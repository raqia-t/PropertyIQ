using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Intelligence;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.Services;

public interface IIntelligenceService
{
    Task<List<DemandGapDto>> GetDemandGapsAsync(string? city);
    Task<NeighborhoodIntelligenceDto> GetNeighborhoodIntelligenceAsync(string city, string area);
    Task<DeveloperDemandRadarDto> GetDeveloperDemandRadarAsync(string? city);
    AdvancedInvestmentAnalysisResponse CalculateAdvancedInvestment(AdvancedInvestmentAnalysisRequest request);
}

public class IntelligenceService : IIntelligenceService
{
    private readonly IApplicationDbContext _context;

    public IntelligenceService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<DemandGapDto>> GetDemandGapsAsync(string? city)
    {
        var targetCity = string.IsNullOrWhiteSpace(city) ? "Lahore" : city;

        // In a production system, this aggregates from an anonymous search logs table.
        // For MVP, we synthesize live market signals correlated with active listings in the DB:
        var properties = await _context.Properties
            .Where(p => !p.IsDeleted && p.City.ToLower() == targetCity.ToLower())
            .ToListAsync();

        var gaps = new List<DemandGapDto>
        {
            new DemandGapDto
            {
                City = targetCity,
                Area = targetCity.Equals("Lahore", StringComparison.OrdinalIgnoreCase) ? "Raiwind Road" : "Sector B-17",
                PropertyType = "Plot",
                SizeCategory = "5 Marla",
                MonthlySearchVolume = 4820,
                ActiveSupplyCount = Math.Max(12, properties.Count(p => p.LandArea <= 5.0 && p.PropertyType == PropertyType.Plot)),
                DemandSupplyRatio = 8.4,
                GapLevel = "HighDemandLowSupply",
                MedianSearchBudget = 9500000m,
                RecommendedAction = "High buyer interest for installment plans. Developers can launch 5-marla inventory with rapid absorption."
            },
            new DemandGapDto
            {
                City = targetCity,
                Area = targetCity.Equals("Lahore", StringComparison.OrdinalIgnoreCase) ? "DHA Phase 6" : "F-10 Markaz",
                PropertyType = "House",
                SizeCategory = "1 Kanal",
                MonthlySearchVolume = 3210,
                ActiveSupplyCount = Math.Max(8, properties.Count(p => p.LandArea >= 1.0 && p.LandAreaUnit == LandAreaUnit.Kanal)),
                DemandSupplyRatio = 6.2,
                GapLevel = "HighDemandLowSupply",
                MedianSearchBudget = 95000000m,
                RecommendedAction = "Strong expatriate and executive demand for newly constructed modern bungalows with solar backup."
            },
            new DemandGapDto
            {
                City = targetCity,
                Area = targetCity.Equals("Lahore", StringComparison.OrdinalIgnoreCase) ? "Gulberg III" : "Blue Area",
                PropertyType = "ApartmentFlat",
                SizeCategory = "2-Bed Luxury",
                MonthlySearchVolume = 2490,
                ActiveSupplyCount = 18,
                DemandSupplyRatio = 4.8,
                GapLevel = "Balanced",
                MedianSearchBudget = 18500000m,
                RecommendedAction = "Steady investor appetite for high-yield serviced apartments with rental management."
            },
            new DemandGapDto
            {
                City = targetCity,
                Area = targetCity.Equals("Lahore", StringComparison.OrdinalIgnoreCase) ? "Bahria Town" : "Gulberg Greens",
                PropertyType = "House",
                SizeCategory = "10 Marla",
                MonthlySearchVolume = 2890,
                ActiveSupplyCount = 42,
                DemandSupplyRatio = 2.1,
                GapLevel = "Balanced",
                MedianSearchBudget = 32000000m,
                RecommendedAction = "Competitive resale pricing required. Listings with verified documentation convert 3x faster."
            }
        };

        return gaps;
    }

    public Task<NeighborhoodIntelligenceDto> GetNeighborhoodIntelligenceAsync(string city, string area)
    {
        var targetCity = string.IsNullOrWhiteSpace(city) ? "Lahore" : city;
        var targetArea = string.IsNullOrWhiteSpace(area) ? "DHA Phase 6" : area;

        var dto = new NeighborhoodIntelligenceDto
        {
            City = targetCity,
            Area = targetArea
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
            dto.AiSummary = "DHA Phase 6 is one of Lahore's prime residential addresses with state-of-the-art underground utilities, top private educational institutions within 5 minutes, direct Ring Road transit, and vibrant commercial CCA markets.";
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
            dto.AiSummary = "Raiwind Road represents high-velocity residential growth in Lahore, offering master-planned housing schemes with affordable 5 and 10 Marla plots, expanding educational campuses, and smooth southern Ring Road connectivity.";
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
            dto.AiSummary = $"Established sector in {targetCity} with convenient access to schools, healthcare facilities, and daily commercial necessities.";
        }

        return Task.FromResult(dto);
    }

    public Task<DeveloperDemandRadarDto> GetDeveloperDemandRadarAsync(string? city)
    {
        var targetCity = string.IsNullOrWhiteSpace(city) ? "Lahore" : city;

        var dto = new DeveloperDemandRadarDto
        {
            TargetCity = targetCity,
            ProjectType = "Master Residential Housing Scheme",
            PreferredInstallmentDurationMonths = 36,
            KeyTakeaway = "Strongest unmet buyer demand is concentrated in 5 Marla residential plots priced under PKR 1 Crore offering 3-year quarterly payment plans.",
            UnitDemandSignals = new List<UnitDemandSignal>
            {
                new UnitDemandSignal { UnitType = "5 Marla Residential Plot", DemandIndex = 95, VelocityUnitsPerMonth = 14.2, AverageClosingPrice = 9500000m, Status = "Extremely High Velocity" },
                new UnitDemandSignal { UnitType = "10 Marla Residential Plot", DemandIndex = 78, VelocityUnitsPerMonth = 7.5, AverageClosingPrice = 18500000m, Status = "High Velocity" },
                new UnitDemandSignal { UnitType = "1 Kanal Executive Plot", DemandIndex = 64, VelocityUnitsPerMonth = 3.8, AverageClosingPrice = 35000000m, Status = "Steady Demand" },
                new UnitDemandSignal { UnitType = "Commercial Boulevard Shop", DemandIndex = 82, VelocityUnitsPerMonth = 5.1, AverageClosingPrice = 16000000m, Status = "High Investor Demand" }
            },
            BudgetDistribution = new List<BudgetDistributionBracket>
            {
                new BudgetDistributionBracket { PriceBracket = "Under PKR 75 Lakh", SearcherPercentage = 24.5, ActiveListingsCount = 8 },
                new BudgetDistributionBracket { PriceBracket = "PKR 75 Lakh - 1.25 Crore", SearcherPercentage = 42.0, ActiveListingsCount = 22 },
                new BudgetDistributionBracket { PriceBracket = "PKR 1.25 Crore - 2.5 Crore", SearcherPercentage = 21.5, ActiveListingsCount = 38 },
                new BudgetDistributionBracket { PriceBracket = "Above PKR 2.5 Crore", SearcherPercentage = 12.0, ActiveListingsCount = 45 }
            }
        };

        return Task.FromResult(dto);
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
