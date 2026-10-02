using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public PropertiesController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetProperties(
        [FromQuery] string? city,
        [FromQuery] string? area,
        [FromQuery] PropertyPurpose? purpose,
        [FromQuery] PropertyType? propertyType,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] int? bedrooms,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 12)
    {
        var query = _context.Properties
            .Include(p => p.Media)
            .Where(p => p.Status == ListingStatus.Published && !p.IsDeleted)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(city))
            query = query.Where(p => p.City.ToLower() == city.ToLower());

        if (!string.IsNullOrWhiteSpace(area))
            query = query.Where(p => p.Area.ToLower().Contains(area.ToLower()));

        if (purpose.HasValue)
            query = query.Where(p => p.Purpose == purpose.Value);

        if (propertyType.HasValue)
            query = query.Where(p => p.PropertyType == propertyType.Value);

        if (minPrice.HasValue)
            query = query.Where(p => p.Price >= minPrice.Value);

        if (maxPrice.HasValue)
            query = query.Where(p => p.Price <= maxPrice.Value);

        if (bedrooms.HasValue)
            query = query.Where(p => p.Bedrooms >= bedrooms.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.Purpose,
                p.PropertyType,
                p.Price,
                p.Currency,
                p.City,
                p.Area,
                p.Bedrooms,
                p.Bathrooms,
                p.LandArea,
                p.LandAreaUnit,
                p.CoveredAreaSqFt,
                p.VerificationStatus,
                p.ListingQualityScore,
                PrimaryImageUrl = p.Media.OrderBy(m => m.SortOrder).Select(m => m.Url).FirstOrDefault() ?? "/placeholder-property.jpg",
                p.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(new
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetPropertyById(Guid id)
    {
        var property = await _context.Properties
            .Include(p => p.Media)
            .Include(p => p.OwnerOrAgent)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (property == null)
        {
            return NotFound(new { message = "Property not found." });
        }

        return Ok(new
        {
            property.Id,
            property.Title,
            property.Description,
            property.AiDraftedDescription,
            Purpose = property.Purpose.ToString(),
            PropertyType = property.PropertyType.ToString(),
            Status = property.Status.ToString(),
            property.Price,
            property.Currency,
            property.IsNegotiable,
            property.ExpectedRentMin,
            property.ExpectedRentMax,
            property.Province,
            property.City,
            property.Area,
            property.SubArea,
            property.Address,
            property.Latitude,
            property.Longitude,
            property.Bedrooms,
            property.Bathrooms,
            property.LandArea,
            LandAreaUnit = property.LandAreaUnit.ToString(),
            property.CoveredAreaSqFt,
            property.TotalFloors,
            property.ParkingSpaces,
            Furnishing = property.Furnishing.ToString(),
            property.ConstructionYear,
            VerificationStatus = property.VerificationStatus.ToString(),
            property.ListingQualityScore,
            Media = property.Media.OrderBy(m => m.SortOrder).Select(m => new
            {
                m.Id,
                m.Url,
                m.MediaType,
                m.Category,
                m.IsPrimary,
                m.AiTags
            }),
            Agent = property.OwnerOrAgent != null ? new
            {
                property.OwnerOrAgent.Id,
                property.OwnerOrAgent.FullName,
                property.OwnerOrAgent.PhoneNumber,
                property.OwnerOrAgent.Email,
                Role = property.OwnerOrAgent.Role.ToString()
            } : null,
            property.CreatedAtUtc
        });
    }
}
