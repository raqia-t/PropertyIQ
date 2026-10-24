using System;
using System.Collections.Generic;

namespace PropertyIQ.Application.DTOs.Agent;

public class AgentVerificationListingDto
{
    public Guid PropertyId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Area { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string PrivacyLevel { get; set; } = "Exact";
    public string ListingStatus { get; set; } = string.Empty;
    public string VerificationStatus { get; set; } = string.Empty;
    public Guid? ActiveCaseId { get; set; }
    public string? CaseStatus { get; set; }
    public string? ServiceLevel { get; set; }
    public string? SpecialistName { get; set; }
    public int? TotalChecks { get; set; }
    public int? PassedChecks { get; set; }
    public int? ConcernChecks { get; set; }
    public bool HasReport { get; set; }
    public DateTime? CaseCreatedAtUtc { get; set; }
    public DateTime? CaseCompletedAtUtc { get; set; }
    public int? SlaHours { get; set; }
    public decimal? FeePkr { get; set; }
    public int EvidenceCount { get; set; }
    public List<string> EvidenceDocumentTypes { get; set; } = new();
    public List<AgentEvidenceDocDto> EvidenceDocuments { get; set; } = new();
}

public class AgentEvidenceDocDto
{
    public Guid Id { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime UploadedAtUtc { get; set; }
}

public class RequestAgentVerificationDto
{
    public Guid PropertyId { get; set; }
    public string ServiceLevel { get; set; } = "PropertySiteVisit";
    public string? Notes { get; set; }
}
