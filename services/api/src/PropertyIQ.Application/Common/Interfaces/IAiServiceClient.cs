using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace PropertyIQ.Application.Common.Interfaces;

public class NaturalLanguageSearchFilterDto
{
    public string RawQuery { get; set; } = string.Empty;
    public string City { get; set; } = "Lahore";
    public string? Area { get; set; }
    public string? PropertyType { get; set; }
    /// <summary>Sale or Rent when detected; null if unspecified.</summary>
    public string? Purpose { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public int? Bedrooms { get; set; }
    public double? LandArea { get; set; }
    public string? LandAreaUnit { get; set; }
    public List<string> LifestylePreferences { get; set; } = new();
    public string? InvestmentIntent { get; set; }
    public double ConfidenceScore { get; set; }
    /// <summary>ollama | rules_fallback | rules — populated by the AI bridge.</summary>
    public string? ParserSource { get; set; }
}

public class PropertyCompSnapshotDto
{
    public Guid? PropertyId { get; set; }
    public string? Title { get; set; }
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string PropertyType { get; set; } = "House";
    public string Purpose { get; set; } = "Sale";
    public decimal Price { get; set; }
    public double Size { get; set; }
    public string SizeUnit { get; set; } = "Marla";
    public int? Bedrooms { get; set; }
    public decimal? ExpectedRentMin { get; set; }
    public decimal? ExpectedRentMax { get; set; }
}

public class PropertyScenarioRequestDto
{
    public Guid? PropertyId { get; set; }
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = "DHA Phase 6";
    public string PropertyType { get; set; } = "House";
    public double Size { get; set; } = 1.0;
    public string SizeUnit { get; set; } = "Kanal";
    public decimal AskingPrice { get; set; } = 98000000m;
    public int? Bedrooms { get; set; }
    /// <summary>Sale or Rent — drives yield denominator and rent blending.</summary>
    public string? Purpose { get; set; } = "Sale";
    /// <summary>Filled by API from live inventory before calling FastAPI.</summary>
    public List<PropertyCompSnapshotDto> SaleComps { get; set; } = new();
    public List<PropertyCompSnapshotDto> RentComps { get; set; } = new();
}

public class PropertyScenarioResultDto
{
    public decimal FairPriceLow { get; set; }
    public decimal FairPriceHigh { get; set; }
    public decimal EstimatedRentMonthlyMin { get; set; }
    public decimal EstimatedRentMonthlyMax { get; set; }
    public double GrossYieldPercentage { get; set; }
    public decimal FutureValue3YrScenario { get; set; }
    public decimal FutureValue5YrScenario { get; set; }
    public decimal FutureValue10YrScenario { get; set; }
    public List<string> Assumptions { get; set; } = new();
    public double ConfidenceScore { get; set; }
    public string Disclaimer { get; set; } = string.Empty;
    /// <summary>comps | hybrid_formula | formula</summary>
    public string? ValuationSource { get; set; }
    public int SaleCompCount { get; set; }
    public int RentCompCount { get; set; }
    /// <summary>ollama_explain | none</summary>
    public string? ExplainSource { get; set; }
}

public class ImageClassificationRequestDto
{
    public string? ImageUrl { get; set; }
    public string? ImageBase64 { get; set; }
    public string? Filename { get; set; }
    public string? PropertyType { get; set; } = "House";
}

public class ImageClassificationResultDto
{
    public string ClassifiedRoom { get; set; } = "LivingRoom";
    public string UiCategory { get; set; } = "Living Room / Hall";
    public double Confidence { get; set; }
    public List<string> DetectedFeatures { get; set; } = new();
    public List<string> QualityIssues { get; set; } = new();
    public List<string> MissingMediaSuggestions { get; set; } = new();
    /// <summary>ollama_vision | filename_fallback | filename</summary>
    public string? Source { get; set; }
}

public class AiListingDraftRequestDto
{
    public string PropertyType { get; set; } = "House";
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = "DHA Phase 6";
    public double Size { get; set; } = 1.0;
    public string SizeUnit { get; set; } = "Kanal";
    public decimal Price { get; set; } = 98000000m;
    public int? Bedrooms { get; set; } = 5;
    public int? Bathrooms { get; set; } = 6;
    public string? Furnishing { get; set; } = "Semi-Furnished";
    public string? UserNotes { get; set; }
}

public class AiListingDraftResultDto
{
    public string SuggestedTitle { get; set; } = string.Empty;
    public string SuggestedDescription { get; set; } = string.Empty;
    public List<string> SellingHighlights { get; set; } = new();
    public List<string> SeoKeywords { get; set; } = new();
    public int CompletenessScore { get; set; }
    public List<string> ConfirmationRequired { get; set; } = new();
    public string Disclaimer { get; set; } = string.Empty;
    /// <summary>ollama | template_fallback | template | ai_service</summary>
    public string? DraftSource { get; set; }
}

public class AgentOpsStatsDto
{
    public int ActiveListings { get; set; }
    public int PendingLeads { get; set; }
    public int TotalLeads { get; set; }
    public int TotalViews { get; set; }
    public int TotalSaves { get; set; }
    public int UpcomingVisits { get; set; }
    public int InReview { get; set; }
    public int Unverified { get; set; }
    public int WeakListingCount { get; set; }
    /// <summary>Agency firm brief only.</summary>
    public int ActiveBrokers { get; set; }
    public int MonthlyLeads { get; set; }
    public string? OrgName { get; set; }
    /// <summary>Developer firm brief only.</summary>
    public int TotalUnits { get; set; }
    public int AvailableUnits { get; set; }
    public int BookedOrSoldUnits { get; set; }
    public double AbsorptionRatePct { get; set; }
    public int BookingsThisMonth { get; set; }
    public int ProjectCount { get; set; }
    public int PendingProofs { get; set; }
}

public class AgentOpsAlertInDto
{
    public string PropertyId { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Issue { get; set; }
    public string? Recommendation { get; set; }
    public string? AlertType { get; set; }
    public string? City { get; set; }
    public string? Area { get; set; }
    public decimal? AskingPrice { get; set; }
}

public class AgentOpsRequestDto
{
    public AgentOpsStatsDto Stats { get; set; } = new();
    public string? FallbackBrief { get; set; }
    public List<AgentOpsAlertInDto> Alerts { get; set; } = new();
    /// <summary>agent | agency | developer</summary>
    public string Audience { get; set; } = "agent";
}

public class AgentOpsRecommendationDto
{
    public string PropertyId { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;
    public string Source { get; set; } = "rules";
}

public class AgentOpsResultDto
{
    public string Briefing { get; set; } = string.Empty;
    public string BriefingSource { get; set; } = "rules";
    public List<AgentOpsRecommendationDto> Recommendations { get; set; } = new();
    public string? FallbackReason { get; set; }
}

public interface IAiServiceClient
{
    Task<NaturalLanguageSearchFilterDto> ParseSearchQueryAsync(string query, string? preferredCity = "Lahore", CancellationToken cancellationToken = default);
    Task<PropertyScenarioResultDto> CalculateScenarioAsync(PropertyScenarioRequestDto request, CancellationToken cancellationToken = default);
    Task<ImageClassificationResultDto> ClassifyImageAsync(ImageClassificationRequestDto request, CancellationToken cancellationToken = default);
    Task<AiListingDraftResultDto> GenerateListingDraftAsync(AiListingDraftRequestDto request, CancellationToken cancellationToken = default);
    Task<AgentOpsResultDto> RunAgentOpsAsync(AgentOpsRequestDto request, CancellationToken cancellationToken = default);
}
