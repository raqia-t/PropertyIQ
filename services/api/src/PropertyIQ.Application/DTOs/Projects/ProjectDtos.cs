using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.DTOs.Projects;

public class CreateProjectDto
{
    public Guid DeveloperOrgId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ProjectType { get; set; } = "HousingScheme";
    public string Province { get; set; } = "Punjab";
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? RegulatoryAuthority { get; set; } // LDA, RDA, CDA, SBCA
    public string? ApprovalReferenceNumber { get; set; }
    public string ApprovalStatus { get; set; } = "Approved";
    public string? ApprovalDocumentUrl { get; set; }
    public DateTime? LaunchDate { get; set; }
    public DateTime? ExpectedCompletionDate { get; set; }
}

public class CreatePhaseDto
{
    public string Name { get; set; } = "Phase 1";
    public string? Description { get; set; }
}

public class CreateBlockDto
{
    public string Name { get; set; } = "Block A";
    public string? BlockType { get; set; } = "Residential";
}

public class CreateInventoryUnitDto
{
    public Guid? PhaseId { get; set; }
    public Guid? BlockId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public string UnitType { get; set; } = "Plot";
    public double Size { get; set; }
    public LandAreaUnit SizeUnit { get; set; } = LandAreaUnit.Marla;
    public int? FloorNumber { get; set; }
    public string? Facing { get; set; }
    public decimal BasePrice { get; set; }
    public string Currency { get; set; } = "PKR";
}

public class BulkCreateInventoryUnitsDto
{
    public Guid? PhaseId { get; set; }
    public Guid? BlockId { get; set; }
    public string UnitType { get; set; } = "Plot";
    public double Size { get; set; }
    public LandAreaUnit SizeUnit { get; set; } = LandAreaUnit.Marla;
    public decimal BasePrice { get; set; }
    public string Prefix { get; set; } = "Plot-";
    public int StartNumber { get; set; } = 1;
    public int Count { get; set; } = 10;
    public string? Facing { get; set; } = "Road Facing";
}

public class UpdateInventoryUnitStatusDto
{
    public InventoryStatus Status { get; set; }
    public string? Reason { get; set; }
}

public class ArchiveProjectDto
{
    public bool Archived { get; set; } = true;
}

public class ReserveUnitRequestDto
{
    public Guid UnitId { get; set; }
    public string? Notes { get; set; }
}

public class CreateBookingRequestDto
{
    public Guid UnitId { get; set; }
    public Guid? PaymentPlanId { get; set; }
    public decimal TotalAgreedPrice { get; set; }
    public int DurationMonths { get; set; } = 36;
    public PaymentFrequency Frequency { get; set; } = PaymentFrequency.Quarterly;
    public decimal BookingPercentage { get; set; } = 10m;
    public decimal DownPaymentPercentage { get; set; } = 15m;
    public decimal PossessionPercentage { get; set; } = 15m;
}

public class UpdateProjectDto
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? ProjectType { get; set; }
    public string? Province { get; set; }
    public string? City { get; set; }
    public string? Area { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? RegulatoryAuthority { get; set; }
    public string? ApprovalReferenceNumber { get; set; }
    public string? ApprovalStatus { get; set; }
    public string? ApprovalDocumentUrl { get; set; }
    public DateTime? LaunchDate { get; set; }
    public DateTime? ExpectedCompletionDate { get; set; }
}

public class UpdateBookingStatusDto
{
    public BookingStatus Status { get; set; }
    public string? Reason { get; set; }
}

public class CreatePaymentPlanDto
{
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = "Standard Payment Plan";
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "PKR";
    public int DurationMonths { get; set; } = 36;
    public PaymentFrequency Frequency { get; set; } = PaymentFrequency.Quarterly;
    public decimal BookingPercentage { get; set; } = 10m;
    public decimal DownPaymentPercentage { get; set; } = 15m;
    public decimal PossessionPercentage { get; set; } = 15m;
}

public class UpdatePaymentPlanDto
{
    public string Name { get; set; } = "Standard Payment Plan";
    public decimal TotalPrice { get; set; }
    public string Currency { get; set; } = "PKR";
    public int DurationMonths { get; set; } = 36;
    public PaymentFrequency Frequency { get; set; } = PaymentFrequency.Quarterly;
    public decimal BookingPercentage { get; set; } = 10m;
    public decimal DownPaymentPercentage { get; set; } = 15m;
    public decimal PossessionPercentage { get; set; } = 15m;
}

public class SubmitPaymentProofDto
{
    public string PaymentProofStorageKey { get; set; } = string.Empty; // URL or storage identifier
    public string? TransactionReference { get; set; }
    public string? Notes { get; set; }
    public decimal AmountPaid { get; set; }
    public DateTime PaymentDate { get; set; } = DateTime.UtcNow;
}

public class VerifyPaymentDto
{
    public bool Approve { get; set; }
    public decimal? ApprovedAmount { get; set; }
    public string? Reason { get; set; }
}
