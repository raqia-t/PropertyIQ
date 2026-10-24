using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Intelligence;

namespace PropertyIQ.Infrastructure.Services;

/// <summary>
/// Resolves catchment coordinates (project pin → Google Geocode → Nominatim),
/// then nearby amenities via Google Places (when keyed) or OSM Overpass.
/// </summary>
public class NeighborhoodPoiProvider : INeighborhoodPoiProvider
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NeighborhoodPoiProvider> _logger;

    private static readonly Dictionary<string, (double Lat, double Lng)> CityCenters = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Lahore"] = (31.5204, 74.3587),
        ["Islamabad"] = (33.6844, 73.0479),
        ["Rawalpindi"] = (33.5651, 73.0169),
        ["Karachi"] = (24.8607, 67.0011),
        ["Multan"] = (30.1575, 71.5249),
        ["Faisalabad"] = (31.4504, 73.1350)
    };

    public NeighborhoodPoiProvider(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<NeighborhoodPoiProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<NeighborhoodPoiLookupResult?> LookupAsync(
        string city,
        string area,
        double? latitude = null,
        double? longitude = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var coords = await ResolveCoordinatesAsync(city, area, latitude, longitude, cancellationToken);
            if (coords == null) return null;

            var (lat, lng) = coords.Value;

            // 1) Overpass (best distances) → 2) Nominatim category search → 3) Google Places (needs billing key)
            var osm = await TryOverpassAsync(lat, lng, cancellationToken);
            if (osm is { Count: > 0 })
            {
                return new NeighborhoodPoiLookupResult
                {
                    Latitude = lat,
                    Longitude = lng,
                    PointsOfInterest = osm,
                    Source = "osm_overpass"
                };
            }

            var nomi = await TryNominatimNearbyAsync(city, area, lat, lng, cancellationToken);
            if (nomi is { Count: > 0 })
            {
                return new NeighborhoodPoiLookupResult
                {
                    Latitude = lat,
                    Longitude = lng,
                    PointsOfInterest = nomi,
                    Source = "osm_nominatim"
                };
            }

            var apiKey = ResolveGoogleMapsApiKey();
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                var places = await TryGooglePlacesAsync(lat, lng, apiKey, cancellationToken);
                if (places is { Count: > 0 })
                {
                    return new NeighborhoodPoiLookupResult
                    {
                        Latitude = lat,
                        Longitude = lng,
                        PointsOfInterest = places,
                        Source = "google_places"
                    };
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Neighborhood POI lookup failed for {City}/{Area}", city, area);
        }

        return null;
    }

    private string? ResolveGoogleMapsApiKey()
    {
        return _configuration["GoogleMaps:ApiKey"]
               ?? _configuration["GOOGLE_MAPS_API_KEY"]
               ?? Environment.GetEnvironmentVariable("GOOGLE_MAPS_API_KEY")
               ?? Environment.GetEnvironmentVariable("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
    }

    private async Task<(double Lat, double Lng)?> ResolveCoordinatesAsync(
        string city,
        string area,
        double? latitude,
        double? longitude,
        CancellationToken ct)
    {
        if (latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180)
            return (latitude.Value, longitude.Value);

        var apiKey = ResolveGoogleMapsApiKey();
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            var g = await TryGoogleGeocodeAsync(city, area, apiKey, ct);
            if (g != null) return g;
        }

        var n = await TryNominatimAsync(city, area, ct);
        if (n != null) return n;

        if (CityCenters.TryGetValue(city?.Trim() ?? "", out var center))
            return center;

        return null;
    }

    private async Task<(double Lat, double Lng)?> TryGoogleGeocodeAsync(
        string city, string area, string apiKey, CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("neighborhood-poi");
            var q = Uri.EscapeDataString($"{area}, {city}, Pakistan".Trim(',', ' '));
            var url =
                $"https://maps.googleapis.com/maps/api/geocode/json?address={q}&key={Uri.EscapeDataString(apiKey)}";
            using var res = await client.GetAsync(url, ct);
            if (!res.IsSuccessStatusCode) return null;
            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;
            if (root.TryGetProperty("status", out var status) &&
                !string.Equals(status.GetString(), "OK", StringComparison.OrdinalIgnoreCase))
                return null;
            if (!root.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
                return null;
            var loc = results[0].GetProperty("geometry").GetProperty("location");
            return (loc.GetProperty("lat").GetDouble(), loc.GetProperty("lng").GetDouble());
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Google geocode failed");
            return null;
        }
    }

    private async Task<(double Lat, double Lng)?> TryNominatimAsync(
        string city, string area, CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("neighborhood-poi");
            var q = Uri.EscapeDataString($"{area}, {city}, Pakistan".Trim(',', ' '));
            var url = $"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={q}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.TryAddWithoutValidation("User-Agent", "PropertyIQ/1.0 (neighborhood-intel)");
            using var res = await client.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) return null;
            var hits = await res.Content.ReadFromJsonAsync<List<NominatimHit>>(cancellationToken: ct);
            var hit = hits?.FirstOrDefault();
            if (hit == null) return null;
            if (!double.TryParse(hit.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat))
                return null;
            if (!double.TryParse(hit.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lng))
                return null;
            return (lat, lng);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Nominatim geocode failed");
            return null;
        }
    }

    private async Task<List<NeighborhoodPoiDto>?> TryNominatimNearbyAsync(
        string city, string area, double lat, double lng, CancellationToken ct)
    {
        // Daily-needs bias: schools, clinics, markets, mosque, pharmacy, park, transit
        var queries = new[]
        {
            ("school", "School"),
            ("hospital", "Hospital"),
            ("supermarket", "Market"),
            ("pharmacy", "Market"),
            ("mosque", "Mosque"),
            ("park", "Park"),
            ("bus station", "Transport")
        };

        var bag = new List<NeighborhoodPoiDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var client = _httpClientFactory.CreateClient("neighborhood-poi");
        var place = string.IsNullOrWhiteSpace(area) ? city : $"{area}, {city}";

        foreach (var (keyword, category) in queries)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var q = Uri.EscapeDataString($"{keyword} near {place}, Pakistan");
                var url = $"https://nominatim.openstreetmap.org/search?format=json&limit=2&q={q}";
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.TryAddWithoutValidation("User-Agent", "PropertyIQ/1.0 (neighborhood-intel)");
                using var res = await client.SendAsync(req, ct);
                if (!res.IsSuccessStatusCode)
                {
                    await Task.Delay(1100, ct);
                    continue;
                }

                var hits = await res.Content.ReadFromJsonAsync<List<NominatimHit>>(cancellationToken: ct);
                foreach (var hit in hits ?? new List<NominatimHit>())
                {
                    if (!double.TryParse(hit.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var plat))
                        continue;
                    if (!double.TryParse(hit.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var plng))
                        continue;
                    var name = ExtractShortName(hit.DisplayName);
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    if (!seen.Add($"{category}|{name}")) continue;
                    var dist = HaversineKm(lat, lng, plat, plng);
                    // Daily-needs radius — reject far/wrong geocodes (common with Nominatim "near").
                    if (dist > 12) continue;
                    bag.Add(new NeighborhoodPoiDto
                    {
                        Name = name,
                        Category = category,
                        DistanceKm = Math.Round(dist, 1),
                        TravelTimeMinutes = EstimateTravelMinutes(dist),
                        Rating = 4.5
                    });
                }
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Nominatim nearby {Keyword} failed", keyword);
            }

            // Nominatim usage policy: ~1 req/sec
            await Task.Delay(1100, ct);
        }

        return bag.Count == 0
            ? null
            : bag.OrderBy(p => p.DistanceKm).Take(10).ToList();
    }

    private static string ExtractShortName(string? displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName)) return string.Empty;
        var first = displayName.Split(',')[0].Trim();
        return string.IsNullOrWhiteSpace(first) ? displayName.Trim() : first;
    }

    private async Task<List<NeighborhoodPoiDto>?> TryGooglePlacesAsync(
        double lat, double lng, string apiKey, CancellationToken ct)
    {
        var types = new[]
        {
            ("school", "School"),
            ("hospital", "Hospital"),
            ("supermarket", "Market"),
            ("mosque", "Mosque"),
            ("park", "Park"),
            ("airport", "Transport")
        };

        var bag = new List<NeighborhoodPoiDto>();
        var client = _httpClientFactory.CreateClient("neighborhood-poi");

        foreach (var (type, category) in types)
        {
            try
            {
                var radius = type == "airport" ? 20000 : 3000;
                var url =
                    $"https://maps.googleapis.com/maps/api/place/nearbysearch/json" +
                    $"?location={lat.ToString(CultureInfo.InvariantCulture)},{lng.ToString(CultureInfo.InvariantCulture)}" +
                    $"&radius={radius}&type={type}&key={Uri.EscapeDataString(apiKey)}";
                using var res = await client.GetAsync(url, ct);
                if (!res.IsSuccessStatusCode) continue;
                await using var stream = await res.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                var root = doc.RootElement;
                var status = root.TryGetProperty("status", out var st) ? st.GetString() : null;
                if (string.Equals(status, "REQUEST_DENIED", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(status, "INVALID_REQUEST", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug("Google Places denied ({Status}); skipping remaining types", status);
                    break;
                }
                if (!string.Equals(status, "OK", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(status, "ZERO_RESULTS", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug("Google Places status {Status} for type {Type}", status, type);
                    continue;
                }

                if (!root.TryGetProperty("results", out var results)) continue;
                var take = type == "airport" ? 1 : 2;
                var added = 0;
                foreach (var place in results.EnumerateArray())
                {
                    if (added >= take) break;
                    var name = place.TryGetProperty("name", out var n) ? n.GetString() : null;
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    if (!place.TryGetProperty("geometry", out var geo) ||
                        !geo.TryGetProperty("location", out var loc))
                        continue;
                    var plat = loc.GetProperty("lat").GetDouble();
                    var plng = loc.GetProperty("lng").GetDouble();
                    var dist = HaversineKm(lat, lng, plat, plng);
                    var rating = place.TryGetProperty("rating", out var r) ? r.GetDouble() : 4.5;
                    bag.Add(new NeighborhoodPoiDto
                    {
                        Name = name!,
                        Category = category,
                        DistanceKm = Math.Round(dist, 1),
                        TravelTimeMinutes = EstimateTravelMinutes(dist),
                        Rating = Math.Round(rating, 1)
                    });
                    added++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Google Places type {Type} failed", type);
            }
        }

        return bag.Count == 0
            ? null
            : bag.OrderBy(p => p.DistanceKm).Take(10).ToList();
    }

    private async Task<List<NeighborhoodPoiDto>?> TryOverpassAsync(
        double lat, double lng, CancellationToken ct)
    {
        try
        {
            var latS = lat.ToString(CultureInfo.InvariantCulture);
            var lngS = lng.ToString(CultureInfo.InvariantCulture);
            var query = $@"
[out:json][timeout:18];
(
  node[""amenity""=""school""](around:2800,{latS},{lngS});
  way[""amenity""=""school""](around:2800,{latS},{lngS});
  node[""amenity""=""hospital""](around:3200,{latS},{lngS});
  node[""amenity""=""clinic""](around:2800,{latS},{lngS});
  node[""amenity""=""marketplace""](around:2800,{latS},{lngS});
  node[""shop""=""supermarket""](around:2800,{latS},{lngS});
  node[""amenity""=""place_of_worship""](around:2000,{latS},{lngS});
  node[""leisure""=""park""](around:2500,{latS},{lngS});
  node[""aeroway""=""aerodrome""](around:20000,{latS},{lngS});
);
out center 40;";

            var client = _httpClientFactory.CreateClient("neighborhood-poi");
            using var form = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("data", query)
            });
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://overpass-api.de/api/interpreter")
            {
                Content = form
            };
            req.Headers.TryAddWithoutValidation("User-Agent", "PropertyIQ/1.0 (neighborhood-intel)");
            using var res = await client.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogDebug("Overpass HTTP {Status}", res.StatusCode);
                return null;
            }

            await using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (!doc.RootElement.TryGetProperty("elements", out var elements))
                return null;

            var bag = new List<NeighborhoodPoiDto>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var el in elements.EnumerateArray())
            {
                if (!el.TryGetProperty("tags", out var tags)) continue;
                var name = tags.TryGetProperty("name", out var n) ? n.GetString() : null;
                if (string.IsNullOrWhiteSpace(name)) continue;

                double plat, plng;
                if (el.TryGetProperty("lat", out var latEl) && el.TryGetProperty("lon", out var lonEl))
                {
                    plat = latEl.GetDouble();
                    plng = lonEl.GetDouble();
                }
                else if (el.TryGetProperty("center", out var center))
                {
                    plat = center.GetProperty("lat").GetDouble();
                    plng = center.GetProperty("lon").GetDouble();
                }
                else continue;

                var category = CategorizeOsm(tags);
                if (category == null) continue;

                var key = $"{category}|{name}";
                if (!seen.Add(key)) continue;

                var dist = HaversineKm(lat, lng, plat, plng);
                bag.Add(new NeighborhoodPoiDto
                {
                    Name = name!,
                    Category = category,
                    DistanceKm = Math.Round(dist, 1),
                    TravelTimeMinutes = EstimateTravelMinutes(dist),
                    Rating = 4.5
                });
            }

            // Prefer diversity: top per category then fill
            var diversified = bag
                .GroupBy(p => p.Category)
                .SelectMany(g => g.OrderBy(p => p.DistanceKm).Take(2))
                .OrderBy(p => p.DistanceKm)
                .Take(10)
                .ToList();

            return diversified.Count == 0 ? null : diversified;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Overpass POI fetch failed");
            return null;
        }
    }

    private static string? CategorizeOsm(JsonElement tags)
    {
        var amenity = tags.TryGetProperty("amenity", out var a) ? a.GetString() : null;
        var shop = tags.TryGetProperty("shop", out var s) ? s.GetString() : null;
        var leisure = tags.TryGetProperty("leisure", out var l) ? l.GetString() : null;
        var aeroway = tags.TryGetProperty("aeroway", out var aw) ? aw.GetString() : null;

        if (string.Equals(amenity, "school", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(amenity, "college", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(amenity, "university", StringComparison.OrdinalIgnoreCase))
            return "School";
        if (string.Equals(amenity, "hospital", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(amenity, "clinic", StringComparison.OrdinalIgnoreCase))
            return "Hospital";
        if (string.Equals(amenity, "marketplace", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(shop, "supermarket", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(shop, "mall", StringComparison.OrdinalIgnoreCase))
            return "Market";
        if (string.Equals(amenity, "place_of_worship", StringComparison.OrdinalIgnoreCase))
            return "Mosque";
        if (string.Equals(leisure, "park", StringComparison.OrdinalIgnoreCase))
            return "Park";
        if (string.Equals(aeroway, "aerodrome", StringComparison.OrdinalIgnoreCase))
            return "Transport";
        return null;
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        static double Rad(double d) => d * Math.PI / 180.0;
        var dLat = Rad(lat2 - lat1);
        var dLon = Rad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static int EstimateTravelMinutes(double distanceKm)
    {
        // Urban ~25 km/h mixed traffic
        return Math.Max(1, (int)Math.Round(distanceKm / 25.0 * 60.0));
    }

    private sealed class NominatimHit
    {
        public string Lat { get; set; } = "";
        public string Lon { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("display_name")]
        public string? DisplayName { get; set; }
    }
}
