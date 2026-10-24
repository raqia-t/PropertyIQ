using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using PropertyIQ.Application.DTOs.Intelligence;

namespace PropertyIQ.Application.Common.Interfaces;

public class NeighborhoodPoiLookupResult
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public List<NeighborhoodPoiDto> PointsOfInterest { get; set; } = new();
    /// <summary>osm_overpass | osm_nominatim | google_places</summary>
    public string Source { get; set; } = "osm_overpass";
}

/// <summary>
/// Live nearby amenities for neighborhood intelligence (Google Places and/or OSM Overpass).
/// Returns null when enrichment is unavailable so callers can fall back to curated seeds.
/// </summary>
public interface INeighborhoodPoiProvider
{
    Task<NeighborhoodPoiLookupResult?> LookupAsync(
        string city,
        string area,
        double? latitude = null,
        double? longitude = null,
        CancellationToken cancellationToken = default);
}
