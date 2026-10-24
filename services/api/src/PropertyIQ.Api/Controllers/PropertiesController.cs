using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Properties;
using PropertyIQ.Application.Services;
using PropertyIQ.Api.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PropertiesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IFileStorageService _fileStorage;

    public PropertiesController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IFileStorageService fileStorage)
    {
        _context = context;
        _currentUserService = currentUserService;
        _fileStorage = fileStorage;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<object>> GetProperties(
        [FromQuery] string? q,
        [FromQuery] string? city,
        [FromQuery] string? area,
        [FromQuery] PropertyPurpose? purpose,
        [FromQuery] PropertyType? propertyType,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] int? bedrooms,
        [FromQuery] double? landArea,
        [FromQuery] string? landAreaUnit,
        [FromQuery] bool relax = true,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        LandAreaUnit? unitFilter = null;
        if (!string.IsNullOrWhiteSpace(landAreaUnit) &&
            Enum.TryParse<LandAreaUnit>(landAreaUnit.Trim(), ignoreCase: true, out var parsedUnit))
        {
            unitFilter = parsedUnit;
        }

        var areaFilter = !string.IsNullOrWhiteSpace(area) && area != "All";
        var cityFilter = !string.IsNullOrWhiteSpace(city) && city != "All";
        var areaLower = areaFilter ? area!.Trim().ToLowerInvariant() : null;
        var cityLower = cityFilter ? city!.Trim().ToLowerInvariant() : null;

        // --- Pass 1: exact / tight filters ---
        var query = BuildPropertyQuery(
            q, cityLower, areaLower, purpose, propertyType,
            minPrice, maxPrice, bedrooms, landArea, unitFilter,
            landAreaTolerance: 0.10,
            applyArea: true,
            expandPrice: false);

        var matchMode = "exact";
        string? relaxedReason = null;
        var total = await query.CountAsync();

        // --- Pass 2 (Phase 7): soft fallback so AI search doesn't feel empty ---
        if (total == 0 && relax)
        {
            // Widen land ±25%, keep area
            if (landArea.HasValue)
            {
                query = BuildPropertyQuery(
                    q, cityLower, areaLower, purpose, propertyType,
                    minPrice, maxPrice, bedrooms, landArea, unitFilter,
                    landAreaTolerance: 0.25,
                    applyArea: true,
                    expandPrice: false);
                total = await query.CountAsync();
                if (total > 0)
                {
                    matchMode = "relaxed";
                    relaxedReason = "Expanded land size tolerance to ±25%.";
                }
            }

            // Drop area, keep city + price band ±15%
            if (total == 0 && areaFilter)
            {
                query = BuildPropertyQuery(
                    q, cityLower, areaLower, purpose, propertyType,
                    minPrice, maxPrice, bedrooms, landArea, unitFilter,
                    landAreaTolerance: 0.25,
                    applyArea: false,
                    expandPrice: true);
                total = await query.CountAsync();
                if (total > 0)
                {
                    matchMode = "relaxed";
                    relaxedReason = "No exact area match — showing nearest in the same city (price ±15%).";
                }
            }

            // Last resort: city + purpose (+ type) only
            if (total == 0 && (areaFilter || landArea.HasValue || maxPrice.HasValue || minPrice.HasValue))
            {
                query = BuildPropertyQuery(
                    q, cityLower, areaLower: null, purpose, propertyType,
                    minPrice: null, maxPrice: null, bedrooms, landArea: null, unitFilter: null,
                    landAreaTolerance: 0,
                    applyArea: false,
                    expandPrice: false);
                total = await query.CountAsync();
                if (total > 0)
                {
                    matchMode = "relaxed";
                    relaxedReason = "Showing broader matches in this city — try adjusting budget or size.";
                }
            }
        }

        // Relevance ranking: exact area > verified > quality > newest
        var ordered = query
            .OrderByDescending(p =>
                areaLower != null && p.Area.ToLower().Contains(areaLower) ? 3 :
                areaLower != null ? 0 : 1)
            .ThenByDescending(p =>
                p.VerificationStatus == PropertyVerificationStatus.Verified ? 1 : 0)
            .ThenByDescending(p => p.ListingQualityScore ?? 0)
            .ThenByDescending(p => p.CreatedAtUtc);

        var rawItems = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Title,
                Purpose = p.Purpose.ToString(),
                PropertyType = p.PropertyType.ToString(),
                p.Price,
                p.Currency,
                p.City,
                p.Area,
                p.Bedrooms,
                p.Bathrooms,
                p.LandArea,
                LandAreaUnit = p.LandAreaUnit.ToString(),
                p.CoveredAreaSqFt,
                VerificationStatus = p.VerificationStatus.ToString(),
                p.ListingQualityScore,
                PrimaryImageUrl = p.Media.OrderByDescending(m => m.IsPrimary).ThenBy(m => m.SortOrder).Select(m => m.Url).FirstOrDefault() ?? "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
                p.CreatedAtUtc
            })
            .ToListAsync();

        var items = rawItems.Select(p =>
        {
            var areaBoost = areaLower != null && p.Area.ToLowerInvariant().Contains(areaLower) ? 40 : 0;
            var landBoost = 0;
            if (landArea.HasValue && p.LandArea > 0)
                landBoost = Math.Max(0, (int)(30 - Math.Abs(p.LandArea - landArea.Value) * 5));
            var verifyBoost = string.Equals(p.VerificationStatus, "Verified", StringComparison.OrdinalIgnoreCase) ? 15 : 0;
            var qualityBoost = Math.Min(15, p.ListingQualityScore ?? 0);
            return new
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
                p.PrimaryImageUrl,
                p.CreatedAtUtc,
                MatchScore = areaBoost + landBoost + verifyBoost + qualityBoost
            };
        }).ToList();

        return Ok(new
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            MatchMode = matchMode,
            RelaxedReason = relaxedReason,
            Items = items
        });
    }

    private IQueryable<Property> BuildPropertyQuery(
        string? q,
        string? cityLower,
        string? areaLower,
        PropertyPurpose? purpose,
        PropertyType? propertyType,
        decimal? minPrice,
        decimal? maxPrice,
        int? bedrooms,
        double? landArea,
        LandAreaUnit? unitFilter,
        double landAreaTolerance,
        bool applyArea,
        bool expandPrice)
    {
        var query = _context.Properties
            .Include(p => p.Media)
            .Where(p => p.Status == ListingStatus.Published && !p.IsDeleted)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(cityLower))
            query = query.Where(p => p.City.ToLower() == cityLower);

        if (applyArea && !string.IsNullOrWhiteSpace(areaLower))
            query = query.Where(p => p.Area.ToLower().Contains(areaLower));

        if (!string.IsNullOrWhiteSpace(q))
        {
            var qLower = q.ToLower();
            query = query.Where(p => p.Title.ToLower().Contains(qLower) ||
                                     p.Area.ToLower().Contains(qLower) ||
                                     p.City.ToLower().Contains(qLower) ||
                                     p.Description.ToLower().Contains(qLower));
        }

        if (purpose.HasValue)
            query = query.Where(p => p.Purpose == purpose.Value);

        if (propertyType.HasValue)
            query = query.Where(p => p.PropertyType == propertyType.Value);

        decimal? effectiveMin = minPrice;
        decimal? effectiveMax = maxPrice;
        if (expandPrice)
        {
            if (minPrice.HasValue) effectiveMin = minPrice.Value * 0.85m;
            if (maxPrice.HasValue) effectiveMax = maxPrice.Value * 1.15m;
        }

        if (effectiveMin.HasValue)
            query = query.Where(p => p.Price >= effectiveMin.Value);

        if (effectiveMax.HasValue)
            query = query.Where(p => p.Price <= effectiveMax.Value);

        if (bedrooms.HasValue)
            query = query.Where(p => p.Bedrooms >= bedrooms.Value);

        if (landArea.HasValue && landArea.Value > 0)
        {
            var lo = landArea.Value * (1.0 - landAreaTolerance);
            var hi = landArea.Value * (1.0 + landAreaTolerance);
            if (unitFilter.HasValue)
            {
                query = query.Where(p =>
                    p.LandAreaUnit == unitFilter.Value &&
                    p.LandArea >= lo &&
                    p.LandArea <= hi);
            }
            else
            {
                query = query.Where(p => p.LandArea >= lo && p.LandArea <= hi);
            }
        }
        else if (unitFilter.HasValue)
        {
            query = query.Where(p => p.LandAreaUnit == unitFilter.Value);
        }

        return query;
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

        var showExactPin = PropertyLocationAccess.ViewerSeesExactPin(property, _currentUserService);
        double? publicLat = showExactPin ? property.Latitude : null;
        double? publicLng = showExactPin ? property.Longitude : null;

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
            Latitude = publicLat,
            Longitude = publicLng,
            PrivacyLevel = property.PrivacyLevel.ToString(),
            ShowExactMap = showExactPin && property.Latitude.HasValue && property.Longitude.HasValue,
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

        var creator = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value && !u.IsDeleted);

        var property = new Property
        {
            OwnerOrAgentId = userId.Value,
            OrganizationId = creator?.OrganizationId,
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
            ExpectedRentMin = dto.ExpectedRentMin,
            ExpectedRentMax = dto.ExpectedRentMax,
            VerificationStatus = PropertyVerificationStatus.Unverified,
            ListingQualityScore = 0
        };

        if (dto.Media != null && dto.Media.Count > 0)
        {
            var sort = 0;
            foreach (var item in dto.Media)
            {
                if (string.IsNullOrWhiteSpace(item.Url)) continue;
                property.Media.Add(new PropertyMedia
                {
                    MediaType = string.IsNullOrWhiteSpace(item.MediaType) ? "Photo" : item.MediaType,
                    Url = item.Url.Trim(),
                    StorageKey = item.Url.Trim(),
                    Category = string.IsNullOrWhiteSpace(item.Category) ? "Exterior" : item.Category,
                    SortOrder = item.SortOrder > 0 ? item.SortOrder : sort,
                    IsPrimary = item.IsPrimary,
                    AiTags = item.AiTags
                });
                sort++;
            }

            if (property.Media.Count > 0 && !property.Media.Any(m => m.IsPrimary))
            {
                property.Media.First().IsPrimary = true;
            }
        }

        property.ListingQualityScore = ListingQualityScorer.ComputeScore(property);

        _context.Properties.Add(property);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPropertyById), new { id = property.Id }, new
        {
            property.Id,
            property.Title,
            property.Price,
            property.ListingQualityScore
        });
    }

    [HttpPut("{id:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateProperty(Guid id, [FromBody] PropertyIQ.Application.DTOs.Properties.UpdatePropertyDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties
            .Include(p => p.Media)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        if (dto.Title != null) property.Title = dto.Title.Trim();
        if (dto.Purpose.HasValue) property.Purpose = dto.Purpose.Value;
        if (dto.PropertyType.HasValue) property.PropertyType = dto.PropertyType.Value;
        if (dto.Status.HasValue) property.Status = dto.Status.Value;
        if (dto.Province != null) property.Province = dto.Province.Trim();
        if (dto.City != null) property.City = dto.City.Trim();
        if (dto.Area != null) property.Area = dto.Area.Trim();
        if (dto.SubArea != null)
            property.SubArea = string.IsNullOrWhiteSpace(dto.SubArea) ? null : dto.SubArea.Trim();
        if (dto.Address != null)
            property.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();
        if (dto.Latitude.HasValue) property.Latitude = dto.Latitude.Value;
        if (dto.Longitude.HasValue) property.Longitude = dto.Longitude.Value;
        if (dto.PrivacyLevel.HasValue) property.PrivacyLevel = dto.PrivacyLevel.Value;
        if (dto.Price.HasValue) property.Price = dto.Price.Value;
        if (dto.Currency != null) property.Currency = dto.Currency.Trim();
        if (dto.IsNegotiable.HasValue) property.IsNegotiable = dto.IsNegotiable.Value;
        if (dto.Bedrooms.HasValue) property.Bedrooms = dto.Bedrooms.Value;
        if (dto.Bathrooms.HasValue) property.Bathrooms = dto.Bathrooms.Value;
        if (dto.LandArea.HasValue) property.LandArea = dto.LandArea.Value;
        if (dto.LandAreaUnit.HasValue) property.LandAreaUnit = dto.LandAreaUnit.Value;
        if (dto.CoveredAreaSqFt.HasValue) property.CoveredAreaSqFt = dto.CoveredAreaSqFt.Value;
        if (dto.TotalFloors.HasValue) property.TotalFloors = dto.TotalFloors.Value;
        if (dto.ParkingSpaces.HasValue) property.ParkingSpaces = dto.ParkingSpaces.Value;
        if (dto.Furnishing.HasValue) property.Furnishing = dto.Furnishing.Value;
        if (dto.ConstructionYear.HasValue) property.ConstructionYear = dto.ConstructionYear.Value;
        if (dto.Description != null) property.Description = dto.Description;
        if (dto.ExpectedRentMin.HasValue) property.ExpectedRentMin = dto.ExpectedRentMin.Value;
        if (dto.ExpectedRentMax.HasValue) property.ExpectedRentMax = dto.ExpectedRentMax.Value;

        property.ListingQualityScore = ListingQualityScorer.ComputeScore(property);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Property updated successfully.",
            property.Id,
            property.ListingQualityScore
        });
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

        var property = await _context.Properties
            .Include(p => p.Media)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.Url))
        {
            return BadRequest(new { message = "Media URL is required." });
        }

        var media = new PropertyMedia
        {
            PropertyId = id,
            MediaType = string.IsNullOrWhiteSpace(dto.MediaType) ? "Photo" : dto.MediaType,
            Url = dto.Url.Trim(),
            StorageKey = dto.Url.Trim(),
            Category = string.IsNullOrWhiteSpace(dto.Category) ? "Exterior" : dto.Category,
            SortOrder = dto.SortOrder,
            IsPrimary = dto.IsPrimary,
            AiTags = dto.AiTags
        };

        if (media.IsPrimary)
        {
            foreach (var existing in property.Media)
            {
                existing.IsPrimary = false;
            }
        }

        property.Media.Add(media);
        property.ListingQualityScore = ListingQualityScorer.ComputeScore(property);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Media attached successfully.",
            media.Id,
            media.Url,
            property.ListingQualityScore
        });
    }

    [HttpPost("{id:guid}/media/upload")]
    [Authorize]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<object>> UploadMedia(
        Guid id,
        IFormFile file,
        [FromForm] string? category,
        [FromForm] int sortOrder = 0,
        [FromForm] bool isPrimary = false,
        [FromForm] string? aiTags = null)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Image file is required." });
        }

        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only image uploads are supported." });
        }

        var property = await _context.Properties
            .Include(p => p.Media)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        await using var stream = file.OpenReadStream();
        var storageKey = await _fileStorage.UploadFileAsync(file.FileName, stream, file.ContentType, isPrivate: false);
        var publicUrl = $"/media-files/{storageKey.Replace('\\', '/')}";

        var media = new PropertyMedia
        {
            PropertyId = id,
            MediaType = "Photo",
            Url = publicUrl,
            StorageKey = storageKey,
            Category = string.IsNullOrWhiteSpace(category) ? "Exterior" : category.Trim(),
            SortOrder = sortOrder,
            IsPrimary = isPrimary,
            AiTags = aiTags
        };

        if (media.IsPrimary)
        {
            foreach (var existing in property.Media)
            {
                existing.IsPrimary = false;
            }
        }

        property.Media.Add(media);
        property.ListingQualityScore = ListingQualityScorer.ComputeScore(property);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Media uploaded successfully.",
            media.Id,
            media.Url,
            storageKey,
            property.ListingQualityScore
        });
    }

    /// <summary>
    /// Recompute listing quality from completeness + media mix (incl. vision categories).
    /// </summary>
    [HttpPost("{id:guid}/refresh-quality")]
    [Authorize]
    public async Task<ActionResult<object>> RefreshListingQuality(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties
            .Include(p => p.Media)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });

        if (property.OwnerOrAgentId != userId.Value &&
            _currentUserService.UserRole != "SuperAdmin" &&
            _currentUserService.UserRole != "Agent")
        {
            return Forbid();
        }

        var result = ListingQualityScorer.Score(property);
        property.ListingQualityScore = result.Score;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            propertyId = property.Id,
            listingQualityScore = result.Score,
            gaps = result.Gaps,
            photoCount = result.PhotoCount,
            hasExterior = result.HasExterior,
            hasKitchen = result.HasKitchen,
            hasBathroom = result.HasBathroom
        });
    }

    [HttpPost("{id:guid}/view")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> RecordView(Guid id, [FromBody] RecordPropertyViewDto? dto = null)
    {
        var propertyExists = await _context.Properties.AnyAsync(p => p.Id == id && !p.IsDeleted);
        if (!propertyExists) return NotFound(new { message = "Property not found." });

        var sessionKey = string.IsNullOrWhiteSpace(dto?.SessionKey) ? null : dto!.SessionKey.Trim();
        if (sessionKey != null && sessionKey.Length > 128) sessionKey = sessionKey[..128];

        var viewerId = _currentUserService.UserId;
        var since = DateTime.UtcNow.AddMinutes(-30);

        // Light dedupe: same user or session within 30 minutes
        var recent = await _context.PropertyViews.AnyAsync(v =>
            v.PropertyId == id &&
            !v.IsDeleted &&
            v.ViewedAtUtc >= since &&
            ((viewerId.HasValue && v.ViewerUserId == viewerId.Value) ||
             (sessionKey != null && v.SessionKey == sessionKey)));

        if (recent)
        {
            return Ok(new { recorded = false, message = "View already counted recently." });
        }

        _context.PropertyViews.Add(new PropertyView
        {
            PropertyId = id,
            ViewerUserId = viewerId,
            SessionKey = sessionKey,
            ViewedAtUtc = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return Ok(new { recorded = true });
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

    private async Task<bool> CanAccessPropertyEvidenceAsync(Property property, Guid userId)
    {
        if (property.OwnerOrAgentId == userId) return true;
        if (_currentUserService.UserRole is "Specialist" or "SuperAdmin") return true;
        return false;
    }

    [HttpGet("{id:guid}/evidence")]
    [Authorize]
    public async Task<ActionResult<object>> ListEvidence(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });
        if (!await CanAccessPropertyEvidenceAsync(property, userId.Value))
            return Forbid();

        var docs = await _context.PropertyEvidenceDocuments
            .Where(d => d.PropertyId == id && !d.IsDeleted)
            .OrderByDescending(d => d.UploadedAtUtc)
            .Select(d => new
            {
                d.Id,
                DocumentType = d.DocumentType.ToString(),
                d.FileName,
                d.ContentType,
                d.SizeBytes,
                Status = d.Status.ToString(),
                d.UploadedAtUtc,
                d.ReviewerNotes
            })
            .ToListAsync();

        return Ok(docs);
    }

    [HttpPost("{id:guid}/evidence")]
    [Authorize]
    [RequestSizeLimit(25_000_000)]
    public async Task<ActionResult<object>> UploadEvidence(
        Guid id,
        IFormFile file,
        [FromForm] string documentType = "Other")
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Evidence file is required." });

        var allowed =
            file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ||
            file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ||
            file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        if (!allowed)
            return BadRequest(new { message = "Only PDF or image evidence files are supported." });

        if (!Enum.TryParse<PropertyEvidenceDocumentType>(documentType, ignoreCase: true, out var docType))
            return BadRequest(new { message = "Invalid documentType. Use SaleFard, Registry, PropertyFile, AllotmentLetter, TransferLetter, or Other." });

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });
        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
            return Forbid();

        await using var stream = file.OpenReadStream();
        var storageKey = await _fileStorage.UploadFileAsync(
            file.FileName, stream, file.ContentType, isPrivate: true);

        var doc = new PropertyEvidenceDocument
        {
            PropertyId = id,
            DocumentType = docType,
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType,
            SizeBytes = file.Length,
            StorageKey = storageKey,
            UploadedByUserId = userId.Value,
            UploadedAtUtc = DateTime.UtcNow,
            Status = PropertyEvidenceDocumentStatus.Submitted
        };

        _context.PropertyEvidenceDocuments.Add(doc);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Evidence uploaded. This does not verify the listing until a specialist reviews it.",
            doc.Id,
            DocumentType = doc.DocumentType.ToString(),
            doc.FileName,
            doc.SizeBytes,
            Status = doc.Status.ToString(),
            doc.UploadedAtUtc
        });
    }

    [HttpGet("{id:guid}/evidence/{docId:guid}/download")]
    [Authorize]
    public async Task<IActionResult> DownloadEvidence(Guid id, Guid docId)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });
        if (!await CanAccessPropertyEvidenceAsync(property, userId.Value))
            return Forbid();

        var doc = await _context.PropertyEvidenceDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.PropertyId == id && !d.IsDeleted);
        if (doc == null) return NotFound(new { message = "Evidence document not found." });

        var stream = await _fileStorage.GetFileAsync(doc.StorageKey);
        if (stream == null) return NotFound(new { message = "File missing from storage." });

        return File(stream, doc.ContentType, doc.FileName);
    }

    [HttpDelete("{id:guid}/evidence/{docId:guid}")]
    [Authorize]
    public async Task<ActionResult<object>> DeleteEvidence(Guid id, Guid docId)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var property = await _context.Properties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (property == null) return NotFound(new { message = "Property not found." });
        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
            return Forbid();

        var doc = await _context.PropertyEvidenceDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.PropertyId == id && !d.IsDeleted);
        if (doc == null) return NotFound(new { message = "Evidence document not found." });

        doc.IsDeleted = true;
        await _fileStorage.DeleteFileAsync(doc.StorageKey);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Evidence document removed." });
    }
}
