using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.DTOs.Properties;

public class CreatePropertyDto
{
    public string Title { get; set; } = string.Empty;
    public PropertyPurpose Purpose { get; set; } = PropertyPurpose.Sale;
    public PropertyType PropertyType { get; set; } = PropertyType.House;

    public string Province { get; set; } = "Punjab";
    public string City { get; set; } = "Lahore";
    public string Area { get; set; } = string.Empty;
    public string? SubArea { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public LocationPrivacyLevel PrivacyLevel { get; set; } = LocationPrivacyLevel.Exact;

    public decimal Price { get; set; }
    public string Currency { get; set; } = "PKR";
    public bool IsNegotiable { get; set; } = false;

    public int? Bedrooms { get; set; }
    public int? Bathrooms { get; set; }
    public double LandArea { get; set; }
    public LandAreaUnit LandAreaUnit { get; set; } = LandAreaUnit.Marla;
    public double? CoveredAreaSqFt { get; set; }
    public int? TotalFloors { get; set; }
    public int? ParkingSpaces { get; set; }
    public FurnishingStatus Furnishing { get; set; } = FurnishingStatus.Unfurnished;
    public int? ConstructionYear { get; set; }

    public string Description { get; set; } = string.Empty;
    public decimal? ExpectedRentMin { get; set; }
    public decimal? ExpectedRentMax { get; set; }
    public List<AddPropertyMediaDto>? Media { get; set; } = new();
}

public class UpdatePropertyDto
{
    public string? Title { get; set; }
    public PropertyPurpose? Purpose { get; set; }
    public PropertyType? PropertyType { get; set; }
    public ListingStatus? Status { get; set; }
    public string? Province { get; set; }
    public string? City { get; set; }
    public string? Area { get; set; }
    public string? SubArea { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public LocationPrivacyLevel? PrivacyLevel { get; set; }
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
    public bool? IsNegotiable { get; set; }
    public int? Bedrooms { get; set; }
    public int? Bathrooms { get; set; }
    public double? LandArea { get; set; }
    public LandAreaUnit? LandAreaUnit { get; set; }
    public double? CoveredAreaSqFt { get; set; }
    public int? TotalFloors { get; set; }
    public int? ParkingSpaces { get; set; }
    public FurnishingStatus? Furnishing { get; set; }
    public int? ConstructionYear { get; set; }
    public string? Description { get; set; }
    public decimal? ExpectedRentMin { get; set; }
    public decimal? ExpectedRentMax { get; set; }
}

public class AddPropertyMediaDto
{
    public string Url { get; set; } = string.Empty;
    public string MediaType { get; set; } = "Photo";
    public string Category { get; set; } = "Exterior";
    public int SortOrder { get; set; } = 0;
    public bool IsPrimary { get; set; } = false;
    public string? AiTags { get; set; }
}

public class RecordPropertyViewDto
{
    public string? SessionKey { get; set; }
}
