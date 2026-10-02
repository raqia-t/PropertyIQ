using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Inquiries;
using PropertyIQ.Domain.Entities;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InquiriesController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public InquiriesController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateInquiry([FromBody] CreateInquiryDto dto)
    {
        var currentUserId = _currentUserService.UserId;

        Guid? targetAgentId = null;
        if (dto.PropertyId.HasValue)
        {
            var prop = await _context.Properties.FirstOrDefaultAsync(p => p.Id == dto.PropertyId.Value);
            if (prop != null)
            {
                targetAgentId = prop.OwnerOrAgentId;
            }
        }

        var inquiry = new Inquiry
        {
            CustomerId = currentUserId,
            PropertyId = dto.PropertyId,
            ProjectId = dto.ProjectId,
            TargetAgentOrDeveloperId = targetAgentId,
            ContactName = dto.ContactName.Trim(),
            ContactEmail = dto.ContactEmail.Trim(),
            ContactPhone = dto.ContactPhone.Trim(),
            Message = dto.Message.Trim(),
            Status = InquiryStatus.New
        };

        _context.Inquiries.Add(inquiry);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Inquiry sent successfully to the listing agent.",
            inquiryId = inquiry.Id,
            status = inquiry.Status.ToString()
        });
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<object>> GetMyInquiries()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var inquiries = await _context.Inquiries
            .Include(i => i.Property)
            .Include(i => i.Project)
            .Where(i => i.CustomerId == userId.Value && !i.IsDeleted)
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new InquiryResponseDto
            {
                Id = i.Id,
                PropertyId = i.PropertyId,
                PropertyTitle = i.Property != null ? i.Property.Title : null,
                ProjectId = i.ProjectId,
                ProjectName = i.Project != null ? i.Project.Name : null,
                ContactName = i.ContactName,
                ContactEmail = i.ContactEmail,
                ContactPhone = i.ContactPhone,
                Message = i.Message,
                Status = i.Status.ToString(),
                AgentNotes = i.AgentNotes,
                CreatedAtUtc = i.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(inquiries);
    }

    [HttpGet("agent")]
    [Authorize]
    public async Task<ActionResult<object>> GetAgentLeads()
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var leads = await _context.Inquiries
            .Include(i => i.Property)
            .Include(i => i.Project)
            .Where(i => i.TargetAgentOrDeveloperId == userId.Value && !i.IsDeleted)
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new InquiryResponseDto
            {
                Id = i.Id,
                PropertyId = i.PropertyId,
                PropertyTitle = i.Property != null ? i.Property.Title : null,
                ProjectId = i.ProjectId,
                ProjectName = i.Project != null ? i.Project.Name : null,
                ContactName = i.ContactName,
                ContactEmail = i.ContactEmail,
                ContactPhone = i.ContactPhone,
                Message = i.Message,
                Status = i.Status.ToString(),
                AgentNotes = i.AgentNotes,
                CreatedAtUtc = i.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(leads);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateInquiryStatus(Guid id, [FromBody] UpdateInquiryStatusDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var inquiry = await _context.Inquiries.FirstOrDefaultAsync(i => i.Id == id && !i.IsDeleted);
        if (inquiry == null) return NotFound(new { message = "Inquiry not found." });

        if (inquiry.TargetAgentOrDeveloperId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        inquiry.Status = dto.Status;
        if (dto.AgentNotes != null)
        {
            inquiry.AgentNotes = dto.AgentNotes;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Inquiry status updated.",
            inquiryId = inquiry.Id,
            status = inquiry.Status.ToString()
        });
    }
}
