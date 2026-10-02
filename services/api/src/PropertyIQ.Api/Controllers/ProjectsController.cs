using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectsController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public ProjectsController(IApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetProjects(
        [FromQuery] string? city,
        [FromQuery] string? regulatoryAuthority,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.InventoryUnits)
            .Where(p => !p.IsDeleted)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(city))
            query = query.Where(p => p.City.ToLower() == city.ToLower());

        if (!string.IsNullOrWhiteSpace(regulatoryAuthority))
            query = query.Where(p => p.RegulatoryAuthority != null && p.RegulatoryAuthority.ToLower() == regulatoryAuthority.ToLower());

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Slug,
                p.Description,
                p.ProjectType,
                p.City,
                p.Area,
                p.RegulatoryAuthority,
                p.ApprovalReferenceNumber,
                p.ApprovalStatus,
                DeveloperName = p.DeveloperOrg != null ? p.DeveloperOrg.Name : string.Empty,
                TotalUnits = p.InventoryUnits.Count,
                AvailableUnits = p.InventoryUnits.Count(u => u.Status == InventoryStatus.Available),
                StartingPrice = p.InventoryUnits.Any() ? p.InventoryUnits.Min(u => u.BasePrice) : 0m,
                p.LaunchDate,
                p.ExpectedCompletionDate
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
    public async Task<ActionResult<object>> GetProjectById(Guid id)
    {
        var project = await _context.Projects
            .Include(p => p.DeveloperOrg)
            .Include(p => p.Phases)
                .ThenInclude(ph => ph.Blocks)
            .Include(p => p.InventoryUnits)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (project == null)
        {
            return NotFound(new { message = "Project not found." });
        }

        var plans = await _context.PaymentPlans
            .Where(pl => pl.ProjectId == id && !pl.IsDeleted)
            .ToListAsync();

        return Ok(new
        {
            project.Id,
            project.Name,
            project.Slug,
            project.Description,
            project.ProjectType,
            project.Province,
            project.City,
            project.Area,
            project.Address,
            project.Latitude,
            project.Longitude,
            project.RegulatoryAuthority,
            project.ApprovalReferenceNumber,
            project.ApprovalStatus,
            Developer = project.DeveloperOrg != null ? new
            {
                project.DeveloperOrg.Id,
                project.DeveloperOrg.Name,
                project.DeveloperOrg.LicenseNumber,
                project.DeveloperOrg.IsVerified
            } : null,
            Phases = project.Phases.Select(ph => new
            {
                ph.Id,
                ph.Name,
                Blocks = ph.Blocks.Select(b => new { b.Id, b.Name, b.BlockType })
            }),
            PaymentPlans = plans.Select(pl => new
            {
                pl.Id,
                pl.Name,
                pl.TotalPrice,
                pl.Currency,
                pl.DurationMonths,
                Frequency = pl.Frequency.ToString(),
                pl.BookingPercentage,
                pl.DownPaymentPercentage,
                pl.PossessionPercentage
            }),
            InventorySummary = new
            {
                Total = project.InventoryUnits.Count,
                Available = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Available),
                Reserved = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Reserved),
                Booked = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Booked),
                Sold = project.InventoryUnits.Count(u => u.Status == InventoryStatus.Sold)
            }
        });
    }

    [HttpGet("{id:guid}/inventory")]
    public async Task<ActionResult<object>> GetProjectInventory(
        Guid id, 
        [FromQuery] InventoryStatus? status,
        [FromQuery] string? unitType)
    {
        var query = _context.InventoryUnits
            .Include(u => u.Phase)
            .Include(u => u.Block)
            .Where(u => u.ProjectId == id && !u.IsDeleted)
            .AsNoTracking();

        if (status.HasValue)
            query = query.Where(u => u.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(unitType))
            query = query.Where(u => u.UnitType.ToLower() == unitType.ToLower());

        var items = await query
            .OrderBy(u => u.UnitNumber)
            .Select(u => new
            {
                u.Id,
                u.UnitNumber,
                u.UnitType,
                u.Size,
                SizeUnit = u.SizeUnit.ToString(),
                u.Facing,
                u.BasePrice,
                u.Currency,
                Status = u.Status.ToString(),
                PhaseName = u.Phase != null ? u.Phase.Name : null,
                BlockName = u.Block != null ? u.Block.Name : null
            })
            .ToListAsync();

        return Ok(items);
    }
}
