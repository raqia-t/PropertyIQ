using System;

namespace PropertyIQ.Application.DTOs.Agent;

public class AgentVisitDto
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public string PropertyTitle { get; set; } = string.Empty;
    public string? PropertyArea { get; set; }
    public string? PropertyCity { get; set; }
    public double? PropertyLatitude { get; set; }
    public double? PropertyLongitude { get; set; }
    public Guid? AgentClientId { get; set; }
    public string? AgentClientName { get; set; }
    public Guid? InquiryId { get; set; }
    public string VisitorName { get; set; } = string.Empty;
    public string? VisitorPhone { get; set; }
    public string? VisitorEmail { get; set; }
    public DateTime ScheduledAtUtc { get; set; }
    public int DurationMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? MeetingPoint { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateAgentVisitDto
{
    public Guid PropertyId { get; set; }
    public Guid? AgentClientId { get; set; }
    public Guid? InquiryId { get; set; }
    public string? VisitorName { get; set; }
    public string? VisitorPhone { get; set; }
    public string? VisitorEmail { get; set; }
    public DateTime ScheduledAtUtc { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public string Status { get; set; } = "Confirmed";
    public string? MeetingPoint { get; set; }
    public string? Notes { get; set; }
}

public class UpdateAgentVisitDto
{
    public Guid? PropertyId { get; set; }
    public Guid? AgentClientId { get; set; }
    public string? VisitorName { get; set; }
    public string? VisitorPhone { get; set; }
    public string? VisitorEmail { get; set; }
    public DateTime? ScheduledAtUtc { get; set; }
    public int? DurationMinutes { get; set; }
    public string? Status { get; set; }
    public string? MeetingPoint { get; set; }
    public string? Notes { get; set; }
}

public class ScheduleVisitFromInquiryDto
{
    public DateTime ScheduledAtUtc { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public string Status { get; set; } = "Confirmed";
    public string? MeetingPoint { get; set; }
    public string? Notes { get; set; }
    /// <summary>When true (default), sets the inquiry status to ViewingScheduled.</summary>
    public bool UpdateInquiryStatus { get; set; } = true;
}
