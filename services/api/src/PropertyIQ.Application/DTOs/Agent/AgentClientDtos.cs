using System;

namespace PropertyIQ.Application.DTOs.Agent;

public class AgentClientDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string ClientSide { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? BudgetMinPkr { get; set; }
    public decimal? BudgetMaxPkr { get; set; }
    public string? TargetAreas { get; set; }
    public string? Notes { get; set; }
    public Guid? SourceInquiryId { get; set; }
    public Guid? LinkedBookingId { get; set; }
    public Guid? LinkedPropertyId { get; set; }
    public string? LinkedPropertyTitle { get; set; }
    public string? ActiveBookingSummary { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateAgentClientDto
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string ClientSide { get; set; } = "Buyer";
    public string Status { get; set; } = "Prospect";
    public decimal? BudgetMinPkr { get; set; }
    public decimal? BudgetMaxPkr { get; set; }
    public string? TargetAreas { get; set; }
    public string? Notes { get; set; }
    public Guid? LinkedPropertyId { get; set; }
    public Guid? LinkedBookingId { get; set; }
    public Guid? SourceInquiryId { get; set; }
}

public class UpdateAgentClientDto
{
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? ClientSide { get; set; }
    public string? Status { get; set; }
    public decimal? BudgetMinPkr { get; set; }
    public decimal? BudgetMaxPkr { get; set; }
    public string? TargetAreas { get; set; }
    public string? Notes { get; set; }
    public Guid? LinkedPropertyId { get; set; }
    public Guid? LinkedBookingId { get; set; }
}
