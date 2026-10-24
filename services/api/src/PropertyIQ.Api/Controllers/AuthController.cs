using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Auth;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly ICurrentUserService _currentUserService;

    public AuthController(
        IApplicationDbContext context, 
        IJwtTokenGenerator jwtTokenGenerator,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _jwtTokenGenerator = jwtTokenGenerator;
        _currentUserService = currentUserService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest(new { message = "Username, email, and password are required." });
        }

        if (request.Password.Trim().Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters." });
        }

        // Public signup may only create these market personas (not staff/admin).
        var allowed = new[]
        {
            UserRole.Customer,
            UserRole.PropertyOwner,
            UserRole.Agent,
            UserRole.Developer,
            UserRole.Specialist
        };
        if (!allowed.Contains(request.Role))
        {
            return BadRequest(new { message = "Selected account role is not available for signup." });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var existing = await _context.Users.AnyAsync(u => u.Email.ToLower() == email);
        if (existing)
        {
            return BadRequest(new { message = "Email is already registered." });
        }

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            FullName = request.FullName.Trim(),
            PhoneNumber = (request.PhoneNumber ?? string.Empty).Trim(),
            Role = request.Role,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var token = _jwtTokenGenerator.GenerateToken(user);

        return Ok(new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            Token = token
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new { message = "Account is inactive. Please contact support." });
        }

        var token = _jwtTokenGenerator.GenerateToken(user);

        return Ok(new AuthResponse
        {
            UserId = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role.ToString(),
            Token = token
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<object>> GetCurrentUser()
    {
        var userId = _currentUserService.UserId;
        if (userId == null)
        {
            return Unauthorized();
        }

        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound();
        }

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.PhoneNumber,
            Role = user.Role.ToString(),
            Organization = user.Organization != null ? new
            {
                user.Organization.Id,
                user.Organization.Name,
                user.Organization.City,
                Type = user.Organization.Type.ToString(),
                user.Organization.IsVerified
            } : null,
            user.IdentityVerified
        });
    }
}
