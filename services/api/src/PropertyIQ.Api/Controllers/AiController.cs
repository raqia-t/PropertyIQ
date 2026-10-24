using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.Services;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly IAiServiceClient _aiClient;
    private readonly IPropertyCompsService _compsService;
    private readonly ILogger<AiController> _logger;

    public AiController(
        IAiServiceClient aiClient,
        IPropertyCompsService compsService,
        ILogger<AiController> logger)
    {
        _aiClient = aiClient;
        _compsService = compsService;
        _logger = logger;
    }

    public class ParseSearchInput
    {
        public string Query { get; set; } = string.Empty;
        public string? PreferredCity { get; set; } = "Lahore";
    }

    [HttpPost("parse-search")]
    public async Task<ActionResult<NaturalLanguageSearchFilterDto>> ParseSearch([FromBody] ParseSearchInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Query))
        {
            return BadRequest(new { message = "Query cannot be empty." });
        }

        var sw = Stopwatch.StartNew();
        var result = await _aiClient.ParseSearchQueryAsync(input.Query, input.PreferredCity);
        sw.Stop();

        if (!string.IsNullOrWhiteSpace(result.ParserSource))
            Response.Headers["X-PropertyIQ-Parser"] = result.ParserSource;

        _logger.LogInformation(
            "POST /api/ai/parse-search in {Ms}ms source={Source} city={City} purpose={Purpose}",
            sw.ElapsedMilliseconds,
            result.ParserSource,
            result.City,
            result.Purpose);

        return Ok(result);
    }

    [HttpPost("property-scenario")]
    public async Task<ActionResult<PropertyScenarioResultDto>> CalculateScenario([FromBody] PropertyScenarioRequestDto request)
    {
        if (request.AskingPrice <= 0)
        {
            return BadRequest(new { message = "Asking price must be greater than zero." });
        }

        try
        {
            var (saleComps, rentComps) = await _compsService.GetCompsAsync(request);
            request.SaleComps = saleComps;
            request.RentComps = rentComps;

            var sw = Stopwatch.StartNew();
            var result = await _aiClient.CalculateScenarioAsync(request);
            sw.Stop();

            if (!string.IsNullOrWhiteSpace(result.ValuationSource))
                Response.Headers["X-PropertyIQ-Valuation"] = result.ValuationSource;
            if (!string.IsNullOrWhiteSpace(result.ExplainSource))
                Response.Headers["X-PropertyIQ-Scenario-Explain"] = result.ExplainSource;

            _logger.LogInformation(
                "POST /api/ai/property-scenario in {Ms}ms source={Source} explain={Explain} saleComps={Sale} rentComps={Rent} city={City}",
                sw.ElapsedMilliseconds,
                result.ValuationSource,
                result.ExplainSource,
                result.SaleCompCount,
                result.RentCompCount,
                request.City);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "property-scenario failed");
            return StatusCode(500, new { message = "Property scenario failed. Check API / AI service logs." });
        }
    }

    public class ClassifyImageInput
    {
        public string? ImageUrl { get; set; }
        public string? ImageBase64 { get; set; }
        public string? Filename { get; set; }
        public string? PropertyType { get; set; } = "House";
    }

    [HttpPost("classify-image")]
    public async Task<ActionResult<ImageClassificationResultDto>> ClassifyImage([FromBody] ClassifyImageInput input)
    {
        if (string.IsNullOrWhiteSpace(input.ImageUrl) && string.IsNullOrWhiteSpace(input.ImageBase64))
        {
            return BadRequest(new { message = "ImageUrl or ImageBase64 is required." });
        }

        try
        {
            var result = await _aiClient.ClassifyImageAsync(new ImageClassificationRequestDto
            {
                ImageUrl = input.ImageUrl,
                ImageBase64 = input.ImageBase64,
                Filename = input.Filename,
                PropertyType = input.PropertyType
            });
            if (!string.IsNullOrWhiteSpace(result.Source))
                Response.Headers["X-PropertyIQ-Image-Source"] = result.Source;
            _logger.LogInformation(
                "POST /api/ai/classify-image source={Source} room={Room}",
                result.Source,
                result.ClassifiedRoom);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "classify-image failed");
            return StatusCode(500, new { message = "Image classification failed." });
        }
    }

    [HttpPost("generate-listing-draft")]
    public async Task<ActionResult<AiListingDraftResultDto>> GenerateListingDraft([FromBody] AiListingDraftRequestDto request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.City))
                return BadRequest(new { message = "City is required." });
            if (string.IsNullOrWhiteSpace(request.Area))
                return BadRequest(new { message = "Area is required." });
            if (request.Price <= 0)
                return BadRequest(new { message = "Price must be greater than zero." });

            var result = await _aiClient.GenerateListingDraftAsync(request);
            if (!string.IsNullOrWhiteSpace(result.DraftSource))
                Response.Headers["X-PropertyIQ-Listing-Draft"] = result.DraftSource;
            _logger.LogInformation(
                "POST /api/ai/generate-listing-draft source={Source} city={City} area={Area}",
                result.DraftSource,
                request.City,
                request.Area);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "generate-listing-draft failed");
            return StatusCode(500, new { message = "Listing draft failed on the server. Check AI service / Ollama, then retry." });
        }
    }
}
