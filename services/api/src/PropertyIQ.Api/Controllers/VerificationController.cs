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
[Authorize]
public class VerificationController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public VerificationController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public class CreateVerificationRequestDto
    {
        public Guid? PropertyId { get; set; }
        public Guid? ProjectId { get; set; }
        public VerificationLevel ServiceLevel { get; set; } = VerificationLevel.BasicDocumentReview;
    }

    [HttpPost("requests")]
    public async Task<ActionResult<object>> CreateRequest([FromBody] CreateVerificationRequestDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        decimal fee = dto.ServiceLevel switch
        {
            VerificationLevel.BasicDocumentReview => 15000m,
            VerificationLevel.PropertySiteVisit => 35000m,
            VerificationLevel.RecordCheck => 45000m,
            VerificationLevel.EnhancedDueDiligence => 75000m,
            VerificationLevel.LegalReview => 120000m,
            _ => 25000m
        };

        var newCase = new VerificationCase
        {
            CustomerId = userId.Value,
            PropertyId = dto.PropertyId,
            ProjectId = dto.ProjectId,
            ServiceLevel = dto.ServiceLevel,
            Fee = fee,
            Currency = "PKR",
            Status = VerificationCaseStatus.Requested,
            SLAHours = dto.ServiceLevel == VerificationLevel.PropertySiteVisit ? 72 : 48
        };

        // Create standard default checklist items for Pakistan properties
        var checks = new[]
        {
            ("Identity", "CHK-ID-01", "Seller / Developer CNIC and Power of Attorney verification"),
            ("OwnershipEvidence", "CHK-OWN-01", "Registry / Sale Deed / Fard Malkiat consistency"),
            ("MutationTransfer", "CHK-MUT-01", "Intiqal / Mutation records verification"),
            ("SocietyApproval", "CHK-SOC-01", "Development Authority (LDA/RDA/CDA/SBCA) NOC status"),
            ("SiteVisit", "CHK-VISIT-01", "Physical boundaries, GPS coordinates and possession verification")
        };

        foreach (var (category, code, title) in checks)
        {
            newCase.ChecklistItems.Add(new VerificationChecklistItem
            {
                Case = newCase,
                Category = category,
                CheckCode = code,
                CheckTitle = title,
                Result = ChecklistResult.NotChecked
            });
        }

        _context.VerificationCases.Add(newCase);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            CaseId = newCase.Id,
            newCase.ServiceLevel,
            newCase.Fee,
            newCase.Currency,
            Status = newCase.Status.ToString(),
            newCase.SLAHours,
            newCase.CreatedAtUtc
        });
    }

    [HttpGet("my-cases")]
    public async Task<ActionResult<object>> GetMyCases()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var cases = await _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Where(c => c.CustomerId == userId.Value && !c.IsDeleted)
            .OrderByDescending(c => c.CreatedAtUtc)
            .Select(c => new
            {
                c.Id,
                PropertyName = c.Property != null ? c.Property.Title : (c.Project != null ? c.Project.Name : "General Property"),
                ServiceLevel = c.ServiceLevel.ToString(),
                Status = c.Status.ToString(),
                c.Fee,
                c.Currency,
                c.SLAHours,
                c.CreatedAtUtc,
                c.CompletedAtUtc
            })
            .ToListAsync();

        return Ok(cases);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetCaseById(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var vCase = await _context.VerificationCases
            .Include(c => c.Property)
            .Include(c => c.Project)
            .Include(c => c.ChecklistItems)
            .Include(c => c.Reports)
            .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

        if (vCase == null) return NotFound(new { message = "Verification case not found." });

        return Ok(new
        {
            vCase.Id,
            Target = vCase.Property != null ? vCase.Property.Title : (vCase.Project != null ? vCase.Project.Name : "Property"),
            ServiceLevel = vCase.ServiceLevel.ToString(),
            Status = vCase.Status.ToString(),
            vCase.Fee,
            vCase.Currency,
            vCase.SLAHours,
            vCase.CreatedAtUtc,
            Checklist = vCase.ChecklistItems.Select(ci => new
            {
                ci.Id,
                ci.Category,
                ci.CheckCode,
                ci.CheckTitle,
                Result = ci.Result.ToString(),
                ci.Notes
            }),
            Reports = vCase.Reports.Select(r => new
            {
                r.Id,
                r.Version,
                r.Summary,
                r.Limitations,
                r.SpecialistNotes,
                r.PublishedAtUtc
            })
        });
    }
}
