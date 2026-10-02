using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

public class Project : BaseEntity, IAuditableEntity
{
    public Guid DeveloperOrgId { get; set; }
    public Organization? DeveloperOrg { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ProjectType { get; set; } = "HousingScheme"; // HousingScheme, ApartmentComplex, CommercialMall

    public string Province { get; set; } = "Punjab";
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    // Regulatory / NOC
    public string? RegulatoryAuthority { get; set; } // LDA, RDA, CDA, SBCA
    public string? ApprovalReferenceNumber { get; set; }
    public string ApprovalStatus { get; set; } = "Approved"; // Approved, UnderProcess, Unapproved
    public string? ApprovalDocumentUrl { get; set; }

    public DateTime? LaunchDate { get; set; }
    public DateTime? ExpectedCompletionDate { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public ICollection<ProjectPhase> Phases { get; set; } = new List<ProjectPhase>();
    public ICollection<InventoryUnit> InventoryUnits { get; set; } = new List<InventoryUnit>();
}

public class ProjectPhase : BaseEntity
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }
    public string Name { get; set; } = "Phase 1";
    public string? Description { get; set; }
    public ICollection<ProjectBlock> Blocks { get; set; } = new List<ProjectBlock>();
}

public class ProjectBlock : BaseEntity
{
    public Guid PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }
    public string Name { get; set; } = "Block A";
    public string? BlockType { get; set; } // Residential, Commercial
}

public class InventoryUnit : BaseEntity, IAuditableEntity
{
    public Guid ProjectId { get; set; }
    public Project? Project { get; set; }

    public Guid? PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }

    public Guid? BlockId { get; set; }
    public ProjectBlock? Block { get; set; }

    public string UnitNumber { get; set; } = string.Empty;
    public string UnitType { get; set; } = "Plot"; // Plot, Apartment, CommercialShop, Penthouse
    public double Size { get; set; }
    public LandAreaUnit SizeUnit { get; set; } = LandAreaUnit.Marla;

    public int? FloorNumber { get; set; }
    public string? Facing { get; set; } // Corner, Park Facing, Road Facing, Normal
    public decimal BasePrice { get; set; }
    public string Currency { get; set; } = "PKR";

    public InventoryStatus Status { get; set; } = InventoryStatus.Available;

    // Concurrency tracking token to prevent double-booking
    public byte[]? RowVersion { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
