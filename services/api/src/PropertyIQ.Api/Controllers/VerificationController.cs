using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    public VerificationController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
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

    [HttpPost("cases")]
    public async Task<ActionResult<object>> CreateCase([FromBody] CreateVerificationCaseDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (!currentUserId.HasValue)
        {
            var demoBuyer = await _context.Users.FirstOrDefaultAsync(u => u.Email == "buyer@gmail.com");
            currentUserId = demoBuyer?.Id ?? Guid.NewGuid();
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
            CustomerId = currentUserId.Value,
            PropertyId = dto.PropertyId,
            ProjectId = dto.ProjectId,
            ServiceLevel = dto.ServiceLevel,
            Fee = fee,
            Currency = "PKR",
            Status = VerificationCaseStatus.Requested,
            SLAHours = slaHours
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
                CapturedByUserId = currentUserId.Value,
                CapturedAtUtc = DateTime.UtcNow
            });
        }

        _context.VerificationCases.Add(newCase);

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = newCase.Id.ToString(),
            Action = "CaseRequested",
            NewValuesJson = $"Level={dto.ServiceLevel};Fee={fee}",
            Reason = dto.CustomerNotes ?? "Customer initiated paid property verification request.",
            ActorUserId = currentUserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCaseById), new { id = newCase.Id }, new
        {
            newCase.Id,
            ServiceLevel = newCase.ServiceLevel.ToString(),
            newCase.Fee,
            newCase.Currency,
            Status = newCase.Status.ToString(),
            newCase.SLAHours,
            newCase.CreatedAtUtc,
            TotalChecks = newCase.ChecklistItems.Count
        });
    }

    [HttpGet("cases")]
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

        // Customer sees their own cases; Specialist sees assigned; Admin sees all
        if (role == UserRole.Customer.ToString() && currentUserId.HasValue)
        {
            query = query.Where(c => c.CustomerId == currentUserId.Value);
        }
        else if (role == UserRole.Specialist.ToString() && currentUserId.HasValue)
        {
            query = query.Where(c => c.AssignedSpecialistId == currentUserId.Value || c.Status == VerificationCaseStatus.Requested);
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
                c.CreatedAtUtc,
                c.CompletedAtUtc
            })
            .ToListAsync();

        return Ok(cases);
    }

    [HttpGet("cases/{id:guid}")]
    public async Task<ActionResult<object>> GetCaseById(Guid id)
    {
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

        return Ok(new
        {
            vCase.Id,
            Target = new
            {
                Name = vCase.Property != null ? vCase.Property.Title : (vCase.Project != null ? vCase.Project.Name : "Target Property"),
                City = vCase.Property != null ? vCase.Property.City : (vCase.Project != null ? vCase.Project.City : "Lahore"),
                Area = vCase.Property != null ? vCase.Property.Area : (vCase.Project != null ? vCase.Project.Area : ""),
                PropertyId = vCase.PropertyId,
                ProjectId = vCase.ProjectId
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
            vCase.SLAHours,
            vCase.CreatedAtUtc,
            vCase.AssignedAtUtc,
            vCase.CompletedAtUtc,
            ChecklistItems = vCase.ChecklistItems
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
            Evidences = vCase.Evidences
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
            Reports = vCase.Reports
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
    public async Task<ActionResult<object>> AssignSpecialist(Guid id, [FromBody] AssignSpecialistDto dto)
    {
        var vCase = await _context.VerificationCases
            .Include(c => c.AssignedSpecialist)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var specialist = await _context.Users.FirstOrDefaultAsync(u => u.Id == dto.SpecialistId && !u.IsDeleted);
        if (specialist == null)
            return NotFound(new { message = "Specialist user not found." });

        vCase.AssignedSpecialistId = specialist.Id;
        vCase.AssignedAtUtc = DateTime.UtcNow;
        vCase.Status = VerificationCaseStatus.InProgress;

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = vCase.Id.ToString(),
            Action = "CaseAssigned",
            NewValuesJson = $"SpecialistId={specialist.Id};SpecialistName={specialist.FullName}",
            Reason = dto.AssignmentNotes ?? "Verification case assigned to specialist.",
            ActorUserId = _currentUserService.UserId
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
    public async Task<ActionResult<object>> UpdateChecklistItem(
        Guid id,
        Guid itemId,
        [FromBody] UpdateChecklistItemDto dto)
    {
        var item = await _context.VerificationChecklistItems
            .Include(ci => ci.Case)
            .FirstOrDefaultAsync(ci => ci.Id == itemId && ci.CaseId == id && !ci.IsDeleted);

        if (item == null)
            return NotFound(new { message = "Checklist item not found." });

        item.Result = dto.Result;
        item.Notes = dto.Notes;
        item.ReviewerId = _currentUserService.UserId;

        if (item.Case != null && item.Case.Status == VerificationCaseStatus.Assigned)
        {
            item.Case.Status = VerificationCaseStatus.InProgress;
        }

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationChecklistItem),
            EntityId = item.Id.ToString(),
            Action = "ChecklistUpdated",
            NewValuesJson = $"Code={item.CheckCode};Result={dto.Result}",
            Reason = dto.Notes ?? $"Checklist item marked as {dto.Result}.",
            ActorUserId = _currentUserService.UserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            item.Id,
            item.CheckCode,
            item.CheckTitle,
            Result = item.Result.ToString(),
            item.Notes
        });
    }

    [HttpPost("cases/{id:guid}/evidence")]
    public async Task<ActionResult<object>> AddEvidence(Guid id, [FromBody] AddEvidenceDto dto)
    {
        var vCase = await _context.VerificationCases.FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);
        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var evidence = new VerificationEvidence
        {
            CaseId = id,
            EvidenceType = dto.EvidenceType,
            FileUrl = dto.FileUrl,
            StorageKey = dto.StorageKey,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            CapturedAtUtc = DateTime.UtcNow,
            CapturedByUserId = _currentUserService.UserId ?? Guid.NewGuid()
        };

        _context.VerificationEvidences.Add(evidence);

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationEvidence),
            EntityId = evidence.Id.ToString(),
            Action = "EvidenceUploaded",
            NewValuesJson = $"Type={dto.EvidenceType};FileUrl={dto.FileUrl};Lat={dto.Latitude};Lng={dto.Longitude}",
            Reason = dto.Notes ?? "Field evidence uploaded for verification case.",
            ActorUserId = _currentUserService.UserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            evidence.Id,
            evidence.CaseId,
            evidence.EvidenceType,
            evidence.FileUrl,
            evidence.Latitude,
            evidence.Longitude,
            evidence.CapturedAtUtc
        });
    }

    [HttpPost("cases/{id:guid}/generate-report")]
    public async Task<ActionResult<object>> GenerateReport(Guid id, [FromBody] GenerateReportDto dto)
    {
        var vCase = await _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

        if (vCase == null)
            return NotFound(new { message = "Verification case not found." });

        var currentUserId = _currentUserService.UserId ?? Guid.NewGuid();
        var nextVersion = vCase.Reports.Count + 1;

        // Mandatory Pakistan verification limitations disclaimer per master product specification
        var mandatoryDisclaimer = dto.Limitations ??
            "This report is an evidence-based verification summary and does not constitute a government title certificate or formal legal advice. " +
            "Findings reflect records, site observations, and documentation available at the time of review. " +
            "Final registration and title mutation remain subject to the relevant Land Revenue Authority and qualified legal counsel.";

        var report = new VerificationReport
        {
            CaseId = vCase.Id,
            Version = nextVersion,
            Summary = dto.Summary,
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
        var hasConcern = vCase.ChecklistItems.Any(ci => ci.Result == ChecklistResult.Concern);
        if (!hasConcern && vCase.Property != null)
        {
            vCase.Property.VerificationStatus = PropertyVerificationStatus.Verified;
        }

        var audit = new AuditLog
        {
            EntityName = nameof(VerificationReport),
            EntityId = report.Id.ToString(),
            Action = "ReportGenerated",
            NewValuesJson = $"Version={nextVersion};CaseStatus=Completed;PropertyVerified={!hasConcern}",
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
