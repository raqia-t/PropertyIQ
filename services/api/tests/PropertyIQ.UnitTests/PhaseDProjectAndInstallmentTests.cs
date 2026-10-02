using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Api.Controllers;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Projects;
using PropertyIQ.Application.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;
using PropertyIQ.Infrastructure.Data;
using Xunit;

namespace PropertyIQ.UnitTests;

public class PhaseDProjectAndInstallmentTests
{
    private class FakeCurrentUserService : ICurrentUserService
    {
        public Guid? UserId { get; set; } = Guid.NewGuid();
        public string? UserEmail { get; set; } = "developer@skylinedev.pk";
        public string? UserRole { get; set; } = "Developer";
    }

    private ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options, new FakeCurrentUserService());
    }

    [Fact]
    public void InstallmentCalculator_GeneratesExactSumMatchingTotalPrice()
    {
        // Arrange
        var calculator = new InstallmentScheduleCalculator();
        var request = new InstallmentCalculationRequest
        {
            TotalPrice = 9534567.89m, // Non-round figure to rigorously test rounding & reconciliation
            DurationMonths = 36,
            Frequency = PaymentFrequency.Quarterly,
            BookingPercentage = 10m,
            DownPaymentPercentage = 15m,
            PossessionPercentage = 15m,
            StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        // Act
        var schedule = calculator.GenerateSchedule(request);

        // Assert
        Assert.NotEmpty(schedule);
        // Booking (1) + DownPayment (1) + 12 Quarterly Installments + Possession (1) = 15 items
        Assert.Equal(15, schedule.Count);

        var totalCalculated = schedule.Sum(s => s.Amount);
        Assert.Equal(request.TotalPrice, totalCalculated);

        // Check Milestone 1 (Booking)
        Assert.Equal("Booking Confirmation", schedule[0].Title);
        Assert.Equal(Math.Round(request.TotalPrice * 0.10m, 2), schedule[0].Amount);

        // Check Milestone 2 (Down Payment)
        Assert.Equal("Down Payment / Allocation", schedule[1].Title);
        Assert.Equal(Math.Round(request.TotalPrice * 0.15m, 2), schedule[1].Amount);

        // Check Final Milestone (Possession)
        Assert.Equal("Possession & Handover", schedule[^1].Title);
        Assert.Equal(Math.Round(request.TotalPrice * 0.15m, 2), schedule[^1].Amount);
    }

    [Fact]
    public void InstallmentCalculator_MonthlyPlan_Generates36MonthlyInstallments()
    {
        var calculator = new InstallmentScheduleCalculator();
        var request = new InstallmentCalculationRequest
        {
            TotalPrice = 12000000m,
            DurationMonths = 36,
            Frequency = PaymentFrequency.Monthly,
            BookingPercentage = 10m,
            DownPaymentPercentage = 10m,
            PossessionPercentage = 20m,
            StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };

        var schedule = calculator.GenerateSchedule(request);

        // 1 Booking + 1 Down Payment + 36 Monthly Installments + 1 Possession = 39 items
        Assert.Equal(39, schedule.Count);
        Assert.Equal(request.TotalPrice, schedule.Sum(s => s.Amount));
    }

    [Fact]
    public async Task ReserveUnit_WhenAvailable_SucceedsAndSetsStatusToReserved()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var calculator = new InstallmentScheduleCalculator();
        var controller = new BookingsController(context, currentUserService, calculator);

        var project = new Project { Name = "Skyline Meadows", Slug = "skyline-meadows" };
        context.Projects.Add(project);

        var unit = new InventoryUnit
        {
            Project = project,
            UnitNumber = "Plot-501",
            BasePrice = 8500000m,
            Status = InventoryStatus.Available
        };
        context.InventoryUnits.Add(unit);
        await context.SaveChangesAsync();

        // Act
        var result = await controller.ReserveUnit(new ReserveUnitRequestDto
        {
            UnitId = unit.Id,
            Notes = "Customer reserved online"
        });

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var updatedUnit = await context.InventoryUnits.FindAsync(unit.Id);
        Assert.NotNull(updatedUnit);
        Assert.Equal(InventoryStatus.Reserved, updatedUnit.Status);

        // Verify audit log recorded
        var audit = await context.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == unit.Id.ToString());
        Assert.NotNull(audit);
        Assert.Equal("UnitReserved", audit.Action);
    }

    [Fact]
    public async Task ReserveUnit_WhenAlreadyReserved_ReturnsConflictToPreventDoubleBooking()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var calculator = new InstallmentScheduleCalculator();
        var controller = new BookingsController(context, currentUserService, calculator);

        var project = new Project { Name = "Skyline Meadows 2", Slug = "skyline-meadows-2" };
        context.Projects.Add(project);

        var unit = new InventoryUnit
        {
            Project = project,
            UnitNumber = "Plot-502",
            BasePrice = 9000000m,
            Status = InventoryStatus.Reserved // Already reserved
        };
        context.InventoryUnits.Add(unit);
        await context.SaveChangesAsync();

        // Act
        var result = await controller.ReserveUnit(new ReserveUnitRequestDto
        {
            UnitId = unit.Id,
            Notes = "Second customer trying to reserve same unit"
        });

        // Assert: MUST return 409 Conflict
        var conflictResult = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(409, conflictResult.StatusCode);
    }

    [Fact]
    public async Task CreateBooking_GeneratesScheduleAndTransitionsUnitToBooked()
    {
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var calculator = new InstallmentScheduleCalculator();
        var controller = new BookingsController(context, currentUserService, calculator);

        var project = new Project { Name = "DHA Commercial Mall", Slug = "dha-commercial-mall" };
        var unit = new InventoryUnit
        {
            Project = project,
            UnitNumber = "Shop-G01",
            BasePrice = 15000000m,
            Status = InventoryStatus.Available
        };
        context.Projects.Add(project);
        context.InventoryUnits.Add(unit);
        await context.SaveChangesAsync();

        var bookingRequest = new CreateBookingRequestDto
        {
            UnitId = unit.Id,
            TotalAgreedPrice = 15000000m,
            DurationMonths = 24,
            Frequency = PaymentFrequency.Quarterly,
            BookingPercentage = 15m,
            DownPaymentPercentage = 15m,
            PossessionPercentage = 20m
        };

        var result = await controller.CreateBooking(bookingRequest);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.NotNull(createdResult.Value);

        var updatedUnit = await context.InventoryUnits.FindAsync(unit.Id);
        Assert.NotNull(updatedUnit);
        Assert.Equal(InventoryStatus.Booked, updatedUnit.Status);

        var booking = await context.Bookings.Include(b => b.ScheduleItems).FirstOrDefaultAsync(b => b.InventoryUnitId == unit.Id);
        Assert.NotNull(booking);
        Assert.Equal(15000000m, booking.TotalAgreedPrice);
        Assert.NotEmpty(booking.ScheduleItems);
        Assert.Equal(15000000m, booking.ScheduleItems.Sum(s => s.Amount));
    }

    [Fact]
    public async Task PaymentVerificationFlow_UpdatesPaidAmountAndCompletesBookingWhenFullyPaid()
    {
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var calculator = new InstallmentScheduleCalculator();
        var controller = new BookingsController(context, currentUserService, calculator);

        var unit = new InventoryUnit
        {
            UnitNumber = "Plot-101",
            BasePrice = 5000000m,
            Status = InventoryStatus.Booked
        };
        var booking = new Booking
        {
            InventoryUnit = unit,
            TotalAgreedPrice = 5000000m,
            Status = BookingStatus.Confirmed
        };
        var scheduleItem = new PaymentScheduleItem
        {
            Booking = booking,
            SequenceNumber = 1,
            Title = "Booking Amount",
            Amount = 5000000m, // Single payment for simplicity
            Status = InstallmentStatus.Due
        };

        context.InventoryUnits.Add(unit);
        context.Bookings.Add(booking);
        context.PaymentScheduleItems.Add(scheduleItem);
        await context.SaveChangesAsync();

        // 1. Customer submits proof
        var proofResult = await controller.SubmitPaymentProof(booking.Id, scheduleItem.Id, new SubmitPaymentProofDto
        {
            PaymentProofStorageKey = "receipts/hbl_deposit_0099.jpg",
            TransactionReference = "HBL-PK-982348",
            AmountPaid = 5000000m,
            Notes = "Online bank transfer completed."
        });

        Assert.IsType<OkObjectResult>(proofResult.Result);

        // 2. Developer verifies and approves payment
        var verifyResult = await controller.VerifyPayment(booking.Id, scheduleItem.Id, new VerifyPaymentDto
        {
            Approve = true,
            ApprovedAmount = 5000000m,
            Reason = "Bank statement deposit confirmed"
        });

        Assert.IsType<OkObjectResult>(verifyResult.Result);

        var updatedItem = await context.PaymentScheduleItems.FindAsync(scheduleItem.Id);
        Assert.NotNull(updatedItem);
        Assert.Equal(InstallmentStatus.Paid, updatedItem.Status);
        Assert.Equal(5000000m, updatedItem.PaidAmount);

        // Since all items are paid, booking is Completed and Unit is Sold
        var updatedBooking = await context.Bookings.FindAsync(booking.Id);
        Assert.NotNull(updatedBooking);
        Assert.Equal(BookingStatus.Completed, updatedBooking.Status);

        var updatedUnit = await context.InventoryUnits.FindAsync(unit.Id);
        Assert.NotNull(updatedUnit);
        Assert.Equal(InventoryStatus.Sold, updatedUnit.Status);
    }
}
