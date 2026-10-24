using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Projects;
using PropertyIQ.Application.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IIntelligenceService _intelligenceService;
    private readonly IFileStorageService _fileStorage;
    private readonly IAiServiceClient _aiClient;

    public ProjectsController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IIntelligenceService intelligenceService,
        IFileStorageService fileStorage,
        IAiServiceClient aiClient)
    {
        _context = context;
        _currentUserService = currentUserService;
        _intelligenceService = intelligenceService;
        _fileStorage = fileStorage;
        _aiClient = aiClient;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetProjects(
        [FromQuery] string? city,
        [FromQuery] string? regulatoryAuthority,
        [FromQuery] string? projectType,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.InventoryUnits)
            .Where(p => !p.IsDeleted && !p.IsArchived)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(city))
            query = query.Where(p => p.City.ToLower() == city.ToLower());

        if (!string.IsNullOrWhiteSpace(regulatoryAuthority))
            query = query.Where(p => p.RegulatoryAuthority != null && p.RegulatoryAuthority.ToLower() == regulatoryAuthority.ToLower());

        if (!string.IsNullOrWhiteSpace(projectType))
            query = query.Where(p => p.ProjectType.ToLower() == projectType.ToLower());

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.Description,
                p.ProjectType,
                p.City,
                p.Area,
                p.RegulatoryAuthority,
                p.ApprovalReferenceNumber,
                p.ApprovalStatus,
                DeveloperName = p.DeveloperOrg != null ? p.DeveloperOrg.Name : string.Empty,
                DeveloperVerified = p.DeveloperOrg != null && p.DeveloperOrg.IsVerified,
                TotalUnits = p.InventoryUnits.Count,
                AvailableUnits = p.InventoryUnits.Count(u => u.Status == InventoryStatus.Available),
                StartingPrice = p.InventoryUnits.Any() ? p.InventoryUnits.Min(u => u.BasePrice) : 0m,
                p.LaunchDate,
                p.ExpectedCompletionDate
            })
            .ToListAsync();

        return Ok(new
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetProjectById(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Blocks)
            .Include(p => p.InventoryUnits)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted && !p.IsArchived);

        if (project == null)
        {
            return NotFound(new { message = "Project not found." });
        }

        var plans = await _context.PaymentPlans
            .Where(pl => pl.ProjectId == id && !pl.IsDeleted)
            .ToListAsync();

        return Ok(BuildProjectDetailResponse(project, plans));
    }

    [HttpGet("by-slug/{slug}")]
    public async Task<ActionResult<object>> GetProjectBySlug(string slug)
    {
        var project = await _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Blocks)
            .Include(p => p.InventoryUnits)
            .FirstOrDefaultAsync(p => p.Slug.ToLower() == slug.ToLower() && !p.IsDeleted && !p.IsArchived);

        if (project == null)
        {
            return NotFound(new { message = $"Project with slug '{slug}' not found." });
        }

        var plans = await _context.PaymentPlans
            .Where(pl => pl.ProjectId == project.Id && !pl.IsDeleted)
            .ToListAsync();

        return Ok(BuildProjectDetailResponse(project, plans));
    }

    [HttpGet("{id:guid}/inventory")]
    public async Task<ActionResult<object>> GetProjectInventory(
        Guid id, 
        [FromQuery] InventoryStatus? status,
        [FromQuery] string? unitType,
        [FromQuery] Guid? phaseId,
        [FromQuery] Guid? blockId)
    {
        var query = _context.InventoryUnits
            .Include(u => u.Phase)
            .Include(u => u.Block)
            .Where(u => u.ProjectId == id && !u.IsDeleted)
            .AsNoTracking();

        if (status.HasValue)
            query = query.Where(u => u.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(unitType))
            query = query.Where(u => u.UnitType.ToLower() == unitType.ToLower());

        if (phaseId.HasValue)
            query = query.Where(u => u.PhaseId == phaseId.Value);

        if (blockId.HasValue)
            query = query.Where(u => u.BlockId == blockId.Value);

        var items = await query
            .OrderBy(u => u.UnitNumber)
            .Select(u => new
            {
                u.Id,
                u.UnitNumber,
                u.UnitType,
                u.Size,
                SizeUnit = u.SizeUnit.ToString(),
                u.FloorNumber,
                u.Facing,
                u.BasePrice,
                u.Currency,
                Status = u.Status.ToString(),
                PhaseId = u.PhaseId,
                PhaseName = u.Phase != null ? u.Phase.Name : null,
                BlockId = u.BlockId,
                BlockName = u.Block != null ? u.Block.Name : null
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("developer/dashboard")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperDashboard()
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);

        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
        {
            return BadRequest(new { message = "Developer account is not linked to an organization." });
        }

        var projectsQuery = _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.InventoryUnits.Where(u => !u.IsDeleted))
            .ThenInclude(u => u.Block)
            .Include(p => p.Phases.Where(ph => !ph.IsDeleted))
            .ThenInclude(ph => ph.Blocks.Where(b => !b.IsDeleted))
            .Where(p => !p.IsDeleted);

        if (developerOrgId.HasValue)
            projectsQuery = projectsQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectsQuery.OrderByDescending(p => p.CreatedAtUtc).ToListAsync();
        var allUnits = projects.SelectMany(p => p.InventoryUnits).Where(u => !u.IsDeleted).ToList();
        var projectIds = projects.Select(p => p.Id).ToList();

        var totalProjects = projects.Count;
        var totalUnits = allUnits.Count;
        var availableUnits = allUnits.Count(u => u.Status == InventoryStatus.Available);
        var reservedUnits = allUnits.Count(u => u.Status == InventoryStatus.Reserved);
        var bookedUnits = allUnits.Count(u => u.Status == InventoryStatus.Booked);
        var soldUnits = allUnits.Count(u => u.Status == InventoryStatus.Sold);
        var blockedUnits = allUnits.Count(u => u.Status == InventoryStatus.Blocked);

        var totalValuation = allUnits.Sum(u => u.BasePrice);
        var bookedOrSoldValuation = allUnits
            .Where(u => u.Status == InventoryStatus.Booked || u.Status == InventoryStatus.Sold)
            .Sum(u => u.BasePrice);

        var bookings = projectIds.Count == 0
            ? new List<Booking>()
            : await _context.Bookings
                .Include(b => b.InventoryUnit)
                .Include(b => b.Customer)
                .Include(b => b.ScheduleItems)
                .Where(b => b.InventoryUnit != null &&
                            projectIds.Contains(b.InventoryUnit.ProjectId) &&
                            !b.IsDeleted)
                .OrderByDescending(b => b.BookedAtUtc)
                .Take(25)
                .ToListAsync();

        var allScheduleItems = bookings.SelectMany(b => b.ScheduleItems.Where(s => !s.IsDeleted)).ToList();
        var totalCollections = allScheduleItems
            .Where(s => s.Status == InstallmentStatus.Paid)
            .Sum(s => s.PaidAmount);
        var pendingInstallments = allScheduleItems
            .Where(s => s.Status is InstallmentStatus.Due or InstallmentStatus.Overdue or InstallmentStatus.PartiallyPaid)
            .Sum(s => s.Amount - s.PaidAmount);

        var pendingProofs = projectIds.Count == 0
            ? new List<object>()
            : (await _context.PaymentScheduleItems
                .Include(s => s.Booking)!.ThenInclude(b => b!.InventoryUnit)!.ThenInclude(u => u!.Project)
                .Include(s => s.Booking)!.ThenInclude(b => b!.Customer)
                .Where(s =>
                    !s.IsDeleted &&
                    s.PaymentProofStorageKey != null &&
                    s.PaymentProofStorageKey != "" &&
                    s.Status != InstallmentStatus.Paid &&
                    s.Booking != null &&
                    !s.Booking.IsDeleted &&
                    s.Booking.InventoryUnit != null &&
                    projectIds.Contains(s.Booking.InventoryUnit.ProjectId))
                .OrderByDescending(s => s.UpdatedAtUtc)
                .Take(30)
                .ToListAsync())
                .Select(s => (object)new
                {
                    s.Id,
                    BookingId = s.BookingId,
                    ScheduleItemId = s.Id,
                    UnitNumber = s.Booking!.InventoryUnit!.UnitNumber,
                    ProjectName = s.Booking.InventoryUnit.Project?.Name ?? "Project",
                    ProjectSlug = s.Booking.InventoryUnit.Project?.Slug,
                    CustomerName = s.Booking.Customer?.FullName ?? "Customer",
                    CustomerPhone = s.Booking.Customer?.PhoneNumber,
                    InstallmentTitle = s.Title,
                    Amount = s.Amount,
                    PaidAmount = s.PaidAmount,
                    Currency = s.Currency,
                    DueDate = s.DueDate,
                    Status = s.Status.ToString(),
                    ProofUrl = s.PaymentProofStorageKey,
                    TransactionReference = s.AdjustmentReason
                })
                .ToList();

        var primaryProject = projects.FirstOrDefault();
        var primaryPhase = primaryProject?.Phases.OrderBy(p => p.CreatedAtUtc).FirstOrDefault();
        var primaryBlock = primaryPhase?.Blocks.OrderBy(b => b.CreatedAtUtc).FirstOrDefault();

        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var bookingsThisMonth = projectIds.Count == 0
            ? 0
            : await _context.Bookings.CountAsync(b =>
                !b.IsDeleted &&
                b.Status != BookingStatus.Cancelled &&
                b.BookedAtUtc >= monthStart &&
                b.InventoryUnit != null &&
                projectIds.Contains(b.InventoryUnit.ProjectId));

        var bookedOrSoldUnits = bookedUnits + soldUnits;
        var absorptionRate = totalUnits == 0
            ? 0
            : Math.Round((double)bookedOrSoldUnits / totalUnits * 100, 1);
        var orgName = currentUser.Organization?.Name ?? "Developer Firm";
        var rulesBrief =
            $"{orgName} has {totalProjects} project{(totalProjects == 1 ? "" : "s")} and {totalUnits} inventory unit{(totalUnits == 1 ? "" : "s")} " +
            $"({availableUnits} available, {bookedOrSoldUnits} booked/sold, {absorptionRate:0.#}% absorption). " +
            $"{bookingsThisMonth} booking{(bookingsThisMonth == 1 ? "" : "s")} this month.";
        if (pendingProofs.Count > 0)
            rulesBrief +=
                $" {pendingProofs.Count} payment proof{(pendingProofs.Count == 1 ? "" : "s")} await verification.";

        var briefing = rulesBrief;
        var briefingSource = "rules";
        try
        {
            // Keep developer dashboard snappy — rules brief is enough if Ollama is slow.
            using var polishCts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2.5));
            var polished = await _aiClient.RunAgentOpsAsync(new AgentOpsRequestDto
            {
                Audience = "developer",
                FallbackBrief = rulesBrief,
                Stats = new AgentOpsStatsDto
                {
                    ActiveListings = totalUnits,
                    PendingLeads = availableUnits,
                    TotalLeads = bookingsThisMonth,
                    WeakListingCount = pendingProofs.Count,
                    OrgName = orgName,
                    TotalUnits = totalUnits,
                    AvailableUnits = availableUnits,
                    BookedOrSoldUnits = bookedOrSoldUnits,
                    AbsorptionRatePct = absorptionRate,
                    BookingsThisMonth = bookingsThisMonth,
                    ProjectCount = totalProjects,
                    PendingProofs = pendingProofs.Count
                },
                Alerts = pendingProofs.Count == 0
                    ? new List<AgentOpsAlertInDto>()
                    : new List<AgentOpsAlertInDto>
                    {
                        new()
                        {
                            PropertyId = "ops:pending-proofs",
                            Title = "Payment proofs pending",
                            Issue = $"{pendingProofs.Count} proof(s) awaiting verification",
                            Recommendation = "Review and approve or reject uploaded installment proofs today.",
                            AlertType = "Collections"
                        }
                    }
            }, polishCts.Token);

            if (!string.IsNullOrWhiteSpace(polished.Briefing))
            {
                briefing = polished.Briefing;
                briefingSource = polished.BriefingSource ?? "rules";
            }
        }
        catch
        {
            // Keep rules brief
        }

        return Ok(new
        {
            DeveloperOrganization = orgName,
            OrganizationId = developerOrgId,
            LicenseNumber = currentUser.Organization?.LicenseNumber,
            IsVerified = currentUser.Organization?.IsVerified ?? false,
            DailyAiBriefing = briefing,
            BriefingSource = briefingSource,
            Summary = new
            {
                TotalProjects = totalProjects,
                TotalUnits = totalUnits,
                AvailableUnits = availableUnits,
                ReservedUnits = reservedUnits,
                BookedUnits = bookedUnits,
                SoldUnits = soldUnits,
                BlockedUnits = blockedUnits,
                TotalValuation = totalValuation,
                BookedValuation = bookedOrSoldValuation,
                TotalCollections = totalCollections,
                PendingInstallments = pendingInstallments,
                PendingProofsCount = pendingProofs.Count
            },
            DefaultProject = primaryProject == null ? null : new
            {
                primaryProject.Id,
                primaryProject.Name,
                primaryProject.Slug,
                PhaseId = primaryPhase?.Id,
                PhaseName = primaryPhase?.Name,
                BlockId = primaryBlock?.Id,
                BlockName = primaryBlock?.Name
            },
            Projects = projects.Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.City,
                p.Area,
                p.ApprovalStatus,
                p.RegulatoryAuthority,
                TotalUnits = p.InventoryUnits.Count(u => !u.IsDeleted),
                AvailableUnits = p.InventoryUnits.Count(u => !u.IsDeleted && u.Status == InventoryStatus.Available),
                BookedUnits = p.InventoryUnits.Count(u =>
                    !u.IsDeleted &&
                    (u.Status == InventoryStatus.Booked || u.Status == InventoryStatus.Sold))
            }),
            InventoryUnits = allUnits
                .OrderBy(u => u.UnitNumber)
                .Select(u =>
                {
                    var project = projects.First(p => p.Id == u.ProjectId);
                    return new
                    {
                        u.Id,
                        ProjectId = u.ProjectId,
                        ProjectName = project.Name,
                        ProjectSlug = project.Slug,
                        u.UnitNumber,
                        u.UnitType,
                        u.Size,
                        SizeUnit = u.SizeUnit.ToString(),
                        u.Facing,
                        u.BasePrice,
                        u.Currency,
                        Status = u.Status.ToString(),
                        BlockName = u.Block?.Name
                    };
                }),
            RecentBookings = bookings.Select(b =>
            {
                var nextDue = b.ScheduleItems
                    .Where(s => !s.IsDeleted && s.Status != InstallmentStatus.Paid && s.Status != InstallmentStatus.Waived && s.Status != InstallmentStatus.Cancelled)
                    .OrderBy(s => s.DueDate)
                    .FirstOrDefault();
                return new
                {
                    b.Id,
                    UnitNumber = b.InventoryUnit?.UnitNumber ?? "Unknown",
                    UnitType = b.InventoryUnit?.UnitType ?? "Plot",
                    ProjectName = projects.FirstOrDefault(p => p.Id == b.InventoryUnit!.ProjectId)?.Name,
                    CustomerName = b.Customer?.FullName ?? "Direct Customer",
                    CustomerPhone = b.Customer?.PhoneNumber ?? "N/A",
                    TotalAgreedPrice = b.TotalAgreedPrice,
                    Status = b.Status.ToString(),
                    BookedAtUtc = b.BookedAtUtc,
                    PaidAmount = b.ScheduleItems.Where(s => !s.IsDeleted).Sum(s => s.PaidAmount),
                    TotalScheduleItems = b.ScheduleItems.Count(s => !s.IsDeleted),
                    PaidScheduleItems = b.ScheduleItems.Count(s => !s.IsDeleted && s.Status == InstallmentStatus.Paid),
                    NextDueDate = nextDue?.DueDate,
                    NextDueAmount = nextDue?.Amount,
                    NextDueTitle = nextDue?.Title
                };
            }),
            PendingProofs = pendingProofs
        });
    }

    [HttpGet("developer/projects")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperProjects(
        [FromQuery] string? search = null,
        [FromQuery] bool includeArchived = false)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var query = _context.Projects
            .Include(p => p.InventoryUnits)
            .Include(p => p.Phases)
            .Where(p => !p.IsDeleted);

        if (!includeArchived)
            query = query.Where(p => !p.IsArchived);

        if (developerOrgId.HasValue)
            query = query.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(q) ||
                p.City.ToLower().Contains(q) ||
                p.Area.ToLower().Contains(q) ||
                p.Slug.ToLower().Contains(q));
        }

        var projects = await query
            .OrderBy(p => p.IsArchived)
            .ThenByDescending(p => p.CreatedAtUtc)
            .ToListAsync();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber,
                IsVerified = currentUser.Organization?.IsVerified ?? false
            },
            TotalProjects = projects.Count,
            Projects = projects.Select(p =>
            {
                var units = p.InventoryUnits.Where(u => !u.IsDeleted).ToList();
                return new
                {
                    p.Id,
                    p.Name,
                    p.Slug,
                    p.Description,
                    p.ProjectType,
                    p.Province,
                    p.City,
                    p.Area,
                    p.Address,
                    p.RegulatoryAuthority,
                    p.ApprovalReferenceNumber,
                    p.ApprovalStatus,
                    p.ApprovalDocumentUrl,
                    p.LaunchDate,
                    p.ExpectedCompletionDate,
                    p.IsArchived,
                    p.CreatedAtUtc,
                    PhaseCount = p.Phases.Count(ph => !ph.IsDeleted),
                    TotalUnits = units.Count,
                    AvailableUnits = units.Count(u => u.Status == InventoryStatus.Available),
                    ReservedUnits = units.Count(u => u.Status == InventoryStatus.Reserved),
                    BookedUnits = units.Count(u => u.Status == InventoryStatus.Booked),
                    SoldUnits = units.Count(u => u.Status == InventoryStatus.Sold),
                    BlockedUnits = units.Count(u => u.Status == InventoryStatus.Blocked),
                    StartingPrice = units.Count > 0 ? units.Min(u => u.BasePrice) : 0m,
                    Currency = "PKR"
                };
            })
        });
    }

    [HttpGet("developer/payment-plans")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperPaymentPlans(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectsQuery = _context.Projects.Where(p => !p.IsDeleted && !p.IsArchived);
        if (developerOrgId.HasValue)
            projectsQuery = projectsQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectsQuery
            .OrderBy(p => p.Name)
            .Select(p => new { p.Id, p.Name, p.Slug, p.City })
            .ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var plansQuery = _context.PaymentPlans
            .Include(pl => pl.Project)
            .Where(pl => !pl.IsDeleted && pl.ProjectId.HasValue && projectIds.Contains(pl.ProjectId.Value));

        if (projectId.HasValue)
            plansQuery = plansQuery.Where(pl => pl.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            plansQuery = plansQuery.Where(pl =>
                pl.Name.ToLower().Contains(q) ||
                (pl.Project != null && pl.Project.Name.ToLower().Contains(q)));
        }

        var plans = await plansQuery
            .OrderByDescending(pl => pl.CreatedAtUtc)
            .ToListAsync();

        var planIds = plans.Select(pl => pl.Id).ToList();
        var bookingCounts = await _context.Bookings
            .Where(b => !b.IsDeleted && b.PaymentPlanId.HasValue && planIds.Contains(b.PaymentPlanId.Value))
            .GroupBy(b => b.PaymentPlanId!.Value)
            .Select(g => new { PlanId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PlanId, x => x.Count);

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber,
                IsVerified = currentUser.Organization?.IsVerified ?? false
            },
            Summary = new
            {
                TotalPlans = plans.Count,
                ProjectCount = projects.Count,
                PlansWithBookings = plans.Count(pl => bookingCounts.ContainsKey(pl.Id))
            },
            Projects = projects,
            Plans = plans.Select(pl =>
            {
                bookingCounts.TryGetValue(pl.Id, out var bookingsUsingPlan);
                var installmentPct = 100m - pl.BookingPercentage - pl.DownPaymentPercentage - pl.PossessionPercentage;
                return new
                {
                    pl.Id,
                    ProjectId = pl.ProjectId,
                    ProjectName = pl.Project?.Name ?? "Project",
                    ProjectSlug = pl.Project?.Slug ?? "",
                    pl.Name,
                    pl.TotalPrice,
                    pl.Currency,
                    pl.DurationMonths,
                    Frequency = pl.Frequency.ToString(),
                    pl.BookingPercentage,
                    pl.DownPaymentPercentage,
                    pl.PossessionPercentage,
                    InstallmentPercentage = installmentPct,
                    BookingsUsingPlan = bookingsUsingPlan,
                    pl.CreatedAtUtc,
                    pl.UpdatedAtUtc
                };
            })
        });
    }

    [HttpPost("developer/payment-plans")]
    [Authorize]
    public async Task<ActionResult<object>> CreateDeveloperPaymentPlan([FromBody] CreatePaymentPlanDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        if (dto.ProjectId == Guid.Empty)
            return BadRequest(new { message = "ProjectId is required." });
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Plan name is required." });
        if (dto.TotalPrice <= 0)
            return BadRequest(new { message = "TotalPrice must be greater than zero." });
        if (dto.DurationMonths <= 0)
            return BadRequest(new { message = "DurationMonths must be greater than zero." });

        var milestoneSum = dto.BookingPercentage + dto.DownPaymentPercentage + dto.PossessionPercentage;
        if (milestoneSum <= 0 || milestoneSum > 100)
            return BadRequest(new { message = "Booking + Down Payment + Possession percentages must be between 0 and 100." });

        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == dto.ProjectId && !p.IsDeleted);
        if (project == null)
            return NotFound(new { message = "Project not found." });
        if (developerOrgId.HasValue && project.DeveloperOrgId != developerOrgId.Value)
            return Forbid();

        var plan = new PaymentPlan
        {
            ProjectId = project.Id,
            Name = dto.Name.Trim(),
            TotalPrice = dto.TotalPrice,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "PKR" : dto.Currency.Trim().ToUpperInvariant(),
            DurationMonths = dto.DurationMonths,
            Frequency = dto.Frequency,
            BookingPercentage = dto.BookingPercentage,
            DownPaymentPercentage = dto.DownPaymentPercentage,
            PossessionPercentage = dto.PossessionPercentage,
            CreatedBy = currentUserId
        };

        _context.PaymentPlans.Add(plan);
        await _context.SaveChangesAsync();

        return Created($"/api/projects/developer/payment-plans", new
        {
            plan.Id,
            plan.ProjectId,
            ProjectName = project.Name,
            plan.Name,
            plan.TotalPrice,
            plan.Currency,
            plan.DurationMonths,
            Frequency = plan.Frequency.ToString(),
            plan.BookingPercentage,
            plan.DownPaymentPercentage,
            plan.PossessionPercentage,
            message = "Payment plan created. Customers can select it on the public project page when booking."
        });
    }

    [HttpPut("developer/payment-plans/{planId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateDeveloperPaymentPlan(
        Guid planId,
        [FromBody] UpdatePaymentPlanDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Plan name is required." });
        if (dto.TotalPrice <= 0)
            return BadRequest(new { message = "TotalPrice must be greater than zero." });
        if (dto.DurationMonths <= 0)
            return BadRequest(new { message = "DurationMonths must be greater than zero." });

        var milestoneSum = dto.BookingPercentage + dto.DownPaymentPercentage + dto.PossessionPercentage;
        if (milestoneSum <= 0 || milestoneSum > 100)
            return BadRequest(new { message = "Booking + Down Payment + Possession percentages must be between 0 and 100." });

        var plan = await _context.PaymentPlans
            .Include(pl => pl.Project)
            .FirstOrDefaultAsync(pl => pl.Id == planId && !pl.IsDeleted);
        if (plan == null || plan.Project == null)
            return NotFound(new { message = "Payment plan not found." });
        if (developerOrgId.HasValue && plan.Project.DeveloperOrgId != developerOrgId.Value)
            return Forbid();

        plan.Name = dto.Name.Trim();
        plan.TotalPrice = dto.TotalPrice;
        plan.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "PKR" : dto.Currency.Trim().ToUpperInvariant();
        plan.DurationMonths = dto.DurationMonths;
        plan.Frequency = dto.Frequency;
        plan.BookingPercentage = dto.BookingPercentage;
        plan.DownPaymentPercentage = dto.DownPaymentPercentage;
        plan.PossessionPercentage = dto.PossessionPercentage;
        plan.UpdatedBy = currentUserId;
        plan.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            plan.Id,
            plan.ProjectId,
            ProjectName = plan.Project.Name,
            plan.Name,
            plan.TotalPrice,
            Frequency = plan.Frequency.ToString(),
            message = "Payment plan updated. Existing customer schedules are unchanged; new bookings use the new template."
        });
    }

    [HttpDelete("developer/payment-plans/{planId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeleteDeveloperPaymentPlan(Guid planId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var plan = await _context.PaymentPlans
            .Include(pl => pl.Project)
            .FirstOrDefaultAsync(pl => pl.Id == planId && !pl.IsDeleted);
        if (plan == null || plan.Project == null)
            return NotFound(new { message = "Payment plan not found." });
        if (developerOrgId.HasValue && plan.Project.DeveloperOrgId != developerOrgId.Value)
            return Forbid();

        var hasBookings = await _context.Bookings.AnyAsync(b =>
            !b.IsDeleted && b.PaymentPlanId == planId);
        if (hasBookings)
            return Conflict(new
            {
                message = "This plan is linked to existing bookings. Archive is blocked — create a new plan instead."
            });

        plan.IsDeleted = true;
        plan.UpdatedBy = currentUserId;
        plan.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Payment plan removed.", plan.Id });
    }

    [HttpGet("developer/inventory")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperInventory(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectsQuery = _context.Projects
            .Include(p => p.Phases.Where(ph => !ph.IsDeleted))
            .ThenInclude(ph => ph.Blocks.Where(b => !b.IsDeleted))
            .Where(p => !p.IsDeleted && !p.IsArchived);

        if (developerOrgId.HasValue)
            projectsQuery = projectsQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectsQuery.OrderByDescending(p => p.CreatedAtUtc).ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var unitsQuery = _context.InventoryUnits
            .Include(u => u.Project)
            .Include(u => u.Phase)
            .Include(u => u.Block)
            .Where(u => !u.IsDeleted && projectIds.Contains(u.ProjectId));

        if (projectId.HasValue)
            unitsQuery = unitsQuery.Where(u => u.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<InventoryStatus>(status, ignoreCase: true, out var statusEnum))
        {
            unitsQuery = unitsQuery.Where(u => u.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            unitsQuery = unitsQuery.Where(u =>
                u.UnitNumber.ToLower().Contains(q) ||
                (u.Facing != null && u.Facing.ToLower().Contains(q)) ||
                (u.Block != null && u.Block.Name.ToLower().Contains(q)) ||
                (u.Project != null && u.Project.Name.ToLower().Contains(q)));
        }

        var units = await unitsQuery.OrderBy(u => u.UnitNumber).ToListAsync();

        var firmUnits = await _context.InventoryUnits
            .Where(u => !u.IsDeleted && projectIds.Contains(u.ProjectId))
            .ToListAsync();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber
            },
            Summary = new
            {
                TotalUnits = firmUnits.Count,
                AvailableUnits = firmUnits.Count(u => u.Status == InventoryStatus.Available),
                ReservedUnits = firmUnits.Count(u => u.Status == InventoryStatus.Reserved),
                BookedUnits = firmUnits.Count(u => u.Status == InventoryStatus.Booked),
                SoldUnits = firmUnits.Count(u => u.Status == InventoryStatus.Sold),
                BlockedUnits = firmUnits.Count(u => u.Status == InventoryStatus.Blocked),
                TotalValuation = firmUnits.Sum(u => u.BasePrice),
                FilteredCount = units.Count
            },
            Projects = projects.Select(p =>
            {
                var phase = p.Phases.OrderBy(ph => ph.CreatedAtUtc).FirstOrDefault();
                var block = phase?.Blocks.OrderBy(b => b.CreatedAtUtc).FirstOrDefault();
                return new
                {
                    p.Id,
                    p.Name,
                    p.Slug,
                    p.City,
                    p.Area,
                    PhaseId = phase?.Id,
                    PhaseName = phase?.Name,
                    BlockId = block?.Id,
                    BlockName = block?.Name,
                    Phases = p.Phases.OrderBy(ph => ph.Name).Select(ph => new
                    {
                        ph.Id,
                        ph.Name,
                        Blocks = ph.Blocks.OrderBy(b => b.Name).Select(b => new
                        {
                            b.Id,
                            b.Name,
                            b.BlockType
                        })
                    })
                };
            }),
            Units = units.Select(u => new
            {
                u.Id,
                ProjectId = u.ProjectId,
                ProjectName = u.Project?.Name ?? "Project",
                ProjectSlug = u.Project?.Slug,
                PhaseId = u.PhaseId,
                PhaseName = u.Phase?.Name,
                BlockId = u.BlockId,
                BlockName = u.Block?.Name,
                u.UnitNumber,
                u.UnitType,
                u.Size,
                SizeUnit = u.SizeUnit.ToString(),
                u.FloorNumber,
                u.Facing,
                u.BasePrice,
                u.Currency,
                Status = u.Status.ToString(),
                u.UpdatedAtUtc
            })
        });
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateProject(Guid id, [FromBody] UpdateProjectDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (project == null) return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue || project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        if (!string.IsNullOrWhiteSpace(dto.Name)) project.Name = dto.Name.Trim();
        if (dto.Description != null) project.Description = dto.Description.Trim();
        if (!string.IsNullOrWhiteSpace(dto.ProjectType)) project.ProjectType = dto.ProjectType.Trim();
        if (!string.IsNullOrWhiteSpace(dto.Province)) project.Province = dto.Province.Trim();
        if (!string.IsNullOrWhiteSpace(dto.City)) project.City = dto.City.Trim();
        if (dto.Area != null) project.Area = dto.Area.Trim();
        if (dto.Address != null) project.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
        if (dto.Latitude.HasValue) project.Latitude = dto.Latitude;
        if (dto.Longitude.HasValue) project.Longitude = dto.Longitude;
        if (dto.RegulatoryAuthority != null)
            project.RegulatoryAuthority = string.IsNullOrWhiteSpace(dto.RegulatoryAuthority)
                ? null
                : dto.RegulatoryAuthority.Trim();
        if (dto.ApprovalReferenceNumber != null)
            project.ApprovalReferenceNumber = string.IsNullOrWhiteSpace(dto.ApprovalReferenceNumber)
                ? null
                : dto.ApprovalReferenceNumber.Trim();
        if (!string.IsNullOrWhiteSpace(dto.ApprovalStatus))
            project.ApprovalStatus = dto.ApprovalStatus.Trim();
        if (dto.ApprovalDocumentUrl != null)
            project.ApprovalDocumentUrl = string.IsNullOrWhiteSpace(dto.ApprovalDocumentUrl)
                ? null
                : dto.ApprovalDocumentUrl.Trim();
        if (dto.LaunchDate.HasValue) project.LaunchDate = dto.LaunchDate;
        if (dto.ExpectedCompletionDate.HasValue) project.ExpectedCompletionDate = dto.ExpectedCompletionDate;

        project.UpdatedBy = currentUserId;
        project.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            project.Id,
            project.Name,
            project.Slug,
            project.ApprovalStatus,
            project.ApprovalReferenceNumber,
            project.ApprovalDocumentUrl,
            project.RegulatoryAuthority,
            project.IsArchived,
            message = "Project updated."
        });
    }

    [HttpPut("{id:guid}/archive")]
    [Authorize]
    public async Task<ActionResult<object>> ArchiveProject(Guid id, [FromBody] ArchiveProjectDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (project == null) return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue || project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        project.IsArchived = dto.Archived;
        project.UpdatedBy = currentUserId;
        project.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            project.Id,
            project.Name,
            project.Slug,
            project.IsArchived,
            message = dto.Archived
                ? "Project archived. It is hidden from public and active developer catalogs."
                : "Project restored to active catalogs."
        });
    }

    [HttpGet("developer/structure")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperStructure([FromQuery] Guid? projectId = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var query = _context.Projects
            .Include(p => p.Phases).ThenInclude(ph => ph.Blocks)
            .Include(p => p.InventoryUnits)
            .Where(p => !p.IsDeleted && !p.IsArchived);

        if (developerOrgId.HasValue)
            query = query.Where(p => p.DeveloperOrgId == developerOrgId.Value);
        if (projectId.HasValue)
            query = query.Where(p => p.Id == projectId.Value);

        var projects = await query.OrderBy(p => p.Name).ToListAsync();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm"
            },
            Projects = projects.Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.City,
                p.Area,
                p.ApprovalStatus,
                p.ApprovalReferenceNumber,
                p.RegulatoryAuthority,
                Phases = p.Phases.Where(ph => !ph.IsDeleted).OrderBy(ph => ph.Name).Select(ph => new
                {
                    ph.Id,
                    ph.Name,
                    ph.Description,
                    UnitCount = p.InventoryUnits.Count(u => !u.IsDeleted && u.PhaseId == ph.Id),
                    Blocks = ph.Blocks.Where(b => !b.IsDeleted).OrderBy(b => b.Name).Select(b => new
                    {
                        b.Id,
                        b.Name,
                        b.BlockType,
                        UnitCount = p.InventoryUnits.Count(u => !u.IsDeleted && u.BlockId == b.Id)
                    })
                })
            })
        });
    }

    [HttpGet("developer/noc")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperNocDocuments([FromQuery] Guid? projectId = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectsQuery = _context.Projects.Where(p => !p.IsDeleted && !p.IsArchived);
        if (developerOrgId.HasValue)
            projectsQuery = projectsQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectsQuery
            .OrderBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.City,
                p.ApprovalStatus,
                p.ApprovalReferenceNumber,
                p.RegulatoryAuthority,
                p.ApprovalDocumentUrl
            })
            .ToListAsync();

        var projectIds = projects.Select(p => p.Id).ToList();
        var docsQuery = _context.ProjectNocDocuments
            .Where(d => !d.IsDeleted && projectIds.Contains(d.ProjectId));
        if (projectId.HasValue)
            docsQuery = docsQuery.Where(d => d.ProjectId == projectId.Value);

        var docs = await docsQuery
            .OrderByDescending(d => d.UploadedAtUtc)
            .ToListAsync();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm"
            },
            Projects = projects,
            Documents = docs.Select(d => new
            {
                d.Id,
                d.ProjectId,
                ProjectName = projects.FirstOrDefault(p => p.Id == d.ProjectId)?.Name ?? "Project",
                d.DocumentType,
                d.Title,
                d.FileName,
                d.ContentType,
                d.SizeBytes,
                d.Notes,
                d.UploadedAtUtc,
                DownloadPath = $"/api/projects/{d.ProjectId}/noc/{d.Id}/download"
            }),
            Summary = new
            {
                ProjectCount = projects.Count,
                DocumentCount = docs.Count,
                ApprovedProjects = projects.Count(p =>
                    string.Equals(p.ApprovalStatus, "Approved", StringComparison.OrdinalIgnoreCase))
            }
        });
    }

    [HttpPost("{projectId:guid}/noc")]
    [Authorize]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<object>> UploadNocDocument(
        Guid projectId,
        IFormFile file,
        [FromForm] string documentType = "NOC",
        [FromForm] string? title = null,
        [FromForm] string? notes = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "NOC / approval file is required." });

        var allowed =
            file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ||
            file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ||
            file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        if (!allowed)
            return BadRequest(new { message = "Only PDF or image files are supported." });

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
        if (project == null) return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue || project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        await using var stream = file.OpenReadStream();
        var storageKey = await _fileStorage.UploadFileAsync(
            file.FileName, stream, file.ContentType, isPrivate: true);

        var doc = new ProjectNocDocument
        {
            ProjectId = projectId,
            DocumentType = string.IsNullOrWhiteSpace(documentType) ? "NOC" : documentType.Trim(),
            Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title.Trim(),
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType,
            SizeBytes = file.Length,
            StorageKey = storageKey,
            Notes = notes,
            UploadedByUserId = currentUserId.Value,
            UploadedAtUtc = DateTime.UtcNow,
            CreatedBy = currentUserId
        };

        _context.ProjectNocDocuments.Add(doc);
        project.ApprovalDocumentUrl = $"/api/projects/{projectId}/noc/{doc.Id}/download";
        project.UpdatedAtUtc = DateTime.UtcNow;
        project.UpdatedBy = currentUserId;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            doc.Id,
            doc.ProjectId,
            doc.DocumentType,
            doc.Title,
            doc.FileName,
            doc.SizeBytes,
            DownloadPath = $"/api/projects/{projectId}/noc/{doc.Id}/download",
            message = "NOC document uploaded."
        });
    }

    [HttpGet("{projectId:guid}/noc/{docId:guid}/download")]
    [Authorize]
    public async Task<IActionResult> DownloadNocDocument(Guid projectId, Guid docId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
        if (project == null) return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue || project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        var doc = await _context.ProjectNocDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.ProjectId == projectId && !d.IsDeleted);
        if (doc == null) return NotFound(new { message = "Document not found." });

        var stream = await _fileStorage.GetFileAsync(doc.StorageKey);
        if (stream == null) return NotFound(new { message = "File missing from storage." });

        return File(stream, doc.ContentType, doc.FileName);
    }

    [HttpDelete("{projectId:guid}/noc/{docId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeleteNocDocument(Guid projectId, Guid docId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var project = await _context.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
        if (project == null) return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue || project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        var doc = await _context.ProjectNocDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.ProjectId == projectId && !d.IsDeleted);
        if (doc == null) return NotFound(new { message = "Document not found." });

        doc.IsDeleted = true;
        doc.UpdatedBy = currentUserId;
        doc.UpdatedAtUtc = DateTime.UtcNow;
        await _fileStorage.DeleteFileAsync(doc.StorageKey);
        await _context.SaveChangesAsync();

        return Ok(new { message = "NOC document removed.", doc.Id });
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<object>> CreateProject([FromBody] CreateProjectDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Project name is required." });

        var slug = string.IsNullOrWhiteSpace(dto.Slug)
            ? Slugify(dto.Name)
            : dto.Slug.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(slug))
            return BadRequest(new { message = "Could not derive a valid project slug." });

        var existingSlug = await _context.Projects.AnyAsync(p => p.Slug.ToLower() == slug && !p.IsDeleted);
        if (existingSlug)
            return BadRequest(new { message = $"A project with slug '{slug}' already exists." });

        var project = new Project
        {
            DeveloperOrgId = developerOrgId.Value,
            Name = dto.Name.Trim(),
            Slug = slug,
            Description = dto.Description?.Trim() ?? string.Empty,
            ProjectType = string.IsNullOrWhiteSpace(dto.ProjectType) ? "HousingScheme" : dto.ProjectType.Trim(),
            Province = string.IsNullOrWhiteSpace(dto.Province) ? "Punjab" : dto.Province.Trim(),
            City = string.IsNullOrWhiteSpace(dto.City) ? "Lahore" : dto.City.Trim(),
            Area = dto.Area?.Trim() ?? string.Empty,
            Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim(),
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            RegulatoryAuthority = string.IsNullOrWhiteSpace(dto.RegulatoryAuthority) ? null : dto.RegulatoryAuthority.Trim(),
            ApprovalReferenceNumber = string.IsNullOrWhiteSpace(dto.ApprovalReferenceNumber) ? null : dto.ApprovalReferenceNumber.Trim(),
            ApprovalStatus = string.IsNullOrWhiteSpace(dto.ApprovalStatus) ? "Pending" : dto.ApprovalStatus.Trim(),
            ApprovalDocumentUrl = dto.ApprovalDocumentUrl,
            LaunchDate = dto.LaunchDate ?? DateTime.UtcNow,
            ExpectedCompletionDate = dto.ExpectedCompletionDate
        };

        var phase = new ProjectPhase
        {
            Name = "Phase 1",
            Description = "Initial release phase"
        };
        phase.Blocks.Add(new ProjectBlock
        {
            Name = "Block A",
            BlockType = "Residential"
        });
        project.Phases.Add(phase);

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProjectById), new { id = project.Id }, new
        {
            project.Id,
            project.Name,
            project.Slug,
            PhaseId = phase.Id,
            BlockId = phase.Blocks.First().Id
        });
    }

    private static string Slugify(string value)
    {
        var chars = value.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray();
        var slug = new string(chars);
        while (slug.Contains("--", StringComparison.Ordinal))
            slug = slug.Replace("--", "-", StringComparison.Ordinal);
        return slug.Trim('-');
    }

    [HttpPost("{projectId:guid}/phases")]
    public async Task<ActionResult<object>> AddPhase(Guid projectId, [FromBody] CreatePhaseDto dto)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null || project.IsDeleted)
            return NotFound(new { message = "Project not found." });

        var phase = new ProjectPhase
        {
            ProjectId = projectId,
            Name = dto.Name,
            Description = dto.Description
        };

        _context.ProjectPhases.Add(phase);
        await _context.SaveChangesAsync();

        return Ok(new { phase.Id, phase.ProjectId, phase.Name, phase.Description });
    }

    [HttpPost("phases/{phaseId:guid}/blocks")]
    public async Task<ActionResult<object>> AddBlock(Guid phaseId, [FromBody] CreateBlockDto dto)
    {
        var phase = await _context.ProjectPhases.FindAsync(phaseId);
        if (phase == null || phase.IsDeleted)
            return NotFound(new { message = "Phase not found." });

        var block = new ProjectBlock
        {
            PhaseId = phaseId,
            Name = dto.Name,
            BlockType = dto.BlockType
        };

        _context.ProjectBlocks.Add(block);
        await _context.SaveChangesAsync();

        return Ok(new { block.Id, block.PhaseId, block.Name, block.BlockType });
    }

    [HttpDelete("phases/{phaseId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeletePhase(Guid phaseId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var phase = await _context.ProjectPhases
            .Include(ph => ph.Project)
            .Include(ph => ph.Blocks)
            .FirstOrDefaultAsync(ph => ph.Id == phaseId && !ph.IsDeleted);
        if (phase == null)
            return NotFound(new { message = "Phase not found." });

        if (phase.Project == null || phase.Project.IsDeleted)
            return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue ||
             phase.Project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        var unitCount = await _context.InventoryUnits.CountAsync(u =>
            !u.IsDeleted && u.PhaseId == phaseId);
        if (unitCount > 0)
            return Conflict(new
            {
                message = $"Cannot delete phase with {unitCount} unit(s). Move or delete units first."
            });

        phase.IsDeleted = true;
        phase.UpdatedAtUtc = DateTime.UtcNow;
        foreach (var block in phase.Blocks.Where(b => !b.IsDeleted))
        {
            block.IsDeleted = true;
            block.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(new { phase.Id, message = "Phase removed." });
    }

    [HttpDelete("blocks/{blockId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeleteBlock(Guid blockId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var block = await _context.ProjectBlocks
            .Include(b => b.Phase)!.ThenInclude(ph => ph!.Project)
            .FirstOrDefaultAsync(b => b.Id == blockId && !b.IsDeleted);
        if (block == null)
            return NotFound(new { message = "Block not found." });

        var project = block.Phase?.Project;
        if (project == null || project.IsDeleted)
            return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue ||
             project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        var unitCount = await _context.InventoryUnits.CountAsync(u =>
            !u.IsDeleted && u.BlockId == blockId);
        if (unitCount > 0)
            return Conflict(new
            {
                message = $"Cannot delete block with {unitCount} unit(s). Move or delete units first."
            });

        block.IsDeleted = true;
        block.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { block.Id, message = "Block removed." });
    }

    [HttpPost("{projectId:guid}/units")]
    [Authorize]
    public async Task<ActionResult<object>> AddUnit(Guid projectId, [FromBody] CreateInventoryUnitDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var project = await _context.Projects
            .Include(p => p.Phases.Where(ph => !ph.IsDeleted))
            .ThenInclude(ph => ph.Blocks.Where(b => !b.IsDeleted))
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
        if (project == null)
            return NotFound(new { message = "Project not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            currentUser.OrganizationId.HasValue &&
            project.DeveloperOrgId != currentUser.OrganizationId.Value)
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.UnitNumber))
            return BadRequest(new { message = "UnitNumber is required." });

        var exists = await _context.InventoryUnits.AnyAsync(u =>
            u.ProjectId == projectId &&
            u.UnitNumber.ToLower() == dto.UnitNumber.Trim().ToLower() &&
            !u.IsDeleted);
        if (exists)
            return BadRequest(new { message = $"Unit with number '{dto.UnitNumber}' already exists in this project." });

        var phaseId = dto.PhaseId;
        var blockId = dto.BlockId;
        if (!phaseId.HasValue || !blockId.HasValue)
        {
            var phase = project.Phases.OrderBy(ph => ph.CreatedAtUtc).FirstOrDefault();
            var block = phase?.Blocks.OrderBy(b => b.CreatedAtUtc).FirstOrDefault();
            phaseId ??= phase?.Id;
            blockId ??= block?.Id;
        }

        var unit = new InventoryUnit
        {
            ProjectId = projectId,
            PhaseId = phaseId,
            BlockId = blockId,
            UnitNumber = dto.UnitNumber.Trim(),
            UnitType = string.IsNullOrWhiteSpace(dto.UnitType) ? "Plot" : dto.UnitType.Trim(),
            Size = dto.Size,
            SizeUnit = dto.SizeUnit,
            FloorNumber = dto.FloorNumber,
            Facing = string.IsNullOrWhiteSpace(dto.Facing) ? null : dto.Facing.Trim(),
            BasePrice = dto.BasePrice,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "PKR" : dto.Currency.Trim(),
            Status = InventoryStatus.Available
        };

        _context.InventoryUnits.Add(unit);
        await _context.SaveChangesAsync();

        return Ok(new { unit.Id, unit.ProjectId, unit.UnitNumber, unit.BasePrice, Status = unit.Status.ToString() });
    }

    [HttpPost("{projectId:guid}/units/bulk")]
    public async Task<ActionResult<object>> BulkAddUnits(Guid projectId, [FromBody] BulkCreateInventoryUnitsDto dto)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null || project.IsDeleted)
            return NotFound(new { message = "Project not found." });

        var createdUnits = new List<InventoryUnit>();
        for (int i = 0; i < dto.Count; i++)
        {
            var unitNum = $"{dto.Prefix}{dto.StartNumber + i}";
            var unit = new InventoryUnit
            {
                ProjectId = projectId,
                PhaseId = dto.PhaseId,
                BlockId = dto.BlockId,
                UnitNumber = unitNum,
                UnitType = dto.UnitType,
                Size = dto.Size,
                SizeUnit = dto.SizeUnit,
                Facing = dto.Facing,
                BasePrice = dto.BasePrice,
                Currency = "PKR",
                Status = InventoryStatus.Available
            };
            createdUnits.Add(unit);
        }

        _context.InventoryUnits.AddRange(createdUnits);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = $"Successfully created {createdUnits.Count} inventory units.",
            Count = createdUnits.Count,
            Units = createdUnits.Select(u => new { u.Id, u.UnitNumber, u.BasePrice, Status = u.Status.ToString() })
        });
    }

    [HttpPut("units/{unitId:guid}/status")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateUnitStatus(Guid unitId, [FromBody] UpdateInventoryUnitStatusDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var unit = await _context.InventoryUnits
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == unitId && !u.IsDeleted);
        if (unit == null)
            return NotFound(new { message = "Inventory unit not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            currentUser.OrganizationId.HasValue &&
            unit.Project != null &&
            unit.Project.DeveloperOrgId != currentUser.OrganizationId.Value)
        {
            return Forbid();
        }

        var oldStatus = unit.Status;
        unit.Status = dto.Status;

        // Record Audit Log
        var audit = new AuditLog
        {
            EntityName = nameof(InventoryUnit),
            EntityId = unit.Id.ToString(),
            Action = "StatusChange",
            OldValuesJson = oldStatus.ToString(),
            NewValuesJson = dto.Status.ToString(),
            Reason = dto.Reason ?? $"Status changed from {oldStatus} to {dto.Status}",
            ActorUserId = _currentUserService.UserId
        };

        _context.AuditLogs.Add(audit);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            unit.Id,
            unit.UnitNumber,
            PreviousStatus = oldStatus.ToString(),
            NewStatus = unit.Status.ToString(),
            unit.UpdatedAtUtc
        });
    }

    [HttpDelete("units/{unitId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeleteUnit(Guid unitId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var unit = await _context.InventoryUnits
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == unitId && !u.IsDeleted);
        if (unit == null)
            return NotFound(new { message = "Inventory unit not found." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            currentUser.OrganizationId.HasValue &&
            unit.Project != null &&
            unit.Project.DeveloperOrgId != currentUser.OrganizationId.Value)
        {
            return Forbid();
        }

        if (unit.Status != InventoryStatus.Available)
            return Conflict(new
            {
                message = $"Only Available units can be deleted (current: {unit.Status})."
            });

        var hasBookingHistory = await _context.Bookings.AnyAsync(b =>
            b.InventoryUnitId == unitId && !b.IsDeleted);
        if (hasBookingHistory)
            return Conflict(new
            {
                message = "Cannot delete a unit with booking history. Change status or cancel bookings first."
            });

        unit.IsDeleted = true;
        unit.UpdatedBy = currentUserId;
        unit.UpdatedAtUtc = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(InventoryUnit),
            EntityId = unit.Id.ToString(),
            Action = "SoftDelete",
            OldValuesJson = unit.UnitNumber,
            NewValuesJson = "Deleted",
            Reason = "Unit soft-deleted from developer inventory",
            ActorUserId = currentUserId
        });

        await _context.SaveChangesAsync();
        return Ok(new { unit.Id, unit.UnitNumber, message = "Unit removed." });
    }

    private static object BuildProjectDetailResponse(Project project, List<PaymentPlan> plans)
    {
        return new
        {
            project.Id,
            project.Name,
            project.Slug,
            project.Description,
            project.ProjectType,
            project.Province,
            project.City,
            project.Area,
            project.Address,
            project.Latitude,
            project.Longitude,
            project.RegulatoryAuthority,
            project.ApprovalReferenceNumber,
            project.ApprovalStatus,
            project.ApprovalDocumentUrl,
            project.LaunchDate,
            project.ExpectedCompletionDate,
            Developer = project.DeveloperOrg != null ? new
            {
                project.DeveloperOrg.Id,
                project.DeveloperOrg.Name,
                project.DeveloperOrg.LicenseNumber,
                project.DeveloperOrg.IsVerified,
                project.DeveloperOrg.ContactEmail,
                project.DeveloperOrg.ContactPhone
            } : null,
            Phases = project.Phases.Select(ph => new
            {
                ph.Id,
                ph.Name,
                ph.Description,
                Blocks = ph.Blocks.Select(b => new { b.Id, b.Name, b.BlockType })
            }),
            PaymentPlans = plans.Select(pl => new
            {
                pl.Id,
                pl.Name,
                pl.TotalPrice,
                pl.Currency,
                pl.DurationMonths,
                Frequency = pl.Frequency.ToString(),
                pl.BookingPercentage,
                pl.DownPaymentPercentage,
                pl.PossessionPercentage
            }),
            InventorySummary = new
            {
                Total = project.InventoryUnits.Count,
                Available = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Available),
                Reserved = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Reserved),
                Booked = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Booked),
                Sold = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Sold),
                Blocked = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Blocked)
            }
        };
    }

    [HttpGet("developer/sales-team")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperSalesTeam(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? channel = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectQuery = _context.Projects.Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new { p.Id, p.Name, p.Slug, p.City, p.Area })
            .ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var internalRoles = new[] { UserRole.Developer, UserRole.Finance };
        var repsQuery = _context.Users
            .Where(u =>
                !u.IsDeleted &&
                developerOrgId.HasValue &&
                u.OrganizationId == developerOrgId.Value &&
                internalRoles.Contains(u.Role));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            repsQuery = repsQuery.Where(u =>
                u.FullName.ToLower().Contains(q) ||
                u.Email.ToLower().Contains(q) ||
                u.PhoneNumber.ToLower().Contains(q));
        }

        var reps = await repsQuery
            .OrderByDescending(u => u.IsActive)
            .ThenBy(u => u.FullName)
            .ToListAsync();

        var repIds = reps.Select(r => r.Id).ToList();
        var inquiries = repIds.Count == 0
            ? new List<Inquiry>()
            : await _context.Inquiries
                .Where(i =>
                    !i.IsDeleted &&
                    i.TargetAgentOrDeveloperId.HasValue &&
                    repIds.Contains(i.TargetAgentOrDeveloperId.Value))
                .ToListAsync();

        var leadsByRep = inquiries
            .GroupBy(i => i.TargetAgentOrDeveloperId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var internalSales = reps.Select(r =>
        {
            leadsByRep.TryGetValue(r.Id, out var leads);
            leads ??= new List<Inquiry>();
            return new
            {
                UserId = r.Id,
                r.FullName,
                r.Email,
                PhoneNumber = r.PhoneNumber,
                Role = r.Role.ToString(),
                r.IsActive,
                AssignedLeadsCount = leads.Count,
                PendingLeadsCount = leads.Count(l => l.Status == InquiryStatus.New),
                r.CreatedAtUtc,
                Channel = "Internal"
            };
        }).ToList();

        var mandatesQuery = _context.AgencyProjectMandates
            .Include(m => m.AgencyOrg)
            .Include(m => m.Project)
            .Where(m =>
                !m.IsDeleted &&
                projectIds.Contains(m.ProjectId));

        if (projectId.HasValue)
            mandatesQuery = mandatesQuery.Where(m => m.ProjectId == projectId.Value);

        var mandates = await mandatesQuery
            .OrderByDescending(m => m.CreatedAtUtc)
            .ToListAsync();

        var agencyOrgIds = mandates.Select(m => m.AgencyOrgId).Distinct().ToList();
        var brokersByAgency = agencyOrgIds.Count == 0
            ? new Dictionary<Guid, int>()
            : await _context.Users
                .Where(u =>
                    !u.IsDeleted &&
                    u.OrganizationId.HasValue &&
                    agencyOrgIds.Contains(u.OrganizationId.Value) &&
                    u.Role == UserRole.Agent)
                .GroupBy(u => u.OrganizationId!.Value)
                .Select(g => new { OrgId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.OrgId, x => x.Count);

        var externalChannels = mandates.Select(m =>
        {
            brokersByAgency.TryGetValue(m.AgencyOrgId, out var brokerCount);
            return new
            {
                MandateId = m.Id,
                m.AgencyOrgId,
                AgencyName = m.AgencyOrg?.Name ?? "Agency",
                AgencyLicense = m.AgencyOrg?.LicenseNumber,
                AgencyCity = m.AgencyOrg?.City ?? "",
                AgencyVerified = m.AgencyOrg?.IsVerified ?? false,
                AgencyContactEmail = m.AgencyOrg?.ContactEmail,
                AgencyContactPhone = m.AgencyOrg?.ContactPhone,
                BrokerCount = brokerCount,
                ProjectId = m.ProjectId,
                ProjectName = m.Project?.Name ?? "Project",
                ProjectSlug = m.Project?.Slug,
                m.IsExclusive,
                Status = m.Status.ToString(),
                m.CommissionPercent,
                m.StartDateUtc,
                m.EndDateUtc,
                m.Notes,
                m.CreatedAtUtc,
                Channel = "External"
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            externalChannels = externalChannels
                .Where(c =>
                    c.AgencyName.ToLower().Contains(q) ||
                    (c.AgencyLicense != null && c.AgencyLicense.ToLower().Contains(q)) ||
                    c.ProjectName.ToLower().Contains(q))
                .ToList();
        }

        var channelKey = (channel ?? "all").Trim().ToLowerInvariant();
        var showInternal = channelKey is "all" or "internal" or "reps";
        var showExternal = channelKey is "all" or "external" or "brokers" or "mandates";

        var agencies = await _context.Organizations
            .Where(o => !o.IsDeleted && o.Type == OrganizationType.Agency)
            .OrderBy(o => o.Name)
            .Select(o => new
            {
                o.Id,
                o.Name,
                o.LicenseNumber,
                o.City,
                o.IsVerified
            })
            .Take(50)
            .ToListAsync();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber
            },
            Summary = new
            {
                InternalRepsCount = internalSales.Count,
                ActiveInternalRepsCount = internalSales.Count(r => r.IsActive),
                ExternalMandatesCount = mandates.Count,
                ActiveMandatesCount = mandates.Count(m => m.Status == AgencyMandateStatus.Active),
                AffiliatedAgenciesCount = agencyOrgIds.Count,
                TotalAssignedLeads = internalSales.Sum(r => r.AssignedLeadsCount)
            },
            Projects = projects,
            Agencies = agencies,
            InternalSales = showInternal ? (object)internalSales : Array.Empty<object>(),
            ExternalChannels = showExternal ? (object)externalChannels : Array.Empty<object>()
        });
    }

    [HttpGet("developer/demand-intelligence")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperDemandIntelligence(
        [FromQuery] string? city = null,
        [FromQuery] string? area = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectQuery = _context.Projects
            .Include(p => p.InventoryUnits.Where(u => !u.IsDeleted))
            .Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery.OrderByDescending(p => p.CreatedAtUtc).ToListAsync();
        var primary = projects.FirstOrDefault();

        var targetCity = !string.IsNullOrWhiteSpace(city)
            ? city.Trim()
            : (primary?.City ?? "Lahore");
        var targetArea = !string.IsNullOrWhiteSpace(area)
            ? area.Trim()
            : (primary?.Area ?? "Raiwind Road");

        var cityProjects = projects
            .Where(p => p.City.Equals(targetCity, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (cityProjects.Count == 0) cityProjects = projects;

        var units = cityProjects.SelectMany(p => p.InventoryUnits.Where(u => !u.IsDeleted)).ToList();
        var projectIds = cityProjects.Select(p => p.Id).ToList();

        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var bookings = projectIds.Count == 0
            ? new List<Booking>()
            : await _context.Bookings
                .Include(b => b.InventoryUnit)
                .Include(b => b.Customer)
                .Include(b => b.ScheduleItems)
                .Where(b =>
                    !b.IsDeleted &&
                    b.InventoryUnit != null &&
                    projectIds.Contains(b.InventoryUnit.ProjectId) &&
                    b.Status != BookingStatus.Cancelled)
                .ToListAsync();

        var bookingsThisMonth = bookings.Count(b => b.BookedAtUtc >= monthStart);
        var prevMonthStart = monthStart.AddMonths(-1);
        var bookingsPrevMonth = bookings.Count(b =>
            b.BookedAtUtc >= prevMonthStart && b.BookedAtUtc < monthStart);
        var availableUnits = units.Count(u => u.Status == InventoryStatus.Available);
        var bookedOrSold = units.Count(u =>
            u.Status is InventoryStatus.Booked or InventoryStatus.Sold);
        var absorptionRate = units.Count == 0
            ? 0
            : Math.Round((double)bookedOrSold / units.Count * 100, 1);

        var inventoryByType = units
            .GroupBy(u => $"{u.Size:0.##} {u.SizeUnit} {u.UnitType}")
            .Select(g => new
            {
                Label = g.Key,
                Total = g.Count(),
                Available = g.Count(u => u.Status == InventoryStatus.Available),
                BookedOrSold = g.Count(u =>
                    u.Status is InventoryStatus.Booked or InventoryStatus.Sold),
                StartingPrice = g.Min(u => u.BasePrice)
            })
            .OrderByDescending(x => x.Available)
            .Take(8)
            .ToList();

        var installmentPlanCount = bookings.Count(b =>
            b.ScheduleItems.Count(s => !s.IsDeleted) > 1);
        var cashOnlyCount = bookings.Count(b =>
            b.ScheduleItems.Count(s => !s.IsDeleted) <= 1);
        var installmentShare = bookings.Count == 0
            ? 0
            : Math.Round((double)installmentPlanCount / bookings.Count * 100, 1);
        var installmentConversionLift = bookings.Count == 0
            ? 1.0
            : cashOnlyCount == 0
                ? (installmentPlanCount > 0 ? 2.0 : 1.0)
                : Math.Round(Math.Max(1.0, (double)installmentPlanCount / cashOnlyCount), 1);

        var diasporaCount = bookings.Count(b => LooksLikeDiasporaCustomer(b.Customer));
        var diasporaShare = bookings.Count == 0
            ? 0
            : Math.Round((double)diasporaCount / bookings.Count * 100, 0);

        var pinProject = cityProjects.FirstOrDefault(p =>
            p.Area.Equals(targetArea, StringComparison.OrdinalIgnoreCase) &&
            p.Latitude.HasValue &&
            p.Longitude.HasValue)
            ?? cityProjects.FirstOrDefault(p => p.Latitude.HasValue && p.Longitude.HasValue)
            ?? cityProjects.FirstOrDefault();

        var radar = await _intelligenceService.GetDeveloperDemandRadarAsync(targetCity, developerOrgId);
        var gaps = await _intelligenceService.GetDemandGapsAsync(targetCity, developerOrgId);
        var neighborhood = await _intelligenceService.GetNeighborhoodIntelligenceAsync(
            targetCity,
            targetArea,
            pinProject?.Latitude,
            pinProject?.Longitude);

        var orgName = currentUser.Organization?.Name ?? "Developer Firm";
        var pendingProofsCount = projectIds.Count == 0
            ? 0
            : await _context.PaymentScheduleItems.CountAsync(s =>
                !s.IsDeleted &&
                s.PaymentProofStorageKey != null &&
                s.PaymentProofStorageKey != "" &&
                s.Status != InstallmentStatus.Paid &&
                s.Booking != null &&
                !s.Booking.IsDeleted &&
                s.Booking.InventoryUnit != null &&
                projectIds.Contains(s.Booking.InventoryUnit.ProjectId));

        var rulesBrief =
            $"{orgName} has {cityProjects.Count} project{(cityProjects.Count == 1 ? "" : "s")} and {units.Count} inventory unit{(units.Count == 1 ? "" : "s")} " +
            $"({availableUnits} available, {bookedOrSold} booked/sold, {absorptionRate:0.#}% absorption). " +
            $"{bookingsThisMonth} booking{(bookingsThisMonth == 1 ? "" : "s")} this month.";
        if (pendingProofsCount > 0)
            rulesBrief +=
                $" {pendingProofsCount} payment proof{(pendingProofsCount == 1 ? "" : "s")} await verification.";
        if (gaps.Count > 0)
        {
            var g0 = gaps[0];
            rulesBrief +=
                $" Priority gap: {g0.SizeCategory} {g0.PropertyType} in {g0.Area} ({g0.GapLevel}).";
        }

        var briefing = rulesBrief;
        var briefingSource = "rules";

        // Best-effort Ollama polish of daily brief + gap recommendations over locked live stats.
        try
        {
            using var polishCts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(12));
            var polished = await _aiClient.RunAgentOpsAsync(new AgentOpsRequestDto
            {
                Audience = "developer",
                FallbackBrief = rulesBrief,
                Stats = new AgentOpsStatsDto
                {
                    ActiveListings = units.Count,
                    PendingLeads = availableUnits,
                    TotalLeads = bookingsThisMonth,
                    WeakListingCount = gaps.Count,
                    OrgName = orgName,
                    TotalUnits = units.Count,
                    AvailableUnits = availableUnits,
                    BookedOrSoldUnits = bookedOrSold,
                    AbsorptionRatePct = absorptionRate,
                    BookingsThisMonth = bookingsThisMonth,
                    ProjectCount = cityProjects.Count,
                    PendingProofs = pendingProofsCount
                },
                Alerts = gaps.Select((g, i) => new AgentOpsAlertInDto
                {
                    PropertyId = $"gap:{i}:{g.City}|{g.Area}|{g.PropertyType}|{g.SizeCategory}",
                    Title = $"{g.SizeCategory} {g.PropertyType} · {g.Area}",
                    Issue = $"{g.GapLevel} · supply {g.ActiveSupplyCount} · demand {g.MonthlySearchVolume}",
                    Recommendation = g.RecommendedAction,
                    AlertType = g.GapLevel,
                    City = g.City,
                    Area = g.Area,
                    AskingPrice = g.MedianSearchBudget
                }).ToList()
            }, polishCts.Token);

            if (!string.IsNullOrWhiteSpace(polished.Briefing))
            {
                briefing = polished.Briefing;
                briefingSource = polished.BriefingSource ?? "rules";
            }

            var recMap = polished.Recommendations
                .Where(r => !string.IsNullOrWhiteSpace(r.PropertyId))
                .GroupBy(r => r.PropertyId, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Last(), StringComparer.OrdinalIgnoreCase);

            for (var i = 0; i < gaps.Count; i++)
            {
                var key = $"gap:{i}:{gaps[i].City}|{gaps[i].Area}|{gaps[i].PropertyType}|{gaps[i].SizeCategory}";
                if (recMap.TryGetValue(key, out var rec) && !string.IsNullOrWhiteSpace(rec.Recommendation))
                {
                    gaps[i].RecommendedAction = rec.Recommendation;
                    gaps[i].RecommendationSource = rec.Source ?? "rules";
                }
            }
        }
        catch
        {
            // Keep rules brief / recommendations
        }

        var topGap = gaps
            .OrderByDescending(g => g.DemandSupplyRatio)
            .FirstOrDefault();

        double plotSearchSurge;
        string surgeBasis;
        if (bookingsPrevMonth > 0)
        {
            plotSearchSurge = Math.Round(
                Math.Clamp(((double)bookingsThisMonth - bookingsPrevMonth) / bookingsPrevMonth * 100, -80, 150),
                0);
            surgeBasis = "mom_bookings";
        }
        else if (bookingsThisMonth > 0)
        {
            plotSearchSurge = Math.Min(60, bookingsThisMonth * 12);
            surgeBasis = "mtd_bookings";
        }
        else if (topGap != null && topGap.DemandSupplyRatio > 0)
        {
            plotSearchSurge = Math.Round(Math.Min(48, Math.Max(0, topGap.DemandSupplyRatio * 4.5)), 0);
            surgeBasis = "gap_proxy";
        }
        else
        {
            plotSearchSurge = 0;
            surgeBasis = "none";
        }

        var pulseTakeaway =
            $"MTD {bookingsThisMonth} booking{(bookingsThisMonth == 1 ? "" : "s")} vs {bookingsPrevMonth} last month " +
            $"({(plotSearchSurge >= 0 ? "+" : "")}{plotSearchSurge}% · {surgeBasis}). " +
            $"Installment plans on {installmentShare}% of bookings ({installmentConversionLift}x vs cash-only). " +
            $"Diaspora phone/email heuristics: {diasporaShare}% ({diasporaCount}/{bookings.Count}). " +
            (string.IsNullOrWhiteSpace(radar.KeyTakeaway) ? "" : radar.KeyTakeaway);

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = orgName,
                LicenseNumber = currentUser.Organization?.LicenseNumber
            },
            Catchment = new
            {
                City = targetCity,
                Area = targetArea,
                ProjectCount = cityProjects.Count,
                PrimaryProjectName = cityProjects.FirstOrDefault()?.Name,
                PrimaryProjectSlug = cityProjects.FirstOrDefault()?.Slug
            },
            Cities = projects.Select(p => p.City).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(c => c).ToList(),
            Areas = projects
                .Where(p => p.City.Equals(targetCity, StringComparison.OrdinalIgnoreCase))
                .Select(p => p.Area)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(a => a)
                .ToList(),
            DailyAiBriefing = briefing,
            BriefingSource = briefingSource,
            Pulse = new
            {
                PlotSearchSurgePct = plotSearchSurge,
                SurgeBasis = surgeBasis,
                BookingsThisMonth = bookingsThisMonth,
                BookingsPrevMonth = bookingsPrevMonth,
                InstallmentConversionLift = installmentConversionLift,
                DiasporaInquirySharePct = diasporaShare,
                DiasporaBookingCount = diasporaCount,
                PreferredInstallmentMonths = radar.PreferredInstallmentDurationMonths,
                KeyTakeaway = pulseTakeaway.Trim(),
                SignalSource = "live_bookings"
            },
            FirmSignals = new
            {
                TotalUnits = units.Count,
                AvailableUnits = availableUnits,
                BookedOrSoldUnits = bookedOrSold,
                AbsorptionRatePct = absorptionRate,
                BookingsThisMonth = bookingsThisMonth,
                TotalActiveBookings = bookings.Count,
                InstallmentBookingSharePct = installmentShare,
                InventoryByType = inventoryByType
            },
            Radar = radar,
            DemandGaps = gaps,
            Neighborhood = neighborhood
        });
    }

    /// <summary>
    /// Heuristic diaspora buyer signal from phone country codes / non-.pk emails.
    /// Not a KYC nationality field — labeled as such in the UI.
    /// </summary>
    private static bool LooksLikeDiasporaCustomer(User? customer)
    {
        if (customer == null) return false;

        var phone = (customer.PhoneNumber ?? string.Empty)
            .Replace(" ", string.Empty)
            .Replace("-", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty);

        if (phone.StartsWith("+", StringComparison.Ordinal) || phone.StartsWith("00", StringComparison.Ordinal))
        {
            var isPk = phone.StartsWith("+92", StringComparison.Ordinal) ||
                       phone.StartsWith("0092", StringComparison.Ordinal);
            if (!isPk) return true;
        }

        var email = (customer.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (email.Contains('@'))
        {
            var domain = email.Split('@')[^1];
            if (domain.EndsWith(".pk", StringComparison.Ordinal)) return false;
            if (domain.EndsWith(".uk", StringComparison.Ordinal) ||
                domain.EndsWith(".ae", StringComparison.Ordinal) ||
                domain.EndsWith(".sa", StringComparison.Ordinal) ||
                domain.EndsWith(".au", StringComparison.Ordinal) ||
                domain.EndsWith(".ca", StringComparison.Ordinal) ||
                domain.EndsWith(".de", StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    [HttpGet("developer/reports/summary")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperReportSummary(
        [FromQuery] string period = "month",
        [FromQuery] Guid? projectId = null)
    {
        var built = await BuildDeveloperReportAsync(period, projectId);
        if (built.Result != null) return built.Result;
        return Ok(built.Value);
    }

    [HttpGet("developer/reports/export.csv")]
    [Authorize]
    public async Task<IActionResult> ExportDeveloperReportCsv(
        [FromQuery] string period = "month",
        [FromQuery] Guid? projectId = null)
    {
        var built = await BuildDeveloperReportAsync(period, projectId);
        if (built.Result != null) return built.Result!;

        var json = System.Text.Json.JsonSerializer.Serialize(built.Value);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Section,Metric,Value");

        void Row(string section, string metric, string? value) =>
            sb.AppendLine($"{CsvEscape(section)},{CsvEscape(metric)},{CsvEscape(value)}");

        string Get(System.Text.Json.JsonElement el, string name) =>
            el.TryGetProperty(name, out var p) ? p.ToString() : "";

        var org = root.GetProperty("Organization");
        Row("Firm", "Organization", Get(org, "Name"));
        Row("Firm", "Period", Get(root, "PeriodLabel"));
        Row("Firm", "FromUtc", Get(root, "FromUtc"));
        Row("Firm", "ToUtc", Get(root, "ToUtc"));
        Row("Firm", "GeneratedAtUtc", Get(root, "GeneratedAtUtc"));

        var collections = root.GetProperty("Collections");
        Row("Collections", "TotalCollected", Get(collections, "TotalCollected"));
        Row("Collections", "Outstanding", Get(collections, "OutstandingAmount"));
        Row("Collections", "Overdue", Get(collections, "OverdueAmount"));
        Row("Collections", "CollectedInPeriod", Get(collections, "CollectedInPeriod"));
        Row("Collections", "RecoveryRatePct", Get(collections, "RecoveryRatePct"));
        Row("Collections", "PendingProofs", Get(collections, "PendingProofCount"));

        var inventory = root.GetProperty("Inventory");
        Row("Inventory", "TotalUnits", Get(inventory, "TotalUnits"));
        Row("Inventory", "Available", Get(inventory, "AvailableUnits"));
        Row("Inventory", "Booked", Get(inventory, "BookedUnits"));
        Row("Inventory", "Sold", Get(inventory, "SoldUnits"));
        Row("Inventory", "Valuation", Get(inventory, "TotalValuation"));

        var bookings = root.GetProperty("Bookings");
        Row("Bookings", "Active", Get(bookings, "ActiveCount"));
        Row("Bookings", "NewInPeriod", Get(bookings, "NewInPeriod"));
        Row("Bookings", "AgreedValue", Get(bookings, "TotalAgreedValue"));

        var regulatory = root.GetProperty("Regulatory");
        Row("Regulatory", "ApprovedProjects", Get(regulatory, "ApprovedCount"));
        Row("Regulatory", "UnderProcess", Get(regulatory, "UnderProcessCount"));
        Row("Regulatory", "Unapproved", Get(regulatory, "UnapprovedCount"));

        if (root.TryGetProperty("ProjectBreakdown", out var projectsEl) &&
            projectsEl.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var p in projectsEl.EnumerateArray())
            {
                Row("Project", Get(p, "Name"),
                    $"units={Get(p, "TotalUnits")};collected={Get(p, "Collected")};outstanding={Get(p, "Outstanding")};approval={Get(p, "ApprovalStatus")}");
            }
        }

        if (root.TryGetProperty("RecentAudits", out var auditsEl) &&
            auditsEl.ValueKind == System.Text.Json.JsonValueKind.Array)
        {
            foreach (var a in auditsEl.EnumerateArray())
            {
                Row("Audit", Get(a, "Action"),
                    $"{Get(a, "EntityName")}:{Get(a, "EntityId")};{Get(a, "Reason")}");
            }
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        var periodKey = Get(root, "Period");
        if (string.IsNullOrWhiteSpace(periodKey)) periodKey = period;
        var fileName = $"developer-report-{periodKey}-{DateTime.UtcNow:yyyyMMddHHmm}.csv";
        return File(bytes, "text/csv", fileName);
    }

    private async Task<(ActionResult? Result, object? Value)> BuildDeveloperReportAsync(
        string? period,
        Guid? projectId)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return (Unauthorized(), null);

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return (Unauthorized(), null);

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return (BadRequest(new { message = "Developer account is not linked to an organization." }), null);

        var (periodKey, periodLabel, fromUtc, toUtc) = ResolveDeveloperReportPeriod(period);
        var today = DateTime.UtcNow.Date;

        var projectQuery = _context.Projects
            .Include(p => p.InventoryUnits.Where(u => !u.IsDeleted))
            .Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery.OrderByDescending(p => p.CreatedAtUtc).ToListAsync();
        var projectOptions = projects
            .Select(p => new { p.Id, p.Name, p.Slug, p.City, p.Area })
            .ToList();

        if (projectId.HasValue)
            projects = projects.Where(p => p.Id == projectId.Value).ToList();

        var projectIds = projects.Select(p => p.Id).ToList();
        var units = projects.SelectMany(p => p.InventoryUnits.Where(u => !u.IsDeleted)).ToList();

        var bookings = projectIds.Count == 0
            ? new List<Booking>()
            : await _context.Bookings
                .Include(b => b.InventoryUnit)
                .Include(b => b.Customer)
                .Include(b => b.ScheduleItems)
                .Where(b =>
                    !b.IsDeleted &&
                    b.InventoryUnit != null &&
                    projectIds.Contains(b.InventoryUnit.ProjectId) &&
                    b.Status != BookingStatus.Cancelled)
                .AsNoTracking()
                .ToListAsync();

        var allItems = bookings
            .SelectMany(b => b.ScheduleItems.Where(s => !s.IsDeleted))
            .ToList();

        var paidItems = allItems.Where(s => s.Status == InstallmentStatus.Paid).ToList();
        var openItems = allItems.Where(s =>
            s.Status != InstallmentStatus.Paid &&
            s.Status != InstallmentStatus.Waived &&
            s.Status != InstallmentStatus.Cancelled).ToList();

        var overdueItems = openItems.Where(s =>
            s.Status == InstallmentStatus.Overdue ||
            (s.DueDate.Date < today && s.PaidAmount < s.Amount)).ToList();

        var collectedInPeriod = paidItems
            .Where(s => s.PaidAtUtc.HasValue &&
                        s.PaidAtUtc.Value <= toUtc &&
                        (!fromUtc.HasValue || s.PaidAtUtc.Value >= fromUtc.Value))
            .Sum(s => s.PaidAmount);

        var totalCollected = paidItems.Sum(s => s.PaidAmount);
        var outstanding = openItems.Sum(s => s.Amount - s.PaidAmount);
        var overdueAmount = overdueItems.Sum(s => s.Amount - s.PaidAmount);
        var scheduledTotal = allItems
            .Where(s => s.Status != InstallmentStatus.Waived && s.Status != InstallmentStatus.Cancelled)
            .Sum(s => s.Amount);
        var recoveryRate = scheduledTotal <= 0
            ? 0
            : Math.Round((double)(totalCollected / scheduledTotal) * 100, 1);

        var pendingProofs = allItems.Count(s =>
            !string.IsNullOrWhiteSpace(s.PaymentProofStorageKey) &&
            s.Status != InstallmentStatus.Paid);

        var newBookingsInPeriod = bookings.Count(b =>
            b.BookedAtUtc <= toUtc &&
            (!fromUtc.HasValue || b.BookedAtUtc >= fromUtc.Value));

        var approved = projects.Count(p =>
            p.ApprovalStatus.Equals("Approved", StringComparison.OrdinalIgnoreCase));
        var underProcess = projects.Count(p =>
            p.ApprovalStatus.Equals("UnderProcess", StringComparison.OrdinalIgnoreCase) ||
            p.ApprovalStatus.Equals("Under Process", StringComparison.OrdinalIgnoreCase));
        var unapproved = projects.Count - approved - underProcess;

        var projectBreakdown = projects.Select(p =>
        {
            var pUnits = p.InventoryUnits.Where(u => !u.IsDeleted).ToList();
            var pBookings = bookings.Where(b => b.InventoryUnit?.ProjectId == p.Id).ToList();
            var pItems = pBookings.SelectMany(b => b.ScheduleItems.Where(s => !s.IsDeleted)).ToList();
            var collected = pItems.Where(s => s.Status == InstallmentStatus.Paid).Sum(s => s.PaidAmount);
            var open = pItems.Where(s =>
                s.Status != InstallmentStatus.Paid &&
                s.Status != InstallmentStatus.Waived &&
                s.Status != InstallmentStatus.Cancelled);
            return new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.City,
                p.Area,
                p.RegulatoryAuthority,
                p.ApprovalReferenceNumber,
                p.ApprovalStatus,
                TotalUnits = pUnits.Count,
                AvailableUnits = pUnits.Count(u => u.Status == InventoryStatus.Available),
                BookedUnits = pUnits.Count(u => u.Status == InventoryStatus.Booked),
                SoldUnits = pUnits.Count(u => u.Status == InventoryStatus.Sold),
                TotalValuation = pUnits.Sum(u => u.BasePrice),
                BookingCount = pBookings.Count,
                Collected = collected,
                Outstanding = open.Sum(s => s.Amount - s.PaidAmount),
                OverdueCount = open.Count(s =>
                    s.Status == InstallmentStatus.Overdue ||
                    (s.DueDate.Date < today && s.PaidAmount < s.Amount))
            };
        }).ToList();

        var scheduleItemIds = allItems.Select(s => s.Id.ToString()).ToHashSet();
        var unitIds = units.Select(u => u.Id.ToString()).ToHashSet();
        var bookingIds = bookings.Select(b => b.Id.ToString()).ToHashSet();
        var projectIdStrings = projectIds.Select(id => id.ToString()).ToHashSet();

        var auditQuery = _context.AuditLogs
            .Where(a => !a.IsDeleted && a.CreatedAtUtc <= toUtc);
        if (fromUtc.HasValue)
            auditQuery = auditQuery.Where(a => a.CreatedAtUtc >= fromUtc.Value);

        var recentAudits = (await auditQuery
                .OrderByDescending(a => a.CreatedAtUtc)
                .Take(200)
                .ToListAsync())
            .Where(a =>
                (a.EntityName == nameof(PaymentScheduleItem) && scheduleItemIds.Contains(a.EntityId)) ||
                (a.EntityName == nameof(Booking) && bookingIds.Contains(a.EntityId)) ||
                (a.EntityName == nameof(InventoryUnit) && unitIds.Contains(a.EntityId)) ||
                (a.EntityName == nameof(Project) && projectIdStrings.Contains(a.EntityId)) ||
                a.Action is "PaymentApproved" or "PaymentRejected" or "PaymentProofSubmitted" or
                    "InventoryStatusChanged" or "UnitBlocked" or "UnitUnblocked")
            .Take(40)
            .Select(a => new
            {
                a.Id,
                a.EntityName,
                a.EntityId,
                a.Action,
                a.Reason,
                a.CreatedAtUtc
            })
            .ToList();

        var installmentStatusBreakdown = allItems
            .GroupBy(s => s.Status.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        var payload = new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber,
                City = currentUser.Organization?.City ?? ""
            },
            Period = periodKey,
            PeriodLabel = periodLabel,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            GeneratedAtUtc = DateTime.UtcNow,
            Projects = projectOptions,
            Collections = new
            {
                TotalCollected = totalCollected,
                OutstandingAmount = outstanding,
                OverdueAmount = overdueAmount,
                CollectedInPeriod = collectedInPeriod,
                ScheduledTotal = scheduledTotal,
                RecoveryRatePct = recoveryRate,
                PendingProofCount = pendingProofs,
                OpenInstallmentCount = openItems.Count,
                OverdueInstallmentCount = overdueItems.Count,
                PaidInstallmentCount = paidItems.Count,
                InstallmentStatusBreakdown = installmentStatusBreakdown
            },
            Inventory = new
            {
                TotalUnits = units.Count,
                AvailableUnits = units.Count(u => u.Status == InventoryStatus.Available),
                ReservedUnits = units.Count(u => u.Status == InventoryStatus.Reserved),
                BookedUnits = units.Count(u => u.Status == InventoryStatus.Booked),
                SoldUnits = units.Count(u => u.Status == InventoryStatus.Sold),
                BlockedUnits = units.Count(u => u.Status == InventoryStatus.Blocked),
                TotalValuation = units.Sum(u => u.BasePrice),
                BookedOrSoldValuation = units
                    .Where(u => u.Status is InventoryStatus.Booked or InventoryStatus.Sold)
                    .Sum(u => u.BasePrice)
            },
            Bookings = new
            {
                ActiveCount = bookings.Count,
                NewInPeriod = newBookingsInPeriod,
                ConfirmedCount = bookings.Count(b => b.Status == BookingStatus.Confirmed),
                CompletedCount = bookings.Count(b => b.Status == BookingStatus.Completed),
                PendingCount = bookings.Count(b => b.Status == BookingStatus.Pending),
                TotalAgreedValue = bookings.Sum(b => b.TotalAgreedPrice)
            },
            Regulatory = new
            {
                ProjectCount = projects.Count,
                ApprovedCount = approved,
                UnderProcessCount = underProcess,
                UnapprovedCount = Math.Max(0, unapproved),
                WithNocReference = projects.Count(p => !string.IsNullOrWhiteSpace(p.ApprovalReferenceNumber)),
                Schemes = projects.Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Slug,
                    p.City,
                    p.Area,
                    p.RegulatoryAuthority,
                    p.ApprovalReferenceNumber,
                    p.ApprovalStatus,
                    p.ApprovalDocumentUrl
                }).ToList()
            },
            ProjectBreakdown = projectBreakdown,
            RecentAudits = recentAudits
        };

        return (null, payload);
    }

    private static (string Key, string Label, DateTime? FromUtc, DateTime ToUtc) ResolveDeveloperReportPeriod(string? period)
    {
        var now = DateTime.UtcNow;
        var key = (period ?? "month").Trim().ToLowerInvariant();
        return key switch
        {
            "quarter" => (
                "quarter",
                $"Q{((now.Month - 1) / 3) + 1} {now.Year}",
                new DateTime(now.Year, ((now.Month - 1) / 3) * 3 + 1, 1, 0, 0, 0, DateTimeKind.Utc),
                now),
            "all" => ("all", "All time", null, now),
            _ => (
                "month",
                now.ToString("MMMM yyyy"),
                new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                now)
        };
    }

    private static string CsvEscape(string? value)
    {
        var v = value ?? "";
        if (v.Contains('"') || v.Contains(',') || v.Contains('\n') || v.Contains('\r'))
            return $"\"{v.Replace("\"", "\"\"")}\"";
        return v;
    }

    [HttpPost("developer/sales-team/reps")]
    [Authorize]
    public async Task<ActionResult<object>> CreateDeveloperSalesRep([FromBody] CreateDeveloperSalesRepDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        if (!currentUser.OrganizationId.HasValue)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        if (string.IsNullOrWhiteSpace(dto.FullName) ||
            string.IsNullOrWhiteSpace(dto.Email) ||
            string.IsNullOrWhiteSpace(dto.PhoneNumber) ||
            string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest(new { message = "Full name, email, phone, and password are required." });
        }

        if (dto.Password.Trim().Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });

        var email = dto.Email.Trim().ToLowerInvariant();
        var emailTaken = await _context.Users.AnyAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
        if (emailTaken)
            return Conflict(new { message = "An account with this email already exists." });

        var role = UserRole.Developer;
        if (!string.IsNullOrWhiteSpace(dto.Role) &&
            Enum.TryParse<UserRole>(dto.Role, ignoreCase: true, out var parsed) &&
            (parsed == UserRole.Developer || parsed == UserRole.Finance))
        {
            role = parsed;
        }

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password.Trim()),
            FullName = dto.FullName.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            Role = role,
            OrganizationId = currentUser.OrganizationId.Value,
            IsActive = true,
            EmailVerified = true,
            IdentityVerified = false
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetDeveloperSalesTeam), new { }, new
        {
            UserId = user.Id,
            user.FullName,
            user.Email,
            PhoneNumber = user.PhoneNumber,
            Role = user.Role.ToString(),
            user.IsActive,
            AssignedLeadsCount = 0,
            PendingLeadsCount = 0,
            user.CreatedAtUtc,
            Channel = "Internal"
        });
    }

    [HttpPost("developer/sales-team/mandates")]
    [Authorize]
    public async Task<ActionResult<object>> CreateDeveloperBrokerMandate([FromBody] CreateDeveloperBrokerMandateDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.Id == dto.ProjectId && !p.IsDeleted);
        if (project == null)
            return NotFound(new { message = "Project not found." });

        if (developerOrgId.HasValue && project.DeveloperOrgId != developerOrgId.Value)
            return Forbid();

        var agency = await _context.Organizations
            .FirstOrDefaultAsync(o =>
                o.Id == dto.AgencyOrgId &&
                !o.IsDeleted &&
                o.Type == OrganizationType.Agency);
        if (agency == null)
            return BadRequest(new { message = "Agency organization not found." });

        var existing = await _context.AgencyProjectMandates
            .FirstOrDefaultAsync(m =>
                m.AgencyOrgId == agency.Id &&
                m.ProjectId == project.Id &&
                !m.IsDeleted);
        if (existing != null)
            return Conflict(new { message = "This agency already has a mandate on this project." });

        var mandate = new AgencyProjectMandate
        {
            AgencyOrgId = agency.Id,
            ProjectId = project.Id,
            IsExclusive = dto.IsExclusive,
            Status = AgencyMandateStatus.Active,
            CommissionPercent = dto.CommissionPercent,
            StartDateUtc = dto.StartDateUtc ?? DateTime.UtcNow,
            EndDateUtc = dto.EndDateUtc,
            Notes = dto.Notes,
            CreatedBy = currentUserId
        };

        _context.AgencyProjectMandates.Add(mandate);
        await _context.SaveChangesAsync();

        var brokerCount = await _context.Users.CountAsync(u =>
            !u.IsDeleted &&
            u.OrganizationId == agency.Id &&
            u.Role == UserRole.Agent);

        return CreatedAtAction(nameof(GetDeveloperSalesTeam), new { }, new
        {
            MandateId = mandate.Id,
            AgencyOrgId = agency.Id,
            AgencyName = agency.Name,
            AgencyLicense = agency.LicenseNumber,
            AgencyCity = agency.City,
            BrokerCount = brokerCount,
            ProjectId = project.Id,
            ProjectName = project.Name,
            ProjectSlug = project.Slug,
            mandate.IsExclusive,
            Status = mandate.Status.ToString(),
            mandate.CommissionPercent,
            mandate.StartDateUtc,
            mandate.EndDateUtc,
            mandate.Notes,
            mandate.CreatedAtUtc,
            Channel = "External"
        });
    }
}

public class CreateDeveloperSalesRepDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? Role { get; set; }
}

public class CreateDeveloperBrokerMandateDto
{
    public Guid ProjectId { get; set; }
    public Guid AgencyOrgId { get; set; }
    public bool IsExclusive { get; set; } = true;
    public decimal? CommissionPercent { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }
    public string? Notes { get; set; }
}
