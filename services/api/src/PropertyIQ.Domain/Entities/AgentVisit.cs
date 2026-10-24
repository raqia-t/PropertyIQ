using System;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

/// <summary>
/// Agent-scheduled property site viewing. Distinct from developer unit Booking and verification field visits.
/// </summary>
public class AgentVisit : BaseEntity, IAuditableEntity
{
    public Guid AgentUserId { get; set; }
    public User? AgentUser { get; set; }

    public Guid? OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    public Guid PropertyId { get; set; }
    public Property? Property { get; set; }

    public Guid? AgentClientId { get; set; }
    public AgentClient? AgentClient { get; set; }

    public Guid? InquiryId { get; set; }
    public Inquiry? Inquiry { get; set; }

    /// <summary>Visitor display name (copied from client/inquiry when scheduled).</summary>
    public string VisitorName { get; set; } = string.Empty;
    public string? VisitorPhone { get; set; }
    public string? VisitorEmail { get; set; }

    public DateTime ScheduledAtUtc { get; set; }
    public int DurationMinutes { get; set; } = 60;

    public AgentVisitStatus Status { get; set; } = AgentVisitStatus.Confirmed;

    /// <summary>Optional meet point / gate instructions.</summary>
    public string? MeetingPoint { get; set; }

    public string? Notes { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
