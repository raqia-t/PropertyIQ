using System;
using System.Collections.Generic;
using System.Linq;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.Services;

public sealed class ListingQualityResult
{
    public int Score { get; init; }
    public List<string> Gaps { get; init; } = new();
    public bool HasExterior { get; init; }
    public bool HasKitchen { get; init; }
    public bool HasBathroom { get; init; }
    public int PhotoCount { get; init; }
}

/// <summary>
/// Completeness + media-mix quality (not a raw photo-count formula).
/// Vision categories improve media-mix points when set on PropertyMedia.Category.
/// </summary>
public static class ListingQualityScorer
{
    public static ListingQualityResult Score(Property property)
    {
        var gaps = new List<string>();
        var score = 0;
        var media = (property.Media ?? Array.Empty<PropertyMedia>())
            .Where(m => !m.IsDeleted)
            .ToList();
        var photoCount = media.Count(m =>
            string.IsNullOrWhiteSpace(m.MediaType) ||
            m.MediaType.Equals("Photo", StringComparison.OrdinalIgnoreCase));

        // Title (10)
        var title = (property.Title ?? "").Trim();
        if (title.Length >= 24)
            score += 10;
        else if (title.Length >= 8)
        {
            score += 6;
            gaps.Add("Expand the title with society, size, and key feature.");
        }
        else
            gaps.Add("Add a clear listing title.");

        // Description (12)
        var desc = (property.Description ?? "").Trim();
        if (desc.Length >= 120)
            score += 12;
        else if (desc.Length >= 40)
        {
            score += 7;
            gaps.Add("Expand the description (amenities, condition, nearby context).");
        }
        else
            gaps.Add("Write a fuller property description.");

        // Location (10)
        if (!string.IsNullOrWhiteSpace(property.City) && !string.IsNullOrWhiteSpace(property.Area))
            score += 10;
        else if (!string.IsNullOrWhiteSpace(property.City))
        {
            score += 5;
            gaps.Add("Set society / area name.");
        }
        else
            gaps.Add("Set city and area.");

        // Price (8)
        if (property.Price > 0)
            score += 8;
        else
            gaps.Add("Set asking price.");

        // Land area (6)
        if (property.LandArea > 0)
            score += 6;
        else
            gaps.Add("Set land area / size.");

        // Specs (6) — houses/apartments benefit from bedrooms
        if (property.PropertyType is PropertyType.Plot or PropertyType.AgriculturalLand)
            score += 6;
        else if (property.Bedrooms.HasValue && property.Bedrooms.Value > 0)
            score += 6;
        else
            gaps.Add("Set bedroom count.");

        // Photos count (24)
        if (photoCount >= 8)
            score += 24;
        else if (photoCount >= 5)
            score += 20;
        else if (photoCount >= 3)
        {
            score += 12;
            gaps.Add($"Only {photoCount} photos — upload at least 5 (kitchen, elevation, washroom).");
        }
        else if (photoCount >= 1)
        {
            score += 6;
            gaps.Add($"Only {photoCount} photo(s) — minimum 5 recommended.");
        }
        else
            gaps.Add("Upload photos (minimum 5 recommended).");

        var categories = media
            .Select(m => (m.Category ?? "").ToLowerInvariant())
            .Where(c => c.Length > 0)
            .ToList();
        var hasExterior = categories.Any(c => c.Contains("exterior") || c.Contains("elevation"));
        var hasKitchen = categories.Any(c => c.Contains("kitchen"));
        var hasBath = categories.Any(c => c.Contains("bath") || c.Contains("wash"));

        // Media mix (24)
        if (hasExterior) score += 8;
        else if (photoCount > 0) gaps.Add("Tag or add an exterior / elevation photo.");
        if (hasKitchen) score += 8;
        else if (photoCount > 0) gaps.Add("Tag or add a kitchen photo.");
        if (hasBath) score += 8;
        else if (photoCount > 0) gaps.Add("Tag or add a bathroom photo.");

        // Primary photo (4)
        if (media.Any(m => m.IsPrimary))
            score += 4;
        else if (photoCount > 0)
            gaps.Add("Mark a primary cover photo.");

        // Map pin (4)
        if (property.Latitude.HasValue && property.Longitude.HasValue)
            score += 4;
        else
            gaps.Add("Set map pin coordinates.");

        // Yield context for premium sale stock (6)
        if (property.Purpose == PropertyPurpose.Sale && property.Price > 100_000_000m)
        {
            if (property.ExpectedRentMin.HasValue)
                score += 6;
            else
                gaps.Add("Add estimated rent / run AI rent scenario for yield context.");
        }
        else
            score += 6;

        score = Math.Clamp(score, 0, 100);

        return new ListingQualityResult
        {
            Score = score,
            Gaps = gaps.Take(5).ToList(),
            HasExterior = hasExterior,
            HasKitchen = hasKitchen,
            HasBathroom = hasBath,
            PhotoCount = photoCount
        };
    }

    public static int ComputeScore(Property property) => Score(property).Score;
}
