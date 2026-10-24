using System;
using System.Collections.Generic;

namespace PropertyIQ.Application.DTOs.Agent;

public class AgentAnalyticsDto
{
    public int ActiveListingsCount { get; set; }
    public int TotalViews { get; set; }
    public int TotalSaves { get; set; }
    public int TotalInquiries { get; set; }
    public int PendingInquiries { get; set; }
    public int VisitsScheduled { get; set; }
    public int VisitsCompleted { get; set; }
    public int ClientsClosed { get; set; }
    public double AvgListingQualityScore { get; set; }

    /// <summary>views → inquiries (percent, 0–100).</summary>
    public double ViewToInquiryRate { get; set; }
    /// <summary>inquiries → visits (percent).</summary>
    public double InquiryToVisitRate { get; set; }
    /// <summary>visits completed → closed clients (percent).</summary>
    public double VisitToCloseRate { get; set; }

    public Dictionary<string, int> InquiryStatusBreakdown { get; set; } = new();
    public List<AgentListingAnalyticsDto> Listings { get; set; } = new();
}

public class AgentListingAnalyticsDto
{
    public Guid PropertyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public int ListingQualityScore { get; set; }
    public int Views { get; set; }
    public int Saves { get; set; }
    public int Inquiries { get; set; }
    public int Visits { get; set; }
    public double ViewToInquiryRate { get; set; }
}
