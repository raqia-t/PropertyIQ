using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Projects;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ProjectsController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
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
            .Where(p => !p.IsDeleted)
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
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

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
            .FirstOrDefaultAsync(p => p.Slug.ToLower() == slug.ToLower() && !p.IsDeleted);

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
    public async Task<ActionResult<object>> GetDeveloperDashboard()
    {
        // Fetch projects for current developer or all projects if admin
        var currentUserId = _currentUserService.UserId;
        var currentUser = currentUserId.HasValue 
            ? await _context.Users.Include(u => u.Organization).FirstOrDefaultAsync(u => u.Id == currentUserId.Value)
            : null;

        var developerOrgId = currentUser?.OrganizationId;

        var projectsQuery = _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.InventoryUnits)
            .Where(p => !p.IsDeleted);

        if (developerOrgId.HasValue)
        {
            projectsQuery = projectsQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);
        }

        var projects = await projectsQuery.ToListAsync();
        var allUnits = projects.SelectMany(p => p.InventoryUnits).ToList();

        var totalProjects = projects.Count;
        var totalUnits = allUnits.Count;
        var availableUnits = allUnits.Count(u => u.Status == InventoryStatus.Available);
        var reservedUnits = allUnits.Count(u => u.Status == InventoryStatus.Reserved);
        var bookedUnits = allUnits.Count(u => u.Status == InventoryStatus.Booked);
        var soldUnits = allUnits.Count(u => u.Status == InventoryStatus.Sold);
        var blockedUnits = allUnits.Count(u => u.Status == InventoryStatus.Blocked);

        var totalValuation = allUnits.Sum(u => u.BasePrice);
        var bookedOrSoldValuation = allUnits.Where(u => u.Status == InventoryStatus.Booked || u.Status == InventoryStatus.Sold).Sum(u => u.BasePrice);

        // Fetch bookings for these projects
        var projectIds = projects.Select(p => p.Id).ToList();
        var bookings = await _context.Bookings
            .Include(b => b.InventoryUnit)
            .Include(b => b.Customer)
            .Include(b => b.ScheduleItems)
            .Where(b => projectIds.Contains(b.InventoryUnit!.ProjectId) && !b.IsDeleted)
            .OrderByDescending(b => b.BookedAtUtc)
            .Take(15)
            .ToListAsync();

        var totalCollections = bookings.SelectMany(b => b.ScheduleItems).Where(s => s.Status == InstallmentStatus.Paid).Sum(s => s.PaidAmount);
        var pendingInstallments = bookings.SelectMany(b => b.ScheduleItems).Where(s => s.Status == InstallmentStatus.Due || s.Status == InstallmentStatus.Overdue).Sum(s => s.Amount - s.PaidAmount);

        return Ok(new
        {
            DeveloperOrganization = currentUser?.Organization?.Name ?? "Skyline Developers Lahore",
            LicenseNumber = currentUser?.Organization?.LicenseNumber ?? "LDA-REG-2024-889",
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
                PendingInstallments = pendingInstallments
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
                TotalUnits = p.InventoryUnits.Count,
                AvailableUnits = p.InventoryUnits.Count(u => u.Status == InventoryStatus.Available),
                BookedUnits = p.InventoryUnits.Count(u => u.Status == InventoryStatus.Booked || u.Status == InventoryStatus.Sold)
            }),
            RecentBookings = bookings.Select(b => new
            {
                b.Id,
                UnitNumber = b.InventoryUnit?.UnitNumber ?? "Unknown",
                UnitType = b.InventoryUnit?.UnitType ?? "Plot",
                CustomerName = b.Customer?.FullName ?? "Direct Customer",
                CustomerPhone = b.Customer?.PhoneNumber ?? "N/A",
                TotalAgreedPrice = b.TotalAgreedPrice,
                Status = b.Status.ToString(),
                BookedAtUtc = b.BookedAtUtc,
                PaidAmount = b.ScheduleItems.Sum(s => s.PaidAmount),
                TotalScheduleItems = b.ScheduleItems.Count,
                PaidScheduleItems = b.ScheduleItems.Count(s => s.Status == InstallmentStatus.Paid)
            })
        });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateProject([FromBody] CreateProjectDto dto)
    {
        var existingSlug = await _context.Projects.AnyAsync(p => p.Slug.ToLower() == dto.Slug.ToLower());
        if (existingSlug)
        {
            return BadRequest(new { message = $"A project with slug '{dto.Slug}' already exists." });
        }

        var project = new Project
        {
            DeveloperOrgId = dto.DeveloperOrgId,
            Name = dto.Name,
            Slug = dto.Slug,
            Description = dto.Description,
            ProjectType = dto.ProjectType,
            Province = dto.Province,
            City = dto.City,
            Area = dto.Area,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            RegulatoryAuthority = dto.RegulatoryAuthority,
            ApprovalReferenceNumber = dto.ApprovalReferenceNumber,
            ApprovalStatus = dto.ApprovalStatus,
            ApprovalDocumentUrl = dto.ApprovalDocumentUrl,
            LaunchDate = dto.LaunchDate ?? DateTime.UtcNow,
            ExpectedCompletionDate = dto.ExpectedCompletionDate
        };

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProjectById), new { id = project.Id }, new { project.Id, project.Name, project.Slug });
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

    [HttpPost("{projectId:guid}/units")]
    public async Task<ActionResult<object>> AddUnit(Guid projectId, [FromBody] CreateInventoryUnitDto dto)
    {
        var project = await _context.Projects.FindAsync(projectId);
        if (project == null || project.IsDeleted)
            return NotFound(new { message = "Project not found." });

        var exists = await _context.InventoryUnits.AnyAsync(u => u.ProjectId == projectId && u.UnitNumber.ToLower() == dto.UnitNumber.ToLower() && !u.IsDeleted);
        if (exists)
            return BadRequest(new { message = $"Unit with number '{dto.UnitNumber}' already exists in this project." });

        var unit = new InventoryUnit
        {
            ProjectId = projectId,
            PhaseId = dto.PhaseId,
            BlockId = dto.BlockId,
            UnitNumber = dto.UnitNumber,
            UnitType = dto.UnitType,
            Size = dto.Size,
            SizeUnit = dto.SizeUnit,
            FloorNumber = dto.FloorNumber,
            Facing = dto.Facing,
            BasePrice = dto.BasePrice,
            Currency = dto.Currency,
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
    public async Task<ActionResult<object>> UpdateUnitStatus(Guid unitId, [FromBody] UpdateInventoryUnitStatusDto dto)
    {
        var unit = await _context.InventoryUnits.FirstOrDefaultAsync(u => u.Id == unitId && !u.IsDeleted);
        if (unit == null)
            return NotFound(new { message = "Inventory unit not found." });

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
}
