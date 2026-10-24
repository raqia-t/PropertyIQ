using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

public class VerificationCase : BaseEntity, IAuditableEntity
{
    public Guid CustomerId { get; set; }
    public User? Customer { get; set; }

    public Guid? PropertyId { get; set; }
    public Property? Property { get; set; }

    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    public VerificationLevel ServiceLevel { get; set; } = VerificationLevel.BasicDocumentReview;
    public decimal Fee { get; set; }
    public string Currency { get; set; } = "PKR";
    public VerificationCaseStatus Status { get; set; } = VerificationCaseStatus.Requested;

    public Guid? AssignedSpecialistId { get; set; }
    public User? AssignedSpecialist { get; set; }

    public DateTime? AssignedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int SLAHours { get; set; } = 48;

    /// <summary>Demo fee acknowledgment — real PSP can replace this later.</summary>
    public bool IsPaid { get; set; }
    public DateTime? PaidAtUtc { get; set; }

    public DateTime? ScheduledVisitAtUtc { get; set; }
    public string? VisitNotes { get; set; }
    public string? CancelReason { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public ICollection<VerificationChecklistItem> ChecklistItems { get; set; } = new List<VerificationChecklistItem>();
    public ICollection<VerificationEvidence> Evidences { get; set; } = new List<VerificationEvidence>();
    public ICollection<VerificationReport> Reports { get; set; } = new List<VerificationReport>();
}

public class VerificationChecklistItem : BaseEntity
{
    public Guid CaseId { get; set; }
    public VerificationCase? Case { get; set; }

    public string Category { get; set; } = "Identity"; // Identity, OwnershipEvidence, MutationTransfer, PropertyDetails, Possession, SocietyApproval, MortgageCharge, CourtDispute, TaxesDues, SiteVisit
    public string CheckCode { get; set; } = string.Empty;
    public string CheckTitle { get; set; } = string.Empty;
    public ChecklistResult Result { get; set; } = ChecklistResult.NotChecked;
    public string? Notes { get; set; }
    public Guid? ReviewerId { get; set; }
}

public class VerificationEvidence : BaseEntity
{
    public Guid CaseId { get; set; }
    public VerificationCase? Case { get; set; }

    public string EvidenceType { get; set; } = "SitePhoto"; // SitePhoto, OfficialRecordDoc, SellerDoc, GPSObservation
    public string FileUrl { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string? FileChecksum { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime CapturedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid CapturedByUserId { get; set; }
}

public class VerificationReport : BaseEntity
{
    public Guid CaseId { get; set; }
    public VerificationCase? Case { get; set; }

    public int Version { get; set; } = 1;
    public string Summary { get; set; } = string.Empty;
    public string Limitations { get; set; } = "This report is an evidence-based verification summary and does not constitute a government title certificate or formal legal advice.";
    public string? SpecialistNotes { get; set; }
    public string? CustomerRecommendations { get; set; }

    public Guid ReviewerId { get; set; }
    public DateTime PublishedAtUtc { get; set; } = DateTime.UtcNow;
    public bool IsImmutable { get; set; } = true;
}

public class AuditLog : BaseEntity
{
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = "Update"; // Insert, Update, Delete, StatusChange
    public Guid? ActorUserId { get; set; }
    public string? ActorRole { get; set; }
    public string? OldValuesJson { get; set; }
    public string? NewValuesJson { get; set; }
    public string? Reason { get; set; }
}
