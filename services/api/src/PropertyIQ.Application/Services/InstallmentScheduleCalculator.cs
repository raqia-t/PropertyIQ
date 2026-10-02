using System;
using System.Collections.Generic;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Application.Services;

public class CalculatedScheduleItem
{
    public int SequenceNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public decimal Amount { get; set; }
    public decimal Percentage { get; set; }
    public InstallmentStatus Status { get; set; } = InstallmentStatus.Scheduled;
}

public class InstallmentCalculationRequest
{
    public decimal TotalPrice { get; set; }
    public int DurationMonths { get; set; } = 36;
    public PaymentFrequency Frequency { get; set; } = PaymentFrequency.Quarterly;
    public decimal BookingPercentage { get; set; } = 10m;
    public decimal DownPaymentPercentage { get; set; } = 10m;
    public decimal PossessionPercentage { get; set; } = 20m;
    public DateTime? StartDate { get; set; }
}

public interface IInstallmentScheduleCalculator
{
    List<CalculatedScheduleItem> GenerateSchedule(InstallmentCalculationRequest request);
}

public class InstallmentScheduleCalculator : IInstallmentScheduleCalculator
{
    public List<CalculatedScheduleItem> GenerateSchedule(InstallmentCalculationRequest request)
    {
        if (request.TotalPrice <= 0)
            throw new ArgumentException("Total price must be greater than zero.", nameof(request.TotalPrice));

        if (request.DurationMonths <= 0)
            throw new ArgumentException("Duration months must be greater than zero.", nameof(request.DurationMonths));

        var items = new List<CalculatedScheduleItem>();
        var startDate = request.StartDate ?? DateTime.UtcNow;

        // 1. Booking Milestone (Immediate / Due on Day 0)
        var bookingAmount = Math.Round(request.TotalPrice * (request.BookingPercentage / 100m), 2);
        items.Add(new CalculatedScheduleItem
        {
            SequenceNumber = 1,
            Title = "Booking Confirmation",
            DueDate = startDate,
            Amount = bookingAmount,
            Percentage = request.BookingPercentage,
            Status = InstallmentStatus.Due
        });

        // 2. Down Payment Milestone (Typically 30 days after booking)
        var downPaymentAmount = Math.Round(request.TotalPrice * (request.DownPaymentPercentage / 100m), 2);
        items.Add(new CalculatedScheduleItem
        {
            SequenceNumber = 2,
            Title = "Down Payment / Allocation",
            DueDate = startDate.AddDays(30),
            Amount = downPaymentAmount,
            Percentage = request.DownPaymentPercentage,
            Status = InstallmentStatus.Scheduled
        });

        // 3. Periodic Installments
        var periodicPercentage = 100m - request.BookingPercentage - request.DownPaymentPercentage - request.PossessionPercentage;
        if (periodicPercentage < 0)
            throw new ArgumentException("Sum of milestone percentages cannot exceed 100%.");

        int intervalMonths = request.Frequency switch
        {
            PaymentFrequency.Monthly => 1,
            PaymentFrequency.Quarterly => 3,
            PaymentFrequency.Biannual => 6,
            _ => 3
        };

        int numberOfInstallments = Math.Max(1, request.DurationMonths / intervalMonths);
        var totalPeriodicAmount = Math.Round(request.TotalPrice * (periodicPercentage / 100m), 2);
        var basePeriodicAmount = Math.Round(totalPeriodicAmount / numberOfInstallments, 2);
        var perInstallmentPercentage = Math.Round(periodicPercentage / numberOfInstallments, 2);

        var currentInstallmentDate = startDate.AddDays(30).AddMonths(intervalMonths);
        decimal accumulatedPeriodic = 0m;

        for (int i = 1; i <= numberOfInstallments; i++)
        {
            var isLast = (i == numberOfInstallments);
            // Adjust last installment for any fractional rounding discrepancy
            var amount = isLast ? (totalPeriodicAmount - accumulatedPeriodic) : basePeriodicAmount;
            accumulatedPeriodic += amount;

            items.Add(new CalculatedScheduleItem
            {
                SequenceNumber = items.Count + 1,
                Title = $"{request.Frequency} Installment #{i}",
                DueDate = currentInstallmentDate,
                Amount = amount,
                Percentage = perInstallmentPercentage,
                Status = InstallmentStatus.Scheduled
            });

            currentInstallmentDate = currentInstallmentDate.AddMonths(intervalMonths);
        }

        // 4. Possession Milestone
        var possessionAmount = Math.Round(request.TotalPrice * (request.PossessionPercentage / 100m), 2);
        items.Add(new CalculatedScheduleItem
        {
            SequenceNumber = items.Count + 1,
            Title = "Possession & Handover",
            DueDate = startDate.AddMonths(request.DurationMonths),
            Amount = possessionAmount,
            Percentage = request.PossessionPercentage,
            Status = InstallmentStatus.Scheduled
        });

        // Reconcile exact sum down to the cent/paisa
        var totalCalculated = 0m;
        foreach (var item in items)
            totalCalculated += item.Amount;

        var discrepancy = request.TotalPrice - totalCalculated;
        if (discrepancy != 0m && items.Count > 2)
        {
            // Adjust the last periodic installment
            items[^2].Amount += discrepancy;
        }

        return items;
    }
}
