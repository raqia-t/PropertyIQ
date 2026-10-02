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

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<object>> CreateProperty([FromBody] PropertyIQ.Application.DTOs.Properties.CreatePropertyDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = new Property
        {
            OwnerOrAgentId = userId.Value,
            Title = dto.Title.Trim(),
            Purpose = dto.Purpose,
            PropertyType = dto.PropertyType,
            Status = ListingStatus.Published, // Published directly or pending moderation
            Province = dto.Province,
            City = dto.City,
            Area = dto.Area,
            SubArea = dto.SubArea,
            Address = dto.Address,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            PrivacyLevel = dto.PrivacyLevel,
            Price = dto.Price,
            Currency = dto.Currency,
            IsNegotiable = dto.IsNegotiable,
            Bedrooms = dto.Bedrooms,
            Bathrooms = dto.Bathrooms,
            LandArea = dto.LandArea,
            LandAreaUnit = dto.LandAreaUnit,
            CoveredAreaSqFt = dto.CoveredAreaSqFt,
            TotalFloors = dto.TotalFloors,
            ParkingSpaces = dto.ParkingSpaces,
            Furnishing = dto.Furnishing,
            ConstructionYear = dto.ConstructionYear,
            Description = dto.Description,
            VerificationStatus = PropertyVerificationStatus.Unverified,
            ListingQualityScore = 75
        };

        _context.Properties.Add(property);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPropertyById), new { id = property.Id }, new { property.Id, property.Title, property.Price });
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateProperty(Guid id, [FromBody] PropertyIQ.Application.DTOs.Properties.UpdatePropertyDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        if (dto.Title != null) property.Title = dto.Title;
        if (dto.Status.HasValue) property.Status = dto.Status.Value;
        if (dto.Price.HasValue) property.Price = dto.Price.Value;
        if (dto.IsNegotiable.HasValue) property.IsNegotiable = dto.IsNegotiable.Value;
        if (dto.Bedrooms.HasValue) property.Bedrooms = dto.Bedrooms.Value;
        if (dto.Bathrooms.HasValue) property.Bathrooms = dto.Bathrooms.Value;
        if (dto.Description != null) property.Description = dto.Description;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Property updated successfully.", property.Id });
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeleteProperty(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        property.IsDeleted = true;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Property removed successfully." });
    }

    [HttpPost("{id:guid}/media")]
    [Authorize]
    public async Task<ActionResult<object>> AddMedia(Guid id, [FromBody] PropertyIQ.Application.DTOs.Properties.AddPropertyMediaDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        var media = new PropertyMedia
        {
            PropertyId = id,
            MediaType = dto.MediaType,
            Url = dto.Url,
            StorageKey = dto.Url,
            Category = dto.Category,
            SortOrder = dto.SortOrder,
            IsPrimary = dto.IsPrimary,
            AiTags = dto.AiTags
        };

        _context.PropertyMedia.Add(media);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Media attached successfully.", media.Id });
    }

    [HttpPost("{id:guid}/save")]
    [Authorize]
    public async Task<ActionResult<object>> SaveProperty(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var existing = await _context.SavedProperties.FirstOrDefaultAsync(s => s.UserId == userId.Value && s.PropertyId == id);
        if (existing != null)
        {
            return Ok(new { message = "Property already saved." });
        }

        _context.SavedProperties.Add(new SavedProperty
        {
            UserId = userId.Value,
            PropertyId = id
        });
        await _context.SaveChangesAsync();

        return Ok(new { message = "Property saved to favorites." });
    }

    [HttpDelete("{id:guid}/save")]
    [Authorize]
    public async Task<ActionResult<object>> UnsaveProperty(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var existing = await _context.SavedProperties.FirstOrDefaultAsync(s => s.UserId == userId.Value && s.PropertyId == id);
        if (existing != null)
        {
            _context.SavedProperties.Remove(existing);
            await _context.SaveChangesAsync();
        }

        return Ok(new { message = "Property removed from favorites." });
    }

    [HttpGet("saved")]
    [Authorize]
    public async Task<ActionResult<object>> GetSavedProperties()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var saved = await _context.SavedProperties
            .Include(s => s.Property)
                .ThenInclude(p => p!.Media)
            .Where(s => s.UserId == userId.Value && !s.Property!.IsDeleted)
            .Select(s => new
            {
                s.Property!.Id,
                s.Property.Title,
                s.Property.Price,
                s.Property.Currency,
                s.Property.City,
                s.Property.Area,
                s.Property.Bedrooms,
                s.Property.Bathrooms,
                s.Property.LandArea,
                s.Property.LandAreaUnit,
                PrimaryImageUrl = s.Property.Media.OrderBy(m => m.SortOrder).Select(m => m.Url).FirstOrDefault() ?? "/placeholder-property.jpg",
                SavedAtUtc = s.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(saved);
    }
}
