using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Intelligence;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.Services;

public interface IIntelligenceService
{
    /// <param name="developerOrgId">When set, gaps are built from that developer's inventory units + bookings.</param>
    Task<List<DemandGapDto>> GetDemandGapsAsync(string? city, Guid? developerOrgId = null);
    Task<NeighborhoodIntelligenceDto> GetNeighborhoodIntelligenceAsync(
        string city,
        string area,
        double? latitude = null,
        double? longitude = null);
    /// <param name="developerOrgId">When set, radar is built from that developer's inventory + bookings.</param>
    Task<DeveloperDemandRadarDto> GetDeveloperDemandRadarAsync(string? city, Guid? developerOrgId = null);
    AdvancedInvestmentAnalysisResponse CalculateAdvancedInvestment(AdvancedInvestmentAnalysisRequest request);
}

public class IntelligenceService : IIntelligenceService
{
    private readonly IApplicationDbContext _context;
    private readonly INeighborhoodPoiProvider? _poiProvider;

    public IntelligenceService(IApplicationDbContext context, INeighborhoodPoiProvider? poiProvider = null)
    {
        _context = context;
        _poiProvider = poiProvider;
    }

    public async Task<List<DemandGapDto>> GetDemandGapsAsync(string? city, Guid? developerOrgId = null)
    {
        if (developerOrgId.HasValue)
            return await BuildGapsFromDeveloperInventoryAsync(city, developerOrgId.Value);

        return await BuildGapsFromMarketListingsAsync(city);
    }

