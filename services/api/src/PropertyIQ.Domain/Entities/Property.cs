using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

public class Property : BaseEntity, IAuditableEntity
{
    public Guid OwnerOrAgentId { get; set; }
    public User? OwnerOrAgent { get; set; }
    public Guid? OrganizationId { get; set; }
    public Organization? Organization { get; set; }

    public string Title { get; set; } = string.Empty;
    public PropertyPurpose Purpose { get; set; } = PropertyPurpose.Sale;
    public PropertyType PropertyType { get; set; } = PropertyType.House;
    public ListingStatus Status { get; set; } = ListingStatus.Draft;

    // Location
    public string Province { get; set; } = "Punjab";
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string? SubArea { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public LocationPrivacyLevel PrivacyLevel { get; set; } = LocationPrivacyLevel.Exact;

    // Financial - Always decimal and explicit currency
    public decimal Price { get; set; }
    public string Currency { get; set; } = "PKR";
    public bool IsNegotiable { get; set; } = false;
    public decimal? ExpectedRentMin { get; set; }
    public decimal? ExpectedRentMax { get; set; }

    // Physical Specs
    public int? Bedrooms { get; set; }
    public int? Bathrooms { get; set; }
    public double? CoveredAreaSqFt { get; set; }
    public double LandArea { get; set; }
    public LandAreaUnit LandAreaUnit { get; set; } = LandAreaUnit.Marla;
    public int? TotalFloors { get; set; }
    public int? FloorNumber { get; set; }
    public int? ParkingSpaces { get; set; }
    public FurnishingStatus Furnishing { get; set; } = FurnishingStatus.Unfurnished;
    public int? ConstructionYear { get; set; }

    // AI & Intelligence
    public string Description { get; set; } = string.Empty;
    public string? AiDraftedDescription { get; set; }
    public int? ListingQualityScore { get; set; }
    public PropertyVerificationStatus VerificationStatus { get; set; } = PropertyVerificationStatus.Unverified;

    // Auditing
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    // Navigation
    public ICollection<PropertyMedia> Media { get; set; } = new List<PropertyMedia>();
}

public class PropertyMedia : BaseEntity
{
    public Guid PropertyId { get; set; }
    public Property? Property { get; set; }
    public string MediaType { get; set; } = "Photo"; // Photo, Video, FloorPlan
    public string Url { get; set; } = string.Empty;
    public string StorageKey { get; set; } = string.Empty;
    public string Category { get; set; } = "Exterior"; // Exterior, LivingRoom, Bedroom, Kitchen, Bathroom, etc.
    public int SortOrder { get; set; } = 0;
    public bool IsPrimary { get; set; } = false;
    public string? AiTags { get; set; }
}
