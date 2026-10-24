using System;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

/// <summary>
/// Agent-owned CRM contact (buyer / seller / investor). Distinct from transactional Inquiry leads.
/// </summary>
public class AgentClient : BaseEntity, IAuditableEntity
{
    public Guid AgentUserId { get; set; }
    public User? AgentUser { get; set; }

    public Guid? OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    /// <summary>Optional link to a registered platform user.</summary>
    public Guid? LinkedUserId { get; set; }
    public User? LinkedUser { get; set; }

    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }

    public AgentClientSide ClientSide { get; set; } = AgentClientSide.Buyer;
    public AgentClientStatus Status { get; set; } = AgentClientStatus.Prospect;

    public decimal? BudgetMinPkr { get; set; }
    public decimal? BudgetMaxPkr { get; set; }

    /// <summary>Comma-separated or free-text target localities.</summary>
    public string? TargetAreas { get; set; }

    public string? Notes { get; set; }

    public Guid? SourceInquiryId { get; set; }
    public Inquiry? SourceInquiry { get; set; }

    public Guid? LinkedBookingId { get; set; }
    public Booking? LinkedBooking { get; set; }

    /// <summary>Seller mandate / listing property when applicable.</summary>
    public Guid? LinkedPropertyId { get; set; }
    public Property? LinkedProperty { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
