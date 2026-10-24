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
[Route("api/agent/clients")]
[Authorize]
public class AgentClientsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public AgentClientsController(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<object>> ListClients(
        [FromQuery] string? side = null,
        [FromQuery] string? status = null,
        [FromQuery] string? q = null)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var query = _context.AgentClients
            .Include(c => c.LinkedProperty)
            .Include(c => c.LinkedBooking)
            .Where(c => c.AgentUserId == userId.Value && !c.IsDeleted);

        if (!string.IsNullOrWhiteSpace(side) &&
            Enum.TryParse<AgentClientSide>(side, ignoreCase: true, out var sideEnum))
        {
            query = query.Where(c => c.ClientSide == sideEnum);
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<AgentClientStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(c => c.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(c =>
                c.FullName.ToLower().Contains(term) ||
                c.Phone.Contains(term) ||
                (c.Email != null && c.Email.ToLower().Contains(term)) ||
                (c.TargetAreas != null && c.TargetAreas.ToLower().Contains(term)));
        }

        var items = await query
            .OrderByDescending(c => c.UpdatedAtUtc ?? c.CreatedAtUtc)
            .ToListAsync();

        return Ok(items.Select(MapToDto).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentClientDto>> GetClient(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var client = await FindOwnedClientAsync(userId.Value, id);
        if (client == null) return NotFound(new { message = "Client not found." });

        return Ok(MapToDto(client));
    }

    [HttpPost]
    public async Task<ActionResult<AgentClientDto>> CreateClient([FromBody] CreateAgentClientDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.FullName) || string.IsNullOrWhiteSpace(dto.Phone))
        {
            return BadRequest(new { message = "Full name and phone are required." });
        }

        var phone = dto.Phone.Trim();
        var exists = await _context.AgentClients.AnyAsync(c =>
            c.AgentUserId == userId.Value && c.Phone == phone && !c.IsDeleted);
        if (exists)
        {
            return Conflict(new { message = "A client with this phone already exists in your CRM." });
        }

        if (!TryParseSide(dto.ClientSide, out var side))
            return BadRequest(new { message = "Invalid clientSide. Use Buyer, Seller, Investor, or Both." });
        if (!TryParseStatus(dto.Status, out var status))
            return BadRequest(new { message = "Invalid status." });

        var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        var client = new AgentClient
        {
            AgentUserId = userId.Value,
            OrganizationId = agent?.OrganizationId,
            FullName = dto.FullName.Trim(),
            Phone = phone,
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim(),
            ClientSide = side,
            Status = status,
            BudgetMinPkr = dto.BudgetMinPkr,
            BudgetMaxPkr = dto.BudgetMaxPkr,
            TargetAreas = string.IsNullOrWhiteSpace(dto.TargetAreas) ? null : dto.TargetAreas.Trim(),
            Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim(),
            LinkedPropertyId = dto.LinkedPropertyId,
            LinkedBookingId = dto.LinkedBookingId,
            SourceInquiryId = dto.SourceInquiryId
        };

        _context.AgentClients.Add(client);
        await _context.SaveChangesAsync();

        var created = await FindOwnedClientAsync(userId.Value, client.Id);
        return CreatedAtAction(nameof(GetClient), new { id = client.Id }, MapToDto(created!));
    }

    [HttpPost("from-inquiry/{inquiryId:guid}")]
    public async Task<ActionResult<AgentClientDto>> PromoteFromInquiry(Guid inquiryId)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var inquiry = await _context.Inquiries
            .Include(i => i.Property)
            .FirstOrDefaultAsync(i => i.Id == inquiryId && !i.IsDeleted);

        if (inquiry == null) return NotFound(new { message = "Inquiry not found." });
        if (inquiry.TargetAgentOrDeveloperId != userId.Value && _currentUserService.UserRole != "SuperAdmin")
        {
            return Forbid();
        }

        var phone = inquiry.ContactPhone.Trim();
        var existing = await _context.AgentClients.FirstOrDefaultAsync(c =>
            c.AgentUserId == userId.Value && c.Phone == phone && !c.IsDeleted);

        if (existing != null)
        {
            existing.SourceInquiryId ??= inquiry.Id;
            existing.LinkedPropertyId ??= inquiry.PropertyId;
            if (string.IsNullOrWhiteSpace(existing.Notes))
            {
                existing.Notes = $"Promoted from inquiry: {inquiry.Message}";
            }
            await _context.SaveChangesAsync();
            var refreshed = await FindOwnedClientAsync(userId.Value, existing.Id);
            return Ok(MapToDto(refreshed!));
        }

        var agent = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId.Value);
        var client = new AgentClient
        {
            AgentUserId = userId.Value,
            OrganizationId = agent?.OrganizationId,
            LinkedUserId = inquiry.CustomerId,
            FullName = inquiry.ContactName.Trim(),
            Phone = phone,
            Email = string.IsNullOrWhiteSpace(inquiry.ContactEmail) ? null : inquiry.ContactEmail.Trim(),
            ClientSide = AgentClientSide.Buyer,
            Status = AgentClientStatus.Prospect,
            TargetAreas = inquiry.Property != null
                ? $"{inquiry.Property.Area}, {inquiry.Property.City}"
                : null,
            Notes = $"Promoted from inquiry: {inquiry.Message}",
            SourceInquiryId = inquiry.Id,
            LinkedPropertyId = inquiry.PropertyId
        };

        _context.AgentClients.Add(client);
        await _context.SaveChangesAsync();
        var created = await FindOwnedClientAsync(userId.Value, client.Id);
        return CreatedAtAction(nameof(GetClient), new { id = client.Id }, MapToDto(created!));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AgentClientDto>> UpdateClient(Guid id, [FromBody] UpdateAgentClientDto dto)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var client = await _context.AgentClients
            .FirstOrDefaultAsync(c => c.Id == id && c.AgentUserId == userId.Value && !c.IsDeleted);
        if (client == null) return NotFound(new { message = "Client not found." });

        if (dto.FullName != null) client.FullName = dto.FullName.Trim();
        if (dto.Phone != null)
        {
            var phone = dto.Phone.Trim();
            var duplicate = await _context.AgentClients.AnyAsync(c =>
                c.AgentUserId == userId.Value && c.Phone == phone && c.Id != id && !c.IsDeleted);
            if (duplicate)
            {
                return Conflict(new { message = "Another client already uses this phone." });
            }
            client.Phone = phone;
        }
        if (dto.Email != null) client.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim();
        if (dto.ClientSide != null)
        {
            if (!TryParseSide(dto.ClientSide, out var side))
                return BadRequest(new { message = "Invalid clientSide." });
            client.ClientSide = side;
        }
        if (dto.Status != null)
        {
            if (!TryParseStatus(dto.Status, out var status))
                return BadRequest(new { message = "Invalid status." });
            client.Status = status;
        }
        if (dto.BudgetMinPkr.HasValue) client.BudgetMinPkr = dto.BudgetMinPkr;
        if (dto.BudgetMaxPkr.HasValue) client.BudgetMaxPkr = dto.BudgetMaxPkr;
        if (dto.TargetAreas != null)
            client.TargetAreas = string.IsNullOrWhiteSpace(dto.TargetAreas) ? null : dto.TargetAreas.Trim();
        if (dto.Notes != null)
            client.Notes = string.IsNullOrWhiteSpace(dto.Notes) ? null : dto.Notes.Trim();
        if (dto.LinkedPropertyId.HasValue) client.LinkedPropertyId = dto.LinkedPropertyId;
        if (dto.LinkedBookingId.HasValue) client.LinkedBookingId = dto.LinkedBookingId;

        await _context.SaveChangesAsync();
        var updated = await FindOwnedClientAsync(userId.Value, id);
        return Ok(MapToDto(updated!));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<object>> DeleteClient(Guid id)
    {
        var userId = _currentUserService.UserId;
        if (userId == null) return Unauthorized();

        var client = await _context.AgentClients
            .FirstOrDefaultAsync(c => c.Id == id && c.AgentUserId == userId.Value && !c.IsDeleted);
        if (client == null) return NotFound(new { message = "Client not found." });

        client.IsDeleted = true;
        await _context.SaveChangesAsync();
        return Ok(new { message = "Client removed from CRM." });
    }

    private async Task<AgentClient?> FindOwnedClientAsync(Guid agentUserId, Guid id)
    {
        return await _context.AgentClients
            .Include(c => c.LinkedProperty)
            .Include(c => c.LinkedBooking)
            .FirstOrDefaultAsync(c => c.Id == id && c.AgentUserId == agentUserId && !c.IsDeleted);
    }

    private static AgentClientDto MapToDto(AgentClient c) => new()
    {
        Id = c.Id,
        FullName = c.FullName,
        Phone = c.Phone,
        Email = c.Email,
        ClientSide = c.ClientSide.ToString(),
        Status = c.Status.ToString(),
        BudgetMinPkr = c.BudgetMinPkr,
        BudgetMaxPkr = c.BudgetMaxPkr,
        TargetAreas = c.TargetAreas,
        Notes = c.Notes,
        SourceInquiryId = c.SourceInquiryId,
        LinkedBookingId = c.LinkedBookingId,
        LinkedPropertyId = c.LinkedPropertyId,
        LinkedPropertyTitle = c.LinkedProperty?.Title,
        ActiveBookingSummary = c.LinkedBookingId.HasValue
            ? $"Booking {c.LinkedBookingId.Value.ToString()[..8]}"
            : null,
        CreatedAtUtc = c.CreatedAtUtc
    };

    private static bool TryParseSide(string? value, out AgentClientSide side) =>
        Enum.TryParse(value, ignoreCase: true, out side);

    private static bool TryParseStatus(string? value, out AgentClientStatus status) =>
        Enum.TryParse(value, ignoreCase: true, out status);
}
