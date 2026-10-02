using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PropertyIQ.Application.Common.Interfaces;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly IAiServiceClient _aiClient;

    public AiController(IAiServiceClient aiClient)
    {
        _aiClient = aiClient;
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

        var result = await _aiClient.ParseSearchQueryAsync(input.Query, input.PreferredCity);
        return Ok(result);
    }

    [HttpPost("property-scenario")]
    public async Task<ActionResult<PropertyScenarioResultDto>> CalculateScenario([FromBody] PropertyScenarioRequestDto request)
    {
        if (request.AskingPrice <= 0)
        {
            return BadRequest(new { message = "Asking price must be greater than zero." });
        }

        var result = await _aiClient.CalculateScenarioAsync(request);
        return Ok(result);
    }

    public class ClassifyImageInput
    {
        public string ImageUrl { get; set; } = string.Empty;
        public string? PropertyType { get; set; } = "House";
    }

    [HttpPost("classify-image")]
    public async Task<ActionResult<ImageClassificationResultDto>> ClassifyImage([FromBody] ClassifyImageInput input)
    {
        if (string.IsNullOrWhiteSpace(input.ImageUrl))
        {
            return BadRequest(new { message = "ImageUrl cannot be empty." });
        }

        var result = await _aiClient.ClassifyImageAsync(input.ImageUrl, input.PropertyType);
        return Ok(result);
    }

    [HttpPost("generate-listing-draft")]
    public async Task<ActionResult<AiListingDraftResultDto>> GenerateListingDraft([FromBody] AiListingDraftRequestDto request)
    {
        var result = await _aiClient.GenerateListingDraftAsync(request);
        return Ok(result);
    }
}
