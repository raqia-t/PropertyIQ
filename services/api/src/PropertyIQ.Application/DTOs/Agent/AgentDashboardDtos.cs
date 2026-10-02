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
    public List<AgentWeakListingAlertDto> WeakListings { get; set; } = new();
}

public class AgentWeakListingAlertDto
{
    public Guid PropertyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Issue { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;
}
