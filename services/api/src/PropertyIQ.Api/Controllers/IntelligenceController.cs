using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PropertyIQ.Application.DTOs.Intelligence;
using PropertyIQ.Application.Services;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IntelligenceController : ControllerBase
{
    private readonly IIntelligenceService _intelligenceService;

    public IntelligenceController(IIntelligenceService intelligenceService)
    {
        _intelligenceService = intelligenceService;
    }

    [HttpGet("demand-gaps")]
    public async Task<ActionResult<List<DemandGapDto>>> GetDemandGaps([FromQuery] string? city)
    {
        var gaps = await _intelligenceService.GetDemandGapsAsync(city);
        return Ok(gaps);
    }

    /// <summary>Preferred: query-string city/area (+ optional pin for tighter POIs).</summary>
    [HttpGet("neighborhood")]
    public async Task<ActionResult<NeighborhoodIntelligenceDto>> GetNeighborhoodIntelligence(
        [FromQuery] string city,
        [FromQuery] string area,
        [FromQuery] double? lat = null,
        [FromQuery] double? lng = null)
    {
        if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(area))
            return BadRequest(new { message = "city and area are required." });

        var intelligence = await _intelligenceService.GetNeighborhoodIntelligenceAsync(
            city, area, lat, lng);
        return Ok(intelligence);
    }

    [HttpGet("neighborhood/{city}/{area}")]
    public async Task<ActionResult<NeighborhoodIntelligenceDto>> GetNeighborhoodIntelligenceByPath(
        string city,
        string area,
        [FromQuery] double? lat = null,
        [FromQuery] double? lng = null)
    {
        var intelligence = await _intelligenceService.GetNeighborhoodIntelligenceAsync(
            city, area, lat, lng);
        return Ok(intelligence);
    }

    [HttpGet("developer-demand")]
    public async Task<ActionResult<DeveloperDemandRadarDto>> GetDeveloperDemandRadar(
        [FromQuery] string? city,
        [FromQuery] Guid? developerOrgId = null)
    {
        var radar = await _intelligenceService.GetDeveloperDemandRadarAsync(city, developerOrgId);
        return Ok(radar);
    }

    [HttpPost("investment-analysis")]
    public ActionResult<AdvancedInvestmentAnalysisResponse> CalculateInvestmentAnalysis([FromBody] AdvancedInvestmentAnalysisRequest request)
    {
        var analysis = _intelligenceService.CalculateAdvancedInvestment(request);
        return Ok(analysis);
    }
}
