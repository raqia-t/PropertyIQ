using System;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

/// <summary>
/// Private title / due-diligence documents for a listing. Not visible to buyers or the public.
/// Uploading evidence does not auto-verify the property.
/// </summary>
public class PropertyEvidenceDocument : BaseEntity, IAuditableEntity
{
    public Guid PropertyId { get; set; }
    public Property? Property { get; set; }

    public PropertyEvidenceDocumentType DocumentType { get; set; } = PropertyEvidenceDocumentType.Other;

    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }

    /// <summary>Private storage key (e.g. private/{guid}_file.pdf).</summary>
    public string StorageKey { get; set; } = string.Empty;

    public Guid UploadedByUserId { get; set; }
    public User? UploadedByUser { get; set; }

    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;

    public PropertyEvidenceDocumentStatus Status { get; set; } = PropertyEvidenceDocumentStatus.Submitted;

    public string? ReviewerNotes { get; set; }

    public Guid? LinkedCaseId { get; set; }
    public VerificationCase? LinkedCase { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