    private async Task<List<DemandGapDto>> BuildGapsFromDeveloperInventoryAsync(string? city, Guid developerOrgId)
    {
        var projects = await _context.Projects
            .Include(p => p.InventoryUnits)
            .Where(p => !p.IsDeleted && p.DeveloperOrgId == developerOrgId)
            .ToListAsync();

        if (!string.IsNullOrWhiteSpace(city))
        {
            projects = projects
                .Where(p => p.City.Equals(city.Trim(), StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var units = projects
            .SelectMany(p => (p.InventoryUnits ?? Enumerable.Empty<InventoryUnit>())
                .Where(u => !u.IsDeleted)
                .Select(u => new { Unit = u, Project = p }))
            .ToList();

        if (units.Count == 0)
            return new List<DemandGapDto>();

        var unitIds = units.Select(x => x.Unit.Id).ToList();
        var since = DateTime.UtcNow.AddDays(-90);
        var bookings = await _context.Bookings
            .Where(b =>
                !b.IsDeleted &&
                unitIds.Contains(b.InventoryUnitId) &&
                b.Status != BookingStatus.Cancelled &&
                b.BookedAtUtc >= since)
            .ToListAsync();

        var bookingsByUnit = bookings
            .GroupBy(b => b.InventoryUnitId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var segments = units
            .GroupBy(x => new
            {
                City = x.Project.City?.Trim() ?? "Lahore",
                Area = string.IsNullOrWhiteSpace(x.Project.Area) ? "General" : x.Project.Area.Trim(),
                PropertyType = string.IsNullOrWhiteSpace(x.Unit.UnitType) ? "Plot" : x.Unit.UnitType.Trim(),
                SizeCategory = BucketSize(x.Unit.Size, x.Unit.SizeUnit)
            })
            .Select(g =>
            {
                var segUnits = g.ToList();
                var available = segUnits.Count(x => x.Unit.Status == InventoryStatus.Available);
                var booked = segUnits.Count(x =>
                    x.Unit.Status is InventoryStatus.Booked or InventoryStatus.Sold);
                var bookingHits = segUnits.Sum(x =>
                    bookingsByUnit.TryGetValue(x.Unit.Id, out var bl) ? bl.Count : 0);
                var prices = segUnits.Select(x => x.Unit.BasePrice).Where(p => p > 0).OrderBy(p => p).ToList();
                var median = Median(prices);
                // Demand proxy: recent bookings weighted + absorption pressure
                var demand = bookingHits * 8 + booked * 3 + Math.Max(0, 6 - available);
                var supply = Math.Max(available, 0);
                var ratio = supply == 0
                    ? (demand > 0 ? demand : 1.0)
                    : Math.Round(demand / (double)Math.Max(supply, 1), 2);
                var gapLevel = ClassifyGap(ratio, supply, demand);
                var action = BuildRulesAction(
                    g.Key.City, g.Key.Area, g.Key.PropertyType, g.Key.SizeCategory,
                    gapLevel, supply, demand, bookingHits, median, firmInventory: true);

                return new DemandGapDto
                {
                    City = g.Key.City,
                    Area = g.Key.Area,
                    PropertyType = g.Key.PropertyType,
                    SizeCategory = g.Key.SizeCategory,
                    MonthlySearchVolume = demand,
                    ActiveSupplyCount = supply,
                    DemandSupplyRatio = ratio,
                    GapLevel = gapLevel,
                    MedianSearchBudget = median,
                    RecommendedAction = action,
                    SignalSource = "live_units",
                    RecommendationSource = "rules",
                    BookingsCount = bookingHits,
                    ViewsCount = 0,
                    InquiriesCount = 0
                };
            })
            .OrderByDescending(g => g.DemandSupplyRatio)
            .ThenByDescending(g => g.MonthlySearchVolume)
            .Take(12)
            .ToList();

        return segments;
    }

    private async Task<List<DemandGapDto>> BuildGapsFromMarketListingsAsync(string? city)
    {
        var targetCity = string.IsNullOrWhiteSpace(city) ? null : city.Trim();

        var query = _context.Properties
            .Where(p => !p.IsDeleted && p.Status == ListingStatus.Published);
        if (targetCity != null)
            query = query.Where(p => p.City.ToLower() == targetCity.ToLower());

        var properties = await query.ToListAsync();
        if (properties.Count == 0)
            return new List<DemandGapDto>();

        var propertyIds = properties.Select(p => p.Id).ToList();
        var since = DateTime.UtcNow.AddDays(-90);

        var views = await _context.PropertyViews
            .Where(v => !v.IsDeleted && propertyIds.Contains(v.PropertyId) && v.ViewedAtUtc >= since)
            .GroupBy(v => v.PropertyId)
            .Select(g => new { PropertyId = g.Key, Count = g.Count() })
            .ToListAsync();
        var viewMap = views.ToDictionary(x => x.PropertyId, x => x.Count);

        var inquiries = await _context.Inquiries
            .Where(i =>
                !i.IsDeleted &&
                i.PropertyId.HasValue &&
                propertyIds.Contains(i.PropertyId.Value) &&
                i.CreatedAtUtc >= since)
            .GroupBy(i => i.PropertyId!.Value)
            .Select(g => new { PropertyId = g.Key, Count = g.Count() })
            .ToListAsync();
        var inquiryMap = inquiries.ToDictionary(x => x.PropertyId, x => x.Count);

        var segments = properties
            .GroupBy(p => new
            {
                City = string.IsNullOrWhiteSpace(p.City) ? "Lahore" : p.City.Trim(),
                Area = string.IsNullOrWhiteSpace(p.Area) ? "General" : p.Area.Trim(),
                PropertyType = p.PropertyType.ToString(),
                SizeCategory = BucketSize(p.LandArea, p.LandAreaUnit, p.Bedrooms)
            })
            .Select(g =>
            {
                var list = g.ToList();
                var supply = list.Count;
                var viewHits = list.Sum(p => viewMap.TryGetValue(p.Id, out var c) ? c : 0);
                var inquiryHits = list.Sum(p => inquiryMap.TryGetValue(p.Id, out var c) ? c : 0);
                var demand = viewHits + inquiryHits * 4;
                var prices = list.Select(p => p.Price).Where(p => p > 0).OrderBy(p => p).ToList();
                var median = Median(prices);
                var ratio = supply == 0
                    ? demand
                    : Math.Round(demand / (double)Math.Max(supply, 1), 2);
                var gapLevel = ClassifyGap(ratio, supply, demand);
                var action = BuildRulesAction(
                    g.Key.City, g.Key.Area, g.Key.PropertyType, g.Key.SizeCategory,
                    gapLevel, supply, demand, inquiryHits, median, firmInventory: false);

                return new DemandGapDto
                {
                    City = g.Key.City,
                    Area = g.Key.Area,
                    PropertyType = g.Key.PropertyType,
                    SizeCategory = g.Key.SizeCategory,
                    MonthlySearchVolume = demand,
                    ActiveSupplyCount = supply,
                    DemandSupplyRatio = ratio,
                    GapLevel = gapLevel,
                    MedianSearchBudget = median,
                    RecommendedAction = action,
                    SignalSource = "live_inventory",
                    RecommendationSource = "rules",
                    BookingsCount = 0,
                    ViewsCount = viewHits,
                    InquiriesCount = inquiryHits
                };
            })
            .Where(g => g.ActiveSupplyCount > 0 || g.MonthlySearchVolume > 0)
            .OrderByDescending(g => g.DemandSupplyRatio)
            .ThenByDescending(g => g.MonthlySearchVolume)
            .Take(12)
            .ToList();

        return segments;
    }

    private static string BucketSize(double size, LandAreaUnit unit, int? bedrooms = null)
    {
        if (unit == LandAreaUnit.Kanal)
        {
            if (size <= 0.6) return "10 Marla";
            if (size < 1.5) return "1 Kanal";
            return "2+ Kanal";
        }

        // Marla (default) and other units treated as marla-scale for bucketing
        if (size > 0 && size <= 5.5) return "5 Marla";
        if (size <= 10.5) return "10 Marla";
        if (size <= 20.5) return "1 Kanal";
        if (bedrooms is >= 1 and <= 2) return $"{bedrooms}-Bed";
        if (bedrooms is >= 3) return $"{bedrooms}-Bed";
        if (size <= 0) return "Unspecified size";
        return $"{size:0.#} {unit}";
    }

    private static decimal Median(List<decimal> ordered)
    {
        if (ordered.Count == 0) return 0m;
        var mid = ordered.Count / 2;
        if (ordered.Count % 2 == 1) return ordered[mid];
        return Math.Round((ordered[mid - 1] + ordered[mid]) / 2m, 0);
    }

    private static string ClassifyGap(double ratio, int supply, int demand)
    {
        if (supply <= 2 && demand >= 3) return "HighDemandLowSupply";
        if (ratio >= 4.0) return "HighDemandLowSupply";
        if (ratio <= 1.0 && supply >= 8) return "Oversupplied";
        return "Balanced";
    }

    private static string BuildRulesAction(
        string city,
        string area,
        string propertyType,
        string sizeCategory,
        string gapLevel,
        int supply,
        int demand,
        int leadOrBookingHits,
        decimal median,
        bool firmInventory)
    {
        var budget = median > 0
            ? (median >= 10_000_000m
                ? $"PKR {(median / 10_000_000m):0.##} Cr"
                : $"PKR {(median / 100_000m):0.#} Lakh")
            : "current asking band";

        if (gapLevel == "HighDemandLowSupply")
        {
            return firmInventory
                ? $"{sizeCategory} {propertyType} in {area}, {city} is thin on available stock ({supply} open) with {leadOrBookingHits} recent bookings — prioritize release/pricing for this band (~{budget})."
                : $"{sizeCategory} {propertyType} in {area}, {city} shows high interest ({demand} signals) vs {supply} live listings — add inventory or tighten pricing around {budget}.";
        }

        if (gapLevel == "Oversupplied")
        {
            return firmInventory
                ? $"{sizeCategory} {propertyType} in {area} has {supply} available units with soft velocity — review payment-plan incentives or pause new releases."
                : $"{sizeCategory} {propertyType} in {area} looks oversupplied ({supply} listings) — differentiate with verification, photos, or price cuts near {budget}.";
        }

        return firmInventory
            ? $"{sizeCategory} {propertyType} in {area} is balanced ({supply} available, {leadOrBookingHits} bookings/90d) — hold plan cadence and monitor absorption weekly."
            : $"{sizeCategory} {propertyType} in {area} is balanced ({supply} listings, {demand} interest signals) — keep quality listings competitive around {budget}.";
    }

    public async Task<NeighborhoodIntelligenceDto> GetNeighborhoodIntelligenceAsync(
        string city,
        string area,
        double? latitude = null,
        double? longitude = null)
    {
        var targetCity = string.IsNullOrWhiteSpace(city) ? "Lahore" : city.Trim();
        var targetArea = string.IsNullOrWhiteSpace(area) ? "DHA Phase 6" : area.Trim();

        if (_poiProvider != null)
        {
            try
            {
                // Nominatim path needs ~6 sequential requests @ 1/sec when Overpass is unreachable.
                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(45));
                var live = await _poiProvider.LookupAsync(targetCity, targetArea, latitude, longitude, cts.Token);
                if (live is { PointsOfInterest.Count: > 0 })
                    return BuildLiveNeighborhoodDto(targetCity, targetArea, live);
            }
            catch
            {
                // Fall through to curated seed
            }
        }

        return BuildSeedNeighborhoodDto(targetCity, targetArea, latitude, longitude);
    }

    private static NeighborhoodIntelligenceDto BuildLiveNeighborhoodDto(
        string city,
        string area,
        NeighborhoodPoiLookupResult live)
    {
        var pois = live.PointsOfInterest;
        var categories = pois.Select(p => p.Category).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        var school = categories.Contains("School", StringComparer.OrdinalIgnoreCase);
        var hospital = categories.Contains("Hospital", StringComparer.OrdinalIgnoreCase);
        var market = categories.Contains("Market", StringComparer.OrdinalIgnoreCase);
        var park = categories.Contains("Park", StringComparer.OrdinalIgnoreCase);
        var mosque = categories.Contains("Mosque", StringComparer.OrdinalIgnoreCase);

        var score = 70;
        if (school) score += 6;
        if (hospital) score += 6;
        if (market) score += 5;
        if (park) score += 4;
        if (mosque) score += 3;
        score += Math.Min(6, pois.Count);
        score = Math.Clamp(score, 55, 96);

        var nearest = pois.OrderBy(p => p.DistanceKm).Take(3).ToList();
        var commute = new Dictionary<string, int>();
        foreach (var p in nearest)
            commute[$"{p.Category}: {p.Name}"] = p.TravelTimeMinutes;

        var transport = pois.FirstOrDefault(p =>
            p.Category.Equals("Transport", StringComparison.OrdinalIgnoreCase));
        if (transport != null)
            commute["Nearest transport hub"] = transport.TravelTimeMinutes;

        var vibeBits = new List<string>();
        if (school && hospital) vibeBits.Add("family-ready amenities nearby");
        if (market) vibeBits.Add("daily retail within catchment");
        if (park) vibeBits.Add("recreation access");
        if (vibeBits.Count == 0) vibeBits.Add("established urban fabric");

        var summary =
            $"{area}, {city}: live map scan found {pois.Count} nearby amenit{(pois.Count == 1 ? "y" : "ies")} " +
            $"({string.Join(", ", categories)}). " +
            (nearest.Count > 0
                ? $"Closest: {nearest[0].Name} ({nearest[0].DistanceKm} km). "
                : "") +
            "Livability scored from amenity density — not a bank appraisal.";

        return new NeighborhoodIntelligenceDto
        {
            City = city,
            Area = area,
            LivabilityScore = score,
            OverallVibe = string.Join("; ", vibeBits),
            SecurityRating = area.Contains("DHA", StringComparison.OrdinalIgnoreCase)
                ? "Gated / managed security corridor (area profile)"
                : "Municipal + private security mix (area profile)",
            InfrastructureQuality = $"{categories.Count} amenity categor{(categories.Count == 1 ? "y" : "ies")} within ~3 km of catchment pin",
            RingRoadAccess = transport != null
                ? $"Nearest transport POI ~{transport.TravelTimeMinutes} min ({transport.Name})"
                : "Check Ring Road / arterial access on project site plan",
            PointsOfInterest = pois,
            CommuteEstimatesMinutes = commute,
            AiSummary = summary,
            SignalSource = "live_pois",
            PoiSource = live.Source,
            Latitude = live.Latitude,
            Longitude = live.Longitude
        };
    }

    private static NeighborhoodIntelligenceDto BuildSeedNeighborhoodDto(
        string targetCity,
        string targetArea,
        double? latitude,
        double? longitude)
    {
        var dto = new NeighborhoodIntelligenceDto
        {
            City = targetCity,
            Area = targetArea,
            SignalSource = "curated_seed",
            PoiSource = "seed",
            Latitude = latitude,
            Longitude = longitude
        };

        if (targetArea.Contains("DHA", StringComparison.OrdinalIgnoreCase))
        {
            dto.LivabilityScore = 94;
            dto.OverallVibe = "Prestigious Master-Planned Executive Residential Sector";
            dto.SecurityRating = "Gated & 24/7 DHA Security Patrols";
            dto.InfrastructureQuality = "100% Underground Electrification, Wide 50ft-150ft Carpeted Boulevards";
            dto.RingRoadAccess = "2 minutes to DHA Phase 6 Ring Road Interchange";
            dto.PointsOfInterest = new List<NeighborhoodPoiDto>
            {
                new NeighborhoodPoiDto { Name = "Lahore Grammar School (LGS DHA)", Category = "School", DistanceKm = 0.8, TravelTimeMinutes = 3, Rating = 4.8 },
                new NeighborhoodPoiDto { Name = "Beaconhouse Newlands", Category = "School", DistanceKm = 1.4, TravelTimeMinutes = 5, Rating = 4.7 },
                new NeighborhoodPoiDto { Name = "National Hospital & Medical Center DHA", Category = "Hospital", DistanceKm = 3.2, TravelTimeMinutes = 8, Rating = 4.6 },
                new NeighborhoodPoiDto { Name = "Al-Fatah Supermarket (Block CCA)", Category = "Market", DistanceKm = 0.5, TravelTimeMinutes = 2, Rating = 4.9 },
                new NeighborhoodPoiDto { Name = "Phase 6 Central Jamia Mosque", Category = "Mosque", DistanceKm = 0.4, TravelTimeMinutes = 2, Rating = 5.0 },
                new NeighborhoodPoiDto { Name = "DHA Sector L Family Park", Category = "Park", DistanceKm = 0.2, TravelTimeMinutes = 1, Rating = 4.7 },
                new NeighborhoodPoiDto { Name = "Allama Iqbal International Airport", Category = "Transport", DistanceKm = 10.5, TravelTimeMinutes = 12, Rating = 4.5 }
            };
            dto.CommuteEstimatesMinutes = new Dictionary<string, int>
            {
                { "Lahore Airport", 12 },
                { "Gulberg Main Boulevard", 18 },
                { "Mall Road / Old City", 28 },
                { "DHA Raya Golf Club", 6 }
            };
            dto.AiSummary = "DHA Phase 6 seed profile (live map POIs unavailable). Prime residential amenities within a short drive of Ring Road and CCA markets.";
        }
        else if (targetArea.Contains("Raiwind", StringComparison.OrdinalIgnoreCase))
        {
            dto.LivabilityScore = 88;
            dto.OverallVibe = "Rapidly Expanding Residential Corridor with Master Housing Schemes";
            dto.SecurityRating = "Gated Communities with CCTV Surveillance";
            dto.InfrastructureQuality = "Dual-Carriageway Raiwind Road with Planned Ring Road Southern Loop Connection";
            dto.RingRoadAccess = "5 minutes to Adda Plot Interchange";
            dto.PointsOfInterest = new List<NeighborhoodPoiDto>
            {
                new NeighborhoodPoiDto { Name = "The City School (Raiwind Campus)", Category = "School", DistanceKm = 1.2, TravelTimeMinutes = 4, Rating = 4.6 },
                new NeighborhoodPoiDto { Name = "Superior University / COMSATS", Category = "School", DistanceKm = 3.5, TravelTimeMinutes = 7, Rating = 4.7 },
                new NeighborhoodPoiDto { Name = "Shaukat Khanum Hospital Extension", Category = "Hospital", DistanceKm = 6.0, TravelTimeMinutes = 12, Rating = 4.9 },
                new NeighborhoodPoiDto { Name = "Jalal Sons / Sector Market", Category = "Market", DistanceKm = 1.0, TravelTimeMinutes = 3, Rating = 4.8 },
                new NeighborhoodPoiDto { Name = "Skyline Meadows Central Park", Category = "Park", DistanceKm = 0.3, TravelTimeMinutes = 1, Rating = 4.6 }
            };
            dto.CommuteEstimatesMinutes = new Dictionary<string, int>
            {
                { "Thokar Niaz Baig", 14 },
                { "DHA Phase 5/6 (via Ring Road)", 20 },
                { "Allama Iqbal Airport", 24 },
                { "Johar Town / Emporium", 16 }
            };
            dto.AiSummary = "Raiwind Road seed profile (live map POIs unavailable). Growth corridor with housing schemes, campuses, and southern Ring Road access.";
        }
        else
        {
            dto.LivabilityScore = 86;
            dto.OverallVibe = "Established Urban Commercial & Residential Sector";
            dto.SecurityRating = "Standard Municipal & Private Security";
            dto.InfrastructureQuality = "Established Civic Amenities with Metro/Public Transit Access";
            dto.RingRoadAccess = "Direct Arterial Access";
            dto.PointsOfInterest = new List<NeighborhoodPoiDto>
            {
                new NeighborhoodPoiDto { Name = "Local Grammar School", Category = "School", DistanceKm = 1.0, TravelTimeMinutes = 4, Rating = 4.5 },
                new NeighborhoodPoiDto { Name = "District Headquarter Hospital", Category = "Hospital", DistanceKm = 2.5, TravelTimeMinutes = 8, Rating = 4.4 },
                new NeighborhoodPoiDto { Name = "Main Commercial Market", Category = "Market", DistanceKm = 0.8, TravelTimeMinutes = 3, Rating = 4.7 }
            };
            dto.CommuteEstimatesMinutes = new Dictionary<string, int>
            {
                { "City Commercial Center", 15 },
                { "Airport / Highway", 25 }
            };
            dto.AiSummary = $"Seed profile for {targetArea}, {targetCity} (live map POIs unavailable). Typical school, healthcare, and market access.";
        }

        return dto;
    }

    public async Task<DeveloperDemandRadarDto> GetDeveloperDemandRadarAsync(string? city, Guid? developerOrgId = null)
    {
        var targetCity = string.IsNullOrWhiteSpace(city) ? "Lahore" : city.Trim();

        var projectQuery = _context.Projects
            .Include(p => p.InventoryUnits)
            .Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery.ToListAsync();
        projects = projects
            .Where(p => p.City.Equals(targetCity, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (projects.Count == 0 && developerOrgId.HasValue)
        {
            // Fall back to all org cities if filter empties catchment
            projects = await _context.Projects
                .Include(p => p.InventoryUnits)
                .Where(p => !p.IsDeleted && p.DeveloperOrgId == developerOrgId.Value)
                .ToListAsync();
            if (projects.Count > 0)
                targetCity = projects[0].City;
        }

        var units = projects
            .SelectMany(p => (p.InventoryUnits ?? Enumerable.Empty<InventoryUnit>()).Where(u => !u.IsDeleted))
            .ToList();

        if (units.Count == 0)
        {
            return new DeveloperDemandRadarDto
            {
                TargetCity = targetCity,
                ProjectType = projects.FirstOrDefault()?.ProjectType ?? "HousingScheme",
                PreferredInstallmentDurationMonths = 36,
                KeyTakeaway = "No inventory units found for this catchment — add units to generate a live demand radar.",
                SignalSource = "empty",
                UnitDemandSignals = new List<UnitDemandSignal>(),
                BudgetDistribution = new List<BudgetDistributionBracket>()
            };
        }

        var unitIds = units.Select(u => u.Id).ToList();
        var since = DateTime.UtcNow.AddDays(-90);
        var bookings = await _context.Bookings
            .Where(b =>
                !b.IsDeleted &&
                unitIds.Contains(b.InventoryUnitId) &&
                b.Status != BookingStatus.Cancelled &&
                b.BookedAtUtc >= since)
            .ToListAsync();

        var bookingsByUnit = bookings
            .GroupBy(b => b.InventoryUnitId)
            .ToDictionary(g => g.Key, g => g.Count());

        var planMonths = await _context.PaymentPlans
            .Where(pp =>
                !pp.IsDeleted &&
                pp.ProjectId.HasValue &&
                projects.Select(p => p.Id).Contains(pp.ProjectId.Value))
            .Select(pp => pp.DurationMonths)
            .ToListAsync();
        var preferredMonths = planMonths.Count > 0
            ? Math.Round(planMonths.Average(), 0)
            : 36;

        var signals = units
            .GroupBy(u => $"{BucketSize(u.Size, u.SizeUnit)} {u.UnitType}".Trim())
            .Select(g =>
            {
                var list = g.ToList();
                var available = list.Count(u => u.Status == InventoryStatus.Available);
                var bookedOrSold = list.Count(u =>
                    u.Status is InventoryStatus.Booked or InventoryStatus.Sold);
                var recent = list.Sum(u => bookingsByUnit.TryGetValue(u.Id, out var c) ? c : 0);
                var velocity = Math.Round(recent / 3.0, 2); // 90 days ≈ 3 months
                var absorption = list.Count == 0 ? 0 : (double)bookedOrSold / list.Count;
                var scarcity = available <= 1 ? 1.0 : available <= 3 ? 0.7 : available <= 8 ? 0.4 : 0.15;
                var demandIndex = (int)Math.Clamp(
                    Math.Round(absorption * 45 + Math.Min(velocity * 12, 40) + scarcity * 20),
                    5,
                    100);
                var closingPrices = list
                    .Where(u => u.Status is InventoryStatus.Booked or InventoryStatus.Sold && u.BasePrice > 0)
                    .Select(u => u.BasePrice)
                    .ToList();
                if (closingPrices.Count == 0)
                    closingPrices = list.Where(u => u.BasePrice > 0).Select(u => u.BasePrice).ToList();
                var avgPrice = closingPrices.Count > 0
                    ? Math.Round(closingPrices.Average(), 0)
                    : 0m;

                return new UnitDemandSignal
                {
                    UnitType = g.Key,
                    DemandIndex = demandIndex,
                    VelocityUnitsPerMonth = velocity,
                    AverageClosingPrice = avgPrice,
                    Status = VelocityStatus(demandIndex, velocity, available),
                    AvailableCount = available,
                    BookedOrSoldCount = bookedOrSold,
                    RecentBookings = recent
                };
            })
            .OrderByDescending(s => s.DemandIndex)
            .ThenByDescending(s => s.VelocityUnitsPerMonth)
            .Take(8)
            .ToList();

        // Budget mix: prefer booking agreed prices; else available base prices
        var budgetSourcePrices = bookings
            .Where(b => b.TotalAgreedPrice > 0)
            .Select(b => b.TotalAgreedPrice)
            .ToList();
        var useBookingsForBudget = budgetSourcePrices.Count > 0;
        if (!useBookingsForBudget)
        {
            budgetSourcePrices = units
                .Where(u => u.Status == InventoryStatus.Available && u.BasePrice > 0)
                .Select(u => u.BasePrice)
                .ToList();
        }

        var brackets = new (string Label, decimal Min, decimal Max)[]
        {
            ("Under PKR 75 Lakh", 0m, 7_500_000m),
            ("PKR 75 Lakh - 1.25 Crore", 7_500_000m, 12_500_000m),
            ("PKR 1.25 Crore - 2.5 Crore", 12_500_000m, 25_000_000m),
            ("Above PKR 2.5 Crore", 25_000_000m, decimal.MaxValue)
        };

        var totalBudgetN = Math.Max(budgetSourcePrices.Count, 1);
        var budgetDist = brackets.Select(br =>
        {
            var inBracket = budgetSourcePrices.Count(p => p >= br.Min && p < br.Max);
            var availableInBracket = units.Count(u =>
                u.Status == InventoryStatus.Available &&
                u.BasePrice >= br.Min &&
                u.BasePrice < br.Max);
            return new BudgetDistributionBracket
            {
                PriceBracket = br.Label,
                SearcherPercentage = Math.Round(inBracket * 100.0 / totalBudgetN, 1),
                ActiveListingsCount = availableInBracket
            };
        }).ToList();

        var top = signals.FirstOrDefault();
        var keyTakeaway = top == null
            ? "Inventory is present but no clear velocity leader yet — track bookings weekly."
            : $"Strongest live velocity: {top.UnitType} (index {top.DemandIndex}, {top.VelocityUnitsPerMonth}/mo, {top.AvailableCount} available). " +
              (useBookingsForBudget
                  ? "Budget mix reflects recent booking prices."
                  : "Budget mix reflects available asking prices (few bookings yet).");

        return new DeveloperDemandRadarDto
        {
            TargetCity = targetCity,
            ProjectType = projects.GroupBy(p => p.ProjectType).OrderByDescending(g => g.Count()).First().Key,
            PreferredInstallmentDurationMonths = preferredMonths,
            KeyTakeaway = keyTakeaway,
            UnitDemandSignals = signals,
            BudgetDistribution = budgetDist,
            SignalSource = "live_units",
            TotalUnitsAnalyzed = units.Count,
            BookingsAnalyzed = bookings.Count
        };
    }

    private static string VelocityStatus(int demandIndex, double velocity, int available)
    {
        if (demandIndex >= 85 || velocity >= 3) return "Extremely High Velocity";
        if (demandIndex >= 70 || velocity >= 1.5) return "High Velocity";
        if (available >= 10 && velocity < 0.5) return "Soft Absorption";
        if (demandIndex >= 50) return "Steady Demand";
        return "Watchlist";
    }

    public AdvancedInvestmentAnalysisResponse CalculateAdvancedInvestment(AdvancedInvestmentAnalysisRequest request)
    {
        var response = new AdvancedInvestmentAnalysisResponse
        {
            PropertyPrice = request.PropertyPrice,
            InitialGrossYield = Math.Round((request.EstimatedMonthlyRent * 12m / request.PropertyPrice) * 100m, 2),
            NetOperatingIncomeYear1 = Math.Round(request.EstimatedMonthlyRent * 12m * 0.90m, 2), // 10% maintenance & vacancy buffer
            Projections = new List<YearlyProjection>()
        };

        decimal currentVal = request.PropertyPrice;
        decimal currentMonthlyRent = request.EstimatedMonthlyRent;
        decimal cumulativeRent = 0m;

        for (int yr = 1; yr <= request.HoldingPeriodYears; yr++)
        {
            currentVal = Math.Round(currentVal * (1m + (decimal)(request.AnnualAppreciationRate / 100.0)), 2);
            if (yr > 1)
            {
                currentMonthlyRent = Math.Round(currentMonthlyRent * (1m + (decimal)(request.AnnualRentalGrowthRate / 100.0)), 2);
            }

            var annualRent = currentMonthlyRent * 12m;
            var netCashFlow = Math.Round(annualRent * 0.90m, 2);
            cumulativeRent += netCashFlow;

            var yieldPct = Math.Round((annualRent / currentVal) * 100m, 2);

            response.Projections.Add(new YearlyProjection
            {
                Year = yr,
                PropertyValue = currentVal,
                AnnualRentalIncome = annualRent,
                NetCashFlow = netCashFlow,
                YieldPercentage = yieldPct
            });
        }

        response.ProjectedExitValue = currentVal;
        response.CumulativeRentalIncome = cumulativeRent;
        var totalGain = (currentVal - request.PropertyPrice) + cumulativeRent;
        response.TotalReturnOnInvestmentPercentage = Math.Round((totalGain / request.PropertyPrice) * 100m, 2);

        return response;
    }
}
