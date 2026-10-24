using System;
using System.Collections.Generic;

namespace PropertyIQ.Application.DTOs.Intelligence;

public class DemandGapDto
{
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string PropertyType { get; set; } = string.Empty;
    public string SizeCategory { get; set; } = string.Empty; // e.g. "5 Marla", "10 Marla", "1 Kanal"
    /// <summary>Proxy demand score: views + inquiries + weighted bookings (not vendor search logs).</summary>
    public int MonthlySearchVolume { get; set; }
    public int ActiveSupplyCount { get; set; }
    public double DemandSupplyRatio { get; set; }
    /// <summary>HighDemandLowSupply | Balanced | Oversupplied</summary>
    public string GapLevel { get; set; } = "Balanced";
    public decimal MedianSearchBudget { get; set; }
    public string RecommendedAction { get; set; } = string.Empty;
    /// <summary>live_inventory | live_units</summary>
    public string SignalSource { get; set; } = "live_inventory";
    /// <summary>rules | ollama</summary>
    public string RecommendationSource { get; set; } = "rules";
    public int BookingsCount { get; set; }
    public int ViewsCount { get; set; }
    public int InquiriesCount { get; set; }
}

public class NeighborhoodPoiDto
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // School, Hospital, Market, Mosque, Transport, Park
    public double DistanceKm { get; set; }
    public int TravelTimeMinutes { get; set; }
    public double Rating { get; set; }
}

public class NeighborhoodIntelligenceDto
{
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public int LivabilityScore { get; set; } // 0 - 100
    public string OverallVibe { get; set; } = string.Empty;
    public string SecurityRating { get; set; } = "High";
    public string InfrastructureQuality { get; set; } = "Underground Electrification, Carpeted Roads";
    public string RingRoadAccess { get; set; } = string.Empty;
    public List<NeighborhoodPoiDto> PointsOfInterest { get; set; } = new();
    public Dictionary<string, int> CommuteEstimatesMinutes { get; set; } = new();
    public string AiSummary { get; set; } = string.Empty;
    /// <summary>live_pois | curated_seed</summary>
    public string SignalSource { get; set; } = "curated_seed";
    /// <summary>osm_overpass | osm_nominatim | google_places | seed</summary>
    public string PoiSource { get; set; } = "seed";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public class DeveloperDemandRadarDto
{
    public string ProjectType { get; set; } = string.Empty;
    public string TargetCity { get; set; } = string.Empty;
    public List<UnitDemandSignal> UnitDemandSignals { get; set; } = new();
    public List<BudgetDistributionBracket> BudgetDistribution { get; set; } = new();
    public double PreferredInstallmentDurationMonths { get; set; } = 36;
    public string KeyTakeaway { get; set; } = string.Empty;
    /// <summary>live_units | empty</summary>
    public string SignalSource { get; set; } = "live_units";
    public int TotalUnitsAnalyzed { get; set; }
    public int BookingsAnalyzed { get; set; }
}

public class UnitDemandSignal
{
    public string UnitType { get; set; } = string.Empty; // 5 Marla Plot, 10 Marla Plot, 2-Bed Flat, etc.
    public int DemandIndex { get; set; } // 0 - 100
    public double VelocityUnitsPerMonth { get; set; }
    public decimal AverageClosingPrice { get; set; }
    public string Status { get; set; } = "High Velocity";
    public int AvailableCount { get; set; }
    public int BookedOrSoldCount { get; set; }
    public int RecentBookings { get; set; }
}

public class BudgetDistributionBracket
{
    public string PriceBracket { get; set; } = string.Empty; // e.g. "PKR 50L - 1 Cr"
    /// <summary>Share of bookings (or available stock if no bookings) in this bracket.</summary>
    public double SearcherPercentage { get; set; }
    public int ActiveListingsCount { get; set; }
}

public class AdvancedInvestmentAnalysisRequest
{
    public decimal PropertyPrice { get; set; } = 25000000m;
    public decimal EstimatedMonthlyRent { get; set; } = 110000m;
    public double AnnualAppreciationRate { get; set; } = 10.5;
    public double AnnualRentalGrowthRate { get; set; } = 8.0;
    public int HoldingPeriodYears { get; set; } = 5;
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = "DHA Phase 6";
}

public class AdvancedInvestmentAnalysisResponse
{
    public decimal PropertyPrice { get; set; }
    public decimal InitialGrossYield { get; set; }
    public decimal NetOperatingIncomeYear1 { get; set; }
    public List<YearlyProjection> Projections { get; set; } = new();
    public decimal ProjectedExitValue { get; set; }
    public decimal CumulativeRentalIncome { get; set; }
    public decimal TotalReturnOnInvestmentPercentage { get; set; }
    public TaxImpactSummary TaxImpact { get; set; } = new();
    public string Disclaimer { get; set; } = "Estimates only. Subject to market fluctuations, inflation, and FBR tax laws.";
}

public class YearlyProjection
{
    public int Year { get; set; }
    public decimal PropertyValue { get; set; }
    public decimal AnnualRentalIncome { get; set; }
    public decimal NetCashFlow { get; set; }
    public decimal YieldPercentage { get; set; }
}

public class TaxImpactSummary
{
    public string Section236KAdvanceTax { get; set; } = "FBR Section 236K Advance Tax: 3% for Filers / 10.5% for Non-Filers on Purchase";
    public string Section7ECapitalGain { get; set; } = "FBR Section 7E Capital Value Tax: Deemed Rental Income Tax rules apply for non-primary properties";
    public string MunicipalPropertyTax { get; set; } = "Annual excise & taxation assessment applied";
}
