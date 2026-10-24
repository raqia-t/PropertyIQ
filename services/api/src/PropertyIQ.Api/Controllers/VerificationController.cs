using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using PropertyIQ.Api.Services;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Verification;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VerificationController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IFileStorageService _fileStorage;

    public VerificationController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IFileStorageService fileStorage)
    {
        _context = context;
        _currentUserService = currentUserService;
        _fileStorage = fileStorage;
    }

    private bool IsSpecialistOrAdmin()
    {
        var role = _currentUserService.UserRole;
        return role == UserRole.Specialist.ToString() || role == UserRole.SuperAdmin.ToString();
    }

    private static bool IsTerminal(VerificationCaseStatus status) =>
        status is VerificationCaseStatus.Completed or VerificationCaseStatus.Cancelled;

    private async Task<(User? user, ActionResult? error)> RequireAuthenticatedUserAsync()
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return (null, Unauthorized());
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (user == null) return (null, Unauthorized());
        return (user, null);
    }

    private ActionResult? EnsureCaseMutable(VerificationCase vCase)
    {
        if (vCase.Status == VerificationCaseStatus.Cancelled)
            return BadRequest(new { message = "Cancelled cases cannot be modified." });
        if (vCase.Status == VerificationCaseStatus.Completed ||
            vCase.Reports.Any(r => r.IsImmutable && !r.IsDeleted))
            return Conflict(new { message = "Case is completed with an immutable report and cannot be modified." });
        return null;
    }

    private ActionResult? EnsureSpecialistOwnsOrAdmin(VerificationCase vCase, User user)
    {
        if (user.Role == UserRole.SuperAdmin) return null;
        if (user.Role != UserRole.Specialist)
            return Forbid();
        if (vCase.AssignedSpecialistId.HasValue && vCase.AssignedSpecialistId != user.Id)
            return Forbid();
        return null;
    }

    [HttpGet("services")]
    [AllowAnonymous]
    public ActionResult<object> GetServiceCatalog()
    {
        var services = new[]
        {
            new
            {
                Level = VerificationLevel.BasicDocumentReview,
                Name = "Basic Document Review",
                Fee = 15000m,
                Currency = "PKR",
                TurnaroundHours = 48,
                Description = "Document completeness, title deed/registry cross-check, visible red flags, and seller metadata scrutiny.",
                IncludedChecks = new[]
                {
                    "Seller / Developer CNIC Identity Match",
                    "Sale Deed / Registry Authenticity Cross-Check",
                    "Fard Malkiat / Record-of-Rights Preliminary Check",
                    "Document Completeness & Missing Stamp Verification"
                }
            },
            new
            {
                Level = VerificationLevel.PropertySiteVisit,
                Name = "Property / Physical Site Visit",
                Fee = 25000m,
                Currency = "PKR",
                TurnaroundHours = 72,
                Description = "On-ground physical inspection with GPS coordinates, boundary markings, signage verification, and possession observation.",
                IncludedChecks = new[]
                {
                    "Exact GPS Coordinate Boundary Mapping",
                    "Signage, Access Road & Utility Line Presence",
                    "Physical Possession & Occupancy Status",
                    "High-Resolution Geo-Tagged Field Photographs"
                }
            },
            new
            {
                Level = VerificationLevel.RecordCheck,
                Name = "Official Record & Authority Check",
                Fee = 35000m,
                Currency = "PKR",
                TurnaroundHours = 96,
                Description = "Government and municipal record lookup against accessible official portals (PLRA Punjab Land Records, RDA, CDA, SBCA).",
                IncludedChecks = new[]
                {
                    "PLRA / Land Registry Electronic Mutation Status",
                    "Development Authority (LDA/RDA/CDA/SBCA) NOC List Status",
                    "Society Master Plan Gazette Notification Match",
                    "Official Reference Metadata Archival"
                }
            },
            new
            {
                Level = VerificationLevel.EnhancedDueDiligence,
                Name = "Enhanced Due Diligence (Recommended)",
                Fee = 60000m,
                Currency = "PKR",
                TurnaroundHours = 120,
                Description = "Comprehensive verification combining multi-decade title chain scrutiny, physical inspection, authority approvals, and tax/dues audit.",
                IncludedChecks = new[]
                {
                    "Full Title Chain & Past Mutation History (Intiqal)",
                    "On-Ground Physical Field Inspection & Geo-Photos",
                    "Development Authority NOC & Layout Plan Clearance",
                    "Municipal Property Tax & Society Dues Verification",
                    "Detailed Risk Scoring & Actionable Advisory"
                }
            },
            new
            {
                Level = VerificationLevel.LegalReview,
                Name = "High-Court Advocate Legal Title Opinion",
                Fee = 95000m,
                Currency = "PKR",
                TurnaroundHours = 168,
                Description = "Full Enhanced Due Diligence paired with a formal, signed title search report from a practicing High Court real estate advocate.",
                IncludedChecks = new[]
                {
                    "All Enhanced Due Diligence Physical & Record Checks",
                    "Civil Court & Revenue Court Lis Pendens (Litigation) Check",
                    "Formal Legal Opinion on Marketable Title",
                    "Signed Advocate Due-Diligence Certificate"
                }
            }
        };

        return Ok(services);
    }

    [HttpGet("specialist/dashboard")]
    [Authorize]
    public async Task<ActionResult<object>> GetSpecialistDashboard([FromQuery] Guid? focusCaseId = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (specialist == null) return Unauthorized();

        var casesQuery = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Evidences)
            .Include(c => c.Reports)
            .Where(c => !c.IsDeleted);

        if (role == UserRole.Specialist.ToString())
        {
            casesQuery = casesQuery.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value ||
                c.Status == VerificationCaseStatus.Requested);
        }

        var cases = await casesQuery
            .OrderByDescending(c => c.UpdatedAtUtc)
            .ThenByDescending(c => c.CreatedAtUtc)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var openStatuses = new[]
        {
            VerificationCaseStatus.Requested,
            VerificationCaseStatus.Assigned,
            VerificationCaseStatus.InProgress,
            VerificationCaseStatus.ReviewPending
        };

        var assignedToMe = cases.Where(c => c.AssignedSpecialistId == currentUserId.Value).ToList();
        var requestedQueue = cases.Where(c => c.Status == VerificationCaseStatus.Requested).ToList();

        VerificationCase? focus = null;
        if (focusCaseId.HasValue)
            focus = cases.FirstOrDefault(c => c.Id == focusCaseId.Value);
        if (focus == null)
        {
            focus = assignedToMe
                .Where(c => openStatuses.Contains(c.Status))
                .OrderByDescending(c => c.Status == VerificationCaseStatus.InProgress)
                .ThenByDescending(c => c.AssignedAtUtc ?? c.CreatedAtUtc)
                .FirstOrDefault();
        }
        if (focus == null)
            focus = requestedQueue.OrderBy(c => c.CreatedAtUtc).FirstOrDefault();

        object? focusPayload = null;
        if (focus != null)
        {
            var verifierSeesExact = focus.Property != null &&
                PropertyLocationAccess.ViewerSeesExactPin(focus.Property, _currentUserService);
            var slaDeadline = focus.CreatedAtUtc.AddHours(focus.SLAHours);
            var slaRemainingHours = Math.Max(0, (slaDeadline - now).TotalHours);

            focusPayload = new
            {
                focus.Id,
                Target = new
                {
                    Name = focus.Property != null
                        ? focus.Property.Title
                        : (focus.Project != null ? focus.Project.Name : "Target Property"),
                    City = focus.Property != null ? focus.Property.City : (focus.Project?.City ?? "Lahore"),
                    Area = focus.Property != null ? focus.Property.Area : (focus.Project?.Area ?? ""),
                    focus.PropertyId,
                    focus.ProjectId,
                    Latitude = verifierSeesExact ? focus.Property?.Latitude : null,
                    Longitude = verifierSeesExact ? focus.Property?.Longitude : null,
                    PrivacyLevel = focus.Property?.PrivacyLevel.ToString()
                },
                Customer = focus.Customer != null
                    ? new
                    {
                        focus.Customer.Id,
                        focus.Customer.FullName,
                        focus.Customer.Email,
                        focus.Customer.PhoneNumber
                    }
                    : null,
                AssignedSpecialist = focus.AssignedSpecialist != null
                    ? new
                    {
                        focus.AssignedSpecialist.Id,
                        focus.AssignedSpecialist.FullName
                    }
                    : null,
                ServiceLevel = focus.ServiceLevel.ToString(),
                Status = focus.Status.ToString(),
                focus.Fee,
                focus.Currency,
                focus.SLAHours,
                SlaDeadlineUtc = slaDeadline,
                SlaRemainingHours = Math.Round(slaRemainingHours, 1),
                IsSlaBreached = now > slaDeadline && focus.Status != VerificationCaseStatus.Completed,
                focus.CreatedAtUtc,
                focus.AssignedAtUtc,
                focus.CompletedAtUtc,
                CanSelfAssign = focus.Status == VerificationCaseStatus.Requested &&
                                focus.AssignedSpecialistId == null &&
                                focus.IsPaid,
                IsAssignedToMe = focus.AssignedSpecialistId == currentUserId.Value,
                TotalChecks = focus.ChecklistItems.Count(ci => !ci.IsDeleted),
                PassedChecks = focus.ChecklistItems.Count(ci =>
                    !ci.IsDeleted && ci.Result == ChecklistResult.Pass),
                ConcernChecks = focus.ChecklistItems.Count(ci =>
                    !ci.IsDeleted && ci.Result == ChecklistResult.Concern),
                EvidenceCount = focus.Evidences.Count(e => !e.IsDeleted),
                HasReport = focus.Reports.Any(r => !r.IsDeleted),
                ChecklistItems = focus.ChecklistItems
                    .Where(ci => !ci.IsDeleted)
                    .OrderBy(ci => ci.CheckCode)
                    .Select(ci => new
                    {
                        ci.Id,
                        ci.Category,
                        ci.CheckCode,
                        ci.CheckTitle,
                        Result = ci.Result.ToString(),
                        ci.Notes
                    }),
                Evidences = focus.Evidences
                    .Where(e => !e.IsDeleted)
                    .OrderByDescending(e => e.CapturedAtUtc)
                    .Select(e => new
                    {
                        e.Id,
                        e.EvidenceType,
                        e.FileUrl,
                        e.StorageKey,
                        e.Latitude,
                        e.Longitude,
                        e.CapturedAtUtc
                    }),
                Reports = focus.Reports
                    .Where(r => !r.IsDeleted)
                    .OrderByDescending(r => r.Version)
                    .Select(r => new
                    {
                        r.Id,
                        r.Version,
                        r.Summary,
                        r.PublishedAtUtc,
                        r.IsImmutable
                    })
            };
        }

        return Ok(new
        {
            Specialist = new
            {
                specialist.Id,
                specialist.FullName,
                specialist.Email,
                specialist.PhoneNumber,
                Role = specialist.Role.ToString()
            },
            Summary = new
            {
                QueueCount = requestedQueue.Count,
                AssignedToMeCount = assignedToMe.Count,
                InProgressCount = assignedToMe.Count(c => c.Status == VerificationCaseStatus.InProgress),
                CompletedCount = assignedToMe.Count(c => c.Status == VerificationCaseStatus.Completed),
                SlaAtRiskCount = assignedToMe.Count(c =>
                    openStatuses.Contains(c.Status) &&
                    now > c.CreatedAtUtc.AddHours(c.SLAHours * 0.75)),
                TotalOpenCount = cases.Count(c => openStatuses.Contains(c.Status)),
                PublishedReportsCount = cases.Count(c => c.Reports.Any(r => !r.IsDeleted))
            },
            Queue = requestedQueue.Select(c => new
            {
                c.Id,
                TargetName = c.Property != null
                    ? c.Property.Title
                    : (c.Project != null ? c.Project.Name : "Target Property"),
                TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                ServiceLevel = c.ServiceLevel.ToString(),
                Status = c.Status.ToString(),
                c.Fee,
                c.Currency,
                c.SLAHours,
                CustomerName = c.Customer?.FullName ?? "Customer",
                c.CreatedAtUtc
            }),
            MyCases = assignedToMe.Select(c => new
            {
                c.Id,
                TargetName = c.Property != null
                    ? c.Property.Title
                    : (c.Project != null ? c.Project.Name : "Target Property"),
                ServiceLevel = c.ServiceLevel.ToString(),
                Status = c.Status.ToString(),
                PassedChecks = c.ChecklistItems.Count(ci =>
                    !ci.IsDeleted && ci.Result == ChecklistResult.Pass),
                TotalChecks = c.ChecklistItems.Count(ci => !ci.IsDeleted),
                HasReport = c.Reports.Any(r => !r.IsDeleted),
                c.CreatedAtUtc,
                c.AssignedAtUtc
            }),
            FocusCase = focusPayload
        });
    }

    [HttpGet("specialist/cases")]
    [Authorize]
    public async Task<ActionResult<object>> GetSpecialistCases(
        [FromQuery] string? scope = null,
        [FromQuery] string? status = null,
        [FromQuery] string? level = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (specialist == null) return Unauthorized();

        var now = DateTime.UtcNow;
        var query = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .Where(c => !c.IsDeleted);

        if (role == UserRole.Specialist.ToString())
        {
            query = query.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value ||
                c.Status == VerificationCaseStatus.Requested);
        }

        var scopeKey = (scope ?? "all").Trim().ToLowerInvariant();
        query = scopeKey switch
        {
            "mine" or "assigned" => query.Where(c => c.AssignedSpecialistId == currentUserId.Value),
            "queue" or "open" or "requested" => query.Where(c => c.Status == VerificationCaseStatus.Requested),
            "active" => query.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value &&
                (c.Status == VerificationCaseStatus.Assigned ||
                 c.Status == VerificationCaseStatus.InProgress ||
                 c.Status == VerificationCaseStatus.ReviewPending)),
            "completed" => query.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value &&
                c.Status == VerificationCaseStatus.Completed),
            _ => query
        };

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<VerificationCaseStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(c => c.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(level) &&
            Enum.TryParse<VerificationLevel>(level, ignoreCase: true, out var levelEnum))
        {
            query = query.Where(c => c.ServiceLevel == levelEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(c =>
                (c.Property != null && c.Property.Title.ToLower().Contains(q)) ||
                (c.Project != null && c.Project.Name.ToLower().Contains(q)) ||
                (c.Customer != null && c.Customer.FullName.ToLower().Contains(q)) ||
                (c.Customer != null && c.Customer.Email.ToLower().Contains(q)) ||
                (c.Property != null && c.Property.City.ToLower().Contains(q)) ||
                (c.Project != null && c.Project.City.ToLower().Contains(q)));
        }

        var cases = await query
            .OrderByDescending(c => c.UpdatedAtUtc)
            .ThenByDescending(c => c.CreatedAtUtc)
            .Take(200)
            .ToListAsync();

        var allVisible = await _context.VerificationCases
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .Where(c =>
                !c.IsDeleted &&
                (role != UserRole.Specialist.ToString() ||
                 c.AssignedSpecialistId == currentUserId.Value ||
                 c.Status == VerificationCaseStatus.Requested))
            .ToListAsync();

        var mine = allVisible.Where(c => c.AssignedSpecialistId == currentUserId.Value).ToList();

        return Ok(new
        {
            Specialist = new
            {
                specialist.Id,
                specialist.FullName,
                specialist.Email
            },
            Summary = new
            {
                TotalVisible = allVisible.Count,
                QueueCount = allVisible.Count(c => c.Status == VerificationCaseStatus.Requested),
                AssignedToMeCount = mine.Count,
                InProgressCount = mine.Count(c => c.Status == VerificationCaseStatus.InProgress),
                CompletedCount = mine.Count(c => c.Status == VerificationCaseStatus.Completed),
                SlaBreachedCount = mine.Count(c =>
                    c.Status != VerificationCaseStatus.Completed &&
                    c.Status != VerificationCaseStatus.Cancelled &&
                    now > c.CreatedAtUtc.AddHours(c.SLAHours)),
                FilteredCount = cases.Count
            },
            Cases = cases.Select(c =>
            {
                var slaDeadline = c.CreatedAtUtc.AddHours(c.SLAHours);
                var remaining = Math.Max(0, (slaDeadline - now).TotalHours);
                var checks = c.ChecklistItems.Where(ci => !ci.IsDeleted).ToList();
                return new
                {
                    c.Id,
                    TargetName = c.Property != null
                        ? c.Property.Title
                        : (c.Project != null ? c.Project.Name : "Target Property"),
                    TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                    TargetArea = c.Property?.Area ?? c.Project?.Area ?? "",
                    c.PropertyId,
                    c.ProjectId,
                    ServiceLevel = c.ServiceLevel.ToString(),
                    Status = c.Status.ToString(),
                    c.Fee,
                    c.Currency,
                    c.SLAHours,
                    SlaDeadlineUtc = slaDeadline,
                    SlaRemainingHours = Math.Round(remaining, 1),
                    IsSlaBreached = c.Status != VerificationCaseStatus.Completed &&
                                    c.Status != VerificationCaseStatus.Cancelled &&
                                    now > slaDeadline,
                    CustomerName = c.Customer?.FullName ?? "Customer",
                    CustomerEmail = c.Customer?.Email,
                    CustomerPhone = c.Customer?.PhoneNumber,
                    SpecialistName = c.AssignedSpecialist?.FullName ?? "Unassigned",
                    IsAssignedToMe = c.AssignedSpecialistId == currentUserId.Value,
                    CanSelfAssign = c.Status == VerificationCaseStatus.Requested &&
                                    c.AssignedSpecialistId == null &&
                                    c.IsPaid,
                    TotalChecks = checks.Count,
                    PassedChecks = checks.Count(ci => ci.Result == ChecklistResult.Pass),
                    ConcernChecks = checks.Count(ci => ci.Result == ChecklistResult.Concern),
                    HasReport = c.Reports.Any(r => !r.IsDeleted),
                    c.CreatedAtUtc,
                    c.AssignedAtUtc,
                    c.CompletedAtUtc
                };
            })
        });
    }

    [HttpGet("specialist/visits")]
    [Authorize]
    public async Task<ActionResult<object>> GetSpecialistVisits(
        [FromQuery] string? scope = null,
        [FromQuery] string? visitStatus = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (specialist == null) return Unauthorized();

        var now = DateTime.UtcNow;

        // Site visits are verification cases with SiteVisit checklist rows
        // (tier PropertySiteVisit and above) — not AgentVisit CRM appointments.
        var query = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Evidences)
            .Include(c => c.Reports)
            .Where(c =>
                !c.IsDeleted &&
                c.ServiceLevel >= VerificationLevel.PropertySiteVisit &&
                c.ChecklistItems.Any(ci => !ci.IsDeleted && ci.Category == "SiteVisit"));

        if (role == UserRole.Specialist.ToString())
        {
            query = query.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value ||
                c.Status == VerificationCaseStatus.Requested);
        }

        var scopeKey = (scope ?? "active").Trim().ToLowerInvariant();
        query = scopeKey switch
        {
            "mine" or "assigned" => query.Where(c => c.AssignedSpecialistId == currentUserId.Value),
            "queue" => query.Where(c => c.Status == VerificationCaseStatus.Requested),
            "completed" => query.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value &&
                c.Status == VerificationCaseStatus.Completed),
            "all" => query,
            _ => query.Where(c =>
                c.Status != VerificationCaseStatus.Completed &&
                c.Status != VerificationCaseStatus.Cancelled &&
                (c.AssignedSpecialistId == currentUserId.Value ||
                 c.Status == VerificationCaseStatus.Requested))
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(c =>
                (c.Property != null && c.Property.Title.ToLower().Contains(q)) ||
                (c.Project != null && c.Project.Name.ToLower().Contains(q)) ||
                (c.Customer != null && c.Customer.FullName.ToLower().Contains(q)) ||
                (c.Property != null && c.Property.City.ToLower().Contains(q)) ||
                (c.Project != null && c.Project.City.ToLower().Contains(q)));
        }

        var cases = await query
            .OrderByDescending(c => c.AssignedAtUtc ?? c.CreatedAtUtc)
            .Take(100)
            .ToListAsync();

        string DeriveVisitStatus(VerificationCase c)
        {
            var siteItems = c.ChecklistItems
                .Where(ci => !ci.IsDeleted && ci.Category == "SiteVisit")
                .ToList();
            if (c.Status == VerificationCaseStatus.Completed)
                return "Completed";
            if (siteItems.Count == 0)
                return "NotRequired";
            if (siteItems.All(ci => ci.Result == ChecklistResult.Pass))
                return "FieldClear";
            if (siteItems.Any(ci => ci.Result == ChecklistResult.Concern))
                return "Concern";
            if (siteItems.Any(ci => ci.Result != ChecklistResult.NotChecked))
                return "InField";
            return "Scheduled";
        }

        if (!string.IsNullOrWhiteSpace(visitStatus))
        {
            var vs = visitStatus.Trim();
            cases = cases.Where(c =>
                string.Equals(DeriveVisitStatus(c), vs, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var allSiteCases = await _context.VerificationCases
            .Include(c => c.ChecklistItems)
            .Include(c => c.Evidences)
            .Where(c =>
                !c.IsDeleted &&
                c.ServiceLevel >= VerificationLevel.PropertySiteVisit &&
                c.ChecklistItems.Any(ci => !ci.IsDeleted && ci.Category == "SiteVisit") &&
                (role != UserRole.Specialist.ToString() ||
                 c.AssignedSpecialistId == currentUserId.Value ||
                 c.Status == VerificationCaseStatus.Requested))
            .ToListAsync();

        var mineSite = allSiteCases.Where(c => c.AssignedSpecialistId == currentUserId.Value).ToList();

        return Ok(new
        {
            Specialist = new
            {
                specialist.Id,
                specialist.FullName,
                specialist.Email
            },
            Summary = new
            {
                TotalSiteCases = allSiteCases.Count,
                ScheduledCount = mineSite.Count(c => DeriveVisitStatus(c) == "Scheduled"),
                InFieldCount = mineSite.Count(c => DeriveVisitStatus(c) == "InField"),
                FieldClearCount = mineSite.Count(c => DeriveVisitStatus(c) == "FieldClear"),
                ConcernCount = mineSite.Count(c => DeriveVisitStatus(c) == "Concern"),
                CompletedCount = mineSite.Count(c => c.Status == VerificationCaseStatus.Completed),
                QueueCount = allSiteCases.Count(c => c.Status == VerificationCaseStatus.Requested),
                GeoEvidenceCount = mineSite.SelectMany(c => c.Evidences.Where(e =>
                    !e.IsDeleted && e.Latitude.HasValue && e.Longitude.HasValue)).Count(),
                FilteredCount = cases.Count
            },
            Visits = cases.Select(c =>
            {
                var siteItems = c.ChecklistItems
                    .Where(ci => !ci.IsDeleted && ci.Category == "SiteVisit")
                    .OrderBy(ci => ci.CheckCode)
                    .ToList();
                var geoEvidence = c.Evidences
                    .Where(e => !e.IsDeleted)
                    .OrderByDescending(e => e.CapturedAtUtc)
                    .ToList();
                var verifierSeesExact = c.Property != null &&
                    PropertyLocationAccess.ViewerSeesExactPin(c.Property, _currentUserService);
                var visitStatusLabel = DeriveVisitStatus(c);
                var slaDeadline = c.CreatedAtUtc.AddHours(c.SLAHours);

                return new
                {
                    CaseId = c.Id,
                    TargetName = c.Property != null
                        ? c.Property.Title
                        : (c.Project != null ? c.Project.Name : "Target Property"),
                    TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                    TargetArea = c.Property?.Area ?? c.Project?.Area ?? "",
                    Latitude = verifierSeesExact ? c.Property?.Latitude : null,
                    Longitude = verifierSeesExact ? c.Property?.Longitude : null,
                    PrivacyLevel = c.Property?.PrivacyLevel.ToString(),
                    ServiceLevel = c.ServiceLevel.ToString(),
                    CaseStatus = c.Status.ToString(),
                    VisitStatus = visitStatusLabel,
                    c.Fee,
                    c.Currency,
                    c.IsPaid,
                    c.ScheduledVisitAtUtc,
                    c.VisitNotes,
                    c.SLAHours,
                    SlaRemainingHours = Math.Round(Math.Max(0, (slaDeadline - now).TotalHours), 1),
                    CustomerName = c.Customer?.FullName ?? "Customer",
                    CustomerPhone = c.Customer?.PhoneNumber,
                    IsAssignedToMe = c.AssignedSpecialistId == currentUserId.Value,
                    CanSelfAssign = c.Status == VerificationCaseStatus.Requested &&
                                    c.AssignedSpecialistId == null &&
                                    c.IsPaid,
                    SiteCheckCount = siteItems.Count,
                    SitePassedCount = siteItems.Count(ci => ci.Result == ChecklistResult.Pass),
                    SiteConcernCount = siteItems.Count(ci => ci.Result == ChecklistResult.Concern),
                    GeoEvidenceCount = geoEvidence.Count(e => e.Latitude.HasValue && e.Longitude.HasValue),
                    HasReport = c.Reports.Any(r => !r.IsDeleted),
                    c.CreatedAtUtc,
                    c.AssignedAtUtc,
                    SiteChecks = siteItems.Select(ci => new
                    {
                        ci.Id,
                        ci.CheckCode,
                        ci.CheckTitle,
                        Result = ci.Result.ToString(),
                        ci.Notes
                    }),
                    Evidences = geoEvidence.Take(12).Select(e => new
                    {
                        e.Id,
                        e.EvidenceType,
                        e.FileUrl,
                        e.Latitude,
                        e.Longitude,
                        e.CapturedAtUtc
                    })
                };
            })
        });
    }

    private static readonly HashSet<string> DocumentChecklistCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "Identity",
        "OwnershipEvidence",
        "MutationTransfer",
        "SocietyApproval",
        "TaxesDues",
        "MortgageCharge",
        "CourtDispute"
    };

    private static readonly HashSet<string> DocumentEvidenceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "OfficialRecordDoc",
        "SellerDoc",
        "DocumentScan"
    };

    [HttpGet("specialist/documents")]
    [Authorize]
    public async Task<ActionResult<object>> GetSpecialistDocuments(
        [FromQuery] string? scope = null,
        [FromQuery] string? docStatus = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (specialist == null) return Unauthorized();

        var casesQuery = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Evidences)
            .Include(c => c.Reports)
            .Where(c => !c.IsDeleted);

        if (role == UserRole.Specialist.ToString())
        {
            casesQuery = casesQuery.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value ||
                c.Status == VerificationCaseStatus.Requested);
        }

        var scopeKey = (scope ?? "active").Trim().ToLowerInvariant();
        casesQuery = scopeKey switch
        {
            "mine" => casesQuery.Where(c => c.AssignedSpecialistId == currentUserId.Value),
            "queue" => casesQuery.Where(c => c.Status == VerificationCaseStatus.Requested),
            "completed" => casesQuery.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value &&
                c.Status == VerificationCaseStatus.Completed),
            "all" => casesQuery,
            _ => casesQuery.Where(c =>
                c.Status != VerificationCaseStatus.Completed &&
                c.Status != VerificationCaseStatus.Cancelled)
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            casesQuery = casesQuery.Where(c =>
                (c.Property != null && c.Property.Title.ToLower().Contains(q)) ||
                (c.Project != null && c.Project.Name.ToLower().Contains(q)) ||
                (c.Customer != null && c.Customer.FullName.ToLower().Contains(q)) ||
                (c.Property != null && c.Property.City.ToLower().Contains(q)));
        }

        var cases = await casesQuery
            .OrderByDescending(c => c.UpdatedAtUtc)
            .Take(100)
            .ToListAsync();

        var propertyIds = cases
            .Where(c => c.PropertyId.HasValue)
            .Select(c => c.PropertyId!.Value)
            .Distinct()
            .ToList();

        var titleDocs = propertyIds.Count == 0
            ? new List<PropertyEvidenceDocument>()
            : await _context.PropertyEvidenceDocuments
                .Include(d => d.UploadedByUser)
                .Where(d => !d.IsDeleted && propertyIds.Contains(d.PropertyId))
                .OrderByDescending(d => d.UploadedAtUtc)
                .ToListAsync();

        var titleDocsByProperty = titleDocs
            .GroupBy(d => d.PropertyId)
            .ToDictionary(g => g.Key, g => g.ToList());

        string DeriveDocReviewStatus(VerificationCase c, List<PropertyEvidenceDocument> propDocs)
        {
            var docChecks = c.ChecklistItems
                .Where(ci => !ci.IsDeleted && DocumentChecklistCategories.Contains(ci.Category))
                .ToList();
            var pendingTitle = propDocs.Count(d => d.Status == PropertyEvidenceDocumentStatus.Submitted);
            if (c.Status == VerificationCaseStatus.Completed)
                return "Closed";
            if (docChecks.Any(ci => ci.Result == ChecklistResult.Concern) ||
                propDocs.Any(d => d.Status == PropertyEvidenceDocumentStatus.Rejected))
                return "Concern";
            if (pendingTitle > 0)
                return "PendingReview";
            if (docChecks.Count > 0 && docChecks.All(ci => ci.Result == ChecklistResult.Pass))
                return "DocsClear";
            if (docChecks.Any(ci => ci.Result != ChecklistResult.NotChecked))
                return "InReview";
            return "Awaiting";
        }

        var payloads = cases.Select(c =>
        {
            var propDocs = c.PropertyId.HasValue && titleDocsByProperty.TryGetValue(c.PropertyId.Value, out var list)
                ? list
                : new List<PropertyEvidenceDocument>();
            var docChecks = c.ChecklistItems
                .Where(ci => !ci.IsDeleted && DocumentChecklistCategories.Contains(ci.Category))
                .OrderBy(ci => ci.CheckCode)
                .ToList();
            var fileEvidence = c.Evidences
                .Where(e => !e.IsDeleted && DocumentEvidenceTypes.Contains(e.EvidenceType))
                .OrderByDescending(e => e.CapturedAtUtc)
                .ToList();
            var reviewStatus = DeriveDocReviewStatus(c, propDocs);

            return new
            {
                CaseId = c.Id,
                TargetName = c.Property != null
                    ? c.Property.Title
                    : (c.Project != null ? c.Project.Name : "Target Property"),
                TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                TargetArea = c.Property?.Area ?? c.Project?.Area ?? "",
                c.PropertyId,
                ServiceLevel = c.ServiceLevel.ToString(),
                CaseStatus = c.Status.ToString(),
                DocReviewStatus = reviewStatus,
                CustomerName = c.Customer?.FullName ?? "Customer",
                IsAssignedToMe = c.AssignedSpecialistId == currentUserId.Value,
                CanSelfAssign = c.Status == VerificationCaseStatus.Requested &&
                                c.AssignedSpecialistId == null &&
                                c.IsPaid,
                DocCheckCount = docChecks.Count,
                DocPassedCount = docChecks.Count(ci => ci.Result == ChecklistResult.Pass),
                DocConcernCount = docChecks.Count(ci => ci.Result == ChecklistResult.Concern),
                CaseFileCount = fileEvidence.Count,
                TitleDocCount = propDocs.Count,
                PendingTitleDocCount = propDocs.Count(d => d.Status == PropertyEvidenceDocumentStatus.Submitted),
                HasReport = c.Reports.Any(r => !r.IsDeleted),
                c.CreatedAtUtc,
                DocumentChecks = docChecks.Select(ci => new
                {
                    ci.Id,
                    ci.Category,
                    ci.CheckCode,
                    ci.CheckTitle,
                    Result = ci.Result.ToString(),
                    ci.Notes
                }),
                CaseFiles = fileEvidence.Select(e => new
                {
                    e.Id,
                    e.EvidenceType,
                    e.FileUrl,
                    e.StorageKey,
                    e.CapturedAtUtc
                }),
                TitleDocuments = propDocs.Select(d => new
                {
                    d.Id,
                    PropertyId = d.PropertyId,
                    DocumentType = d.DocumentType.ToString(),
                    d.FileName,
                    d.ContentType,
                    d.SizeBytes,
                    Status = d.Status.ToString(),
                    d.ReviewerNotes,
                    UploadedBy = d.UploadedByUser?.FullName ?? "Uploader",
                    d.UploadedAtUtc,
                    DownloadPath = $"/api/properties/{d.PropertyId}/evidence/{d.Id}/download"
                })
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(docStatus))
        {
            var ds = docStatus.Trim();
            payloads = payloads
                .Where(p => string.Equals(p.DocReviewStatus, ds, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var allCasesForSummary = await _context.VerificationCases
            .Include(c => c.ChecklistItems)
            .Where(c =>
                !c.IsDeleted &&
                (role != UserRole.Specialist.ToString() ||
                 c.AssignedSpecialistId == currentUserId.Value ||
                 c.Status == VerificationCaseStatus.Requested))
            .ToListAsync();

        var minePropertyIds = allCasesForSummary
            .Where(c => c.AssignedSpecialistId == currentUserId.Value && c.PropertyId.HasValue)
            .Select(c => c.PropertyId!.Value)
            .Distinct()
            .ToList();

        var pendingTitleGlobal = minePropertyIds.Count == 0
            ? 0
            : await _context.PropertyEvidenceDocuments.CountAsync(d =>
                !d.IsDeleted &&
                minePropertyIds.Contains(d.PropertyId) &&
                d.Status == PropertyEvidenceDocumentStatus.Submitted);

        return Ok(new
        {
            Specialist = new
            {
                specialist.Id,
                specialist.FullName,
                specialist.Email
            },
            Summary = new
            {
                CasesWithDocs = payloads.Count,
                PendingTitleDocs = pendingTitleGlobal,
                AwaitingCount = payloads.Count(p => p.DocReviewStatus == "Awaiting"),
                InReviewCount = payloads.Count(p => p.DocReviewStatus == "InReview"),
                PendingReviewCount = payloads.Count(p => p.DocReviewStatus == "PendingReview"),
                DocsClearCount = payloads.Count(p => p.DocReviewStatus == "DocsClear"),
                ConcernCount = payloads.Count(p => p.DocReviewStatus == "Concern"),
                FilteredCount = payloads.Count
            },
            Cases = payloads
        });
    }

    [HttpPost("specialist/documents/{docId:guid}/review")]
    [Authorize]
    public async Task<ActionResult<object>> ReviewTitleDocument(
        Guid docId,
        [FromBody] ReviewTitleDocumentDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var doc = await _context.PropertyEvidenceDocuments
            .Include(d => d.Property)
            .FirstOrDefaultAsync(d => d.Id == docId && !d.IsDeleted);
        if (doc == null)
            return NotFound(new { message = "Title evidence document not found." });

        if (dto.Approve)
        {
            doc.Status = PropertyEvidenceDocumentStatus.Accepted;
            doc.ReviewerNotes = dto.Notes ?? "Accepted by verification specialist.";
        }
        else
        {
            doc.Status = PropertyEvidenceDocumentStatus.Rejected;
            doc.ReviewerNotes = dto.Notes ?? "Rejected — insufficient or unverifiable document.";
        }

        if (role == UserRole.Specialist.ToString())
        {
            var linkedOrAssigned = await _context.VerificationCases.AnyAsync(c =>
                !c.IsDeleted &&
                c.PropertyId == doc.PropertyId &&
                c.AssignedSpecialistId == currentUserId.Value &&
                c.Status != VerificationCaseStatus.Cancelled);
            if (!linkedOrAssigned &&
                !(dto.LinkCaseId.HasValue &&
                  await _context.VerificationCases.AnyAsync(c =>
                      c.Id == dto.LinkCaseId.Value &&
                      !c.IsDeleted &&
                      c.AssignedSpecialistId == currentUserId.Value)))
            {
                return Forbid();
            }
        }

        if (dto.LinkCaseId.HasValue)
            doc.LinkedCaseId = dto.LinkCaseId;

        var audit = new AuditLog
        {
            EntityName = nameof(PropertyEvidenceDocument),
            EntityId = doc.Id.ToString(),
            Action = dto.Approve ? "TitleDocAccepted" : "TitleDocRejected",
            NewValuesJson = $"Status={doc.Status};PropertyId={doc.PropertyId}",
            Reason = doc.ReviewerNotes,
            ActorUserId = currentUserId
        };
        _context.AuditLogs.Add(audit);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            doc.Id,
            DocumentType = doc.DocumentType.ToString(),
            doc.FileName,
            Status = doc.Status.ToString(),
            doc.ReviewerNotes,
            message = dto.Approve ? "Document accepted." : "Document rejected."
        });
    }

    private static readonly HashSet<string> FieldEvidenceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "SitePhoto",
        "GPSObservation"
    };

    [HttpGet("specialist/evidence")]
    [Authorize]
    public async Task<ActionResult<object>> GetSpecialistEvidence(
        [FromQuery] string? scope = null,
        [FromQuery] string? evidenceType = null,
        [FromQuery] bool? hasGeo = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (specialist == null) return Unauthorized();

        var casesQuery = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.Evidences)
            .Include(c => c.Reports)
            .Where(c => !c.IsDeleted);

        if (role == UserRole.Specialist.ToString())
        {
            casesQuery = casesQuery.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value ||
                c.Status == VerificationCaseStatus.Requested);
        }

        var scopeKey = (scope ?? "active").Trim().ToLowerInvariant();
        casesQuery = scopeKey switch
        {
            "mine" => casesQuery.Where(c => c.AssignedSpecialistId == currentUserId.Value),
            "queue" => casesQuery.Where(c => c.Status == VerificationCaseStatus.Requested),
            "completed" => casesQuery.Where(c =>
                c.AssignedSpecialistId == currentUserId.Value &&
                c.Status == VerificationCaseStatus.Completed),
            "with-evidence" => casesQuery.Where(c =>
                c.Evidences.Any(e => !e.IsDeleted && FieldEvidenceTypes.Contains(e.EvidenceType))),
            "all" => casesQuery,
            _ => casesQuery.Where(c =>
                c.Status != VerificationCaseStatus.Completed &&
                c.Status != VerificationCaseStatus.Cancelled)
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            casesQuery = casesQuery.Where(c =>
                (c.Property != null && c.Property.Title.ToLower().Contains(q)) ||
                (c.Project != null && c.Project.Name.ToLower().Contains(q)) ||
                (c.Customer != null && c.Customer.FullName.ToLower().Contains(q)) ||
                (c.Property != null && c.Property.City.ToLower().Contains(q)));
        }

        var cases = await casesQuery
            .OrderByDescending(c => c.UpdatedAtUtc ?? c.CreatedAtUtc)
            .Take(100)
            .ToListAsync();

        var typeFilter = string.IsNullOrWhiteSpace(evidenceType) ||
                         string.Equals(evidenceType, "all", StringComparison.OrdinalIgnoreCase)
            ? null
            : evidenceType.Trim();

        var payloads = cases.Select(c =>
        {
            var fieldEvidence = c.Evidences
                .Where(e => !e.IsDeleted && FieldEvidenceTypes.Contains(e.EvidenceType))
                .OrderByDescending(e => e.CapturedAtUtc)
                .ToList();

            if (typeFilter != null)
            {
                fieldEvidence = fieldEvidence
                    .Where(e => string.Equals(e.EvidenceType, typeFilter, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            if (hasGeo == true)
                fieldEvidence = fieldEvidence.Where(e => e.Latitude.HasValue && e.Longitude.HasValue).ToList();
            else if (hasGeo == false)
                fieldEvidence = fieldEvidence.Where(e => !e.Latitude.HasValue || !e.Longitude.HasValue).ToList();

            return new
            {
                CaseId = c.Id,
                TargetName = c.Property != null
                    ? c.Property.Title
                    : (c.Project != null ? c.Project.Name : "Target Property"),
                TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                TargetArea = c.Property?.Area ?? c.Project?.Area ?? "",
                ServiceLevel = c.ServiceLevel.ToString(),
                CaseStatus = c.Status.ToString(),
                CustomerName = c.Customer?.FullName ?? "Customer",
                IsAssignedToMe = c.AssignedSpecialistId == currentUserId.Value,
                CanSelfAssign = c.Status == VerificationCaseStatus.Requested &&
                                c.AssignedSpecialistId == null &&
                                c.IsPaid,
                CanAddEvidence = c.AssignedSpecialistId == currentUserId.Value &&
                                 c.Status != VerificationCaseStatus.Completed &&
                                 c.Status != VerificationCaseStatus.Cancelled,
                EvidenceCount = fieldEvidence.Count,
                GeoTaggedCount = fieldEvidence.Count(e => e.Latitude.HasValue && e.Longitude.HasValue),
                SitePhotoCount = fieldEvidence.Count(e =>
                    string.Equals(e.EvidenceType, "SitePhoto", StringComparison.OrdinalIgnoreCase)),
                GpsObservationCount = fieldEvidence.Count(e =>
                    string.Equals(e.EvidenceType, "GPSObservation", StringComparison.OrdinalIgnoreCase)),
                HasReport = c.Reports.Any(r => !r.IsDeleted),
                c.CreatedAtUtc,
                Evidences = fieldEvidence.Select(e => new
                {
                    e.Id,
                    e.EvidenceType,
                    e.FileUrl,
                    e.StorageKey,
                    e.Latitude,
                    e.Longitude,
                    e.CapturedAtUtc,
                    HasGeo = e.Latitude.HasValue && e.Longitude.HasValue
                })
            };
        }).ToList();

        if (scopeKey == "with-evidence" || typeFilter != null || hasGeo.HasValue)
        {
            payloads = payloads.Where(p => p.EvidenceCount > 0).ToList();
        }

        var allVisible = await _context.VerificationCases
            .Include(c => c.Evidences)
            .Where(c =>
                !c.IsDeleted &&
                (role != UserRole.Specialist.ToString() ||
                 c.AssignedSpecialistId == currentUserId.Value ||
                 c.Status == VerificationCaseStatus.Requested))
            .ToListAsync();

        var mineEvidence = allVisible
            .Where(c => c.AssignedSpecialistId == currentUserId.Value)
            .SelectMany(c => c.Evidences.Where(e =>
                !e.IsDeleted && FieldEvidenceTypes.Contains(e.EvidenceType)))
            .ToList();

        return Ok(new
        {
            Specialist = new
            {
                specialist.Id,
                specialist.FullName,
                specialist.Email
            },
            Summary = new
            {
                CasesInView = payloads.Count,
                TotalEvidenceItems = mineEvidence.Count,
                GeoTaggedCount = mineEvidence.Count(e => e.Latitude.HasValue && e.Longitude.HasValue),
                SitePhotoCount = mineEvidence.Count(e =>
                    string.Equals(e.EvidenceType, "SitePhoto", StringComparison.OrdinalIgnoreCase)),
                GpsObservationCount = mineEvidence.Count(e =>
                    string.Equals(e.EvidenceType, "GPSObservation", StringComparison.OrdinalIgnoreCase)),
                CasesWithEvidence = allVisible.Count(c =>
                    c.AssignedSpecialistId == currentUserId.Value &&
                    c.Evidences.Any(e => !e.IsDeleted && FieldEvidenceTypes.Contains(e.EvidenceType))),
                FilteredCount = payloads.Count
            },
            Cases = payloads
        });
    }

    [HttpGet("specialist/reports")]
    [Authorize]
    public async Task<ActionResult<object>> GetSpecialistReports(
        [FromQuery] string? scope = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var role = _currentUserService.UserRole;
        if (role != UserRole.Specialist.ToString() && role != UserRole.SuperAdmin.ToString())
            return Forbid();

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (specialist == null) return Unauthorized();

        var reportsQuery = _context.VerificationReports
            .Include(r => r.Case!).ThenInclude(c => c!.Property)
            .Include(r => r.Case!).ThenInclude(c => c!.Project)
            .Include(r => r.Case!).ThenInclude(c => c!.Customer)
            .Include(r => r.Case!).ThenInclude(c => c!.ChecklistItems)
            .Where(r => !r.IsDeleted && r.Case != null && !r.Case.IsDeleted);

        if (role == UserRole.Specialist.ToString())
        {
            reportsQuery = reportsQuery.Where(r =>
                r.Case!.AssignedSpecialistId == currentUserId.Value ||
                r.ReviewerId == currentUserId.Value);
        }

        var scopeKey = (scope ?? "published").Trim().ToLowerInvariant();
        reportsQuery = scopeKey switch
        {
            "mine" => reportsQuery.Where(r => r.ReviewerId == currentUserId.Value),
            "recent" => reportsQuery.Where(r => r.PublishedAtUtc >= DateTime.UtcNow.AddDays(-30)),
            "all" => reportsQuery,
            _ => reportsQuery
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            reportsQuery = reportsQuery.Where(r =>
                (r.Case!.Property != null && r.Case.Property.Title.ToLower().Contains(q)) ||
                (r.Case.Project != null && r.Case.Project.Name.ToLower().Contains(q)) ||
                (r.Case.Customer != null && r.Case.Customer.FullName.ToLower().Contains(q)) ||
                r.Summary.ToLower().Contains(q));
        }

        var reports = await reportsQuery
            .OrderByDescending(r => r.PublishedAtUtc)
            .Take(100)
            .ToListAsync();

        var reportPayloads = reports.Select(r =>
        {
            var c = r.Case!;
            var checks = c.ChecklistItems.Where(ci => !ci.IsDeleted).ToList();
            return new
            {
                r.Id,
                CaseId = c.Id,
                r.Version,
                r.Summary,
                r.SpecialistNotes,
                r.CustomerRecommendations,
                r.Limitations,
                r.PublishedAtUtc,
                r.IsImmutable,
                TargetName = c.Property != null
                    ? c.Property.Title
                    : (c.Project != null ? c.Project.Name : "Target Property"),
                TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                TargetArea = c.Property?.Area ?? c.Project?.Area ?? "",
                ServiceLevel = c.ServiceLevel.ToString(),
                CaseStatus = c.Status.ToString(),
                CustomerName = c.Customer?.FullName ?? "Customer",
                TotalChecks = checks.Count,
                PassedChecks = checks.Count(ci => ci.Result == ChecklistResult.Pass),
                ConcernChecks = checks.Count(ci => ci.Result == ChecklistResult.Concern),
                UncheckedCount = checks.Count(ci => ci.Result == ChecklistResult.NotChecked),
                IsReviewedByMe = r.ReviewerId == currentUserId.Value
            };
        }).ToList();

        var candidateQuery = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .Include(c => c.Evidences)
            .Where(c =>
                !c.IsDeleted &&
                c.AssignedSpecialistId == currentUserId.Value &&
                c.Status != VerificationCaseStatus.Completed &&
                c.Status != VerificationCaseStatus.Cancelled &&
                !c.Reports.Any(r => !r.IsDeleted));

        var candidates = await candidateQuery
            .OrderByDescending(c => c.UpdatedAtUtc ?? c.CreatedAtUtc)
            .Take(50)
            .ToListAsync();

        var candidatePayloads = candidates.Select(c =>
        {
            var checks = c.ChecklistItems.Where(ci => !ci.IsDeleted).ToList();
            return new
            {
                CaseId = c.Id,
                TargetName = c.Property != null
                    ? c.Property.Title
                    : (c.Project != null ? c.Project.Name : "Target Property"),
                TargetCity = c.Property?.City ?? c.Project?.City ?? "",
                TargetArea = c.Property?.Area ?? c.Project?.Area ?? "",
                ServiceLevel = c.ServiceLevel.ToString(),
                CaseStatus = c.Status.ToString(),
                CustomerName = c.Customer?.FullName ?? "Customer",
                TotalChecks = checks.Count,
                PassedChecks = checks.Count(ci => ci.Result == ChecklistResult.Pass),
                ConcernChecks = checks.Count(ci => ci.Result == ChecklistResult.Concern),
                UncheckedCount = checks.Count(ci => ci.Result == ChecklistResult.NotChecked),
                EvidenceCount = c.Evidences.Count(e => !e.IsDeleted),
                ReadyToPublish = checks.Count > 0 &&
                                 checks.All(ci => ci.Result != ChecklistResult.NotChecked)
            };
        }).ToList();

        var allMyReports = await _context.VerificationReports
            .Where(r =>
                !r.IsDeleted &&
                (r.ReviewerId == currentUserId.Value ||
                 (r.Case != null && r.Case.AssignedSpecialistId == currentUserId.Value)))
            .ToListAsync();

        return Ok(new
        {
            Specialist = new
            {
                specialist.Id,
                specialist.FullName,
                specialist.Email
            },
            Summary = new
            {
                PublishedReportsCount = allMyReports.Count,
                CasesReadyToPublish = candidatePayloads.Count(p => p.ReadyToPublish),
                PublishCandidates = candidatePayloads.Count,
                LatestPublishedAtUtc = allMyReports.Count == 0
                    ? (DateTime?)null
                    : allMyReports.Max(r => r.PublishedAtUtc),
                FilteredCount = reportPayloads.Count
            },
            Reports = reportPayloads,
            PublishCandidates = candidatePayloads
        });
    }

    [HttpPost("cases")]
    [Authorize]
    public async Task<ActionResult<object>> CreateCase([FromBody] CreateVerificationCaseDto dto)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;
        var currentUserId = user!.Id;

        if (!dto.PropertyId.HasValue && !dto.ProjectId.HasValue)
            return BadRequest(new { message = "Select a listing (PropertyId) or developer project (ProjectId)." });

        if (!dto.AcknowledgeFee)
            return BadRequest(new { message = "Acknowledge the verification fee to continue (demo payment)." });

        if (dto.PropertyId.HasValue)
        {
            var propertyExists = await _context.Properties.AnyAsync(p => p.Id == dto.PropertyId.Value && !p.IsDeleted);
            if (!propertyExists)
                return NotFound(new { message = "Property not found." });

            var openExists = await _context.VerificationCases.AnyAsync(c =>
                c.PropertyId == dto.PropertyId.Value &&
                !c.IsDeleted &&
                c.Status != VerificationCaseStatus.Completed &&
                c.Status != VerificationCaseStatus.Cancelled);
            if (openExists)
                return Conflict(new { message = "An open verification case already exists for this listing." });
        }

        if (dto.ProjectId.HasValue)
        {
            var projectExists = await _context.Projects.AnyAsync(p =>
                p.Id == dto.ProjectId.Value && !p.IsDeleted && !p.IsArchived);
            if (!projectExists)
                return NotFound(new { message = "Project not found." });
        }

        decimal fee = dto.ServiceLevel switch
        {
            VerificationLevel.BasicDocumentReview => 15000m,
            VerificationLevel.PropertySiteVisit => 25000m,
            VerificationLevel.RecordCheck => 35000m,
            VerificationLevel.EnhancedDueDiligence => 60000m,
            VerificationLevel.LegalReview => 95000m,
            _ => 25000m
        };

        int slaHours = dto.ServiceLevel switch
        {
            VerificationLevel.BasicDocumentReview => 48,
            VerificationLevel.PropertySiteVisit => 72,
            VerificationLevel.RecordCheck => 96,
            VerificationLevel.EnhancedDueDiligence => 120,
            VerificationLevel.LegalReview => 168,
            _ => 72
        };

        var newCase = new VerificationCase
        {
            CustomerId = currentUserId,
            PropertyId = dto.PropertyId,
            ProjectId = dto.ProjectId,
            ServiceLevel = dto.ServiceLevel,
            Fee = fee,
            Currency = "PKR",
            Status = VerificationCaseStatus.Requested,
            SLAHours = slaHours,
            IsPaid = true,
            PaidAtUtc = DateTime.UtcNow
        };

        // Populate standardized Pakistan verification checklist items based on tier
        var defaultChecks = new List<(string Category, string Code, string Title)>
        {
            ("Identity", "CHK-ID-01", "Seller / Developer CNIC and Power of Attorney identity verification"),
            ("OwnershipEvidence", "CHK-OWN-01", "Registry / Sale Deed / Fard Malkiat consistency cross-check"),
            ("MutationTransfer", "CHK-MUT-01", "Intiqal / Mutation records and chain of title transfer verification"),
            ("SocietyApproval", "CHK-SOC-01", "Development Authority (LDA/RDA/CDA/SBCA) NOC & Layout Approval"),
            ("TaxesDues", "CHK-TAX-01", "Property Tax challans, society development charges & utility clearance")
        };

        if (dto.ServiceLevel >= VerificationLevel.PropertySiteVisit)
        {
            defaultChecks.Add(("SiteVisit", "CHK-VISIT-01", "Physical boundaries, access road, signage & possession status"));
            defaultChecks.Add(("SiteVisit", "CHK-VISIT-02", "GPS coordinate verification & high-res field photo capture"));
        }

        if (dto.ServiceLevel >= VerificationLevel.EnhancedDueDiligence)
        {
            defaultChecks.Add(("MortgageCharge", "CHK-MTG-01", "Bank charge, lien, mortgage & non-encumbrance verification"));
            defaultChecks.Add(("CourtDispute", "CHK-LIT-01", "Revenue / Civil Court dispute & stay order records scan"));
        }

        foreach (var (cat, code, title) in defaultChecks)
        {
            newCase.ChecklistItems.Add(new VerificationChecklistItem
            {
                Case = newCase,
                Category = cat,
                CheckCode = code,
                CheckTitle = title,
                Result = ChecklistResult.NotChecked
            });
        }

        // Attach submitted initial documents as evidence
        foreach (var doc in dto.Documents)
        {
            newCase.Evidences.Add(new VerificationEvidence
            {
                Case = newCase,
                EvidenceType = "SellerDoc",
                FileUrl = doc.FileUrl,
                StorageKey = doc.FileUrl,
                CapturedByUserId = currentUserId,
                CapturedAtUtc = DateTime.UtcNow
            });
        }

        _context.VerificationCases.Add(newCase);

        if (dto.PropertyId.HasValue)
        {
            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.Id == dto.PropertyId.Value && !p.IsDeleted);
            if (property != null && property.VerificationStatus != PropertyVerificationStatus.Verified)
            {
                property.VerificationStatus = PropertyVerificationStatus.InReview;
            }
        }

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = newCase.Id.ToString(),
            Action = "CaseRequested",
            NewValuesJson = $"Level={dto.ServiceLevel};Fee={fee};Paid=true;PropertyId={dto.PropertyId};ProjectId={dto.ProjectId}",
            Reason = dto.CustomerNotes ?? "Customer initiated paid property verification request.",
            ActorUserId = currentUserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCaseById), new { id = newCase.Id }, new
        {
            newCase.Id,
            newCase.PropertyId,
            newCase.ProjectId,
            ServiceLevel = newCase.ServiceLevel.ToString(),
            newCase.Fee,
            newCase.Currency,
            Status = newCase.Status.ToString(),
            newCase.IsPaid,
            newCase.SLAHours,
            newCase.CreatedAtUtc,
            TotalChecks = newCase.ChecklistItems.Count,
            message = "Verification case created. Fee acknowledged (demo payment)."
        });
    }

    [HttpGet("cases")]
    [Authorize]
    public async Task<ActionResult<object>> GetCases(
        [FromQuery] VerificationCaseStatus? status,
        [FromQuery] VerificationLevel? level)
    {
        var currentUserId = _currentUserService.UserId;
        var role = _currentUserService.UserRole;

        var query = _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .Where(c => !c.IsDeleted)
            .AsNoTracking();

        // Customer sees their own cases; Specialist sees assigned/open; Agent sees cases on owned listings
        if (role == UserRole.Customer.ToString() && currentUserId.HasValue)
        {
            query = query.Where(c => c.CustomerId == currentUserId.Value);
        }
        else if (role == UserRole.Specialist.ToString() && currentUserId.HasValue)
        {
            query = query.Where(c => c.AssignedSpecialistId == currentUserId.Value || c.Status == VerificationCaseStatus.Requested);
        }
        else if (role == UserRole.Agent.ToString() && currentUserId.HasValue)
        {
            var ownedPropertyIds = _context.Properties
                .Where(p => p.OwnerOrAgentId == currentUserId.Value && !p.IsDeleted)
                .Select(p => p.Id);
            query = query.Where(c =>
                c.CustomerId == currentUserId.Value ||
                (c.PropertyId.HasValue && ownedPropertyIds.Contains(c.PropertyId.Value)));
        }

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (level.HasValue)
            query = query.Where(c => c.ServiceLevel == level.Value);

        var cases = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .Select(c => new
            {
                c.Id,
                TargetName = c.Property != null ? c.Property.Title : (c.Project != null ? c.Project.Name : "Target Property"),
                TargetCity = c.Property != null ? c.Property.City : (c.Project != null ? c.Project.City : "Lahore"),
                TargetArea = c.Property != null ? c.Property.Area : (c.Project != null ? c.Project.Area : ""),
                ServiceLevel = c.ServiceLevel.ToString(),
                Status = c.Status.ToString(),
                c.Fee,
                c.Currency,
                c.SLAHours,
                CustomerName = c.Customer != null ? c.Customer.FullName : "Customer",
                SpecialistName = c.AssignedSpecialist != null ? c.AssignedSpecialist.FullName : "Unassigned",
                TotalChecks = c.ChecklistItems.Count,
                PassedChecks = c.ChecklistItems.Count(ci => ci.Result == ChecklistResult.Pass),
                ConcernChecks = c.ChecklistItems.Count(ci => ci.Result == ChecklistResult.Concern),
                HasReport = c.Reports.Any(),
                c.IsPaid,
                c.ScheduledVisitAtUtc,
                c.CreatedAtUtc,
                c.CompletedAtUtc
            })
            .ToListAsync();

        return Ok(cases);
    }

    [HttpGet("cases/{id:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> GetCaseById(Guid id)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.Customer)
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Evidences)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var role = user!.Role;
        var allowed = role == UserRole.SuperAdmin ||
                      vCase.CustomerId == user.Id ||
                      (role == UserRole.Specialist &&
                       (vCase.AssignedSpecialistId == user.Id ||
                        vCase.Status == VerificationCaseStatus.Requested)) ||
                      (role == UserRole.Agent && vCase.Property != null &&
                       vCase.Property.OwnerOrAgentId == user.Id);
        if (!allowed)
            return Forbid();

        var verifierSeesExact = vCase.Property != null &&
            PropertyLocationAccess.ViewerSeesExactPin(vCase.Property, _currentUserService);

        return Ok(new
        {
            vCase.Id,
            Target = new
            {
                Name = vCase.Property != null ? vCase.Property.Title : (vCase.Project != null ? vCase.Project.Name : "Target Property"),
                City = vCase.Property != null ? vCase.Property.City : (vCase.Project != null ? vCase.Project.City : "Lahore"),
                Area = vCase.Property != null ? vCase.Property.Area : (vCase.Project != null ? vCase.Project.Area : ""),
                PropertyId = vCase.PropertyId,
                ProjectId = vCase.ProjectId,
                Latitude = verifierSeesExact ? vCase.Property?.Latitude : null,
                Longitude = verifierSeesExact ? vCase.Property?.Longitude : null,
                PrivacyLevel = vCase.Property?.PrivacyLevel.ToString()
            },
            Customer = vCase.Customer != null ? new
            {
                vCase.Customer.Id,
                vCase.Customer.FullName,
                vCase.Customer.Email,
                vCase.Customer.PhoneNumber
            } : null,
            AssignedSpecialist = vCase.AssignedSpecialist != null ? new
            {
                vCase.AssignedSpecialist.Id,
                vCase.AssignedSpecialist.FullName,
                vCase.AssignedSpecialist.Email,
                vCase.AssignedSpecialist.PhoneNumber
            } : null,
            ServiceLevel = vCase.ServiceLevel.ToString(),
            Status = vCase.Status.ToString(),
            vCase.Fee,
            vCase.Currency,
            vCase.IsPaid,
            vCase.PaidAtUtc,
            vCase.SLAHours,
            vCase.ScheduledVisitAtUtc,
            vCase.VisitNotes,
            vCase.CancelReason,
            vCase.CreatedAtUtc,
            vCase.AssignedAtUtc,
            vCase.CompletedAtUtc,
            ChecklistItems = vCase.ChecklistItems.Where(ci => !ci.IsDeleted)
                .OrderBy(ci => ci.CheckCode)
                .Select(ci => new
                {
                    ci.Id,
                    ci.Category,
                    ci.CheckCode,
                    ci.CheckTitle,
                    Result = ci.Result.ToString(),
                    ci.Notes
                }),
            Evidences = vCase.Evidences.Where(e => !e.IsDeleted)
                .OrderByDescending(e => e.CapturedAtUtc)
                .Select(e => new
                {
                    e.Id,
                    e.EvidenceType,
                    e.FileUrl,
                    e.StorageKey,
                    e.FileChecksum,
                    e.Latitude,
                    e.Longitude,
                    e.CapturedAtUtc,
                    DownloadPath = $"/api/verification/cases/{vCase.Id}/evidence/{e.Id}/download"
                }),
            Reports = vCase.Reports.Where(r => !r.IsDeleted)
                .OrderByDescending(r => r.Version)
                .Select(r => new
                {
                    r.Id,
                    r.Version,
                    r.Summary,
                    r.Limitations,
                    r.SpecialistNotes,
                    r.CustomerRecommendations,
                    r.PublishedAtUtc,
                    r.IsImmutable
                })
        });
    }

    [HttpPost("cases/{id:guid}/assign")]
    [Authorize]
    public async Task<ActionResult<object>> AssignSpecialist(Guid id, [FromBody] AssignSpecialistDto? dto = null)
    {
        dto ??= new AssignSpecialistDto();
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;
        if (!IsSpecialistOrAdmin())
            return Forbid();

        var vCase = await _context.VerificationCases
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var mutableError = EnsureCaseMutable(vCase);
        if (mutableError != null) return mutableError;

        if (!vCase.IsPaid)
            return BadRequest(new { message = "Case fee has not been acknowledged/paid." });

        Guid specialistId;
        if (user!.Role == UserRole.Specialist)
            specialistId = user.Id;
        else if (dto.SpecialistId.HasValue)
            specialistId = dto.SpecialistId.Value;
        else
            return BadRequest(new { message = "SpecialistId is required." });

        var specialist = await _context.Users.FirstOrDefaultAsync(u =>
            u.Id == specialistId && !u.IsDeleted &&
            (u.Role == UserRole.Specialist || u.Role == UserRole.SuperAdmin));
        if (specialist == null)
            return NotFound(new { message = "Specialist user not found." });

        vCase.AssignedSpecialistId = specialist.Id;
        vCase.AssignedAtUtc = DateTime.UtcNow;
        vCase.Status = VerificationCaseStatus.Assigned;

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = vCase.Id.ToString(),
            Action = "CaseAssigned",
            NewValuesJson = $"SpecialistId={specialist.Id};SpecialistName={specialist.FullName};Status=Assigned",
            Reason = dto.AssignmentNotes ?? "Verification case assigned to specialist.",
            ActorUserId = user.Id
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = $"Case assigned to {specialist.FullName}.",
            caseId = vCase.Id,
            specialistId = specialist.Id,
            specialistName = specialist.FullName,
            status = vCase.Status.ToString()
        });
    }

    [HttpPut("cases/{id:guid}/checklist/{itemId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateChecklistItem(
        Guid id,
        Guid itemId,
        [FromBody] UpdateChecklistItemDto dto)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var item = await _context.VerificationChecklistItems
            .Include(ci => ci.Case)!.ThenInclude(c => c!.Reports)
            .FirstOrDefaultAsync(ci => ci.Id == itemId && ci.CaseId == id && !ci.IsDeleted);

        if (item?.Case == null)
            return NotFound(new { message = "Checklist item not found." });

        var ownError = EnsureSpecialistOwnsOrAdmin(item.Case, user!);
        if (ownError != null) return ownError;
        if (!item.Case.AssignedSpecialistId.HasValue && user!.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Assign the case before updating checklist items." });

        var mutableError = EnsureCaseMutable(item.Case);
        if (mutableError != null) return mutableError;

        item.Result = dto.Result;
        item.Notes = dto.Notes;
        item.ReviewerId = user!.Id;

        if (item.Case.Status == VerificationCaseStatus.Assigned)
            item.Case.Status = VerificationCaseStatus.InProgress;

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationChecklistItem),
            EntityId = item.Id.ToString(),
            Action = "ChecklistUpdated",
            NewValuesJson = $"Code={item.CheckCode};Result={dto.Result}",
            Reason = dto.Notes ?? $"Checklist item marked as {dto.Result}.",
            ActorUserId = user.Id
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            item.Id,
            item.CheckCode,
            item.CheckTitle,
            Result = item.Result.ToString(),
            item.Notes,
            caseStatus = item.Case.Status.ToString()
        });
    }

    [HttpPost("cases/{id:guid}/evidence")]
    [Authorize]
    public async Task<ActionResult<object>> AddEvidence(Guid id, [FromBody] AddEvidenceDto dto)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var ownError = EnsureSpecialistOwnsOrAdmin(vCase, user!);
        if (ownError != null) return ownError;
        if (!vCase.AssignedSpecialistId.HasValue && user!.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Assign the case before adding evidence." });

        var mutableError = EnsureCaseMutable(vCase);
        if (mutableError != null) return mutableError;

        if (string.IsNullOrWhiteSpace(dto.FileUrl) && string.IsNullOrWhiteSpace(dto.StorageKey))
            return BadRequest(new { message = "Provide FileUrl or use the multipart upload endpoint." });

        var evidence = new VerificationEvidence
        {
            CaseId = id,
            EvidenceType = string.IsNullOrWhiteSpace(dto.EvidenceType) ? "SitePhoto" : dto.EvidenceType.Trim(),
            FileUrl = dto.FileUrl?.Trim() ?? string.Empty,
            StorageKey = string.IsNullOrWhiteSpace(dto.StorageKey) ? (dto.FileUrl?.Trim() ?? "") : dto.StorageKey.Trim(),
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            CapturedAtUtc = DateTime.UtcNow,
            CapturedByUserId = user!.Id
        };

        _context.VerificationEvidences.Add(evidence);

        if (vCase.Status == VerificationCaseStatus.Assigned)
            vCase.Status = VerificationCaseStatus.InProgress;

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationEvidence),
            EntityId = evidence.Id.ToString(),
            Action = "EvidenceUploaded",
            NewValuesJson = $"Type={evidence.EvidenceType};FileUrl={evidence.FileUrl};Lat={dto.Latitude};Lng={dto.Longitude}",
            Reason = dto.Notes ?? "Field evidence uploaded for verification case.",
            ActorUserId = user.Id
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            evidence.Id,
            evidence.CaseId,
            evidence.EvidenceType,
            evidence.FileUrl,
            evidence.StorageKey,
            evidence.Latitude,
            evidence.Longitude,
            evidence.CapturedAtUtc,
            DownloadPath = $"/api/verification/cases/{id}/evidence/{evidence.Id}/download"
        });
    }

    [HttpPost("cases/{id:guid}/evidence/upload")]
    [Authorize]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<object>> UploadEvidenceFile(
        Guid id,
        IFormFile? file,
        [FromForm] string evidenceType = "SitePhoto",
        [FromForm] double? latitude = null,
        [FromForm] double? longitude = null,
        [FromForm] string? notes = null)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var ownError = EnsureSpecialistOwnsOrAdmin(vCase, user!);
        if (ownError != null) return ownError;
        if (!vCase.AssignedSpecialistId.HasValue && user!.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Assign the case before uploading evidence." });

        var mutableError = EnsureCaseMutable(vCase);
        if (mutableError != null) return mutableError;

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Evidence file is required." });

        var contentType = file.ContentType ?? "application/octet-stream";
        var isPdf = contentType.Contains("pdf", StringComparison.OrdinalIgnoreCase) ||
                    file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        var isImage = contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
        if (!isPdf && !isImage)
            return BadRequest(new { message = "Only PDF or image evidence files are supported." });

        await using var readStream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await readStream.CopyToAsync(ms);
        var bytes = ms.ToArray();
        var checksum = Convert.ToHexString(SHA256.HashData(bytes));

        await using var uploadStream = new MemoryStream(bytes);
        var storageKey = await _fileStorage.UploadFileAsync(
            file.FileName, uploadStream, contentType, isPrivate: true);

        var evidence = new VerificationEvidence
        {
            CaseId = id,
            EvidenceType = string.IsNullOrWhiteSpace(evidenceType) ? "SitePhoto" : evidenceType.Trim(),
            FileUrl = storageKey,
            StorageKey = storageKey,
            FileChecksum = checksum,
            Latitude = latitude,
            Longitude = longitude,
            CapturedAtUtc = DateTime.UtcNow,
            CapturedByUserId = user!.Id
        };
        _context.VerificationEvidences.Add(evidence);

        if (vCase.Status == VerificationCaseStatus.Assigned)
            vCase.Status = VerificationCaseStatus.InProgress;

        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(VerificationEvidence),
            EntityId = evidence.Id.ToString(),
            Action = "EvidenceFileUploaded",
            NewValuesJson = $"Type={evidence.EvidenceType};StorageKey={storageKey};Checksum={checksum}",
            Reason = notes ?? "Field evidence file uploaded.",
            ActorUserId = user.Id
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            evidence.Id,
            evidence.CaseId,
            evidence.EvidenceType,
            evidence.StorageKey,
            evidence.FileChecksum,
            evidence.Latitude,
            evidence.Longitude,
            evidence.CapturedAtUtc,
            DownloadPath = $"/api/verification/cases/{id}/evidence/{evidence.Id}/download",
            message = "Evidence file stored."
        });
    }

    [HttpGet("cases/{id:guid}/evidence/{evidenceId:guid}/download")]
    [Authorize]
    public async Task<IActionResult> DownloadEvidence(Guid id, Guid evidenceId)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError!;

        var vCase = await _context.VerificationCases
            .Include(c => c.Property)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var role = user!.Role;
        var allowed = role == UserRole.SuperAdmin ||
                      vCase.CustomerId == user.Id ||
                      (role == UserRole.Specialist &&
                       (vCase.AssignedSpecialistId == user.Id ||
                        vCase.Status == VerificationCaseStatus.Requested)) ||
                      (role == UserRole.Agent && vCase.Property != null &&
                       vCase.Property.OwnerOrAgentId == user.Id);
        if (!allowed)
            return Forbid();

        var evidence = await _context.VerificationEvidences
            .FirstOrDefaultAsync(e => e.Id == evidenceId && e.CaseId == id && !e.IsDeleted);
        if (evidence == null)
            return NotFound(new { message = "Evidence not found." });

        if (string.IsNullOrWhiteSpace(evidence.StorageKey) ||
            evidence.StorageKey.StartsWith("http", StringComparison.OrdinalIgnoreCase) ||
            evidence.StorageKey.StartsWith("documents/", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrWhiteSpace(evidence.FileUrl) &&
                evidence.FileUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                return Redirect(evidence.FileUrl);
            return NotFound(new { message = "No downloadable file for this evidence entry." });
        }

        var stream = await _fileStorage.GetFileAsync(evidence.StorageKey);
        if (stream == null)
            return NotFound(new { message = "Evidence file missing from storage." });

        var fileName = Path.GetFileName(evidence.StorageKey);
        var contentType = fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
            ? "application/pdf"
            : "application/octet-stream";
        return File(stream, contentType, fileName);
    }

    [HttpPut("cases/{id:guid}/schedule-visit")]
    [Authorize]
    public async Task<ActionResult<object>> ScheduleVisit(Guid id, [FromBody] ScheduleVisitDto dto)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var ownError = EnsureSpecialistOwnsOrAdmin(vCase, user!);
        if (ownError != null) return ownError;
        if (!vCase.AssignedSpecialistId.HasValue && user!.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Assign the case before scheduling a visit." });

        var mutableError = EnsureCaseMutable(vCase);
        if (mutableError != null) return mutableError;

        if (vCase.ServiceLevel < VerificationLevel.PropertySiteVisit)
            return BadRequest(new { message = "This service level does not include a site visit." });

        vCase.ScheduledVisitAtUtc = dto.ScheduledVisitAtUtc.ToUniversalTime();
        vCase.VisitNotes = string.IsNullOrWhiteSpace(dto.VisitNotes) ? null : dto.VisitNotes.Trim();
        if (vCase.Status == VerificationCaseStatus.Assigned)
            vCase.Status = VerificationCaseStatus.InProgress;

        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = vCase.Id.ToString(),
            Action = "VisitScheduled",
            NewValuesJson = $"ScheduledVisitAtUtc={vCase.ScheduledVisitAtUtc:o}",
            Reason = vCase.VisitNotes ?? "Site visit scheduled.",
            ActorUserId = user!.Id
        });

        await _context.SaveChangesAsync();
        return Ok(new
        {
            vCase.Id,
            vCase.ScheduledVisitAtUtc,
            vCase.VisitNotes,
            status = vCase.Status.ToString(),
            message = "Site visit scheduled."
        });
    }

    [HttpPost("cases/{id:guid}/review-pending")]
    [Authorize]
    public async Task<ActionResult<object>> MarkReviewPending(Guid id)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var ownError = EnsureSpecialistOwnsOrAdmin(vCase, user!);
        if (ownError != null) return ownError;
        var mutableError = EnsureCaseMutable(vCase);
        if (mutableError != null) return mutableError;

        var uncheckedCount = vCase.ChecklistItems.Count(ci =>
            !ci.IsDeleted && ci.Result == ChecklistResult.NotChecked);
        if (uncheckedCount > 0)
            return BadRequest(new { message = $"{uncheckedCount} checklist item(s) still NotChecked." });

        vCase.Status = VerificationCaseStatus.ReviewPending;
        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = vCase.Id.ToString(),
            Action = "ReviewPending",
            NewValuesJson = "Status=ReviewPending",
            Reason = "Specialist marked case ready for final report review.",
            ActorUserId = user!.Id
        });
        await _context.SaveChangesAsync();
        return Ok(new { vCase.Id, status = vCase.Status.ToString(), message = "Case moved to Review Pending." });
    }

    [HttpPost("cases/{id:guid}/cancel")]
    [Authorize]
    public async Task<ActionResult<object>> CancelCase(Guid id, [FromBody] CancelVerificationCaseDto? dto = null)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        if (vCase.Status == VerificationCaseStatus.Cancelled)
            return BadRequest(new { message = "Case is already cancelled." });
        if (vCase.Status == VerificationCaseStatus.Completed)
            return Conflict(new { message = "Completed cases cannot be cancelled." });

        var role = user!.Role;
        var allowed = role == UserRole.SuperAdmin ||
                      vCase.CustomerId == user.Id ||
                      (role == UserRole.Specialist && vCase.AssignedSpecialistId == user.Id) ||
                      (role == UserRole.Agent && vCase.Property != null &&
                       vCase.Property.OwnerOrAgentId == user.Id);
        if (!allowed)
            return Forbid();

        vCase.Status = VerificationCaseStatus.Cancelled;
        vCase.CancelReason = string.IsNullOrWhiteSpace(dto?.Reason)
            ? "Cancelled from workspace."
            : dto!.Reason!.Trim();
        vCase.CompletedAtUtc = DateTime.UtcNow;

        if (vCase.Property != null &&
            vCase.Property.VerificationStatus == PropertyVerificationStatus.InReview)
        {
            var otherOpen = await _context.VerificationCases.AnyAsync(c =>
                c.Id != vCase.Id &&
                c.PropertyId == vCase.PropertyId &&
                !c.IsDeleted &&
                c.Status != VerificationCaseStatus.Cancelled &&
                c.Status != VerificationCaseStatus.Completed);
            if (!otherOpen)
                vCase.Property.VerificationStatus = PropertyVerificationStatus.Unverified;
        }

        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = vCase.Id.ToString(),
            Action = "CaseCancelled",
            NewValuesJson = $"Status=Cancelled;Reason={vCase.CancelReason}",
            Reason = vCase.CancelReason,
            ActorUserId = user.Id
        });
        await _context.SaveChangesAsync();
        return Ok(new { vCase.Id, status = vCase.Status.ToString(), message = "Verification case cancelled." });
    }

    [HttpPost("cases/{id:guid}/generate-report")]
    [Authorize]
    public async Task<ActionResult<object>> GenerateReport(Guid id, [FromBody] GenerateReportDto dto)
    {
        var (user, authError) = await RequireAuthenticatedUserAsync();
        if (authError != null) return authError;

        var vCase = await _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var ownError = EnsureSpecialistOwnsOrAdmin(vCase, user!);
        if (ownError != null) return ownError;
        if (!vCase.AssignedSpecialistId.HasValue && user!.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Assign the case before publishing a report." });
        if (!vCase.IsPaid)
            return BadRequest(new { message = "Cannot publish — case fee is unpaid." });

        if (vCase.Status == VerificationCaseStatus.Cancelled)
            return BadRequest(new { message = "Cancelled cases cannot be published." });
        if (vCase.Status == VerificationCaseStatus.Completed ||
            vCase.Reports.Any(r => r.IsImmutable && !r.IsDeleted))
            return Conflict(new { message = "An immutable report already exists for this case." });

        var activeChecks = vCase.ChecklistItems.Where(ci => !ci.IsDeleted).ToList();
        if (activeChecks.Count == 0)
            return BadRequest(new { message = "Case has no checklist items." });
        if (activeChecks.Any(ci => ci.Result == ChecklistResult.NotChecked))
            return BadRequest(new { message = "Complete all checklist items before publishing." });
        if (string.IsNullOrWhiteSpace(dto.Summary))
            return BadRequest(new { message = "Report summary is required." });

        var currentUserId = user!.Id;
        var nextVersion = vCase.Reports.Count(r => !r.IsDeleted) + 1;

        // Mandatory Pakistan verification limitations disclaimer per master product specification
        var mandatoryDisclaimer = dto.Limitations ??
            "This report is an evidence-based verification summary and does not constitute a government title certificate or formal legal advice. " +
            "Findings reflect records, site observations, and documentation available at the time of review. " +
            "Final registration and title mutation remain subject to the relevant Land Revenue Authority and qualified legal counsel.";

        var report = new VerificationReport
        {
            CaseId = vCase.Id,
            Version = nextVersion,
            Summary = dto.Summary.Trim(),
            SpecialistNotes = dto.SpecialistNotes,
            CustomerRecommendations = dto.CustomerRecommendations,
            Limitations = mandatoryDisclaimer,
            ReviewerId = currentUserId,
            PublishedAtUtc = DateTime.UtcNow,
            IsImmutable = true
        };

        _context.VerificationReports.Add(report);

        vCase.Status = VerificationCaseStatus.Completed;
        vCase.CompletedAtUtc = DateTime.UtcNow;

        // If all checks passed and no severe concern exists, mark property verified
        var hasConcern = activeChecks.Any(ci => ci.Result == ChecklistResult.Concern);
        if (!hasConcern && vCase.Property != null)
        {
            vCase.Property.VerificationStatus = PropertyVerificationStatus.Verified;
        }

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationReport),
            EntityId = report.Id.ToString(),
            Action = "ReportGenerated",
            NewValuesJson = $"Version={nextVersion};CaseStatus=Completed;PropertyVerified={!hasConcern};Immutable=true",
            Reason = "Verification case finalized and immutable report published.",
            ActorUserId = currentUserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            report.Id,
            report.CaseId,
            report.Version,
            report.Summary,
            report.Limitations,
            report.SpecialistNotes,
            report.CustomerRecommendations,
            report.PublishedAtUtc,
            CaseStatus = vCase.Status.ToString(),
            PropertyVerificationStatus = vCase.Property?.VerificationStatus.ToString()
        });
    }
}
