using System;
using PropertyIQ.Domain.Common;

namespace PropertyIQ.Domain.Entities;

/// <summary>
/// Regulatory / NOC / approval documents attached to a developer project.
/// </summary>
public class ProjectNocDocument : BaseEntity, IAuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public string DocumentType { get; set; } = "NOC"; // NOC, ApprovalLetter, LayoutPlan, Other
    public string Title { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/pdf";
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public Guid UploadedByUserId { get; set; }
    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
