using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Projects;
using PropertyIQ.Application.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IInstallmentScheduleCalculator _scheduleCalculator;
    private readonly IFileStorageService _fileStorage;

    public BookingsController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IInstallmentScheduleCalculator scheduleCalculator,
        IFileStorageService fileStorage)
    {
        _context = context;
        _currentUserService = currentUserService;
        _scheduleCalculator = scheduleCalculator;
        _fileStorage = fileStorage;
    }

    [HttpPost("calculate-schedule")]
    public ActionResult<object> CalculateSchedule([FromBody] InstallmentCalculationRequest request)
    {
        try
        {
            var schedule = _scheduleCalculator.GenerateSchedule(request);
            var totalCalculated = schedule.Sum(s => s.Amount);

            return Ok(new
            {
                TotalPrice = request.TotalPrice,
                DurationMonths = request.DurationMonths,
                Frequency = request.Frequency.ToString(),
                TotalScheduleSum = totalCalculated,
                ItemCount = schedule.Count,
                Schedule = schedule
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("reserve")]
    public async Task<ActionResult<object>> ReserveUnit([FromBody] ReserveUnitRequestDto dto)
    {
        var unit = await _context.InventoryUnits
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == dto.UnitId && !u.IsDeleted);

        if (unit == null)
            return NotFound(new { message = "Inventory unit not found." });

        // Concurrency Guard: Unit must strictly be Available
        if (unit.Status != InventoryStatus.Available)
        {
            return Conflict(new
            {
                message = $"Unit {unit.UnitNumber} is currently '{unit.Status}' and cannot be reserved. Another customer may have just reserved it.",
                unitId = unit.Id,
                currentStatus = unit.Status.ToString()
            });
        }

        unit.Status = InventoryStatus.Reserved;

        var audit = new AuditLog
        {
            EntityName = nameof(InventoryUnit),
            EntityId = unit.Id.ToString(),
            Action = "UnitReserved",
            OldValuesJson = InventoryStatus.Available.ToString(),
            NewValuesJson = InventoryStatus.Reserved.ToString(),
            Reason = dto.Notes ?? "Unit temporarily reserved by customer.",
            ActorUserId = _currentUserService.UserId
        };
        _context.AuditLogs.Add(audit);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Concurrency conflict: This unit was modified by another transaction. Please refresh and try again." });
        }

        return Ok(new
        {
            message = $"Unit {unit.UnitNumber} reserved successfully.",
            unitId = unit.Id,
            unitNumber = unit.UnitNumber,
            status = unit.Status.ToString(),
            basePrice = unit.BasePrice,
            currency = unit.Currency
        });
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateBooking([FromBody] CreateBookingRequestDto dto)
    {
        var unit = await _context.InventoryUnits
            .Include(u => u.Project)
            .FirstOrDefaultAsync(u => u.Id == dto.UnitId && !u.IsDeleted);

        if (unit == null)
            return NotFound(new { message = "Inventory unit not found." });

        // Concurrency Guard: Unit can only be booked if Available or Reserved by this flow
        if (unit.Status == InventoryStatus.Booked || unit.Status == InventoryStatus.Sold || unit.Status == InventoryStatus.Blocked)
        {
            return Conflict(new
            {
                message = $"Unit {unit.UnitNumber} cannot be booked because its status is '{unit.Status}'.",
                unitId = unit.Id,
                currentStatus = unit.Status.ToString()
            });
        }

        // Determine Customer ID
        var customerId = _currentUserService.UserId;
        if (!customerId.HasValue)
        {
            // Fallback to seeded demo buyer if unauthenticated
            var demoBuyer = await _context.Users.FirstOrDefaultAsync(u => u.Email == "buyer@gmail.com");
            customerId = demoBuyer?.Id ?? Guid.NewGuid();
        }

        var agreedPrice = dto.TotalAgreedPrice > 0 ? dto.TotalAgreedPrice : unit.BasePrice;

        // Generate Installment Schedule
        var calcRequest = new InstallmentCalculationRequest
        {
            TotalPrice = agreedPrice,
            DurationMonths = dto.DurationMonths,
            Frequency = dto.Frequency,
            BookingPercentage = dto.BookingPercentage,
            DownPaymentPercentage = dto.DownPaymentPercentage,
            PossessionPercentage = dto.PossessionPercentage,
            StartDate = DateTime.UtcNow
        };

        var calculatedItems = _scheduleCalculator.GenerateSchedule(calcRequest);

        var booking = new Booking
        {
            InventoryUnitId = unit.Id,
            CustomerId = customerId.Value,
            PaymentPlanId = dto.PaymentPlanId,
            TotalAgreedPrice = agreedPrice,
            Currency = unit.Currency,
            Status = BookingStatus.Confirmed,
            BookedAtUtc = DateTime.UtcNow
        };

        foreach (var calc in calculatedItems)
        {
            booking.ScheduleItems.Add(new PaymentScheduleItem
            {
                SequenceNumber = calc.SequenceNumber,
                Title = calc.Title,
                DueDate = calc.DueDate,
                Amount = calc.Amount,
                Currency = unit.Currency,
                Status = calc.Status,
                PaidAmount = 0m
            });
        }

        unit.Status = InventoryStatus.Booked;

        var audit = new AuditLog
        {
            EntityName = nameof(Booking),
            EntityId = booking.Id.ToString(),
            Action = "BookingCreated",
            NewValuesJson = $"AgreedPrice={agreedPrice};ScheduleItemsCount={calculatedItems.Count}",
            Reason = $"Customer confirmed booking for Unit {unit.UnitNumber}.",
            ActorUserId = customerId
        };

        _context.Bookings.Add(booking);
        _context.AuditLogs.Add(audit);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Concurrency conflict occurred while creating booking. Please try again." });
        }

        return CreatedAtAction(nameof(GetBookingById), new { id = booking.Id }, new
        {
            booking.Id,
            UnitNumber = unit.UnitNumber,
            ProjectName = unit.Project?.Name,
            booking.TotalAgreedPrice,
            booking.Currency,
            Status = booking.Status.ToString(),
            booking.BookedAtUtc,
            ScheduleItemsCount = booking.ScheduleItems.Count,
            BookingAmountDue = booking.ScheduleItems.FirstOrDefault(s => s.SequenceNumber == 1)?.Amount ?? 0m
        });
    }

    [HttpGet("developer")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperBookings(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectQuery = _context.Projects.Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new { p.Id, p.Name, p.Slug, p.City, p.Area })
            .ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var query = _context.Bookings
            .Include(b => b.InventoryUnit)!.ThenInclude(u => u!.Project)
            .Include(b => b.Customer)
            .Include(b => b.ScheduleItems)
            .Where(b =>
                !b.IsDeleted &&
                b.InventoryUnit != null &&
                projectIds.Contains(b.InventoryUnit.ProjectId));

        if (projectId.HasValue)
            query = query.Where(b => b.InventoryUnit!.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<BookingStatus>(status, ignoreCase: true, out var statusEnum))
        {
            query = query.Where(b => b.Status == statusEnum);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(b =>
                (b.InventoryUnit != null && b.InventoryUnit.UnitNumber.ToLower().Contains(q)) ||
                (b.Customer != null && b.Customer.FullName.ToLower().Contains(q)) ||
                (b.Customer != null && b.Customer.Email.ToLower().Contains(q)) ||
                (b.InventoryUnit != null && b.InventoryUnit.Project != null &&
                 b.InventoryUnit.Project.Name.ToLower().Contains(q)));
        }

        var bookings = await query.OrderByDescending(b => b.BookedAtUtc).ToListAsync();

        var firmBookings = await _context.Bookings
            .Include(b => b.ScheduleItems)
            .Include(b => b.InventoryUnit)
            .Where(b =>
                !b.IsDeleted &&
                b.InventoryUnit != null &&
                projectIds.Contains(b.InventoryUnit.ProjectId))
            .ToListAsync();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber
            },
            Summary = new
            {
                TotalBookings = firmBookings.Count,
                PendingCount = firmBookings.Count(b => b.Status == BookingStatus.Pending),
                ConfirmedCount = firmBookings.Count(b => b.Status == BookingStatus.Confirmed),
                CompletedCount = firmBookings.Count(b => b.Status == BookingStatus.Completed),
                CancelledCount = firmBookings.Count(b => b.Status == BookingStatus.Cancelled),
                TotalAgreedValue = firmBookings.Sum(b => b.TotalAgreedPrice),
                TotalCollected = firmBookings.SelectMany(b => b.ScheduleItems.Where(s => !s.IsDeleted)).Sum(s => s.PaidAmount),
                PendingDue = firmBookings
                    .SelectMany(b => b.ScheduleItems.Where(s => !s.IsDeleted))
                    .Where(s => s.Status is InstallmentStatus.Due or InstallmentStatus.Overdue or InstallmentStatus.PartiallyPaid)
                    .Sum(s => s.Amount - s.PaidAmount),
                FilteredCount = bookings.Count
            },
            Projects = projects,
            Bookings = bookings.Select(b =>
            {
                var items = b.ScheduleItems.Where(s => !s.IsDeleted).ToList();
                var paid = items.Sum(s => s.PaidAmount);
                var next = items
                    .Where(s => s.Status != InstallmentStatus.Paid &&
                                s.Status != InstallmentStatus.Waived &&
                                s.Status != InstallmentStatus.Cancelled)
                    .OrderBy(s => s.DueDate)
                    .FirstOrDefault();
                var pendingProofs = items.Count(s =>
                    !string.IsNullOrWhiteSpace(s.PaymentProofStorageKey) &&
                    s.Status != InstallmentStatus.Paid);

                return new
                {
                    b.Id,
                    UnitId = b.InventoryUnitId,
                    UnitNumber = b.InventoryUnit?.UnitNumber ?? "N/A",
                    UnitType = b.InventoryUnit?.UnitType ?? "N/A",
                    ProjectId = b.InventoryUnit?.ProjectId,
                    ProjectName = b.InventoryUnit?.Project?.Name ?? "N/A",
                    ProjectSlug = b.InventoryUnit?.Project?.Slug,
                    CustomerName = b.Customer?.FullName ?? "Customer",
                    CustomerEmail = b.Customer?.Email ?? "",
                    CustomerPhone = b.Customer?.PhoneNumber,
                    b.TotalAgreedPrice,
                    b.Currency,
                    Status = b.Status.ToString(),
                    b.BookedAtUtc,
                    TotalPaid = paid,
                    RemainingBalance = b.TotalAgreedPrice - paid,
                    ScheduleItemCount = items.Count,
                    PaidScheduleItemCount = items.Count(s => s.Status == InstallmentStatus.Paid),
                    PendingProofCount = pendingProofs,
                    NextPaymentDue = next == null ? null : new
                    {
                        next.Id,
                        next.Title,
                        next.DueDate,
                        next.Amount,
                        Status = next.Status.ToString()
                    }
                };
            })
        });
    }

    [HttpGet("developer/installments")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperInstallments(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? scope = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectQuery = _context.Projects.Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new { p.Id, p.Name, p.Slug, p.City, p.Area })
            .ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var itemsQuery = _context.PaymentScheduleItems
            .Include(s => s.Booking)!.ThenInclude(b => b!.InventoryUnit)!.ThenInclude(u => u!.Project)
            .Include(s => s.Booking)!.ThenInclude(b => b!.Customer)
            .Where(s =>
                !s.IsDeleted &&
                s.Booking != null &&
                !s.Booking.IsDeleted &&
                s.Booking.InventoryUnit != null &&
                projectIds.Contains(s.Booking.InventoryUnit.ProjectId));

        if (projectId.HasValue)
            itemsQuery = itemsQuery.Where(s => s.Booking!.InventoryUnit!.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(status) &&
            Enum.TryParse<InstallmentStatus>(status, ignoreCase: true, out var statusEnum))
        {
            itemsQuery = itemsQuery.Where(s => s.Status == statusEnum);
        }

        var scopeKey = (scope ?? "open").Trim().ToLowerInvariant();
        var today = DateTime.UtcNow.Date;

        itemsQuery = scopeKey switch
        {
            "pending_proof" or "proofs" => itemsQuery.Where(s =>
                s.PaymentProofStorageKey != null &&
                s.PaymentProofStorageKey != "" &&
                s.Status != InstallmentStatus.Paid),
            "due" => itemsQuery.Where(s => s.Status == InstallmentStatus.Due),
            "overdue" => itemsQuery.Where(s =>
                s.Status == InstallmentStatus.Overdue ||
                (s.Status != InstallmentStatus.Paid &&
                 s.Status != InstallmentStatus.Waived &&
                 s.Status != InstallmentStatus.Cancelled &&
                 s.DueDate.Date < today &&
                 s.PaidAmount < s.Amount)),
            "upcoming" => itemsQuery.Where(s =>
                s.Status != InstallmentStatus.Paid &&
                s.Status != InstallmentStatus.Waived &&
                s.Status != InstallmentStatus.Cancelled &&
                s.DueDate.Date >= today &&
                s.DueDate.Date <= today.AddDays(30)),
            "paid" => itemsQuery.Where(s => s.Status == InstallmentStatus.Paid),
            "all" => itemsQuery,
            _ => itemsQuery.Where(s =>
                s.Status != InstallmentStatus.Paid &&
                s.Status != InstallmentStatus.Waived &&
                s.Status != InstallmentStatus.Cancelled)
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            itemsQuery = itemsQuery.Where(s =>
                s.Title.ToLower().Contains(q) ||
                (s.Booking!.InventoryUnit != null && s.Booking.InventoryUnit.UnitNumber.ToLower().Contains(q)) ||
                (s.Booking.Customer != null && s.Booking.Customer.FullName.ToLower().Contains(q)) ||
                (s.Booking.InventoryUnit!.Project != null &&
                 s.Booking.InventoryUnit.Project.Name.ToLower().Contains(q)));
        }

        var items = await itemsQuery
            .OrderBy(s => s.DueDate)
            .ThenBy(s => s.SequenceNumber)
            .Take(300)
            .ToListAsync();

        var firmItems = await _context.PaymentScheduleItems
            .Include(s => s.Booking)!.ThenInclude(b => b!.InventoryUnit)
            .Where(s =>
                !s.IsDeleted &&
                s.Booking != null &&
                !s.Booking.IsDeleted &&
                s.Booking.InventoryUnit != null &&
                projectIds.Contains(s.Booking.InventoryUnit.ProjectId))
            .ToListAsync();

        var openItems = firmItems.Where(s =>
            s.Status != InstallmentStatus.Paid &&
            s.Status != InstallmentStatus.Waived &&
            s.Status != InstallmentStatus.Cancelled).ToList();

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber
            },
            Summary = new
            {
                TotalInstallments = firmItems.Count,
                OpenCount = openItems.Count,
                PaidCount = firmItems.Count(s => s.Status == InstallmentStatus.Paid),
                DueCount = firmItems.Count(s => s.Status == InstallmentStatus.Due),
                OverdueCount = firmItems.Count(s =>
                    s.Status == InstallmentStatus.Overdue ||
                    (s.Status != InstallmentStatus.Paid &&
                     s.Status != InstallmentStatus.Waived &&
                     s.Status != InstallmentStatus.Cancelled &&
                     s.DueDate.Date < today &&
                     s.PaidAmount < s.Amount)),
                PendingProofCount = firmItems.Count(s =>
                    !string.IsNullOrWhiteSpace(s.PaymentProofStorageKey) &&
                    s.Status != InstallmentStatus.Paid),
                TotalCollected = firmItems.Where(s => s.Status == InstallmentStatus.Paid).Sum(s => s.PaidAmount),
                OutstandingAmount = openItems.Sum(s => s.Amount - s.PaidAmount),
                FilteredCount = items.Count
            },
            Projects = projects,
            Installments = items.Select(s => new
            {
                s.Id,
                BookingId = s.BookingId,
                ScheduleItemId = s.Id,
                s.SequenceNumber,
                s.Title,
                s.DueDate,
                s.Amount,
                s.PaidAmount,
                Remaining = s.Amount - s.PaidAmount,
                s.Currency,
                Status = s.Status.ToString(),
                IsOverdue = s.Status != InstallmentStatus.Paid &&
                            s.Status != InstallmentStatus.Waived &&
                            s.Status != InstallmentStatus.Cancelled &&
                            s.DueDate.Date < today &&
                            s.PaidAmount < s.Amount,
                HasPendingProof = !string.IsNullOrWhiteSpace(s.PaymentProofStorageKey) &&
                                  s.Status != InstallmentStatus.Paid,
                ProofUrl = s.PaymentProofStorageKey,
                s.PaidAtUtc,
                s.AdjustmentReason,
                UnitNumber = s.Booking!.InventoryUnit!.UnitNumber,
                UnitType = s.Booking.InventoryUnit.UnitType,
                ProjectId = s.Booking.InventoryUnit.ProjectId,
                ProjectName = s.Booking.InventoryUnit.Project?.Name ?? "Project",
                ProjectSlug = s.Booking.InventoryUnit.Project?.Slug,
                CustomerName = s.Booking.Customer?.FullName ?? "Customer",
                CustomerPhone = s.Booking.Customer?.PhoneNumber,
                CustomerEmail = s.Booking.Customer?.Email,
                BookingStatus = s.Booking.Status.ToString()
            })
        });
    }

    [HttpGet("developer/customers")]
    [Authorize]
    public async Task<ActionResult<object>> GetDeveloperCustomers(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? compliance = null,
        [FromQuery] string? search = null)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var developerOrgId = currentUser.OrganizationId;
        if (!developerOrgId.HasValue && currentUser.Role != UserRole.SuperAdmin)
            return BadRequest(new { message = "Developer account is not linked to an organization." });

        var projectQuery = _context.Projects.Where(p => !p.IsDeleted);
        if (developerOrgId.HasValue)
            projectQuery = projectQuery.Where(p => p.DeveloperOrgId == developerOrgId.Value);

        var projects = await projectQuery
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new { p.Id, p.Name, p.Slug, p.City, p.Area })
            .ToListAsync();
        var projectIds = projects.Select(p => p.Id).ToList();

        var today = DateTime.UtcNow.Date;

        var bookings = await _context.Bookings
            .Include(b => b.InventoryUnit)!.ThenInclude(u => u!.Project)
            .Include(b => b.Customer)
            .Include(b => b.ScheduleItems)
            .Where(b =>
                !b.IsDeleted &&
                b.InventoryUnit != null &&
                projectIds.Contains(b.InventoryUnit.ProjectId) &&
                b.Status != BookingStatus.Cancelled)
            .AsNoTracking()
            .ToListAsync();

        if (projectId.HasValue)
            bookings = bookings.Where(b => b.InventoryUnit!.ProjectId == projectId.Value).ToList();

        var customerGroups = bookings
            .Where(b => b.Customer != null)
            .GroupBy(b => b.CustomerId)
            .Select(g =>
            {
                var customer = g.First().Customer!;
                var customerBookings = g.OrderByDescending(b => b.BookedAtUtc).ToList();
                var allItems = customerBookings
                    .SelectMany(b => b.ScheduleItems.Where(s => !s.IsDeleted))
                    .ToList();
                var openItems = allItems.Where(s =>
                    s.Status != InstallmentStatus.Paid &&
                    s.Status != InstallmentStatus.Waived &&
                    s.Status != InstallmentStatus.Cancelled).ToList();
                var overdueCount = openItems.Count(s =>
                    s.Status == InstallmentStatus.Overdue ||
                    (s.DueDate.Date < today && s.PaidAmount < s.Amount));
                var pendingProofCount = allItems.Count(s =>
                    !string.IsNullOrWhiteSpace(s.PaymentProofStorageKey) &&
                    s.Status != InstallmentStatus.Paid);
                var totalPaid = allItems.Sum(s => s.PaidAmount);
                var totalAgreed = customerBookings.Sum(b => b.TotalAgreedPrice);
                var paidItemCount = allItems.Count(s => s.Status == InstallmentStatus.Paid);
                var complianceLabel = overdueCount > 0
                    ? "Overdue"
                    : pendingProofCount > 0
                        ? "PendingProof"
                        : openItems.Count == 0 && allItems.Count > 0
                            ? "FullyPaid"
                            : "Current";

                return new
                {
                    CustomerId = customer.Id,
                    FullName = customer.FullName,
                    Email = customer.Email,
                    Phone = customer.PhoneNumber,
                    BookingCount = customerBookings.Count,
                    ActiveBookingCount = customerBookings.Count(b =>
                        b.Status is BookingStatus.Pending or BookingStatus.Confirmed),
                    CompletedBookingCount = customerBookings.Count(b => b.Status == BookingStatus.Completed),
                    Units = customerBookings
                        .Select(b => b.InventoryUnit?.UnitNumber ?? "N/A")
                        .Distinct()
                        .ToList(),
                    Projects = customerBookings
                        .Where(b => b.InventoryUnit?.Project != null)
                        .GroupBy(b => b.InventoryUnit!.ProjectId)
                        .Select(pg => new
                        {
                            Id = pg.Key,
                            Name = pg.First().InventoryUnit!.Project!.Name,
                            Slug = pg.First().InventoryUnit!.Project!.Slug
                        })
                        .ToList(),
                    TotalAgreedValue = totalAgreed,
                    TotalCollected = totalPaid,
                    OutstandingAmount = Math.Max(0, totalAgreed - totalPaid),
                    ScheduleItemCount = allItems.Count,
                    PaidScheduleItemCount = paidItemCount,
                    OverdueInstallmentCount = overdueCount,
                    PendingProofCount = pendingProofCount,
                    Compliance = complianceLabel,
                    FirstBookedAtUtc = customerBookings.Min(b => b.BookedAtUtc),
                    LastBookedAtUtc = customerBookings.Max(b => b.BookedAtUtc),
                    Currency = customerBookings.FirstOrDefault()?.Currency ?? "PKR",
                    Bookings = customerBookings.Select(b =>
                    {
                        var items = b.ScheduleItems.Where(s => !s.IsDeleted).ToList();
                        var paid = items.Sum(s => s.PaidAmount);
                        var next = items
                            .Where(s => s.Status != InstallmentStatus.Paid &&
                                        s.Status != InstallmentStatus.Waived &&
                                        s.Status != InstallmentStatus.Cancelled)
                            .OrderBy(s => s.DueDate)
                            .FirstOrDefault();
                        return new
                        {
                            b.Id,
                            UnitNumber = b.InventoryUnit?.UnitNumber ?? "N/A",
                            UnitType = b.InventoryUnit?.UnitType ?? "N/A",
                            ProjectId = b.InventoryUnit?.ProjectId,
                            ProjectName = b.InventoryUnit?.Project?.Name ?? "Project",
                            ProjectSlug = b.InventoryUnit?.Project?.Slug,
                            b.TotalAgreedPrice,
                            b.Currency,
                            Status = b.Status.ToString(),
                            b.BookedAtUtc,
                            TotalPaid = paid,
                            RemainingBalance = b.TotalAgreedPrice - paid,
                            ScheduleItemCount = items.Count,
                            PaidScheduleItemCount = items.Count(s => s.Status == InstallmentStatus.Paid),
                            PendingProofCount = items.Count(s =>
                                !string.IsNullOrWhiteSpace(s.PaymentProofStorageKey) &&
                                s.Status != InstallmentStatus.Paid),
                            NextPaymentDue = next == null ? null : new
                            {
                                next.Id,
                                next.Title,
                                next.DueDate,
                                next.Amount,
                                Status = next.Status.ToString()
                            }
                        };
                    }).ToList()
                };
            })
            .OrderByDescending(c => c.LastBookedAtUtc)
            .ToList();

        var complianceKey = (compliance ?? "all").Trim().ToLowerInvariant();
        var filtered = complianceKey switch
        {
            "overdue" => customerGroups.Where(c => c.Compliance == "Overdue").ToList(),
            "pending_proof" or "proofs" => customerGroups.Where(c => c.PendingProofCount > 0).ToList(),
            "current" => customerGroups.Where(c => c.Compliance == "Current").ToList(),
            "fully_paid" or "paid" => customerGroups.Where(c => c.Compliance == "FullyPaid").ToList(),
            _ => customerGroups
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            filtered = filtered.Where(c =>
                c.FullName.ToLower().Contains(q) ||
                c.Email.ToLower().Contains(q) ||
                (c.Phone != null && c.Phone.ToLower().Contains(q)) ||
                c.Units.Any(u => u.ToLower().Contains(q)) ||
                c.Projects.Any(p => p.Name.ToLower().Contains(q))).ToList();
        }

        return Ok(new
        {
            Organization = new
            {
                Id = developerOrgId,
                Name = currentUser.Organization?.Name ?? "Developer Firm",
                LicenseNumber = currentUser.Organization?.LicenseNumber
            },
            Summary = new
            {
                TotalBuyers = customerGroups.Count,
                CurrentCount = customerGroups.Count(c => c.Compliance == "Current"),
                OverdueCount = customerGroups.Count(c => c.Compliance == "Overdue"),
                PendingProofBuyers = customerGroups.Count(c => c.PendingProofCount > 0),
                FullyPaidCount = customerGroups.Count(c => c.Compliance == "FullyPaid"),
                TotalAgreedValue = customerGroups.Sum(c => c.TotalAgreedValue),
                TotalCollected = customerGroups.Sum(c => c.TotalCollected),
                OutstandingAmount = customerGroups.Sum(c => c.OutstandingAmount),
                FilteredCount = filtered.Count
            },
            Projects = projects,
            Customers = filtered
        });
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetBookings([FromQuery] Guid? projectId)
    {
        var currentUserId = _currentUserService.UserId;
        var query = _context.Bookings
            .Include(b => b.InventoryUnit)
                .ThenInclude(u => u!.Project)
            .Include(b => b.Customer)
            .Include(b => b.ScheduleItems)
            .Where(b => !b.IsDeleted)
            .AsNoTracking();

        // If customer, filter to own bookings
        if (_currentUserService.UserRole == UserRole.Customer.ToString() && currentUserId.HasValue)
        {
            query = query.Where(b => b.CustomerId == currentUserId.Value);
        }
        else if (_currentUserService.UserRole == UserRole.Developer.ToString() && currentUserId.HasValue)
        {
            var orgId = await _context.Users
                .Where(u => u.Id == currentUserId.Value)
                .Select(u => u.OrganizationId)
                .FirstOrDefaultAsync();
            if (orgId.HasValue)
            {
                query = query.Where(b =>
                    b.InventoryUnit != null &&
                    b.InventoryUnit.Project != null &&
                    b.InventoryUnit.Project.DeveloperOrgId == orgId.Value);
            }
            if (projectId.HasValue)
                query = query.Where(b => b.InventoryUnit!.ProjectId == projectId.Value);
        }
        else if (projectId.HasValue)
        {
            query = query.Where(b => b.InventoryUnit!.ProjectId == projectId.Value);
        }

        var bookings = await query
            .OrderByDescending(b => b.BookedAtUtc)
            .Select(b => new
            {
                b.Id,
                UnitId = b.InventoryUnitId,
                UnitNumber = b.InventoryUnit != null ? b.InventoryUnit.UnitNumber : "N/A",
                UnitType = b.InventoryUnit != null ? b.InventoryUnit.UnitType : "N/A",
                ProjectId = b.InventoryUnit != null ? b.InventoryUnit.ProjectId : (Guid?)null,
                ProjectName = b.InventoryUnit != null && b.InventoryUnit.Project != null ? b.InventoryUnit.Project.Name : "N/A",
                CustomerName = b.Customer != null ? b.Customer.FullName : "Customer",
                CustomerEmail = b.Customer != null ? b.Customer.Email : "",
                b.TotalAgreedPrice,
                b.Currency,
                Status = b.Status.ToString(),
                b.BookedAtUtc,
                TotalPaid = b.ScheduleItems.Sum(s => s.PaidAmount),
                TotalDue = b.ScheduleItems.Where(s => s.Status == InstallmentStatus.Due || s.Status == InstallmentStatus.Overdue).Sum(s => s.Amount - s.PaidAmount),
                RemainingBalance = b.TotalAgreedPrice - b.ScheduleItems.Sum(s => s.PaidAmount),
                NextPaymentDue = b.ScheduleItems
                    .Where(s => s.Status != InstallmentStatus.Paid)
                    .OrderBy(s => s.DueDate)
                    .Select(s => new { s.Id, s.Title, s.DueDate, s.Amount, Status = s.Status.ToString() })
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(bookings);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetBookingById(Guid id)
    {
        var booking = await _context.Bookings
            .Include(b => b.InventoryUnit)
                .ThenInclude(u => u!.Project)
            .Include(b => b.Customer)
            .Include(b => b.ScheduleItems)
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted);

        if (booking == null)
            return NotFound(new { message = "Booking not found." });

        var totalPaid = booking.ScheduleItems.Sum(s => s.PaidAmount);
        var remainingBalance = booking.TotalAgreedPrice - totalPaid;

        return Ok(new
        {
            booking.Id,
            booking.TotalAgreedPrice,
            booking.Currency,
            Status = booking.Status.ToString(),
            booking.BookedAtUtc,
            TotalPaid = totalPaid,
            RemainingBalance = remainingBalance,
            Unit = booking.InventoryUnit != null ? new
            {
                booking.InventoryUnit.Id,
                booking.InventoryUnit.UnitNumber,
                booking.InventoryUnit.UnitType,
                booking.InventoryUnit.Size,
                SizeUnit = booking.InventoryUnit.SizeUnit.ToString(),
                booking.InventoryUnit.Facing,
                ProjectId = booking.InventoryUnit.ProjectId,
                ProjectName = booking.InventoryUnit.Project?.Name,
                ProjectCity = booking.InventoryUnit.Project?.City
            } : null,
            Customer = booking.Customer != null ? new
            {
                booking.Customer.Id,
                booking.Customer.FullName,
                booking.Customer.Email,
                booking.Customer.PhoneNumber
            } : null,
            ScheduleItems = booking.ScheduleItems
                .OrderBy(s => s.SequenceNumber)
                .Select(s => new
                {
                    s.Id,
                    s.SequenceNumber,
                    s.Title,
                    s.DueDate,
                    s.Amount,
                    s.Currency,
                    Status = s.Status.ToString(),
                    s.PaidAmount,
                    s.PaidAtUtc,
                    s.PaymentProofStorageKey,
                    s.AdjustmentReason
                })
        });
    }

    [HttpPost("{bookingId:guid}/schedule/{scheduleItemId:guid}/proof/upload")]
    [Authorize]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult<object>> UploadPaymentProofImage(
        Guid bookingId,
        Guid scheduleItemId,
        IFormFile file)
    {
        var userId = _currentUserService.UserId;
        if (!userId.HasValue) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Receipt image file is required." });

        if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only image uploads are supported (JPG, PNG, WEBP)." });

        var scheduleItem = await _context.PaymentScheduleItems
            .Include(s => s.Booking)
            .FirstOrDefaultAsync(s => s.Id == scheduleItemId && s.BookingId == bookingId && !s.IsDeleted);

        if (scheduleItem?.Booking == null)
            return NotFound(new { message = "Schedule item not found for this booking." });

        var role = _currentUserService.UserRole;
        var isOwner = scheduleItem.Booking.CustomerId == userId.Value;
        var isStaff = role is "Developer" or "SuperAdmin" or "Finance";
        if (!isOwner && !isStaff)
            return Forbid();

        await using var stream = file.OpenReadStream();
        var storageKey = await _fileStorage.UploadFileAsync(
            file.FileName,
            stream,
            file.ContentType,
            isPrivate: false);
        var publicUrl = $"/media-files/{storageKey.Replace('\\', '/')}";

        return Ok(new
        {
            message = "Receipt image uploaded successfully.",
            storageKey,
            url = publicUrl,
            fileName = file.FileName,
            contentType = file.ContentType,
            sizeBytes = file.Length
        });
    }

    [HttpPost("{bookingId:guid}/schedule/{scheduleItemId:guid}/proof")]
    [Authorize]
    public async Task<ActionResult<object>> SubmitPaymentProof(
        Guid bookingId,
        Guid scheduleItemId,
        [FromBody] SubmitPaymentProofDto dto)
    {
        var scheduleItem = await _context.PaymentScheduleItems
            .Include(s => s.Booking)
            .FirstOrDefaultAsync(s => s.Id == scheduleItemId && s.BookingId == bookingId && !s.IsDeleted);

        if (scheduleItem == null)
            return NotFound(new { message = "Schedule item not found for this booking." });

        var userId = _currentUserService.UserId;
        if (userId.HasValue && scheduleItem.Booking != null)
        {
            var role = _currentUserService.UserRole;
            var isOwner = scheduleItem.Booking.CustomerId == userId.Value;
            var isStaff = role is "Developer" or "SuperAdmin" or "Finance";
            if (!isOwner && !isStaff)
                return Forbid();
        }

        if (string.IsNullOrWhiteSpace(dto.PaymentProofStorageKey))
            return BadRequest(new { message = "Payment proof image (storage key or URL) is required." });

        scheduleItem.PaymentProofStorageKey = dto.PaymentProofStorageKey;
        scheduleItem.AdjustmentReason = $"Proof submitted: TxRef={dto.TransactionReference ?? "N/A"}. Note={dto.Notes ?? ""}";
        scheduleItem.Status = InstallmentStatus.Due; // Awaiting developer verification

        var audit = new AuditLog
        {
            EntityName = nameof(PaymentScheduleItem),
            EntityId = scheduleItem.Id.ToString(),
            Action = "PaymentProofSubmitted",
            NewValuesJson = $"ProofKey={dto.PaymentProofStorageKey};TxRef={dto.TransactionReference};Amount={dto.AmountPaid}",
            Reason = dto.Notes ?? "Payment receipt submitted by customer.",
            ActorUserId = _currentUserService.UserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Payment receipt submitted successfully and is pending developer verification.",
            scheduleItemId = scheduleItem.Id,
            proofKey = scheduleItem.PaymentProofStorageKey,
            status = scheduleItem.Status.ToString()
        });
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize]
    public async Task<ActionResult<object>> CancelBooking(Guid id, [FromBody] UpdateBookingStatusDto? dto = null)
    {
        dto ??= new UpdateBookingStatusDto { Status = BookingStatus.Cancelled };
        dto.Status = BookingStatus.Cancelled;
        return await UpdateBookingStatus(id, dto);
    }

    [HttpPut("{id:guid}/status")]
    [Authorize]
    public async Task<ActionResult<object>> UpdateBookingStatus(Guid id, [FromBody] UpdateBookingStatusDto dto)
    {
        var currentUserId = _currentUserService.UserId;
        if (currentUserId == null) return Unauthorized();

        var currentUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == currentUserId.Value && !u.IsDeleted);
        if (currentUser == null) return Unauthorized();

        var booking = await _context.Bookings
            .Include(b => b.InventoryUnit)!.ThenInclude(u => u!.Project)
            .Include(b => b.ScheduleItems)
            .FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted);

        if (booking == null)
            return NotFound(new { message = "Booking not found." });

        var unit = booking.InventoryUnit;
        if (unit?.Project == null)
            return BadRequest(new { message = "Booking is missing inventory/project linkage." });

        if (currentUser.Role != UserRole.SuperAdmin &&
            (!currentUser.OrganizationId.HasValue ||
             unit.Project.DeveloperOrgId != currentUser.OrganizationId.Value))
            return Forbid();

        if (booking.Status == BookingStatus.Cancelled && dto.Status == BookingStatus.Cancelled)
            return BadRequest(new { message = "Booking is already cancelled." });

        if (booking.Status == BookingStatus.Completed && dto.Status != BookingStatus.Completed)
            return BadRequest(new { message = "Completed bookings cannot change status." });

        if (dto.Status == BookingStatus.Cancelled)
        {
            var hasPaid = booking.ScheduleItems.Any(s =>
                !s.IsDeleted && s.Status == InstallmentStatus.Paid && s.PaidAmount > 0);
            if (hasPaid)
                return Conflict(new
                {
                    message = "Cannot cancel a booking with verified paid installments. Reverse payments first."
                });

            booking.Status = BookingStatus.Cancelled;
            if (unit.Status is InventoryStatus.Booked or InventoryStatus.Reserved)
                unit.Status = InventoryStatus.Available;

            foreach (var item in booking.ScheduleItems.Where(s => !s.IsDeleted))
            {
                if (item.Status != InstallmentStatus.Paid)
                    item.Status = InstallmentStatus.Cancelled;
            }
        }
        else if (dto.Status == BookingStatus.Confirmed)
        {
            if (booking.Status == BookingStatus.Cancelled)
                return BadRequest(new { message = "Cancelled bookings cannot be reactivated from this screen." });
            booking.Status = BookingStatus.Confirmed;
            if (unit.Status == InventoryStatus.Available || unit.Status == InventoryStatus.Reserved)
                unit.Status = InventoryStatus.Booked;
        }
        else if (dto.Status == BookingStatus.Completed)
        {
            booking.Status = BookingStatus.Completed;
            unit.Status = InventoryStatus.Sold;
        }
        else if (dto.Status == BookingStatus.Pending)
        {
            booking.Status = BookingStatus.Pending;
        }
        else
        {
            return BadRequest(new { message = "Unsupported booking status." });
        }

        booking.UpdatedBy = currentUserId;
        booking.UpdatedAtUtc = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            EntityName = nameof(Booking),
            EntityId = booking.Id.ToString(),
            Action = "BookingStatusChanged",
            NewValuesJson = $"Status={booking.Status};UnitStatus={unit.Status}",
            Reason = dto.Reason ?? $"Booking status set to {booking.Status}.",
            ActorUserId = currentUserId
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            booking.Id,
            Status = booking.Status.ToString(),
            UnitId = unit.Id,
            UnitNumber = unit.UnitNumber,
            UnitStatus = unit.Status.ToString(),
            message = $"Booking marked {booking.Status}."
        });
    }

    [HttpPost("{bookingId:guid}/schedule/{scheduleItemId:guid}/verify")]
    public async Task<ActionResult<object>> VerifyPayment(
        Guid bookingId,
        Guid scheduleItemId,
        [FromBody] VerifyPaymentDto dto)
    {
        var scheduleItem = await _context.PaymentScheduleItems
            .Include(s => s.Booking)
                .ThenInclude(b => b!.InventoryUnit)
            .FirstOrDefaultAsync(s => s.Id == scheduleItemId && s.BookingId == bookingId && !s.IsDeleted);

        if (scheduleItem == null)
            return NotFound(new { message = "Schedule item not found." });

        var booking = scheduleItem.Booking;

        if (dto.Approve)
        {
            var amountToCredit = dto.ApprovedAmount ?? scheduleItem.Amount;
            scheduleItem.PaidAmount = amountToCredit;
            scheduleItem.PaidAtUtc = DateTime.UtcNow;
            scheduleItem.Status = InstallmentStatus.Paid;
            scheduleItem.AdjustmentReason = dto.Reason ?? "Payment verified and approved by developer.";

            // Check if all schedule items in this booking are fully paid
            var allItems = await _context.PaymentScheduleItems
                .Where(s => s.BookingId == bookingId && !s.IsDeleted)
                .ToListAsync();

            var allPaid = allItems.All(s => s.Id == scheduleItemId || s.Status == InstallmentStatus.Paid);
            if (allPaid && booking != null)
            {
                booking.Status = BookingStatus.Completed;
                if (booking.InventoryUnit != null)
                {
                    booking.InventoryUnit.Status = InventoryStatus.Sold;
                }
            }
        }
        else
        {
            scheduleItem.AdjustmentReason = $"Payment proof rejected: {dto.Reason ?? "Unverified deposit"}";
            scheduleItem.PaymentProofStorageKey = null; // Clear rejected proof
            scheduleItem.Status = InstallmentStatus.Overdue;
        }

        var audit = new AuditLog
        {
            EntityName = nameof(PaymentScheduleItem),
            EntityId = scheduleItem.Id.ToString(),
            Action = dto.Approve ? "PaymentApproved" : "PaymentRejected",
            NewValuesJson = $"Status={scheduleItem.Status};PaidAmount={scheduleItem.PaidAmount}",
            Reason = dto.Reason ?? (dto.Approve ? "Payment verified" : "Payment rejected"),
            ActorUserId = _currentUserService.UserId
        };
        _context.AuditLogs.Add(audit);

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = dto.Approve ? "Payment successfully verified." : "Payment rejected.",
            scheduleItemId = scheduleItem.Id,
            status = scheduleItem.Status.ToString(),
            paidAmount = scheduleItem.PaidAmount,
            bookingStatus = booking?.Status.ToString(),
            unitStatus = booking?.InventoryUnit?.Status.ToString()
        });
    }
}
