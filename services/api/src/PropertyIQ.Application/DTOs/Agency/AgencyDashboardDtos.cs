using System;
using System.Collections.Generic;

namespace PropertyIQ.Application.DTOs.Agency;

public class AgencyDashboardDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public int ActiveListingsCount { get; set; }
    public int TotalListingsCount { get; set; }
    public int ActiveBrokersCount { get; set; }
    public int MonthlyLeadsCount { get; set; }
    public int TotalLeadsCount { get; set; }
    public int PendingLeadsCount { get; set; }
    /// <summary>Closed deal volume is not tracked yet — UI should show "—" when false.</summary>
    public bool ClosedVolumeTracked { get; set; }
    /// <summary>Firm daily brief over locked org stats (rules or Ollama polish).</summary>
    public string DailyAiBriefing { get; set; } = string.Empty;
    /// <summary>ollama | rules</summary>
    public string BriefingSource { get; set; } = "rules";
    /// <summary>Firm-wide weak listings needing optimization (Photos / MediaMix / RentScenario).</summary>
    public List<AgencyWeakListingAlertDto> WeakListings { get; set; } = new();
    public List<AgencyBrokerRowDto> Brokers { get; set; } = new();
    public List<AgencyListingRowDto> Listings { get; set; } = new();
}

public class AgencyWeakListingAlertDto
{
    public Guid PropertyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Issue { get; set; } = string.Empty;
    public string Recommendation { get; set; } = string.Empty;
    /// <summary>Photos | MediaMix | RentScenario | Completeness</summary>
    public string AlertType { get; set; } = "Photos";
    public Guid AssignedBrokerId { get; set; }
    public string AssignedBrokerName { get; set; } = "Unassigned";
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string PropertyType { get; set; } = "House";
    public double LandArea { get; set; }
    public string LandAreaUnit { get; set; } = "Marla";
    public decimal AskingPrice { get; set; }
    public int? Bedrooms { get; set; }
    public int ListingQualityScore { get; set; }
    /// <summary>ollama | rules</summary>
    public string RecommendationSource { get; set; } = "rules";
    public int Priority { get; set; }
}

public class AgencyOrgSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
    public bool IsVerified { get; set; }
}

public class AgencyBrokerRowDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public int ActiveListingsCount { get; set; }
    public int TotalListingsCount { get; set; }
    public int AssignedLeadsCount { get; set; }
    public int PendingLeadsCount { get; set; }
}

public class AgencyListingRowDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid AssignedBrokerId { get; set; }
    public string AssignedBrokerName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Currency { get; set; } = "PKR";
    public string Status { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public int LeadsCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class AgencyListingsResponseDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public List<AgencyBrokerOptionDto> Brokers { get; set; } = new();
    public List<AgencyListingDetailDto> Listings { get; set; } = new();
}

public class AgencyBrokerOptionDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
}

public class AgencyListingDetailDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public Guid AssignedBrokerId { get; set; }
    public string AssignedBrokerName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Currency { get; set; } = "PKR";
    public double LandArea { get; set; }
    public string LandAreaUnit { get; set; } = "Marla";
    public int? Bedrooms { get; set; }
    public string Status { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public int ListingQualityScore { get; set; }
    public int MediaCount { get; set; }
    public string PrimaryImageUrl { get; set; } = "/placeholder-property.jpg";
    public int LeadsCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class AgencyLeadsResponseDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public List<AgencyBrokerOptionDto> Brokers { get; set; } = new();
    public int NewLeadsCount { get; set; }
    public int TotalLeadsCount { get; set; }
    public List<AgencyLeadDto> Leads { get; set; } = new();
}

public class AgencyLeadDto
{
    public Guid Id { get; set; }
    public Guid? PropertyId { get; set; }
    public string? PropertyTitle { get; set; }
    public Guid? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public Guid? AssignedBrokerId { get; set; }
    public string AssignedBrokerName { get; set; } = "Unassigned";
    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? AgentNotes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class AgencyClientsResponseDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public List<AgencyBrokerOptionDto> Brokers { get; set; } = new();
    public int TotalClientsCount { get; set; }
    public int ActiveClientsCount { get; set; }
    public List<AgencyClientDto> Clients { get; set; } = new();
}

