using System;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

/// <summary>
/// Brokerage marketing mandate: links an Agency org to a Developer-owned Project
/// (exclusive or non-exclusive sales rights). Does not change Project.DeveloperOrgId.
/// </summary>
public class AgencyProjectMandate : BaseEntity, IAuditableEntity
{
    public Guid AgencyOrgId { get; set; }
    public Organization? AgencyOrg { get; set; }

    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public bool IsExclusive { get; set; } = true;
    public AgencyMandateStatus Status { get; set; } = AgencyMandateStatus.Active;

    /// <summary>Optional agency commission share percentage (e.g. 2.0 = 2%).</summary>
    public decimal? CommissionPercent { get; set; }

    public DateTime? StartDateUtc { get; set; }
    public DateTime? EndDateUtc { get; set; }

    public string? Notes { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
