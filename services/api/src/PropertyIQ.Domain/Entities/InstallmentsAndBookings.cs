using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

public class PaymentPlan : BaseEntity, IAuditableEntity
{
    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    public string Name { get; set; } = "Standard 3-Year Plan";
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "PKR";
    public int DurationMonths { get; set; } = 36;
    public PaymentFrequency Frequency { get; set; } = PaymentFrequency.Monthly;

    public decimal BookingPercentage { get; set; } = 10m;
    public decimal DownPaymentPercentage { get; set; } = 10m;
    public decimal PossessionPercentage { get; set; } = 20m;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}

public class Booking : BaseEntity, IAuditableEntity
{
    public Guid InventoryUnitId { get; set; }
    public InventoryUnit? InventoryUnit { get; set; }

    public Guid CustomerId { get; set; }
    public User? Customer { get; set; }

    public Guid? PaymentPlanId { get; set; }
    public PaymentPlan? PaymentPlan { get; set; }

    public decimal TotalAgreedPrice { get; set; }
    public string Currency { get; set; } = "PKR";
    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    public DateTime BookedAtUtc { get; set; } = DateTime.UtcNow;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public ICollection<PaymentScheduleItem> ScheduleItems { get; set; } = new List<PaymentScheduleItem>();
}

public class PaymentScheduleItem : BaseEntity, IAuditableEntity
{
    public Guid BookingId { get; set; }
    public Booking? Booking { get; set; }

    public int SequenceNumber { get; set; }
    public string Title { get; set; } = "Monthly Installment"; // Booking, Down Payment, Installment 1, Possession, etc.
    public DateTime DueDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "PKR";

    public InstallmentStatus Status { get; set; } = InstallmentStatus.Scheduled;

    public decimal PaidAmount { get; set; } = 0m;
    public DateTime? PaidAtUtc { get; set; }
    public string? PaymentProofStorageKey { get; set; }
    public string? AdjustmentReason { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
