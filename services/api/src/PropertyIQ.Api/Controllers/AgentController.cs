using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Agent;
using PropertyIQ.Application.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AgentController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAiServiceClient _aiClient;
    private readonly ILogger<AgentController> _logger;

    public AgentController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IAiServiceClient aiClient,
        ILogger<AgentController> logger)
    {
        _context = context;
        _currentUserService = currentUserService;
        _aiClient = aiClient;
        _logger = logger;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<AgentDashboardDto>> GetAgentDashboard()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var listings = await _context.Properties
            .Include(p => p.Media)
            .Where(p => p.OwnerOrAgentId == userId.Value && !p.IsDeleted)
            .ToListAsync();

        var activeCount = listings.Count(l => l.Status == ListingStatus.Published);
        var listingIds = listings.Select(l => l.Id).ToList();

        var totalSaves = await _context.SavedProperties.CountAsync(s => listingIds.Contains(s.PropertyId));
        var totalViews = await _context.PropertyViews.CountAsync(v =>
            listingIds.Contains(v.PropertyId) && !v.IsDeleted);
        var leads = await _context.Inquiries.Where(i => i.TargetAgentOrDeveloperId == userId.Value && !i.IsDeleted).ToListAsync();
        var pendingLeads = leads.Count(l => l.Status == InquiryStatus.New);

        var visitsUpcoming = await _context.AgentVisits.CountAsync(v =>
            v.AgentUserId == userId.Value &&
            !v.IsDeleted &&
            v.ScheduledAtUtc >= DateTime.UtcNow &&
            (v.Status == AgentVisitStatus.Requested || v.Status == AgentVisitStatus.Confirmed));

        var unverifiedCount = listings.Count(l => l.VerificationStatus == PropertyVerificationStatus.Unverified);
        var inReviewCount = listings.Count(l => l.VerificationStatus == PropertyVerificationStatus.InReview);

        // Weak listing recommendations (completeness scorer + Phase D Ollama polish)
        var weakListings = new List<AgentWeakListingAlertDto>();
        var qualityDirty = false;
        foreach (var l in listings.Where(x => x.Status == ListingStatus.Published || x.Status == ListingStatus.Draft))
        {
            var quality = ListingQualityScorer.Score(l);
            if (l.ListingQualityScore != quality.Score)
            {
                l.ListingQualityScore = quality.Score;
                qualityDirty = true;
            }

            if (quality.PhotoCount < 5)
            {
                weakListings.Add(new AgentWeakListingAlertDto
                {
                    PropertyId = l.Id,
                    Title = l.Title,
                    Issue = $"Only {quality.PhotoCount} photos uploaded (minimum 5 recommended) · quality {quality.Score}%",
                    Recommendation = "Upload kitchen, elevation, and washroom photos to improve listing completeness.",
                    AlertType = "Photos",
                    City = l.City,
                    Area = l.Area,
                    PropertyType = l.PropertyType.ToString(),
                    LandArea = l.LandArea,
                    LandAreaUnit = l.LandAreaUnit.ToString(),
                    AskingPrice = l.Price,
                    Bedrooms = l.Bedrooms,
                    Priority = 30 - Math.Min(quality.PhotoCount, 5) * 3
                });
            }
            else if (!quality.HasExterior || !quality.HasKitchen || !quality.HasBathroom)
            {
                var missing = new List<string>();
                if (!quality.HasExterior) missing.Add("exterior/elevation");
                if (!quality.HasKitchen) missing.Add("kitchen");
                if (!quality.HasBathroom) missing.Add("bathroom");
                weakListings.Add(new AgentWeakListingAlertDto
                {
                    PropertyId = l.Id,
                    Title = l.Title,
                    Issue = $"Photo mix incomplete — missing {string.Join(", ", missing)} · quality {quality.Score}%",
                    Recommendation = $"Add {string.Join(", ", missing)} photos so buyers see the full property.",
                    AlertType = "MediaMix",
                    City = l.City,
                    Area = l.Area,
                    PropertyType = l.PropertyType.ToString(),
                    LandArea = l.LandArea,
                    LandAreaUnit = l.LandAreaUnit.ToString(),
                    AskingPrice = l.Price,
                    Bedrooms = l.Bedrooms,
                    Priority = 18
                });
            }
            else if (l.Price > 100000000m && l.ExpectedRentMin == null && l.Purpose == PropertyPurpose.Sale)
            {
                weakListings.Add(new AgentWeakListingAlertDto
                {
                    PropertyId = l.Id,
                    Title = l.Title,
                    Issue = $"Missing estimated rental yield context · quality {quality.Score}%",
                    Recommendation = "Run AI rent scenario and save estimated rent on this listing.",
                    AlertType = "RentScenario",
                    City = l.City,
                    Area = l.Area,
                    PropertyType = l.PropertyType.ToString(),
                    LandArea = l.LandArea,
                    LandAreaUnit = l.LandAreaUnit.ToString(),
                    AskingPrice = l.Price,
                    Bedrooms = l.Bedrooms,
                    Priority = 12
                });
            }
            else if (quality.Score < 70 && quality.Gaps.Count > 0)
            {
                weakListings.Add(new AgentWeakListingAlertDto
                {
                    PropertyId = l.Id,
                    Title = l.Title,
                    Issue = $"Listing completeness {quality.Score}%",
                    Recommendation = quality.Gaps[0],
                    AlertType = "Completeness",
                    City = l.City,
                    Area = l.Area,
                    PropertyType = l.PropertyType.ToString(),
                    LandArea = l.LandArea,
                    LandAreaUnit = l.LandAreaUnit.ToString(),
                    AskingPrice = l.Price,
                    Bedrooms = l.Bedrooms,
                    Priority = 10
                });
            }
        }

        if (qualityDirty)
            await _context.SaveChangesAsync();

        weakListings = weakListings
            .OrderByDescending(w => w.Priority)
            .ThenBy(w => w.Title)
            .Take(12)
            .ToList();

        // Stats-only daily brief — no invented market claims
        var briefingParts = new List<string>
        {
            $"You have {activeCount} active listing{(activeCount == 1 ? "" : "s")}.",
            $"{pendingLeads} new lead{(pendingLeads == 1 ? "" : "s")} need follow-up ({leads.Count} total).",
            $"{totalViews} listing view{(totalViews == 1 ? "" : "s")} and {totalSaves} wishlist save{(totalSaves == 1 ? "" : "s")} so far."
        };
        if (visitsUpcoming > 0)
            briefingParts.Add($"{visitsUpcoming} upcoming site visit{(visitsUpcoming == 1 ? "" : "s")}.");
        if (inReviewCount > 0)
            briefingParts.Add($"{inReviewCount} listing{(inReviewCount == 1 ? "" : "s")} in verification review.");
        if (unverifiedCount > 0)
            briefingParts.Add($"{unverifiedCount} still unverified.");
        if (weakListings.Count > 0)
            briefingParts.Add($"{weakListings.Count} listing{(weakListings.Count == 1 ? "" : "s")} need optimization.");

        var briefing = string.Join(" ", briefingParts);
        var briefingSource = "rules";

        // Keep dashboard under Next.js rewrite budget (~30s). Ollama polish is best-effort.
        try
        {
            // Keep agent dashboard snappy — rules brief is enough if Ollama is slow.
            using var polishCts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(2.5));
            var polished = await _aiClient.RunAgentOpsAsync(new AgentOpsRequestDto
            {
                FallbackBrief = briefing,
                Stats = new AgentOpsStatsDto
                {
                    ActiveListings = activeCount,
                    PendingLeads = pendingLeads,
                    TotalLeads = leads.Count,
                    TotalViews = totalViews,
                    TotalSaves = totalSaves,
                    UpcomingVisits = visitsUpcoming,
                    InReview = inReviewCount,
                    Unverified = unverifiedCount,
                    WeakListingCount = weakListings.Count
                },
                Alerts = weakListings.Select(w => new AgentOpsAlertInDto
                {
                    PropertyId = w.PropertyId.ToString(),
                    Title = w.Title,
                    Issue = w.Issue,
                    Recommendation = w.Recommendation,
                    AlertType = w.AlertType,
                    City = w.City,
                    Area = w.Area,
                    AskingPrice = w.AskingPrice
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

            foreach (var w in weakListings)
            {
                var key = w.PropertyId.ToString();
                if (recMap.TryGetValue(key, out var rec) && !string.IsNullOrWhiteSpace(rec.Recommendation))
                {
                    w.Recommendation = rec.Recommendation;
                    w.RecommendationSource = rec.Source ?? "rules";
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Phase D agent-ops polish skipped; using rules briefing.");
        }

        return Ok(new AgentDashboardDto
        {
            ActiveListingsCount = activeCount,
            TotalViews = totalViews,
            TotalSaves = totalSaves,
            TotalLeads = leads.Count,
            PendingLeadsCount = pendingLeads,
            DailyAiBriefing = briefing,
            BriefingSource = briefingSource,
            WeakListings = weakListings
        });
    }

    [HttpGet("listings")]
    public async Task<ActionResult<object>> GetAgentListings()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var listings = await _context.Properties
            .Include(p => p.Media)
            .Where(p => p.OwnerOrAgentId == userId.Value && !p.IsDeleted)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.City,
                p.Area,
                p.Price,
                p.Currency,
                p.LandArea,
                LandAreaUnit = p.LandAreaUnit.ToString(),
                p.Bedrooms,
                Status = p.Status.ToString(),
                VerificationStatus = p.VerificationStatus.ToString(),
                p.ListingQualityScore,
                MediaCount = p.Media.Count,
                PrimaryImageUrl = p.Media.OrderBy(m => m.SortOrder).Select(m => m.Url).FirstOrDefault() ?? "/placeholder-property.jpg",
                p.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(listings);
    }

    [HttpGet("analytics")]
    public async Task<ActionResult<AgentAnalyticsDto>> GetAnalytics()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var properties = await _context.Properties
            .Where(p => p.OwnerOrAgentId == userId.Value && !p.IsDeleted)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync();

        var propertyIds = properties.Select(p => p.Id).ToList();

        var views = await _context.PropertyViews
            .Where(v => propertyIds.Contains(v.PropertyId) && !v.IsDeleted)
            .GroupBy(v => v.PropertyId)
            .Select(g => new { PropertyId = g.Key, Count = g.Count() })
            .ToListAsync();
        var viewsMap = views.ToDictionary(x => x.PropertyId, x => x.Count);

        var saves = await _context.SavedProperties
            .Where(s => propertyIds.Contains(s.PropertyId))
            .GroupBy(s => s.PropertyId)
            .Select(g => new { PropertyId = g.Key, Count = g.Count() })
            .ToListAsync();
        var savesMap = saves.ToDictionary(x => x.PropertyId, x => x.Count);

        var inquiries = await _context.Inquiries
            .Where(i => i.TargetAgentOrDeveloperId == userId.Value && !i.IsDeleted)
            .ToListAsync();

        var inquiriesByProperty = inquiries
            .Where(i => i.PropertyId.HasValue)
            .GroupBy(i => i.PropertyId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var visits = await _context.AgentVisits
            .Where(v => v.AgentUserId == userId.Value && !v.IsDeleted)
            .ToListAsync();

        var visitsByProperty = visits
            .GroupBy(v => v.PropertyId)
            .ToDictionary(g => g.Key, g => g.Count());

        var closedClients = await _context.AgentClients
            .CountAsync(c =>
                c.AgentUserId == userId.Value &&
                !c.IsDeleted &&
                c.Status == AgentClientStatus.Closed);

        var totalViews = viewsMap.Values.Sum();
        var totalSaves = savesMap.Values.Sum();
        var totalInquiries = inquiries.Count;
        var visitsScheduled = visits.Count(v =>
            v.Status is AgentVisitStatus.Requested or AgentVisitStatus.Confirmed);
        var visitsCompleted = visits.Count(v => v.Status == AgentVisitStatus.Completed);

        static double Rate(int numerator, int denominator) =>
            denominator <= 0 ? 0 : Math.Round(100.0 * numerator / denominator, 1);

        var listingRows = properties.Select(p =>
        {
            var v = viewsMap.GetValueOrDefault(p.Id);
            var s = savesMap.GetValueOrDefault(p.Id);
            var iq = inquiriesByProperty.GetValueOrDefault(p.Id);
            var vt = visitsByProperty.GetValueOrDefault(p.Id);
            return new AgentListingAnalyticsDto
            {
                PropertyId = p.Id,
                Title = p.Title,
                City = p.City,
                Area = p.Area,
                Status = p.Status.ToString(),
                VerificationStatus = p.VerificationStatus.ToString(),
                ListingQualityScore = p.ListingQualityScore ?? 0,
                Views = v,
                Saves = s,
                Inquiries = iq,
                Visits = vt,
                ViewToInquiryRate = Rate(iq, v)
            };
        }).ToList();

        var statusBreakdown = Enum.GetValues<InquiryStatus>()
            .ToDictionary(
                s => s.ToString(),
                s => inquiries.Count(i => i.Status == s));

        var avgQuality = properties.Count == 0
            ? 0
            : Math.Round(properties.Average(p => (double)(p.ListingQualityScore ?? 0)), 1);

        return Ok(new AgentAnalyticsDto
        {
            ActiveListingsCount = properties.Count(p => p.Status == ListingStatus.Published),
            TotalViews = totalViews,
            TotalSaves = totalSaves,
            TotalInquiries = totalInquiries,
            PendingInquiries = inquiries.Count(i => i.Status == InquiryStatus.New),
            VisitsScheduled = visitsScheduled,
            VisitsCompleted = visitsCompleted,
            ClientsClosed = closedClients,
            AvgListingQualityScore = avgQuality,
            ViewToInquiryRate = Rate(totalInquiries, totalViews),
            InquiryToVisitRate = Rate(visits.Count, totalInquiries),
            VisitToCloseRate = Rate(closedClients, visitsCompleted > 0 ? visitsCompleted : visits.Count),
            InquiryStatusBreakdown = statusBreakdown,
            Listings = listingRows
        });
    }

    [HttpGet("verification")]
    public async Task<ActionResult<List<AgentVerificationListingDto>>> GetVerificationOverview()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var properties = await _context.Properties
            .Where(p => p.OwnerOrAgentId == userId.Value && !p.IsDeleted)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync();

        var propertyIds = properties.Select(p => p.Id).ToList();

        var cases = await _context.VerificationCases
            .Include(c => c.AssignedSpecialist)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .Where(c => c.PropertyId.HasValue && propertyIds.Contains(c.PropertyId.Value) && !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync();

        var latestByProperty = cases
            .GroupBy(c => c.PropertyId!.Value)
            .ToDictionary(g => g.Key, g => g.First());

        var evidence = await _context.PropertyEvidenceDocuments
            .Where(d => propertyIds.Contains(d.PropertyId) && !d.IsDeleted)
            .OrderByDescending(d => d.UploadedAtUtc)
            .Select(d => new
            {
                d.Id,
                d.PropertyId,
                DocumentType = d.DocumentType.ToString(),
                d.FileName,
                d.ContentType,
                d.SizeBytes,
                Status = d.Status.ToString(),
                d.UploadedAtUtc
            })
            .ToListAsync();

        var evidenceByProperty = evidence
            .GroupBy(e => e.PropertyId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = properties.Select(p =>
        {
            latestByProperty.TryGetValue(p.Id, out var latest);
            evidenceByProperty.TryGetValue(p.Id, out var ev);
            var docs = ev ?? [];
            return new AgentVerificationListingDto
            {
                PropertyId = p.Id,
                Title = p.Title,
                City = p.City,
                Area = p.Area,
                Latitude = p.Latitude,
                Longitude = p.Longitude,
                PrivacyLevel = p.PrivacyLevel.ToString(),
                ListingStatus = p.Status.ToString(),
                VerificationStatus = p.VerificationStatus.ToString(),
                ActiveCaseId = latest?.Id,
                CaseStatus = latest?.Status.ToString(),
                ServiceLevel = latest?.ServiceLevel.ToString(),
                SpecialistName = latest?.AssignedSpecialist?.FullName,
                TotalChecks = latest?.ChecklistItems.Count,
                PassedChecks = latest?.ChecklistItems.Count(ci => ci.Result == ChecklistResult.Pass),
                ConcernChecks = latest?.ChecklistItems.Count(ci => ci.Result == ChecklistResult.Concern),
                HasReport = latest?.Reports.Any() == true,
                CaseCreatedAtUtc = latest?.CreatedAtUtc,
                CaseCompletedAtUtc = latest?.CompletedAtUtc,
                SlaHours = latest?.SLAHours,
                FeePkr = latest?.Fee,
                EvidenceCount = docs.Count,
                EvidenceDocumentTypes = docs.Select(x => x.DocumentType).Distinct().ToList(),
                EvidenceDocuments = docs.Select(x => new AgentEvidenceDocDto
                {
                    Id = x.Id,
                    DocumentType = x.DocumentType,
                    FileName = x.FileName,
                    ContentType = x.ContentType,
                    SizeBytes = x.SizeBytes,
                    Status = x.Status,
                    UploadedAtUtc = x.UploadedAtUtc
                }).ToList()
            };
        }).ToList();

        return Ok(result);
    }

    [HttpPost("verification/request")]
    public async Task<ActionResult<object>> RequestVerification([FromBody] RequestAgentVerificationDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        if (dto.PropertyId == Guid.Empty)
            return BadRequest(new { message = "PropertyId is required." });

        if (!Enum.TryParse<VerificationLevel>(dto.ServiceLevel, ignoreCase: true, out var level))
            return BadRequest(new { message = "Invalid serviceLevel. Use BasicDocumentReview, PropertySiteVisit, RecordCheck, EnhancedDueDiligence, or LegalReview." });

        var property = await _context.Properties
            .FirstOrDefaultAsync(p => p.Id == dto.PropertyId && !p.IsDeleted);
        if (property == null)
            return NotFound(new { message = "Property not found." });
        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
            return Forbid();

        if (property.VerificationStatus == PropertyVerificationStatus.Verified)
            return Conflict(new { message = "This listing is already verified." });

        var openExists = await _context.VerificationCases.AnyAsync(c =>
            c.PropertyId == property.Id &&
            !c.IsDeleted &&
            c.Status != VerificationCaseStatus.Completed &&
            c.Status != VerificationCaseStatus.Cancelled);

        if (openExists)
            return Conflict(new { message = "An open verification case already exists for this listing." });

        decimal fee = level switch
        {
            VerificationLevel.BasicDocumentReview => 15000m,
            VerificationLevel.PropertySiteVisit => 25000m,
            VerificationLevel.RecordCheck => 35000m,
            VerificationLevel.EnhancedDueDiligence => 60000m,
            VerificationLevel.LegalReview => 95000m,
            _ => 25000m
        };

        int slaHours = level switch
        {
            VerificationLevel.BasicDocumentReview => 48,
            VerificationLevel.PropertySiteVisit => 72,
            VerificationLevel.RecordCheck => 96,
            VerificationLevel.EnhancedDueDiligence => 120,
            VerificationLevel.LegalReview => 168,
            _ => 72
        };

        var specialist = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == "specialist@propertyiq.pk" && u.IsActive);

        var newCase = new VerificationCase
        {
            CustomerId = userId.Value,
            PropertyId = property.Id,
            ServiceLevel = level,
            Fee = fee,
            Currency = "PKR",
            Status = specialist != null ? VerificationCaseStatus.Assigned : VerificationCaseStatus.Requested,
            AssignedSpecialistId = specialist?.Id,
            AssignedAtUtc = specialist != null ? DateTime.UtcNow : null,
            SLAHours = slaHours,
            IsPaid = true,
            PaidAtUtc = DateTime.UtcNow
        };

        var defaultChecks = new List<(string Category, string Code, string Title)>
        {
            ("Identity", "CHK-ID-01", "Seller / Developer CNIC and Power of Attorney identity verification"),
            ("OwnershipEvidence", "CHK-OWN-01", "Registry / Sale Deed / Fard Malkiat consistency cross-check"),
            ("MutationTransfer", "CHK-MUT-01", "Intiqal / Mutation records and chain of title transfer verification"),
            ("SocietyApproval", "CHK-SOC-01", "Development Authority (LDA/RDA/CDA/SBCA) NOC & Layout Approval"),
            ("TaxesDues", "CHK-TAX-01", "Property Tax challans, society development charges & utility clearance")
        };

        if (level >= VerificationLevel.PropertySiteVisit)
        {
            defaultChecks.Add(("SiteVisit", "CHK-VISIT-01", "Physical boundaries, access road, signage & possession status"));
            defaultChecks.Add(("SiteVisit", "CHK-VISIT-02", "GPS coordinate verification & high-res field photo capture"));
        }

        if (level >= VerificationLevel.EnhancedDueDiligence)
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

        _context.VerificationCases.Add(newCase);
        property.VerificationStatus = PropertyVerificationStatus.InReview;

        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(VerificationCase),
            EntityId = newCase.Id.ToString(),
            Action = "AgentRequestedVerification",
            NewValuesJson = $"Level={level};Fee={fee};PropertyId={property.Id}",
            Reason = string.IsNullOrWhiteSpace(dto.Notes)
                ? "Agent requested listing verification from workspace."
                : dto.Notes.Trim(),
            ActorUserId = userId
        });

        await _context.SaveChangesAsync();

        return Created($"/api/agent/verification", new
        {
            caseId = newCase.Id,
            propertyId = property.Id,
            verificationStatus = property.VerificationStatus.ToString(),
            caseStatus = newCase.Status.ToString(),
            serviceLevel = newCase.ServiceLevel.ToString(),
            specialistName = specialist?.FullName,
            fee = newCase.Fee,
            currency = newCase.Currency,
            slaHours = newCase.SLAHours,
            totalChecks = newCase.ChecklistItems.Count,
            message = "Verification requested. Listing marked In Review."
        });
    }
}
