using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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

    public BookingsController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IInstallmentScheduleCalculator scheduleCalculator)
    {
        _context = context;
        _currentUserService = currentUserService;
        _scheduleCalculator = scheduleCalculator;
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

    [HttpPost("{bookingId:guid}/schedule/{scheduleItemId:guid}/proof")]
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
