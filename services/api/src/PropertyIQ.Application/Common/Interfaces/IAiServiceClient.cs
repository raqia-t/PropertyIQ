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
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public int? Bedrooms { get; set; }
    public double? LandArea { get; set; }
    public string? LandAreaUnit { get; set; }
    public List<string> LifestylePreferences { get; set; } = new();
    public string? InvestmentIntent { get; set; }
    public double ConfidenceScore { get; set; }
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
}

public class ImageClassificationResultDto
{
    public string ClassifiedRoom { get; set; } = "LivingRoom";
    public double Confidence { get; set; }
    public List<string> DetectedFeatures { get; set; } = new();
    public List<string> QualityIssues { get; set; } = new();
    public List<string> MissingMediaSuggestions { get; set; } = new();
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
}

public interface IAiServiceClient
{
    Task<NaturalLanguageSearchFilterDto> ParseSearchQueryAsync(string query, string? preferredCity = "Lahore", CancellationToken cancellationToken = default);
    Task<PropertyScenarioResultDto> CalculateScenarioAsync(PropertyScenarioRequestDto request, CancellationToken cancellationToken = default);
    Task<ImageClassificationResultDto> ClassifyImageAsync(string imageUrl, string? propertyType = "House", CancellationToken cancellationToken = default);
    Task<AiListingDraftResultDto> GenerateListingDraftAsync(AiListingDraftRequestDto request, CancellationToken cancellationToken = default);
}
