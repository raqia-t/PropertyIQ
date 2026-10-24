using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Agent;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/agent/visits")]
[Authorize]
public class AgentVisitsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public AgentVisitsController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<object>> ListVisits(
        [FromQuery] string? status = null,
        [FromQuery] string? scope = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var query = _context.AgentVisits
            .Include(v => v.Property)
            .Include(v => v.AgentClient)
            .Where(v => v.AgentUserId == userId.Value && !v.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<AgentVisitStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(v => v.Status == statusEnum);
        }

        var now = DateTime.UtcNow;
        if (string.Equals(scope, "upcoming", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(v =>
                v.ScheduledAtUtc >= now &&
                v.Status != AgentVisitStatus.Cancelled &&
                v.Status != AgentVisitStatus.Completed &&
                v.Status != AgentVisitStatus.NoShow);
        }
        else if (string.Equals(scope, "past", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(v =>
                v.ScheduledAtUtc < now ||
                v.Status == AgentVisitStatus.Completed ||
                v.Status == AgentVisitStatus.NoShow ||
                v.Status == AgentVisitStatus.Cancelled);
        }

        if (from.HasValue) query = query.Where(v => v.ScheduledAtUtc >= from.Value.ToUniversalTime());
        if (to.HasValue) query = query.Where(v => v.ScheduledAtUtc <= to.Value.ToUniversalTime());

        var items = await query
            .OrderBy(v => v.ScheduledAtUtc)
            .ToListAsync();

        return Ok(items.Select(MapToDto).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentVisitDto>> GetVisit(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var visit = await FindOwnedVisitAsync(userId.Value, id);
        if (visit == null) return NotFound(new { message = "Visit not found." });

        return Ok(MapToDto(visit));
    }

    [HttpPost]
    public async Task<ActionResult<AgentVisitDto>> CreateVisit([FromBody] CreateAgentVisitDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        if (dto.PropertyId == Guid.Empty)
            return BadRequest(new { message = "PropertyId is required." });
        if (dto.ScheduledAtUtc == default)
            return BadRequest(new { message = "ScheduledAtUtc is required." });
        if (!TryParseStatus(dto.Status, out var status))
            return BadRequest(new { message = "Invalid status. Use Requested, Confirmed, Completed, NoShow, or Cancelled." });

        var property = await _context.Properties
            .FirstOrDefaultAsync(p => p.Id == dto.PropertyId && !p.IsDeleted);
        if (property == null)
            return NotFound(new { message = "Property not found." });
        if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
            return Forbid();

        AgentClient? client = null;
        if (dto.AgentClientId.HasValue)
        {
            client = await _context.AgentClients.FirstOrDefaultAsync(c =>
                c.Id == dto.AgentClientId.Value && c.AgentUserId == userId.Value && !c.IsDeleted);
            if (client == null)
                return BadRequest(new { message = "Agent client not found in your CRM." });
        }

        Inquiry? inquiry = null;
        if (dto.InquiryId.HasValue)
        {
            inquiry = await _context.Inquiries.FirstOrDefaultAsync(i =>
                i.Id == dto.InquiryId.Value && !i.IsDeleted);
            if (inquiry == null)
                return BadRequest(new { message = "Inquiry not found." });
            if (inquiry.TargetAgentOrDeveloperId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
                return Forbid();
        }

        var visitorName = FirstNonEmpty(
            dto.VisitorName,
            client?.FullName,
            inquiry?.ContactName);
        if (string.IsNullOrWhiteSpace(visitorName))
            return BadRequest(new { message = "VisitorName is required (or link a client / inquiry)." });

        var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        var visit = new AgentVisit
        {
            AgentUserId = userId.Value,
            OrganizationId = agent?.OrganizationId,
            PropertyId = dto.PropertyId,
            AgentClientId = client?.Id,
            InquiryId = inquiry?.Id,
            VisitorName = visitorName.Trim(),
            VisitorPhone = FirstNonEmpty(dto.VisitorPhone, client?.Phone, inquiry?.ContactPhone),
            VisitorEmail = FirstNonEmpty(dto.VisitorEmail, client?.Email, inquiry?.ContactEmail),
            ScheduledAtUtc = dto.ScheduledAtUtc.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(dto.ScheduledAtUtc, DateTimeKind.Utc)
                : dto.ScheduledAtUtc.ToUniversalTime(),
            DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60,
            Status = status,
            MeetingPoint = string.IsNullOrWhiteSpace(dto.MeetingPoint) ? null : dto.MeetingPoint.Trim(),
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim()
        };

        _context.AgentVisits.Add(visit);

        if (inquiry != null)
        {
            inquiry.Status = InquiryStatus.ViewingScheduled;
            if (string.IsNullOrWhiteSpace(inquiry.AgentNotes))
            {
                inquiry.AgentNotes = $"Site visit scheduled for {visit.ScheduledAtUtc:u} UTC.";
            }
        }

        await _context.SaveChangesAsync();
        var created = await FindOwnedVisitAsync(userId.Value, visit.Id);
        return CreatedAtAction(nameof(GetVisit), new { id = visit.Id }, MapToDto(created!));
    }

    [HttpPost("from-inquiry/{inquiryId:guid}")]
    public async Task<ActionResult<AgentVisitDto>> ScheduleFromInquiry(
        Guid inquiryId,
        [FromBody] ScheduleVisitFromInquiryDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        if (dto.ScheduledAtUtc == default)
            return BadRequest(new { message = "ScheduledAtUtc is required." });
        if (!TryParseStatus(dto.Status, out var status))
            return BadRequest(new { message = "Invalid status." });

        var inquiry = await _context.Inquiries
            .Include(i => i.Property)
            .FirstOrDefaultAsync(i => i.Id == inquiryId && !i.IsDeleted);

        if (inquiry == null) return NotFound(new { message = "Inquiry not found." });
        if (inquiry.TargetAgentOrDeveloperId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
            return Forbid();
        if (!inquiry.PropertyId.HasValue)
            return BadRequest(new { message = "This inquiry is not linked to a property listing." });

        var existingOpen = await _context.AgentVisits.FirstOrDefaultAsync(v =>
            v.AgentUserId == userId.Value &&
            v.InquiryId == inquiryId &&
            !v.IsDeleted &&
            v.Status != AgentVisitStatus.Cancelled &&
            v.Status != AgentVisitStatus.Completed &&
            v.Status != AgentVisitStatus.NoShow);

        if (existingOpen != null)
        {
            existingOpen.ScheduledAtUtc = NormalizeUtc(dto.ScheduledAtUtc);
            existingOpen.DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60;
            existingOpen.Status = status;
            if (dto.MeetingPoint != null)
                existingOpen.MeetingPoint = string.IsNullOrWhiteSpace(dto.MeetingPoint) ? null : dto.MeetingPoint.Trim();
            if (dto.Notes != null)
                existingOpen.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

            if (dto.UpdateInquiryStatus)
                inquiry.Status = InquiryStatus.ViewingScheduled;

            await _context.SaveChangesAsync();
            var refreshed = await FindOwnedVisitAsync(userId.Value, existingOpen.Id);
            return Ok(MapToDto(refreshed!));
        }

        // Prefer matching CRM client by phone
        var phone = inquiry.ContactPhone?.Trim();
        AgentClient? client = null;
        if (!string.IsNullOrWhiteSpace(phone))
        {
            client = await _context.AgentClients.FirstOrDefaultAsync(c =>
                c.AgentUserId == userId.Value && c.Phone == phone && !c.IsDeleted);
        }

        var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        var visit = new AgentVisit
        {
            AgentUserId = userId.Value,
            OrganizationId = agent?.OrganizationId,
            PropertyId = inquiry.PropertyId.Value,
            AgentClientId = client?.Id,
            InquiryId = inquiry.Id,
            VisitorName = inquiry.ContactName.Trim(),
            VisitorPhone = string.IsNullOrWhiteSpace(inquiry.ContactPhone) ? null : inquiry.ContactPhone.Trim(),
            VisitorEmail = string.IsNullOrWhiteSpace(inquiry.ContactEmail) ? null : inquiry.ContactEmail.Trim(),
            ScheduledAtUtc = NormalizeUtc(dto.ScheduledAtUtc),
            DurationMinutes = dto.DurationMinutes > 0 ? dto.DurationMinutes : 60,
            Status = status,
            MeetingPoint = string.IsNullOrWhiteSpace(dto.MeetingPoint) ? null : dto.MeetingPoint.Trim(),
            Notes = string.IsNullOrWhiteSpace(dto.Notes)
                ? $"Scheduled from inquiry: {inquiry.Message}"
                : dto.Notes.Trim()
        };

        _context.AgentVisits.Add(visit);

        if (dto.UpdateInquiryStatus)
        {
            inquiry.Status = InquiryStatus.ViewingScheduled;
            if (string.IsNullOrWhiteSpace(inquiry.AgentNotes))
            {
                inquiry.AgentNotes = $"Site visit scheduled for {visit.ScheduledAtUtc:u} UTC.";
            }
        }

        await _context.SaveChangesAsync();
        var created = await FindOwnedVisitAsync(userId.Value, visit.Id);
        return CreatedAtAction(nameof(GetVisit), new { id = visit.Id }, MapToDto(created!));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AgentVisitDto>> UpdateVisit(Guid id, [FromBody] UpdateAgentVisitDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var visit = await _context.AgentVisits
            .FirstOrDefaultAsync(v => v.Id == id && v.AgentUserId == userId.Value && !v.IsDeleted);
        if (visit == null) return NotFound(new { message = "Visit not found." });

        if (dto.PropertyId.HasValue)
        {
            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.Id == dto.PropertyId.Value && !p.IsDeleted);
            if (property == null) return BadRequest(new { message = "Property not found." });
            if (property.OwnerOrAgentId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
                return Forbid();
            visit.PropertyId = dto.PropertyId.Value;
        }

        if (dto.AgentClientId.HasValue)
        {
            if (dto.AgentClientId.Value == Guid.Empty)
            {
                visit.AgentClientId = null;
            }
            else
            {
                var client = await _context.AgentClients.FirstOrDefaultAsync(c =>
                    c.Id == dto.AgentClientId.Value && c.AgentUserId == userId.Value && !c.IsDeleted);
                if (client == null)
                    return BadRequest(new { message = "Agent client not found in your CRM." });
                visit.AgentClientId = client.Id;
                visit.VisitorName = client.FullName;
                visit.VisitorPhone = client.Phone;
                visit.VisitorEmail = client.Email;
            }
        }

        if (dto.VisitorName != null) visit.VisitorName = dto.VisitorName.Trim();
        if (dto.VisitorPhone != null)
            visit.VisitorPhone = string.IsNullOrWhiteSpace(dto.VisitorPhone) ? null : dto.VisitorPhone.Trim();
        if (dto.VisitorEmail != null)
            visit.VisitorEmail = string.IsNullOrWhiteSpace(dto.VisitorEmail) ? null : dto.VisitorEmail.Trim();
        if (dto.ScheduledAtUtc.HasValue) visit.ScheduledAtUtc = NormalizeUtc(dto.ScheduledAtUtc.Value);
        if (dto.DurationMinutes.HasValue && dto.DurationMinutes.Value > 0)
            visit.DurationMinutes = dto.DurationMinutes.Value;
        if (dto.Status != null)
        {
            if (!TryParseStatus(dto.Status, out var status))
                return BadRequest(new { message = "Invalid status." });
            visit.Status = status;
        }
        if (dto.MeetingPoint != null)
            visit.MeetingPoint = string.IsNullOrWhiteSpace(dto.MeetingPoint) ? null : dto.MeetingPoint.Trim();
        if (dto.Notes != null)
            visit.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();

        await _context.SaveChangesAsync();
        var updated = await FindOwnedVisitAsync(userId.Value, id);
        return Ok(MapToDto(updated!));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<object>> CancelVisit(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var visit = await _context.AgentVisits
            .FirstOrDefaultAsync(v => v.Id == id && v.AgentUserId == userId.Value && !v.IsDeleted);
        if (visit == null) return NotFound(new { message = "Visit not found." });

        visit.Status = AgentVisitStatus.Cancelled;
        visit.IsDeleted = true;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Visit cancelled." });
    }

    private async Task<AgentVisit?> FindOwnedVisitAsync(Guid agentUserId, Guid id)
    {
        return await _context.AgentVisits
            .Include(v => v.Property)
            .Include(v => v.AgentClient)
            .FirstOrDefaultAsync(v => v.Id == id && v.AgentUserId == agentUserId && !v.IsDeleted);
    }

    private static AgentVisitDto MapToDto(AgentVisit v) => new()
    {
        Id = v.Id,
        PropertyId = v.PropertyId,
        PropertyTitle = v.Property?.Title ?? "Property",
        PropertyArea = v.Property?.Area,
        PropertyCity = v.Property?.City,
        PropertyLatitude = v.Property?.Latitude,
        PropertyLongitude = v.Property?.Longitude,
        AgentClientId = v.AgentClientId,
        AgentClientName = v.AgentClient?.FullName,
        InquiryId = v.InquiryId,
        VisitorName = v.VisitorName,
        VisitorPhone = v.VisitorPhone,
        VisitorEmail = v.VisitorEmail,
        ScheduledAtUtc = v.ScheduledAtUtc,
        DurationMinutes = v.DurationMinutes,
        Status = v.Status.ToString(),
        MeetingPoint = v.MeetingPoint,
        Notes = v.Notes,
        CreatedAtUtc = v.CreatedAtUtc
    };

    private static bool TryParseStatus(string? value, out AgentVisitStatus status) =>
        Enum.TryParse(value, ignoreCase: true, out status);

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var v in values)
        {
            if (!string.IsNullOrWhiteSpace(v)) return v;
        }
        return null;
    }
}
