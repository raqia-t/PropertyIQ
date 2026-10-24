using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.Services;

public interface IPropertyCompsService
{
    Task<(List<PropertyCompSnapshotDto> SaleComps, List<PropertyCompSnapshotDto> RentComps)> GetCompsAsync(
        PropertyScenarioRequestDto request,
        CancellationToken cancellationToken = default);
}

public class PropertyCompsService : IPropertyCompsService
{
    private readonly IApplicationDbContext _context;

    public PropertyCompsService(IApplicationDbContext context)
    {
        _context = context;
    }

    public static double ToMarla(double size, LandAreaUnit unit) =>
        unit == LandAreaUnit.Kanal ? size * 20.0 : size;

    public static double ToMarla(double size, string? sizeUnit)
    {
        if (string.Equals(sizeUnit, "Kanal", StringComparison.OrdinalIgnoreCase))
            return size * 20.0;
        return size;
    }

    public async Task<(List<PropertyCompSnapshotDto> SaleComps, List<PropertyCompSnapshotDto> RentComps)> GetCompsAsync(
        PropertyScenarioRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var city = (request.City ?? "Lahore").Trim();
        var area = (request.Area ?? "").Trim();
        var subjectMarla = ToMarla(request.Size, request.SizeUnit);
        if (subjectMarla <= 0) subjectMarla = 1;

        var hasType = Enum.TryParse<PropertyType>(request.PropertyType, ignoreCase: true, out var propType);
        var excludeId = request.PropertyId;

        var rows = await _context.Properties
            .AsNoTracking()
            .Where(p =>
                !p.IsDeleted &&
                p.Status == ListingStatus.Published &&
                p.City.ToLower() == city.ToLower() &&
                (excludeId == null || p.Id != excludeId.Value))
            .Select(p => new CompRow(
                p.Id,
                p.Title,
                p.City,
                p.Area,
                p.Purpose,
                p.PropertyType,
                p.Price,
                p.LandArea,
                p.LandAreaUnit,
                p.Bedrooms,
                p.ExpectedRentMin,
                p.ExpectedRentMax))
            .Take(200)
            .ToListAsync(cancellationToken);

        bool SizeOk(CompRow r)
        {
            var m = ToMarla(r.LandArea, r.LandAreaUnit);
            if (m <= 0) return false;
            return m >= subjectMarla * 0.65 && m <= subjectMarla * 1.35;
        }

        bool AreaOk(CompRow r)
        {
            if (string.IsNullOrWhiteSpace(area)) return true;
            var a = area.ToLowerInvariant();
            var l = (r.Area ?? "").ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(l)) return false;
            var aToken = a.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? a;
            var lToken = l.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? l;
            return l.Contains(a) || a.Contains(l) || l.Contains(aToken) || a.Contains(lToken);
        }

        static PropertyCompSnapshotDto Map(CompRow r) => new()
        {
            PropertyId = r.Id,
            Title = r.Title,
            City = r.City,
            Area = r.Area,
            PropertyType = r.PropertyType.ToString(),
            Purpose = r.Purpose.ToString(),
            Price = r.Price,
            Size = r.LandArea,
            SizeUnit = r.LandAreaUnit.ToString(),
            Bedrooms = r.Bedrooms,
            ExpectedRentMin = r.ExpectedRentMin,
            ExpectedRentMax = r.ExpectedRentMax
        };

        var typed = hasType
            ? rows.Where(r => r.PropertyType == propType).ToList()
            : rows;
        if (typed.Count == 0) typed = rows;

        var sizeFiltered = typed.Where(SizeOk).ToList();
        if (sizeFiltered.Count == 0) sizeFiltered = typed;

        var areaFiltered = sizeFiltered.Where(AreaOk).ToList();
        var pool = areaFiltered.Count > 0 ? areaFiltered : sizeFiltered;

        var sale = pool
            .Where(r => r.Purpose == PropertyPurpose.Sale && r.Price > 0)
            .Take(12)
            .Select(Map)
            .ToList();

        // Prefer true For-Rent listings; ExpectedRent on Sale listings is fallback only
        var rent = pool
            .Where(r => r.Purpose == PropertyPurpose.Rent && r.Price > 0)
            .Take(12)
            .Select(Map)
            .ToList();

        if (rent.Count == 0)
        {
            rent = sizeFiltered
                .Where(r => r.Purpose == PropertyPurpose.Rent && r.Price > 0)
                .Take(12)
                .Select(Map)
                .ToList();
        }

        if (rent.Count == 0)
        {
            rent = pool
                .Where(r => r.ExpectedRentMin != null && r.ExpectedRentMax != null)
                .Take(8)
                .Select(Map)
                .ToList();
        }

        return (sale, rent);
    }

    private sealed record CompRow(
        Guid Id,
        string Title,
        string City,
        string Area,
        PropertyPurpose Purpose,
        PropertyType PropertyType,
        decimal Price,
        double LandArea,
        LandAreaUnit LandAreaUnit,
        int? Bedrooms,
        decimal? ExpectedRentMin,
        decimal? ExpectedRentMax);
}
