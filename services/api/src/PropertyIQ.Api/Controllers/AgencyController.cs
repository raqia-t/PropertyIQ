using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Agency;
using PropertyIQ.Application.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AgencyController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAiServiceClient _aiClient;
    private readonly ILogger<AgencyController> _logger;

    public AgencyController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IAiServiceClient aiClient,
        ILogger<AgencyController> logger)
    {
        _context = context;
        _currentUserService = currentUserService;
        _aiClient = aiClient;
        _logger = logger;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<AgencyDashboardDto>> GetDashboard()
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;
        var brokers = resolved.Value.Brokers;
        var brokerIds = resolved.Value.BrokerIds;

        var properties = await _context.Properties
            .Include(p => p.Media)
            .Where(p =>
                !p.IsDeleted &&
                (p.OrganizationId == org.Id || brokerIds.Contains(p.OwnerOrAgentId)))
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync();

        var inquiries = await _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.TargetAgentOrDeveloperId.HasValue &&
                brokerIds.Contains(i.TargetAgentOrDeveloperId.Value))
            .ToListAsync();

        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var monthlyLeads = inquiries.Count(i => i.CreatedAtUtc >= monthStart);
        var pendingLeads = inquiries.Count(i => i.Status == InquiryStatus.New);
        var activeListings = properties.Count(p => p.Status == ListingStatus.Published);
        var propertyIds = properties.Select(p => p.Id).ToList();
        var totalViews = propertyIds.Count == 0
            ? 0
            : await _context.PropertyViews.CountAsync(v => propertyIds.Contains(v.PropertyId) && !v.IsDeleted);
        var totalSaves = propertyIds.Count == 0
            ? 0
            : await _context.SavedProperties.CountAsync(s => propertyIds.Contains(s.PropertyId));
        var visitsUpcoming = brokerIds.Count == 0
            ? 0
            : await _context.AgentVisits.CountAsync(v =>
                brokerIds.Contains(v.AgentUserId) &&
                !v.IsDeleted &&
                v.ScheduledAtUtc >= DateTime.UtcNow &&
                (v.Status == AgentVisitStatus.Requested || v.Status == AgentVisitStatus.Confirmed));
        var inReview = properties.Count(p => p.VerificationStatus == PropertyVerificationStatus.InReview);
        var unverified = properties.Count(p => p.VerificationStatus == PropertyVerificationStatus.Unverified);

        var leadsByBroker = inquiries
            .GroupBy(i => i.TargetAgentOrDeveloperId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var leadsByProperty = inquiries
            .Where(i => i.PropertyId.HasValue)
            .GroupBy(i => i.PropertyId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var brokerNameById = brokers.ToDictionary(b => b.Id, b => b.FullName);

        var brokerRows = brokers.Select(b =>
        {
            var brokerListings = properties.Where(p => p.OwnerOrAgentId == b.Id).ToList();
            leadsByBroker.TryGetValue(b.Id, out var brokerLeads);
            brokerLeads ??= new List<Inquiry>();

            return new AgencyBrokerRowDto
            {
                UserId = b.Id,
                FullName = b.FullName,
                Email = b.Email,
                PhoneNumber = b.PhoneNumber,
                ActiveListingsCount = brokerListings.Count(p => p.Status == ListingStatus.Published),
                TotalListingsCount = brokerListings.Count,
                AssignedLeadsCount = brokerLeads.Count,
                PendingLeadsCount = brokerLeads.Count(l => l.Status == InquiryStatus.New)
            };
        }).ToList();

        var listingRows = properties.Select(p => new AgencyListingRowDto
        {
            Id = p.Id,
            Title = p.Title,
            AssignedBrokerId = p.OwnerOrAgentId,
            AssignedBrokerName = brokerNameById.TryGetValue(p.OwnerOrAgentId, out var name)
                ? name
                : "Unassigned",
            Price = p.Price,
            Currency = p.Currency,
            Status = p.Status.ToString(),
            VerificationStatus = p.VerificationStatus.ToString(),
            LeadsCount = leadsByProperty.TryGetValue(p.Id, out var lc) ? lc : 0,
            CreatedAtUtc = p.CreatedAtUtc
        }).ToList();

        // Firm listing optimizer — completeness scorer + media/rent rules, scoped to org inventory
        var weakListings = new List<AgencyWeakListingAlertDto>();
        var qualityDirty = false;
        foreach (var l in properties.Where(x =>
                     x.Status == ListingStatus.Published || x.Status == ListingStatus.Draft))
        {
            var brokerLabel = brokerNameById.TryGetValue(l.OwnerOrAgentId, out var bn)
                ? bn
                : "Unassigned";
            var quality = ListingQualityScorer.Score(l);
            if (l.ListingQualityScore != quality.Score)
            {
                l.ListingQualityScore = quality.Score;
                qualityDirty = true;
            }

            AgencyWeakListingAlertDto BaseAlert(
                string issue,
                string recommendation,
                string alertType,
                int priority) => new()
            {
                PropertyId = l.Id,
                Title = l.Title,
                Issue = issue,
                Recommendation = recommendation,
                AlertType = alertType,
                AssignedBrokerId = l.OwnerOrAgentId,
                AssignedBrokerName = brokerLabel,
                City = l.City,
                Area = l.Area,
                PropertyType = l.PropertyType.ToString(),
                LandArea = l.LandArea,
                LandAreaUnit = l.LandAreaUnit.ToString(),
                AskingPrice = l.Price,
                Bedrooms = l.Bedrooms,
                ListingQualityScore = quality.Score,
                Priority = priority
            };

            if (quality.PhotoCount < 5)
            {
                weakListings.Add(BaseAlert(
                    $"Only {quality.PhotoCount} photos uploaded (minimum 5 recommended) · quality {quality.Score}%",
                    $"Ask {brokerLabel} to upload kitchen, elevation, and washroom photos.",
                    "Photos",
                    30 - Math.Min(quality.PhotoCount, 5) * 3));
            }
            else if (!quality.HasExterior || !quality.HasKitchen || !quality.HasBathroom)
            {
                var missing = new List<string>();
                if (!quality.HasExterior) missing.Add("exterior/elevation");
                if (!quality.HasKitchen) missing.Add("kitchen");
                if (!quality.HasBathroom) missing.Add("bathroom");
                weakListings.Add(BaseAlert(
                    $"Photo mix incomplete — missing {string.Join(", ", missing)} · quality {quality.Score}%",
                    $"Coach {brokerLabel} to add {string.Join(", ", missing)} photos (AI classify helps tag rooms).",
                    "MediaMix",
                    18));
            }
            else if (l.Price > 100000000m && l.ExpectedRentMin == null && l.Purpose == PropertyPurpose.Sale)
            {
                weakListings.Add(BaseAlert(
                    $"Missing estimated rental yield context · quality {quality.Score}%",
                    $"Run AI rent scenario for {brokerLabel}'s listing and save expected rent.",
                    "RentScenario",
                    12));
            }
            else if (quality.Score < 70 && quality.Gaps.Count > 0)
            {
                weakListings.Add(BaseAlert(
                    $"Listing completeness {quality.Score}% — needs coach follow-up",
                    $"Ask {brokerLabel}: {quality.Gaps[0]}",
                    "Completeness",
                    10));
            }
        }

        if (qualityDirty)
            await _context.SaveChangesAsync();

        weakListings = weakListings
            .OrderByDescending(w => w.Priority)
            .ThenBy(w => w.Title)
            .Take(12)
            .ToList();

        var rulesBrief =
            $"{org.Name} has {brokers.Count} active broker{(brokers.Count == 1 ? "" : "s")} and {activeListings} active listing{(activeListings == 1 ? "" : "s")}. " +
            $"{pendingLeads} new lead{(pendingLeads == 1 ? "" : "s")} need follow-up ({inquiries.Count} firm total; {monthlyLeads} this month). " +
            $"{totalViews} listing view{(totalViews == 1 ? "" : "s")} and {totalSaves} wishlist save{(totalSaves == 1 ? "" : "s")} across firm inventory.";
        if (visitsUpcoming > 0)
            rulesBrief += $" {visitsUpcoming} upcoming site visit{(visitsUpcoming == 1 ? "" : "s")}.";
        if (inReview > 0)
            rulesBrief += $" {inReview} listing{(inReview == 1 ? "" : "s")} in verification review.";
        if (unverified > 0)
            rulesBrief += $" {unverified} still unverified.";
        if (weakListings.Count > 0)
            rulesBrief +=
                $" {weakListings.Count} listing{(weakListings.Count == 1 ? "" : "s")} need optimization across the firm.";

        var briefing = rulesBrief;
        var briefingSource = "rules";
        try
        {
            // Keep agency dashboard snappy — rules brief is enough if Ollama is slow.
            using var polishCts = new CancellationTokenSource(TimeSpan.FromSeconds(2.5));
            var polished = await _aiClient.RunAgentOpsAsync(new AgentOpsRequestDto
            {
                Audience = "agency",
                FallbackBrief = rulesBrief,
                Stats = new AgentOpsStatsDto
                {
                    ActiveListings = activeListings,
                    PendingLeads = pendingLeads,
                    TotalLeads = inquiries.Count,
                    TotalViews = totalViews,
                    TotalSaves = totalSaves,
                    UpcomingVisits = visitsUpcoming,
                    InReview = inReview,
                    Unverified = unverified,
                    WeakListingCount = weakListings.Count,
                    ActiveBrokers = brokers.Count,
                    MonthlyLeads = monthlyLeads,
                    OrgName = org.Name
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
            _logger.LogWarning(ex, "Agency firm brief/optimizer polish skipped; using rules.");
        }

        return Ok(new AgencyDashboardDto
        {
            Organization = ToOrgSummary(org),
            ActiveListingsCount = activeListings,
            TotalListingsCount = properties.Count,
            ActiveBrokersCount = brokers.Count,
            MonthlyLeadsCount = monthlyLeads,
            TotalLeadsCount = inquiries.Count,
            PendingLeadsCount = pendingLeads,
            ClosedVolumeTracked = false,
            DailyAiBriefing = briefing,
            BriefingSource = briefingSource,
            WeakListings = weakListings,
            Brokers = brokerRows,
            Listings = listingRows
        });
    }

    [HttpGet("listings")]
    public async Task<ActionResult<AgencyListingsResponseDto>> GetListings(
        [FromQuery] Guid? brokerId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? verificationStatus = null,
        [FromQuery] string? search = null)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;
        var brokers = resolved.Value.Brokers;
        var brokerIds = resolved.Value.BrokerIds;

        if (brokerId.HasValue && !brokerIds.Contains(brokerId.Value))
        {
            return BadRequest(new { message = "Broker is not a member of your agency organization." });
        }

        var query = _context.Properties
            .Include(p => p.Media)
            .Where(p =>
                !p.IsDeleted &&
                (p.OrganizationId == org.Id || brokerIds.Contains(p.OwnerOrAgentId)));

        if (brokerId.HasValue)
        {
            query = query.Where(p => p.OwnerOrAgentId == brokerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<ListingStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(p => p.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(verificationStatus) &&
            Enum.TryParse<PropertyVerificationStatus>(verificationStatus, ignoreCase: true, out var verEnum))
        {
            query = query.Where(p => p.VerificationStatus == verEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p =>
                p.Title.ToLower().Contains(term) ||
                p.City.ToLower().Contains(term) ||
                p.Area.ToLower().Contains(term));
        }

        var properties = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync();

        var propertyIds = properties.Select(p => p.Id).ToList();
        var leadsByProperty = await _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.PropertyId.HasValue &&
                propertyIds.Contains(i.PropertyId.Value))
            .GroupBy(i => i.PropertyId!.Value)
            .Select(g => new { PropertyId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.PropertyId, x => x.Count);

        var brokerNameById = brokers.ToDictionary(b => b.Id, b => b.FullName);

        var listings = properties.Select(p => new AgencyListingDetailDto
        {
            Id = p.Id,
            Title = p.Title,
            City = p.City,
            Area = p.Area,
            AssignedBrokerId = p.OwnerOrAgentId,
            AssignedBrokerName = brokerNameById.TryGetValue(p.OwnerOrAgentId, out var name)
                ? name
                : "Unassigned",
            Price = p.Price,
            Currency = p.Currency,
            LandArea = p.LandArea,
            LandAreaUnit = p.LandAreaUnit.ToString(),
            Bedrooms = p.Bedrooms,
            Status = p.Status.ToString(),
            VerificationStatus = p.VerificationStatus.ToString(),
            ListingQualityScore = p.ListingQualityScore ?? 0,
            MediaCount = p.Media.Count,
            PrimaryImageUrl = p.Media.OrderBy(m => m.SortOrder).Select(m => m.Url).FirstOrDefault()
                ?? "/placeholder-property.jpg",
            LeadsCount = leadsByProperty.TryGetValue(p.Id, out var lc) ? lc : 0,
            CreatedAtUtc = p.CreatedAtUtc
        }).ToList();

        return Ok(new AgencyListingsResponseDto
        {
            Organization = ToOrgSummary(org),
            Brokers = brokers.Select(b => new AgencyBrokerOptionDto
            {
                UserId = b.Id,
                FullName = b.FullName
            }).ToList(),
            Listings = listings
        });
    }

    [HttpGet("leads")]
    public async Task<ActionResult<AgencyLeadsResponseDto>> GetLeads(
        [FromQuery] Guid? brokerId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;
        var brokers = resolved.Value.Brokers;
        var brokerIds = resolved.Value.BrokerIds;

        if (brokerId.HasValue && !brokerIds.Contains(brokerId.Value))
        {
            return BadRequest(new { message = "Broker is not a member of your agency organization." });
        }

        var query = _context.Inquiries
            .Include(i => i.Property)
            .Include(i => i.Project)
            .Where(i =>
                !i.IsDeleted &&
                i.TargetAgentOrDeveloperId.HasValue &&
                brokerIds.Contains(i.TargetAgentOrDeveloperId.Value));

        if (brokerId.HasValue)
        {
            query = query.Where(i => i.TargetAgentOrDeveloperId == brokerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<InquiryStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(i => i.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i =>
                i.ContactName.ToLower().Contains(term) ||
                i.ContactEmail.ToLower().Contains(term) ||
                i.ContactPhone.ToLower().Contains(term) ||
                (i.Property != null && i.Property.Title.ToLower().Contains(term)) ||
                (i.Project != null && i.Project.Name.ToLower().Contains(term)));
        }

        var inquiries = await query
            .OrderByDescending(i => i.CreatedAtUtc)
            .ToListAsync();

        var brokerNameById = brokers.ToDictionary(b => b.Id, b => b.FullName);

        // Unfiltered counts for firm KPIs on this page
        var allFirmLeads = await _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.TargetAgentOrDeveloperId.HasValue &&
                brokerIds.Contains(i.TargetAgentOrDeveloperId.Value))
            .Select(i => i.Status)
            .ToListAsync();

        var leads = inquiries.Select(i =>
        {
            var assignedId = i.TargetAgentOrDeveloperId;
            var brokerName = assignedId.HasValue && brokerNameById.TryGetValue(assignedId.Value, out var name)
                ? name
                : "Unassigned";

            return new AgencyLeadDto
            {
                Id = i.Id,
                PropertyId = i.PropertyId,
                PropertyTitle = i.Property?.Title,
                ProjectId = i.ProjectId,
                ProjectName = i.Project?.Name,
                AssignedBrokerId = assignedId,
                AssignedBrokerName = brokerName,
                ContactName = i.ContactName,
                ContactEmail = i.ContactEmail,
                ContactPhone = i.ContactPhone,
                Message = i.Message,
                Status = i.Status.ToString(),
                AgentNotes = i.AgentNotes,
                CreatedAtUtc = i.CreatedAtUtc
            };
        }).ToList();

        return Ok(new AgencyLeadsResponseDto
        {
            Organization = ToOrgSummary(org),
            Brokers = brokers.Select(b => new AgencyBrokerOptionDto
            {
                UserId = b.Id,
                FullName = b.FullName
            }).ToList(),
            NewLeadsCount = allFirmLeads.Count(s => s == InquiryStatus.New),
            TotalLeadsCount = allFirmLeads.Count,
            Leads = leads
        });
    }

    [HttpGet("clients")]
    public async Task<ActionResult<AgencyClientsResponseDto>> GetClients(
        [FromQuery] Guid? brokerId = null,
        [FromQuery] string? side = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;
        var brokers = resolved.Value.Brokers;
        var brokerIds = resolved.Value.BrokerIds;

        if (brokerId.HasValue && !brokerIds.Contains(brokerId.Value))
        {
            return BadRequest(new { message = "Broker is not a member of your agency organization." });
        }

        var query = _context.AgentClients
            .Include(c => c.LinkedProperty)
            .Where(c =>
                !c.IsDeleted &&
                (c.OrganizationId == org.Id || brokerIds.Contains(c.AgentUserId)));

        if (brokerId.HasValue)
        {
            query = query.Where(c => c.AgentUserId == brokerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(side) &&
            Enum.TryParse<AgentClientSide>(side, ignoreCase: true, out var sideEnum))
        {
            query = query.Where(c => c.ClientSide == sideEnum);
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<AgentClientStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(c => c.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.FullName.ToLower().Contains(term) ||
                c.Phone.Contains(term) ||
                (c.Email != null && c.Email.ToLower().Contains(term)) ||
                (c.TargetAreas != null && c.TargetAreas.ToLower().Contains(term)));
        }

        var clients = await query
            .OrderByDescending(c => c.UpdatedAtUtc ?? c.CreatedAtUtc)
            .ToListAsync();

        var brokerNameById = brokers.ToDictionary(b => b.Id, b => b.FullName);

        var allFirmStatuses = await _context.AgentClients
            .Where(c =>
                !c.IsDeleted &&
                (c.OrganizationId == org.Id || brokerIds.Contains(c.AgentUserId)))
            .Select(c => c.Status)
            .ToListAsync();

        return Ok(new AgencyClientsResponseDto
        {
            Organization = ToOrgSummary(org),
            Brokers = brokers.Select(b => new AgencyBrokerOptionDto
            {
                UserId = b.Id,
                FullName = b.FullName
            }).ToList(),
            TotalClientsCount = allFirmStatuses.Count,
            ActiveClientsCount = allFirmStatuses.Count(s =>
                s is AgentClientStatus.Active or AgentClientStatus.MandateSigned or AgentClientStatus.UnderOffer),
            Clients = clients.Select(c => new AgencyClientDto
            {
                Id = c.Id,
                AgentUserId = c.AgentUserId,
                AssignedBrokerName = brokerNameById.TryGetValue(c.AgentUserId, out var name)
                    ? name
                    : "Unassigned",
                FullName = c.FullName,
                Phone = c.Phone,
                Email = c.Email,
                ClientSide = c.ClientSide.ToString(),
                Status = c.Status.ToString(),
                BudgetMinPkr = c.BudgetMinPkr,
                BudgetMaxPkr = c.BudgetMaxPkr,
                TargetAreas = c.TargetAreas,
                Notes = c.Notes,
                LinkedPropertyId = c.LinkedPropertyId,
                LinkedPropertyTitle = c.LinkedProperty?.Title,
                SourceInquiryId = c.SourceInquiryId,
                CreatedAtUtc = c.CreatedAtUtc
            }).ToList()
        });
    }

    [HttpGet("brokers")]
    public async Task<ActionResult<AgencyBrokersResponseDto>> GetBrokers([FromQuery] string? search = null)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;
        var brokers = resolved.Value.Brokers;
        var brokerIds = resolved.Value.BrokerIds;

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            brokers = brokers
                .Where(b =>
                    b.FullName.ToLower().Contains(term) ||
                    b.Email.ToLower().Contains(term) ||
                    b.PhoneNumber.Contains(term))
                .ToList();
            brokerIds = brokers.Select(b => b.Id).ToList();
        }

        var properties = await _context.Properties
            .Where(p => !p.IsDeleted && brokerIds.Contains(p.OwnerOrAgentId))
            .Select(p => new { p.OwnerOrAgentId, p.Status })
            .ToListAsync();

        var inquiries = await _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.TargetAgentOrDeveloperId.HasValue &&
                brokerIds.Contains(i.TargetAgentOrDeveloperId.Value))
            .Select(i => new { BrokerId = i.TargetAgentOrDeveloperId!.Value, i.Status })
            .ToListAsync();

        var clients = await _context.AgentClients
            .Where(c => !c.IsDeleted && brokerIds.Contains(c.AgentUserId))
            .Select(c => c.AgentUserId)
            .ToListAsync();

        var rows = brokers.Select(b =>
        {
            var brokerListings = properties.Where(p => p.OwnerOrAgentId == b.Id).ToList();
            var brokerLeads = inquiries.Where(i => i.BrokerId == b.Id).ToList();
            return new AgencyBrokerDetailDto
            {
                UserId = b.Id,
                FullName = b.FullName,
                Email = b.Email,
                PhoneNumber = b.PhoneNumber,
                IsActive = b.IsActive,
                ActiveListingsCount = brokerListings.Count(p => p.Status == ListingStatus.Published),
                TotalListingsCount = brokerListings.Count,
                AssignedLeadsCount = brokerLeads.Count,
                PendingLeadsCount = brokerLeads.Count(l => l.Status == InquiryStatus.New),
                ClientsCount = clients.Count(id => id == b.Id),
                CreatedAtUtc = b.CreatedAtUtc
            };
        }).ToList();

        return Ok(new AgencyBrokersResponseDto
        {
            Organization = ToOrgSummary(org),
            ActiveBrokersCount = rows.Count(b => b.IsActive),
            Brokers = rows
        });
    }

    [HttpPost("brokers")]
    public async Task<ActionResult<AgencyBrokerDetailDto>> CreateBroker([FromBody] CreateAgencyBrokerDto dto)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;

        if (string.IsNullOrWhiteSpace(dto.FullName) ||
            string.IsNullOrWhiteSpace(dto.Email) ||
            string.IsNullOrWhiteSpace(dto.PhoneNumber) ||
            string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest(new { message = "Full name, email, phone, and password are required." });
        }

        if (dto.Password.Trim().Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters." });
        }

        var email = dto.Email.Trim().ToLowerInvariant();
        var phone = dto.PhoneNumber.Trim();

        var emailTaken = await _context.Users.AnyAsync(u => u.Email.ToLower() == email && !u.IsDeleted);
        if (emailTaken)
        {
            return Conflict(new { message = "An account with this email already exists." });
        }

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password.Trim()),
            FullName = dto.FullName.Trim(),
            PhoneNumber = phone,
            Role = UserRole.Agent,
            OrganizationId = org.Id,
            IsActive = true,
            EmailVerified = true,
            IdentityVerified = false
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBrokers), new { }, new AgencyBrokerDetailDto
        {
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            IsActive = user.IsActive,
            ActiveListingsCount = 0,
            TotalListingsCount = 0,
            AssignedLeadsCount = 0,
            PendingLeadsCount = 0,
            ClientsCount = 0,
            CreatedAtUtc = user.CreatedAtUtc
        });
    }

    [HttpGet("analytics")]
    public async Task<ActionResult<AgencyAnalyticsDto>> GetAnalytics([FromQuery] Guid? brokerId = null)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;
        var brokers = resolved.Value.Brokers;
        var brokerIds = resolved.Value.BrokerIds;

        if (brokerId.HasValue)
        {
            if (!brokerIds.Contains(brokerId.Value))
            {
                return BadRequest(new { message = "Broker is not a member of your agency organization." });
            }
            brokers = brokers.Where(b => b.Id == brokerId.Value).ToList();
            brokerIds = new List<Guid> { brokerId.Value };
        }

        var brokerNameById = brokers.ToDictionary(b => b.Id, b => b.FullName);

        var properties = await _context.Properties
            .Where(p =>
                !p.IsDeleted &&
                (p.OrganizationId == org.Id || brokerIds.Contains(p.OwnerOrAgentId)))
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync();

        if (brokerId.HasValue)
        {
            properties = properties.Where(p => p.OwnerOrAgentId == brokerId.Value).ToList();
        }

        var propertyIds = properties.Select(p => p.Id).ToList();

        var views = propertyIds.Count == 0
            ? new List<(Guid PropertyId, int Count)>()
            : (await _context.PropertyViews
                .Where(v => propertyIds.Contains(v.PropertyId) && !v.IsDeleted)
                .GroupBy(v => v.PropertyId)
                .Select(g => new { PropertyId = g.Key, Count = g.Count() })
                .ToListAsync())
                .Select(x => (x.PropertyId, x.Count))
                .ToList();
        var viewsMap = views.ToDictionary(x => x.PropertyId, x => x.Count);

        var saves = propertyIds.Count == 0
            ? new List<(Guid PropertyId, int Count)>()
            : (await _context.SavedProperties
                .Where(s => propertyIds.Contains(s.PropertyId))
                .GroupBy(s => s.PropertyId)
                .Select(g => new { PropertyId = g.Key, Count = g.Count() })
                .ToListAsync())
                .Select(x => (x.PropertyId, x.Count))
                .ToList();
        var savesMap = saves.ToDictionary(x => x.PropertyId, x => x.Count);

        var inquiries = await _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.TargetAgentOrDeveloperId.HasValue &&
                brokerIds.Contains(i.TargetAgentOrDeveloperId.Value))
            .ToListAsync();

        var inquiriesByProperty = inquiries
            .Where(i => i.PropertyId.HasValue)
            .GroupBy(i => i.PropertyId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var visits = await _context.AgentVisits
            .Where(v => !v.IsDeleted && brokerIds.Contains(v.AgentUserId))
            .ToListAsync();

        var visitsByProperty = visits
            .GroupBy(v => v.PropertyId)
            .ToDictionary(g => g.Key, g => g.Count());

        var closedClientsByBroker = await _context.AgentClients
            .Where(c =>
                !c.IsDeleted &&
                brokerIds.Contains(c.AgentUserId) &&
                c.Status == AgentClientStatus.Closed)
            .GroupBy(c => c.AgentUserId)
            .Select(g => new { BrokerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.BrokerId, x => x.Count);

        var closedClients = closedClientsByBroker.Values.Sum();

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
            return new AgencyListingAnalyticsDto
            {
                PropertyId = p.Id,
                Title = p.Title,
                City = p.City,
                Area = p.Area,
                AssignedBrokerId = p.OwnerOrAgentId,
                AssignedBrokerName = brokerNameById.TryGetValue(p.OwnerOrAgentId, out var name)
                    ? name
                    : "Unassigned",
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

        var brokerRows = brokers.Select(b =>
        {
            var brokerListings = properties.Where(p => p.OwnerOrAgentId == b.Id).ToList();
            var brokerInquiries = inquiries.Count(i => i.TargetAgentOrDeveloperId == b.Id);
            var brokerVisitsScheduled = visits.Count(v =>
                v.AgentUserId == b.Id &&
                v.Status is AgentVisitStatus.Requested or AgentVisitStatus.Confirmed);
            return new AgencyBrokerAnalyticsDto
            {
                UserId = b.Id,
                FullName = b.FullName,
                ActiveListingsCount = brokerListings.Count(p => p.Status == ListingStatus.Published),
                Inquiries = brokerInquiries,
                VisitsScheduled = brokerVisitsScheduled,
                ClientsClosed = closedClientsByBroker.GetValueOrDefault(b.Id)
            };
        }).ToList();

        var statusBreakdown = Enum.GetValues<InquiryStatus>()
            .ToDictionary(
                s => s.ToString(),
                s => inquiries.Count(i => i.Status == s));

        var avgQuality = properties.Count == 0
            ? 0
            : Math.Round(properties.Average(p => (double)(p.ListingQualityScore ?? 0)), 1);

        return Ok(new AgencyAnalyticsDto
        {
            Organization = ToOrgSummary(org),
            ActiveBrokersCount = brokers.Count,
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
            Brokers = brokerRows,
            Listings = listingRows
        });
    }

    [HttpGet("reports/summary")]
    public async Task<ActionResult<AgencyReportSummaryDto>> GetReportSummary(
        [FromQuery] string period = "month")
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var summary = await BuildReportSummaryAsync(
            resolved.Value!.Org,
            resolved.Value.Brokers,
            resolved.Value.BrokerIds,
            period);
        return Ok(summary);
    }

    [HttpGet("reports/export.csv")]
    public async Task<IActionResult> ExportReportCsv([FromQuery] string period = "month")
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var s = await BuildReportSummaryAsync(
            resolved.Value!.Org,
            resolved.Value.Brokers,
            resolved.Value.BrokerIds,
            period);

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Section,Metric,Value");
        sb.AppendLine(Csv("Firm", "Organization", s.Organization.Name));
        sb.AppendLine(Csv("Firm", "City", s.Organization.City));
        sb.AppendLine(Csv("Firm", "Period", s.PeriodLabel));
        sb.AppendLine(Csv("Firm", "FromUtc", s.FromUtc?.ToString("o") ?? ""));
        sb.AppendLine(Csv("Firm", "ToUtc", s.ToUtc.ToString("o")));
        sb.AppendLine(Csv("Firm", "GeneratedAtUtc", s.GeneratedAtUtc.ToString("o")));
        sb.AppendLine(Csv("Snapshot", "ActiveBrokers", s.ActiveBrokersCount.ToString()));
        sb.AppendLine(Csv("Snapshot", "ActiveListings", s.ActiveListingsCount.ToString()));
        sb.AppendLine(Csv("Snapshot", "TotalListings", s.TotalListingsCount.ToString()));
        sb.AppendLine(Csv("Snapshot", "TotalClients", s.TotalClientsCount.ToString()));
        sb.AppendLine(Csv("Period", "NewListings", s.NewListingsInPeriod.ToString()));
        sb.AppendLine(Csv("Period", "Views", s.ViewsInPeriod.ToString()));
        sb.AppendLine(Csv("Period", "Inquiries", s.InquiriesInPeriod.ToString()));
        sb.AppendLine(Csv("Period", "PendingInquiries", s.PendingInquiriesInPeriod.ToString()));
        sb.AppendLine(Csv("Period", "VisitsScheduled", s.VisitsScheduledInPeriod.ToString()));
        sb.AppendLine(Csv("Period", "VisitsCompleted", s.VisitsCompletedInPeriod.ToString()));
        sb.AppendLine(Csv("Period", "ClientsClosed", s.ClientsClosedInPeriod.ToString()));
        sb.AppendLine(Csv("Rates", "ViewToInquiryPercent", s.ViewToInquiryRate.ToString("0.0")));
        sb.AppendLine(Csv("Rates", "InquiryToVisitPercent", s.InquiryToVisitRate.ToString("0.0")));
        sb.AppendLine(Csv("Rates", "VisitToClosePercent", s.VisitToCloseRate.ToString("0.0")));
        sb.AppendLine(Csv("Rates", "ClosedVolumeTracked", s.ClosedVolumeTracked ? "true" : "false"));

        foreach (var kv in s.InquiryStatusBreakdown.Where(x => x.Value > 0))
            sb.AppendLine(Csv("InquiryStatus", kv.Key, kv.Value.ToString()));

        foreach (var b in s.TopBrokers)
            sb.AppendLine(Csv("Broker", b.FullName,
                $"listings={b.ActiveListingsCount};inquiries={b.Inquiries};visits={b.VisitsScheduled};closed={b.ClientsClosed}"));

        foreach (var l in s.TopListings)
            sb.AppendLine(Csv("Listing", l.Title,
                $"broker={l.AssignedBrokerName};views={l.Views};inquiries={l.Inquiries};visits={l.Visits}"));

        var bytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"agency-report-{s.Period}-{DateTime.UtcNow:yyyyMMddHHmm}.csv";
        return File(bytes, "text/csv", fileName);
    }

    private async Task<AgencyReportSummaryDto> BuildReportSummaryAsync(
        Organization org,
        List<User> brokers,
        List<Guid> brokerIds,
        string? period)
    {
        var (periodKey, periodLabel, fromUtc, toUtc) = ResolveReportPeriod(period);

        var properties = await _context.Properties
            .Where(p =>
                !p.IsDeleted &&
                (p.OrganizationId == org.Id || brokerIds.Contains(p.OwnerOrAgentId)))
            .ToListAsync();

        var propertyIds = properties.Select(p => p.Id).ToList();
        var brokerNameById = brokers.ToDictionary(b => b.Id, b => b.FullName);

        var viewsQuery = _context.PropertyViews
            .Where(v => propertyIds.Contains(v.PropertyId) && !v.IsDeleted && v.ViewedAtUtc <= toUtc);
        if (fromUtc.HasValue)
            viewsQuery = viewsQuery.Where(v => v.ViewedAtUtc >= fromUtc.Value);

        var viewsInPeriod = propertyIds.Count == 0 ? 0 : await viewsQuery.CountAsync();

        var viewsByProperty = propertyIds.Count == 0
            ? new Dictionary<Guid, int>()
            : (await viewsQuery
                .GroupBy(v => v.PropertyId)
                .Select(g => new { PropertyId = g.Key, Count = g.Count() })
                .ToListAsync())
                .ToDictionary(x => x.PropertyId, x => x.Count);

        var inquiriesQuery = _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.TargetAgentOrDeveloperId.HasValue &&
                brokerIds.Contains(i.TargetAgentOrDeveloperId.Value) &&
                i.CreatedAtUtc <= toUtc);
        if (fromUtc.HasValue)
            inquiriesQuery = inquiriesQuery.Where(i => i.CreatedAtUtc >= fromUtc.Value);

        var inquiries = await inquiriesQuery.ToListAsync();

        var visitsQuery = _context.AgentVisits
            .Where(v =>
                !v.IsDeleted &&
                brokerIds.Contains(v.AgentUserId) &&
                v.ScheduledAtUtc <= toUtc);
        if (fromUtc.HasValue)
            visitsQuery = visitsQuery.Where(v => v.ScheduledAtUtc >= fromUtc.Value);

        var visits = await visitsQuery.ToListAsync();

        var allClients = await _context.AgentClients
            .Where(c => !c.IsDeleted && brokerIds.Contains(c.AgentUserId))
            .ToListAsync();

        var closedInPeriod = allClients.Count(c =>
        {
            if (c.Status != AgentClientStatus.Closed) return false;
            var when = c.UpdatedAtUtc ?? c.CreatedAtUtc;
            if (when > toUtc) return false;
            return !fromUtc.HasValue || when >= fromUtc.Value;
        });

        var inquiriesByProperty = inquiries
            .Where(i => i.PropertyId.HasValue)
            .GroupBy(i => i.PropertyId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var visitsByProperty = visits
            .GroupBy(v => v.PropertyId)
            .ToDictionary(g => g.Key, g => g.Count());

        static double Rate(int numerator, int denominator) =>
            denominator <= 0 ? 0 : Math.Round(100.0 * numerator / denominator, 1);

        var visitsScheduled = visits.Count(v =>
            v.Status is AgentVisitStatus.Requested or AgentVisitStatus.Confirmed);
        var visitsCompleted = visits.Count(v => v.Status == AgentVisitStatus.Completed);

        var topListings = properties
            .Select(p =>
            {
                var v = viewsByProperty.GetValueOrDefault(p.Id);
                var iq = inquiriesByProperty.GetValueOrDefault(p.Id);
                var vt = visitsByProperty.GetValueOrDefault(p.Id);
                return new AgencyListingAnalyticsDto
                {
                    PropertyId = p.Id,
                    Title = p.Title,
                    City = p.City,
                    Area = p.Area,
                    AssignedBrokerId = p.OwnerOrAgentId,
                    AssignedBrokerName = brokerNameById.TryGetValue(p.OwnerOrAgentId, out var name)
                        ? name
                        : "Unassigned",
                    Status = p.Status.ToString(),
                    VerificationStatus = p.VerificationStatus.ToString(),
                    ListingQualityScore = p.ListingQualityScore ?? 0,
                    Views = v,
                    Saves = 0,
                    Inquiries = iq,
                    Visits = vt,
                    ViewToInquiryRate = Rate(iq, v)
                };
            })
            .OrderByDescending(l => l.Inquiries)
            .ThenByDescending(l => l.Views)
            .Take(10)
            .ToList();

        var topBrokers = brokers.Select(b =>
        {
            var brokerListings = properties.Where(p => p.OwnerOrAgentId == b.Id).ToList();
            return new AgencyBrokerAnalyticsDto
            {
                UserId = b.Id,
                FullName = b.FullName,
                ActiveListingsCount = brokerListings.Count(p => p.Status == ListingStatus.Published),
                Inquiries = inquiries.Count(i => i.TargetAgentOrDeveloperId == b.Id),
                VisitsScheduled = visits.Count(v =>
                    v.AgentUserId == b.Id &&
                    v.Status is AgentVisitStatus.Requested or AgentVisitStatus.Confirmed),
                ClientsClosed = allClients.Count(c =>
                {
                    if (c.AgentUserId != b.Id || c.Status != AgentClientStatus.Closed) return false;
                    var when = c.UpdatedAtUtc ?? c.CreatedAtUtc;
                    if (when > toUtc) return false;
                    return !fromUtc.HasValue || when >= fromUtc.Value;
                })
            };
        })
        .OrderByDescending(b => b.Inquiries)
        .ToList();

        var newListingsInPeriod = properties.Count(p =>
        {
            if (p.CreatedAtUtc > toUtc) return false;
            return !fromUtc.HasValue || p.CreatedAtUtc >= fromUtc.Value;
        });

        return new AgencyReportSummaryDto
        {
            Organization = ToOrgSummary(org),
            Period = periodKey,
            PeriodLabel = periodLabel,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            GeneratedAtUtc = DateTime.UtcNow,
            ActiveBrokersCount = brokers.Count,
            ActiveListingsCount = properties.Count(p => p.Status == ListingStatus.Published),
            TotalListingsCount = properties.Count,
            NewListingsInPeriod = newListingsInPeriod,
            ViewsInPeriod = viewsInPeriod,
            InquiriesInPeriod = inquiries.Count,
            PendingInquiriesInPeriod = inquiries.Count(i => i.Status == InquiryStatus.New),
            VisitsScheduledInPeriod = visitsScheduled,
            VisitsCompletedInPeriod = visitsCompleted,
            ClientsClosedInPeriod = closedInPeriod,
            TotalClientsCount = allClients.Count,
            ViewToInquiryRate = Rate(inquiries.Count, viewsInPeriod),
            InquiryToVisitRate = Rate(visits.Count, inquiries.Count),
            VisitToCloseRate = Rate(closedInPeriod, visitsCompleted > 0 ? visitsCompleted : visits.Count),
            ClosedVolumeTracked = false,
            InquiryStatusBreakdown = Enum.GetValues<InquiryStatus>()
                .ToDictionary(s => s.ToString(), s => inquiries.Count(i => i.Status == s)),
            TopBrokers = topBrokers,
            TopListings = topListings
        };
    }

    private static string Csv(string section, string metric, string value)
    {
        static string Esc(string v) =>
            v.Contains(',') || v.Contains('"') || v.Contains('\n')
                ? $"\"{v.Replace("\"", "\"\"")}\""
                : v;
        return $"{Esc(section)},{Esc(metric)},{Esc(value)}";
    }

    private static (string Key, string Label, DateTime? FromUtc, DateTime ToUtc) ResolveReportPeriod(string? period)
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

    [HttpGet("projects")]
    public async Task<ActionResult<AgencyProjectsResponseDto>> GetProjects(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;

        var query = _context.AgencyProjectMandates
            .Include(m => m.Project)!.ThenInclude(p => p!.DeveloperOrg)
            .Include(m => m.Project)!.ThenInclude(p => p!.InventoryUnits)
            .Where(m => !m.IsDeleted && m.AgencyOrgId == org.Id);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<AgencyMandateStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(m => m.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(m =>
                m.Project != null &&
                (m.Project.Name.ToLower().Contains(term) ||
                 m.Project.City.ToLower().Contains(term) ||
                 m.Project.Area.ToLower().Contains(term) ||
                 (m.Project.DeveloperOrg != null && m.Project.DeveloperOrg.Name.ToLower().Contains(term))));
        }

        var mandates = await query
            .OrderByDescending(m => m.CreatedAtUtc)
            .ToListAsync();

        var allStatuses = await _context.AgencyProjectMandates
            .Where(m => !m.IsDeleted && m.AgencyOrgId == org.Id)
            .Select(m => m.Status)
            .ToListAsync();

        return Ok(new AgencyProjectsResponseDto
        {
            Organization = ToOrgSummary(org),
            ActiveMandatesCount = allStatuses.Count(s => s == AgencyMandateStatus.Active),
            TotalMandatesCount = allStatuses.Count,
            Mandates = mandates.Select(MapMandateDto).ToList()
        });
    }

    [HttpPost("projects")]
    public async Task<ActionResult<AgencyProjectMandateDto>> CreateProjectMandate(
        [FromBody] CreateAgencyProjectMandateDto dto)
    {
        var resolved = await ResolveAgencyContextAsync();
        if (resolved.Result != null) return resolved.Result;

        var org = resolved.Value!.Org;

        if (dto.ProjectId == Guid.Empty)
        {
            return BadRequest(new { message = "Select a developer project to mandate." });
        }

        if (dto.CommissionPercent is < 0 or > 100)
        {
            return BadRequest(new { message = "Commission percent must be between 0 and 100." });
        }

        if (dto.EndDateUtc.HasValue && dto.StartDateUtc.HasValue &&
            dto.EndDateUtc.Value < dto.StartDateUtc.Value)
        {
            return BadRequest(new { message = "End date cannot be before start date." });
        }

        var project = await _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.InventoryUnits)
            .FirstOrDefaultAsync(p => p.Id == dto.ProjectId && !p.IsDeleted);

        if (project == null)
        {
            return NotFound(new { message = "Project not found." });
        }

        var existing = await _context.AgencyProjectMandates
            .FirstOrDefaultAsync(m =>
                m.AgencyOrgId == org.Id &&
                m.ProjectId == dto.ProjectId &&
                !m.IsDeleted);

        if (existing != null)
        {
            return Conflict(new
            {
                message = "This agency already has a mandate on that project."
            });
        }

        var mandate = new AgencyProjectMandate
        {
            AgencyOrgId = org.Id,
            ProjectId = project.Id,
            IsExclusive = dto.IsExclusive,
            Status = AgencyMandateStatus.Active,
            CommissionPercent = dto.CommissionPercent,
            StartDateUtc = dto.StartDateUtc ?? DateTime.UtcNow,
            EndDateUtc = dto.EndDateUtc,
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim()
        };

        _context.AgencyProjectMandates.Add(mandate);
        await _context.SaveChangesAsync();

        mandate.Project = project;
        return CreatedAtAction(nameof(GetProjects), new { }, MapMandateDto(mandate));
    }

    private static AgencyProjectMandateDto MapMandateDto(AgencyProjectMandate m)
    {
        var p = m.Project;
        var units = p?.InventoryUnits?.Where(u => !u.IsDeleted).ToList() ?? new List<InventoryUnit>();
        return new AgencyProjectMandateDto
        {
            Id = m.Id,
            ProjectId = m.ProjectId,
            ProjectName = p?.Name ?? "Unknown project",
            ProjectSlug = p?.Slug ?? string.Empty,
            ProjectType = p?.ProjectType ?? string.Empty,
            City = p?.City ?? string.Empty,
            Area = p?.Area ?? string.Empty,
            DeveloperName = p?.DeveloperOrg?.Name ?? string.Empty,
            DeveloperVerified = p?.DeveloperOrg?.IsVerified ?? false,
            ApprovalStatus = p?.ApprovalStatus ?? string.Empty,
            RegulatoryAuthority = p?.RegulatoryAuthority,
            TotalUnits = units.Count,
            AvailableUnits = units.Count(u => u.Status == InventoryStatus.Available),
            StartingPrice = units.Count > 0 ? units.Min(u => u.BasePrice) : 0m,
            Currency = units.FirstOrDefault()?.Currency ?? "PKR",
            IsExclusive = m.IsExclusive,
            Status = m.Status.ToString(),
            CommissionPercent = m.CommissionPercent,
            StartDateUtc = m.StartDateUtc,
            EndDateUtc = m.EndDateUtc,
            Notes = m.Notes,
            CreatedAtUtc = m.CreatedAtUtc
        };
    }

    private static AgencyOrgSummaryDto ToOrgSummary(Organization org) => new()
    {
        Id = org.Id,
        Name = org.Name,
        City = org.City,
        LicenseNumber = org.LicenseNumber,
        IsVerified = org.IsVerified
    };

    private sealed class AgencyContext
    {
        public required Organization Org { get; init; }
        public required List<User> Brokers { get; init; }
        public required List<Guid> BrokerIds { get; init; }
    }

    private async Task<(ActionResult? Result, AgencyContext? Value)> ResolveAgencyContextAsync()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return (Unauthorized(), null);

        var role = _currentUserService.UserRole;
        if (role != UserRole.Agent.ToString() && role != UserRole.SuperAdmin.ToString())
        {
            return (Forbid(), null);
        }

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == userId.Value && !u.IsDeleted);

        if (currentUser == null) return (Unauthorized(), null);

        if (currentUser.OrganizationId == null || currentUser.Organization == null)
        {
            return (BadRequest(new
            {
                message = "Your account is not linked to an agency organization. Contact support to join a brokerage firm."
            }), null);
        }

        if (currentUser.Organization.Type != OrganizationType.Agency && role != UserRole.SuperAdmin.ToString())
        {
            return (BadRequest(new { message = "Organization is not an agency brokerage." }), null);
        }

        var org = currentUser.Organization;
        var brokers = await _context.Users
            .Where(u =>
                u.OrganizationId == org.Id &&
                u.Role == UserRole.Agent &&
                u.IsActive &&
                !u.IsDeleted)
            .OrderBy(u => u.FullName)
            .ToListAsync();

        return (null, new AgencyContext
        {
            Org = org,
            Brokers = brokers,
            BrokerIds = brokers.Select(b => b.Id).ToList()
        });
    }
}
