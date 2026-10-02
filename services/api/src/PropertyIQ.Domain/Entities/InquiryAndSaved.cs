using System;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

public enum InquiryStatus
{
    New = 1,
    Contacted = 2,
    Qualified = 3,
    ViewingScheduled = 4,
    Closed = 5,
    Spam = 6
}

public class Inquiry : BaseEntity, IAuditableEntity
{
    public Guid? CustomerId { get; set; }
    public User? Customer { get; set; }

    public Guid? PropertyId { get; set; }
    public Property? Property { get; set; }

    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    public Guid? TargetAgentOrDeveloperId { get; set; }
    public User? TargetAgentOrDeveloper { get; set; }

    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;

    public InquiryStatus Status { get; set; } = InquiryStatus.New;
    public string? AgentNotes { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}

public class SavedProperty : BaseEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid PropertyId { get; set; }
    public Property? Property { get; set; }
}
