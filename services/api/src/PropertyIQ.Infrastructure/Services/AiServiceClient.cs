using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PropertyIQ.Application.Common.Interfaces;

namespace PropertyIQ.Infrastructure.Services;

public class AiServiceClient : IAiServiceClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiServiceClient> _logger;
    private readonly string _baseUrl;

    public AiServiceClient(HttpClient httpClient, IConfiguration configuration, ILogger<AiServiceClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _baseUrl = (configuration["AiService:BaseUrl"] ?? "http://127.0.0.1:8002").TrimEnd('/');
    }

    public async Task<NaturalLanguageSearchFilterDto> ParseSearchQueryAsync(string query, string? preferredCity = "Lahore", CancellationToken cancellationToken = default)
    {
        try
        {
            using var requestMessage = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/ai/search-parser")
            {
                Content = JsonContent.Create(new
                {
                    query,
                    preferred_city = preferredCity
                })
            };

            var response = await _httpClient.SendAsync(requestMessage, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                string? parserSource = null;
                if (response.Headers.TryGetValues("X-PropertyIQ-Parser", out var values))
                    parserSource = values.FirstOrDefault();

                var mapped = MapSearchFilter(json, query, preferredCity, parserSource);
                _logger.LogInformation(
                    "AI parse-search ok source={Source} city={City} type={Type} purpose={Purpose} conf={Conf}",
                    mapped.ParserSource,
                    mapped.City,
                    mapped.PropertyType,
                    mapped.Purpose,
                    mapped.ConfidenceScore);
                return mapped;
            }

            _logger.LogWarning("AI search-parser returned HTTP {Status}; using local fallback.", (int)response.StatusCode);
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "AI search-parser timed out after {Timeout}; using local rule fallback.", _httpClient.Timeout);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "FastAPI AI service unreachable; using local rule parser fallback.");
        }

        // Resilient Fallback (Phase 2 contract fields)
        var qLower = query.ToLowerInvariant();
        string? purpose = null;
        if (qLower.Contains("for rent") || qLower.Contains(" on rent") || (qLower.Contains("rent") && !qLower.Contains("for sale")))
            purpose = "Rent";
        else if (qLower.Contains("for sale") || qLower.Contains("to buy"))
            purpose = "Sale";

        decimal? maxPrice = null;
        if (qLower.Contains("4 crore") || qLower.Contains("4 cr")) maxPrice = 40000000m;
        else if (qLower.Contains("3 crore") || qLower.Contains("3 cr")) maxPrice = 30000000m;
        else if (qLower.Contains("2.5 crore") || qLower.Contains("2.5 cr")) maxPrice = 25000000m;
        else if (qLower.Contains("2 crore") || qLower.Contains("2 cr")) maxPrice = 20000000m;
        else if (qLower.Contains("1 crore") || qLower.Contains("1 cr")) maxPrice = 10000000m;
        else if (qLower.Contains("80 lac") || qLower.Contains("80 lakh")) maxPrice = 8000000m;
        else if (qLower.Contains("50 lac") || qLower.Contains("50 lakh")) maxPrice = 5000000m;

        return new NaturalLanguageSearchFilterDto
        {
            RawQuery = query,
            City = qLower.Contains("islamabad") ? "Islamabad" : (qLower.Contains("karachi") ? "Karachi" : (qLower.Contains("rawalpindi") ? "Rawalpindi" : "Lahore")),
            Area = qLower.Contains("dha") ? "DHA" : (qLower.Contains("bahria") ? "Bahria Town" : null),
            PropertyType = qLower.Contains("flat") || qLower.Contains("apartment") ? "ApartmentFlat" : (qLower.Contains("plot") ? "Plot" : (qLower.Contains("shop") || qLower.Contains("commercial") ? "CommercialShop" : "House")),
            Purpose = purpose,
            MaxPrice = maxPrice,
            LandArea = qLower.Contains("10 marla") ? 10.0 : (qLower.Contains("5 marla") ? 5.0 : (qLower.Contains("1 kanal") ? 1.0 : null)),
            LandAreaUnit = qLower.Contains("kanal") ? "Kanal" : (qLower.Contains("marla") ? "Marla" : null),
            LifestylePreferences = new List<string>(),
            InvestmentIntent = qLower.Contains("investment") || qLower.Contains("yield") ? "Rental & Capital Appreciation" : null,
            ConfidenceScore = 0.85,
            ParserSource = "rules_fallback"
        };
    }

    private static NaturalLanguageSearchFilterDto MapSearchFilter(
        JsonElement json,
        string query,
        string? preferredCity,
        string? parserSource)
    {
        static string? Str(JsonElement root, string name)
            => root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;

        static decimal? Dec(JsonElement root, string name)
            => root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetDecimal() : null;

        static double? Dbl(JsonElement root, string name)
            => root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetDouble() : null;

        static int? Int(JsonElement root, string name)
            => root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetInt32() : null;

        var lifestyle = new List<string>();
        if (json.TryGetProperty("lifestyle_preferences", out var lp) && lp.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in lp.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s))
                        lifestyle.Add(s!);
                }
            }
        }

        return new NaturalLanguageSearchFilterDto
        {
            RawQuery = Str(json, "raw_query") ?? query,
            City = Str(json, "city") ?? preferredCity ?? "Lahore",
            Area = Str(json, "area"),
            PropertyType = Str(json, "property_type"),
            Purpose = Str(json, "purpose"),
            MinPrice = Dec(json, "min_price"),
            MaxPrice = Dec(json, "max_price"),
            Bedrooms = Int(json, "bedrooms"),
            LandArea = Dbl(json, "land_area"),
            LandAreaUnit = Str(json, "land_area_unit"),
            LifestylePreferences = lifestyle,
            InvestmentIntent = Str(json, "investment_intent"),
            ConfidenceScore = json.TryGetProperty("confidence_score", out var cs) && cs.ValueKind == JsonValueKind.Number
                ? cs.GetDouble()
                : 0.90,
            ParserSource = string.IsNullOrWhiteSpace(parserSource) ? "ai_service" : parserSource
        };
    }

    public async Task<PropertyScenarioResultDto> CalculateScenarioAsync(PropertyScenarioRequestDto request, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/ai/property-scenario", new
            {
                city = request.City,
                area = request.Area,
                property_type = request.PropertyType,
                size = request.Size,
                size_unit = request.SizeUnit,
                asking_price = (double)request.AskingPrice,
                bedrooms = request.Bedrooms,
                purpose = request.Purpose ?? "Sale",
                sale_comps = request.SaleComps.Select(c => new
                {
                    property_id = c.PropertyId,
                    title = c.Title,
                    city = c.City,
                    area = c.Area,
                    property_type = c.PropertyType,
                    purpose = c.Purpose,
                    price = (double)c.Price,
                    size = c.Size,
                    size_unit = c.SizeUnit,
                    bedrooms = c.Bedrooms,
                    expected_rent_min = c.ExpectedRentMin.HasValue ? (double?)c.ExpectedRentMin.Value : null,
                    expected_rent_max = c.ExpectedRentMax.HasValue ? (double?)c.ExpectedRentMax.Value : null
                }),
                rent_comps = request.RentComps.Select(c => new
                {
                    property_id = c.PropertyId,
                    title = c.Title,
                    city = c.City,
                    area = c.Area,
                    property_type = c.PropertyType,
                    purpose = c.Purpose,
                    price = (double)c.Price,
                    size = c.Size,
                    size_unit = c.SizeUnit,
                    bedrooms = c.Bedrooms,
                    expected_rent_min = c.ExpectedRentMin.HasValue ? (double?)c.ExpectedRentMin.Value : null,
                    expected_rent_max = c.ExpectedRentMax.HasValue ? (double?)c.ExpectedRentMax.Value : null
                })
            }, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                string? explainSource = null;
                if (response.Headers.TryGetValues("X-PropertyIQ-Scenario-Explain", out var explainHdr))
                    explainSource = explainHdr.FirstOrDefault();

                return MapScenarioResult(json, explainSource);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "FastAPI AI service unreachable; using deterministic financial valuation fallback.");
        }

        return LocalScenarioFallback(request);
    }

    private static PropertyScenarioResultDto MapScenarioResult(JsonElement json, string? explainSource)
    {
        static decimal Dec(JsonElement root, string name) =>
            root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetDecimal() : 0m;

        static double Dbl(JsonElement root, string name) =>
            root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetDouble() : 0.0;

        static int Int(JsonElement root, string name) =>
            root.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number ? el.GetInt32() : 0;

        var assumptions = new List<string>();
        if (json.TryGetProperty("assumptions", out var ass) && ass.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in ass.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var s = item.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) assumptions.Add(s!);
                }
            }
        }

        return new PropertyScenarioResultDto
        {
            FairPriceLow = Dec(json, "fair_price_low"),
            FairPriceHigh = Dec(json, "fair_price_high"),
            EstimatedRentMonthlyMin = Dec(json, "estimated_rent_monthly_min"),
            EstimatedRentMonthlyMax = Dec(json, "estimated_rent_monthly_max"),
            GrossYieldPercentage = Dbl(json, "gross_yield_percentage"),
            FutureValue3YrScenario = Dec(json, "future_value_3yr_scenario"),
            FutureValue5YrScenario = Dec(json, "future_value_5yr_scenario"),
            FutureValue10YrScenario = Dec(json, "future_value_10yr_scenario"),
            Assumptions = assumptions,
            ConfidenceScore = Dbl(json, "confidence_score"),
            Disclaimer = json.TryGetProperty("disclaimer", out var d) ? d.GetString() ?? string.Empty : string.Empty,
            ValuationSource = json.TryGetProperty("valuation_source", out var vs) ? vs.GetString() : "formula",
            SaleCompCount = Int(json, "sale_comp_count"),
            RentCompCount = Int(json, "rent_comp_count"),
            ExplainSource = explainSource
                ?? (json.TryGetProperty("explain_source", out var es) ? es.GetString() : "none")
        };
    }

    private static PropertyScenarioResultDto LocalScenarioFallback(PropertyScenarioRequestDto request)
    {
        var price = request.AskingPrice;
        var monthlyRent = price * 0.0042m;
        return new PropertyScenarioResultDto
        {
            FairPriceLow = Math.Round(price * 0.94m, 2),
            FairPriceHigh = Math.Round(price * 1.05m, 2),
            EstimatedRentMonthlyMin = Math.Round(monthlyRent * 0.90m, 2),
            EstimatedRentMonthlyMax = Math.Round(monthlyRent * 1.12m, 2),
            GrossYieldPercentage = 5.04,
            FutureValue3YrScenario = Math.Round(price * 1.36m, 2),
            FutureValue5YrScenario = Math.Round(price * 1.68m, 2),
            FutureValue10YrScenario = Math.Round(price * 2.83m, 2),
            Assumptions = new List<string>
            {
                "AI service unreachable — local asking-price formula used.",
                "Reconnect FastAPI / Ollama for comps-aware scenarios."
            },
            ConfidenceScore = 0.55,
            Disclaimer = "Estimates generated for decision intelligence; non-guaranteed.",
            ValuationSource = "formula",
            SaleCompCount = request.SaleComps?.Count ?? 0,
            RentCompCount = request.RentComps?.Count ?? 0,
            ExplainSource = "none"
        };
    }

    public async Task<ImageClassificationResultDto> ClassifyImageAsync(
        ImageClassificationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Don't let vision hang the listing upload UI (~150s HttpClient timeout).
            using var classifyCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            classifyCts.CancelAfter(TimeSpan.FromSeconds(25));

            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/ai/image-classification", new
            {
                image_url = request.ImageUrl ?? "",
                image_base64 = request.ImageBase64,
                filename = request.Filename,
                property_type = request.PropertyType ?? "House"
            }, classifyCts.Token);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                string? source = null;
                if (response.Headers.TryGetValues("X-PropertyIQ-Image-Source", out var srcHdr))
                    source = srcHdr.FirstOrDefault();

                return new ImageClassificationResultDto
                {
                    ClassifiedRoom = json.TryGetProperty("classified_room", out var room)
                        ? room.GetString() ?? "LivingRoom"
                        : "LivingRoom",
                    UiCategory = json.TryGetProperty("ui_category", out var cat)
                        ? cat.GetString() ?? "Living Room / Hall"
                        : "Living Room / Hall",
                    Confidence = json.TryGetProperty("confidence", out var conf) && conf.ValueKind == JsonValueKind.Number
                        ? conf.GetDouble()
                        : 0.55,
                    DetectedFeatures = ReadStringArray(json, "detected_features"),
                    QualityIssues = ReadStringArray(json, "quality_issues"),
                    MissingMediaSuggestions = ReadStringArray(json, "missing_media_suggestions"),
                    Source = source
                        ?? (json.TryGetProperty("source", out var s) ? s.GetString() : "ai_service")
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "FastAPI AI service unreachable; returning filename image classification fallback.");
        }

        var hint = (request.Filename ?? request.ImageUrl ?? "").ToLowerInvariant();
        var roomFb = hint.Contains("kitchen") ? "Kitchen"
            : hint.Contains("bed") ? "Bedroom"
            : hint.Contains("bath") ? "Bathroom"
            : hint.Contains("exterior") || hint.Contains("front") ? "Exterior"
            : "LivingRoom";

        return new ImageClassificationResultDto
        {
            ClassifiedRoom = roomFb,
            UiCategory = roomFb == "Kitchen" ? "Kitchen"
                : roomFb == "Bedroom" ? "Bedroom"
                : roomFb == "Bathroom" ? "Bathroom / Powder Room"
                : roomFb == "Exterior" ? "Exterior / Elevation"
                : "Living Room / Hall",
            Confidence = 0.5,
            DetectedFeatures = new List<string> { "Filename heuristic" },
            QualityIssues = new List<string>(),
            MissingMediaSuggestions = new List<string> { "Add exterior, kitchen, and bathroom photos" },
            Source = "filename_fallback"
        };
    }

    public async Task<AiListingDraftResultDto> GenerateListingDraftAsync(AiListingDraftRequestDto request, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/ai/listing-draft", new
            {
                property_type = request.PropertyType,
                city = request.City,
                area = request.Area,
                size = request.Size,
                size_unit = request.SizeUnit,
                price = (double)request.Price,
                bedrooms = request.Bedrooms,
                bathrooms = request.Bathrooms,
                furnishing = request.Furnishing,
                user_notes = request.UserNotes
            }, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
                string? draftSource = null;
                if (response.Headers.TryGetValues("X-PropertyIQ-Listing-Draft", out var draftHeaders))
                    draftSource = draftHeaders.FirstOrDefault();

                return MapListingDraft(json, request, draftSource ?? "ai_service");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "FastAPI AI service unreachable; returning template listing draft.");
        }

        return MapListingDraftFallback(request, "template_fallback");
    }

    private static List<string> ReadStringArray(JsonElement root, string snakeName)
    {
        var list = new List<string>();
        if (!root.TryGetProperty(snakeName, out var el) || el.ValueKind != JsonValueKind.Array)
            return list;
        foreach (var item in el.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var s = item.GetString();
                if (!string.IsNullOrWhiteSpace(s))
                    list.Add(s!);
            }
        }
        return list;
    }

    private static AiListingDraftResultDto MapListingDraft(JsonElement json, AiListingDraftRequestDto request, string source)
    {
        return new AiListingDraftResultDto
        {
            SuggestedTitle = json.TryGetProperty("suggested_title", out var t) ? t.GetString() ?? string.Empty : string.Empty,
            SuggestedDescription = json.TryGetProperty("suggested_description", out var d) ? d.GetString() ?? string.Empty : string.Empty,
            SellingHighlights = ReadStringArray(json, "selling_highlights"),
            SeoKeywords = ReadStringArray(json, "seo_keywords"),
            CompletenessScore = json.TryGetProperty("completeness_score", out var cs) && cs.ValueKind == JsonValueKind.Number
                ? cs.GetInt32()
                : 80,
            ConfirmationRequired = ReadStringArray(json, "confirmation_required"),
            Disclaimer = json.TryGetProperty("disclaimer", out var disc) ? disc.GetString() ?? string.Empty : string.Empty,
            DraftSource = source
        };
    }

    private static AiListingDraftResultDto MapListingDraftFallback(AiListingDraftRequestDto request, string source)
    {
        var title = $"{request.Size} {request.SizeUnit} {request.PropertyType} in {request.Area}, {request.City}";
        var desc =
            $"Prime {request.Size} {request.SizeUnit} {request.PropertyType} located in {request.Area}, {request.City}. " +
            (request.Bedrooms.HasValue ? $"Features {request.Bedrooms} bedrooms. " : "") +
            "Review and verify all details before publishing.";
        return new AiListingDraftResultDto
        {
            SuggestedTitle = title,
            SuggestedDescription = desc,
            SellingHighlights = new List<string> { $"{request.Area}, {request.City}", $"{request.Size} {request.SizeUnit}" },
            SeoKeywords = new List<string> { $"{request.City} {request.PropertyType}", request.Area },
            CompletenessScore = 72,
            ConfirmationRequired = new List<string> { "Verify title documents and possession" },
            Disclaimer = "Assistive draft. Verify all details before publishing.",
            DraftSource = source
        };
    }

    public async Task<AgentOpsResultDto> RunAgentOpsAsync(
        AgentOpsRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var fallback = new AgentOpsResultDto
        {
            Briefing = request.FallbackBrief ?? string.Empty,
            BriefingSource = "rules",
            Recommendations = request.Alerts.Select(a => new AgentOpsRecommendationDto
            {
                PropertyId = a.PropertyId,
                Recommendation = a.Recommendation ?? string.Empty,
                Source = "rules"
            }).ToList()
        };

        try
        {
            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/ai/agent-ops", new
            {
                audience = string.IsNullOrWhiteSpace(request.Audience) ? "agent" : request.Audience,
                stats = new
                {
                    active_listings = request.Stats.ActiveListings,
                    pending_leads = request.Stats.PendingLeads,
                    total_leads = request.Stats.TotalLeads,
                    total_views = request.Stats.TotalViews,
                    total_saves = request.Stats.TotalSaves,
                    upcoming_visits = request.Stats.UpcomingVisits,
                    in_review = request.Stats.InReview,
                    unverified = request.Stats.Unverified,
                    weak_listing_count = request.Stats.WeakListingCount,
                    active_brokers = request.Stats.ActiveBrokers,
                    monthly_leads = request.Stats.MonthlyLeads,
                    org_name = request.Stats.OrgName,
                    total_units = request.Stats.TotalUnits,
                    available_units = request.Stats.AvailableUnits,
                    booked_or_sold_units = request.Stats.BookedOrSoldUnits,
                    absorption_rate_pct = request.Stats.AbsorptionRatePct,
                    bookings_this_month = request.Stats.BookingsThisMonth,
                    project_count = request.Stats.ProjectCount,
                    pending_proofs = request.Stats.PendingProofs
                },
                fallback_brief = request.FallbackBrief,
                alerts = request.Alerts.Select(a => new
                {
                    property_id = a.PropertyId,
                    title = a.Title,
                    issue = a.Issue,
                    recommendation = a.Recommendation,
                    alert_type = a.AlertType,
                    city = a.City,
                    area = a.Area,
                    asking_price = a.AskingPrice.HasValue ? (double?)a.AskingPrice.Value : null
                })
            }, cancellationToken);

            if (!response.IsSuccessStatusCode)
                return fallback;

            var json = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
            var briefing = json.TryGetProperty("briefing", out var b) ? b.GetString() ?? fallback.Briefing : fallback.Briefing;
            var source = json.TryGetProperty("briefing_source", out var bs) ? bs.GetString() ?? "rules" : "rules";
            var recs = new List<AgentOpsRecommendationDto>();
            if (json.TryGetProperty("recommendations", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in arr.EnumerateArray())
                {
                    var pid = item.TryGetProperty("property_id", out var p) ? p.GetString() : null;
                    var rec = item.TryGetProperty("recommendation", out var r) ? r.GetString() : null;
                    var src = item.TryGetProperty("source", out var s) ? s.GetString() : "rules";
                    if (!string.IsNullOrWhiteSpace(pid) && !string.IsNullOrWhiteSpace(rec))
                    {
                        recs.Add(new AgentOpsRecommendationDto
                        {
                            PropertyId = pid!,
                            Recommendation = rec!,
                            Source = src ?? "rules"
                        });
                    }
                }
            }

            return new AgentOpsResultDto
            {
                Briefing = briefing,
                BriefingSource = source ?? "rules",
                Recommendations = recs.Count > 0 ? recs : fallback.Recommendations,
                FallbackReason = json.TryGetProperty("fallback_reason", out var fr) && fr.ValueKind == JsonValueKind.String
                    ? fr.GetString()
                    : null
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "agent-ops unreachable; using rules briefing.");
            return fallback;
        }
    }
}
