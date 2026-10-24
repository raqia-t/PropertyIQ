using System;
using System.Collections.Generic;

namespace PropertyIQ.Application.DTOs.Agent;

public class AgentDashboardDto
{
    public int ActiveListingsCount { get; set; }
    public int TotalViews { get; set; }
    public int TotalSaves { get; set; }
    public int TotalLeads { get; set; }
    public int PendingLeadsCount { get; set; }

    public string DailyAiBriefing { get; set; } = string.Empty;
    /// <summary>ollama | rules</summary>
    public string BriefingSource { get; set; } = "rules";
    public List<AgentWeakListingAlertDto> WeakListings { get; set; } = new();
}

public class AgentWeakListingAlertDto
{
    public Guid PropertyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Issue { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;
    public string AlertType { get; set; } = "Photos"; // Photos | RentScenario | MediaMix
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string PropertyType { get; set; } = "House";
    public double LandArea { get; set; }
    public string LandAreaUnit { get; set; } = "Marla";
    public decimal AskingPrice { get; set; }
    public int? Bedrooms { get; set; }
    /// <summary>ollama | rules</summary>
    public string RecommendationSource { get; set; } = "rules";
    public int Priority { get; set; }
}