public class AgencyClientDto
{
    public Guid Id { get; set; }
    public Guid AgentUserId { get; set; }
    public string AssignedBrokerName { get; set; } = "Unassigned";
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string ClientSide { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? BudgetMinPkr { get; set; }
    public decimal? BudgetMaxPkr { get; set; }
    public string? TargetAreas { get; set; }
    public string? Notes { get; set; }
    public Guid? LinkedPropertyId { get; set; }
    public string? LinkedPropertyTitle { get; set; }
    public Guid? SourceInquiryId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class AgencyProjectsResponseDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public int ActiveMandatesCount { get; set; }
    public int TotalMandatesCount { get; set; }
    public List<AgencyProjectMandateDto> Mandates { get; set; } = new();
}

public class AgencyProjectMandateDto
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public string ProjectSlug { get; set; } = string.Empty;
    public string ProjectType { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public string DeveloperName { get; set; } = string.Empty;
    public bool DeveloperVerified { get; set; }
    public string ApprovalStatus { get; set; } = string.Empty;
    public string? RegulatoryAuthority { get; set; }
    public int TotalUnits { get; set; }
    public int AvailableUnits { get; set; }
    public decimal StartingPrice { get; set; }
    public string Currency { get; set; } = "PKR";
    public bool IsExclusive { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? CommissionPercent { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateAgencyProjectMandateDto
{
    public Guid ProjectId { get; set; }
    public bool IsExclusive { get; set; } = true;
    public decimal? CommissionPercent { get; set; }
    public DateTime? StartDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }
    public string? Notes { get; set; }
}

public class AgencyBrokersResponseDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public int ActiveBrokersCount { get; set; }
    public List<AgencyBrokerDetailDto> Brokers { get; set; } = new();
}

public class AgencyBrokerDetailDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int ActiveListingsCount { get; set; }
    public int TotalListingsCount { get; set; }
    public int AssignedLeadsCount { get; set; }
    public int PendingLeadsCount { get; set; }
    public int ClientsCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateAgencyBrokerDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AgencyAnalyticsDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public int ActiveBrokersCount { get; set; }
    public int ActiveListingsCount { get; set; }
    public int TotalViews { get; set; }
    public int TotalSaves { get; set; }
    public int TotalInquiries { get; set; }
    public int PendingInquiries { get; set; }
    public int VisitsScheduled { get; set; }
    public int VisitsCompleted { get; set; }
    public int ClientsClosed { get; set; }
    public double AvgListingQualityScore { get; set; }
    public double ViewToInquiryRate { get; set; }
    public double InquiryToVisitRate { get; set; }
    public double VisitToCloseRate { get; set; }
    public Dictionary<string, int> InquiryStatusBreakdown { get; set; } = new();
    public List<AgencyBrokerAnalyticsDto> Brokers { get; set; } = new();
    public List<AgencyListingAnalyticsDto> Listings { get; set; } = new();
}

public class AgencyBrokerAnalyticsDto
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public int ActiveListingsCount { get; set; }
    public int Inquiries { get; set; }
    public int VisitsScheduled { get; set; }
    public int ClientsClosed { get; set; }
}

public class AgencyListingAnalyticsDto
{
    public Guid PropertyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public Guid AssignedBrokerId { get; set; }
    public string AssignedBrokerName { get; set; } = "Unassigned";
    public string Status { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public int ListingQualityScore { get; set; }
    public int Views { get; set; }
    public int Saves { get; set; }
    public int Inquiries { get; set; }
    public int Visits { get; set; }
    public double ViewToInquiryRate { get; set; }
}

public class AgencyReportSummaryDto
{
    public AgencyOrgSummaryDto Organization { get; set; } = new();
    public string Period { get; set; } = "all";
    public string PeriodLabel { get; set; } = "All time";
    public DateTime? FromUtc { get; set; }
    public DateTime ToUtc { get; set; }
    public DateTime GeneratedAtUtc { get; set; }

    public int ActiveBrokersCount { get; set; }
    public int ActiveListingsCount { get; set; }
    public int TotalListingsCount { get; set; }
    public int NewListingsInPeriod { get; set; }

    public int ViewsInPeriod { get; set; }
    public int InquiriesInPeriod { get; set; }
    public int PendingInquiriesInPeriod { get; set; }
    public int VisitsScheduledInPeriod { get; set; }
    public int VisitsCompletedInPeriod { get; set; }
    public int ClientsClosedInPeriod { get; set; }
    public int TotalClientsCount { get; set; }

    public double ViewToInquiryRate { get; set; }
    public double InquiryToVisitRate { get; set; }
    public double VisitToCloseRate { get; set; }

    public bool ClosedVolumeTracked { get; set; }
    public Dictionary<string, int> InquiryStatusBreakdown { get; set; } = new();
    public List<AgencyBrokerAnalyticsDto> TopBrokers { get; set; } = new();
    public List<AgencyListingAnalyticsDto> TopListings { get; set; } = new();
}
