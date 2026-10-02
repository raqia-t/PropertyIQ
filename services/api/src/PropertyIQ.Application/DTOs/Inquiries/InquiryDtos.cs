using System;
using PropertyIQ.Domain.Entities;

namespace PropertyIQ.Application.DTOs.Inquiries;

public class CreateInquiryDto
{
    public Guid? PropertyId { get; set; }
    public Guid? ProjectId { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class UpdateInquiryStatusDto
{
    public InquiryStatus Status { get; set; }
    public string? AgentNotes { get; set; }
}

public class InquiryResponseDto
{
    public Guid Id { get; set; }
    public Guid? PropertyId { get; set; }
    public string? PropertyTitle { get; set; }
    public Guid? ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? AgentNotes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
