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

    [HttpGet("neighborhood/{city}/{area}")]
    public async Task<ActionResult<NeighborhoodIntelligenceDto>> GetNeighborhoodIntelligence(string city, string area)
    {
        var intelligence = await _intelligenceService.GetNeighborhoodIntelligenceAsync(city, area);
        return Ok(intelligence);
    }

    [HttpGet("developer-demand")]
    public async Task<ActionResult<DeveloperDemandRadarDto>> GetDeveloperDemandRadar([FromQuery] string? city)
    {
        var radar = await _intelligenceService.GetDeveloperDemandRadarAsync(city);
        return Ok(radar);
    }

    [HttpPost("investment-analysis")]
    public ActionResult<AdvancedInvestmentAnalysisResponse> CalculateInvestmentAnalysis([FromBody] AdvancedInvestmentAnalysisRequest request)
    {
        var analysis = _intelligenceService.CalculateAdvancedInvestment(request);
        return Ok(analysis);
    }
}
