using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Intelligence;
using PropertyIQ.Application.Services;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;
using PropertyIQ.Infrastructure.Data;
using Xunit;

namespace PropertyIQ.UnitTests;

public class PhaseFIntelligenceTests
{
    private class FakeCurrentUserService : ICurrentUserService
    {
        public Guid? UserId { get; set; } = Guid.NewGuid();
        public string? UserEmail { get; set; } = "agent@lahoreproperties.pk";
        public string? UserRole { get; set; } = "Agent";
    }

    private ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options, new FakeCurrentUserService());
    }

    [Fact]
    public async Task DemandGaps_FromLiveListings_IdentifiesHighInterestThinSupply()
    {
        using var context = CreateInMemoryDbContext();
        var area = "Test Thin Supply Area";
        var hot = new Property
        {
            Title = "Hot 5 Marla Plot",
            City = "Lahore",
            Area = area,
            PropertyType = PropertyType.Plot,
            LandArea = 5,
            LandAreaUnit = LandAreaUnit.Marla,
            Price = 9_500_000m,
            Status = ListingStatus.Published
        };
        context.Properties.Add(hot);
        await context.SaveChangesAsync();

        for (var i = 0; i < 12; i++)
        {
            context.PropertyViews.Add(new PropertyView
            {
                PropertyId = hot.Id,
                ViewedAtUtc = DateTime.UtcNow.AddDays(-i)
            });
        }

        for (var i = 0; i < 4; i++)
        {
            context.Inquiries.Add(new Inquiry
            {
                PropertyId = hot.Id,
                ContactName = $"Buyer {i}",
                ContactPhone = "+923001234567",
                Status = InquiryStatus.New,
                CreatedAtUtc = DateTime.UtcNow.AddDays(-i)
            });
        }

        // Flood another area so ordering is meaningful
        for (var i = 0; i < 10; i++)
        {
            context.Properties.Add(new Property
            {
                Title = $"Quiet House {i}",
                City = "Lahore",
                Area = "Quiet Oversupply Colony",
                PropertyType = PropertyType.House,
                LandArea = 10,
                LandAreaUnit = LandAreaUnit.Marla,
                Price = 25_000_000m,
                Status = ListingStatus.Published
            });
        }

        await context.SaveChangesAsync();
        var service = new IntelligenceService(context);

        var gaps = await service.GetDemandGapsAsync("Lahore");

        Assert.NotEmpty(gaps);
        Assert.All(gaps, g => Assert.Equal("live_inventory", g.SignalSource));
        Assert.Contains(gaps, g => g.Area == area && g.MonthlySearchVolume > 0);
        var thin = gaps.First(g => g.Area == area);
        Assert.True(thin.DemandSupplyRatio >= 1);
        Assert.NotEmpty(thin.RecommendedAction);
        Assert.Equal("rules", thin.RecommendationSource);
    }

    [Fact]
    public async Task DemandGaps_FromDeveloperUnits_UsesBookings()
    {
        using var context = CreateInMemoryDbContext();
        var orgId = Guid.NewGuid();
        context.Organizations.Add(new Organization
        {
            Id = orgId,
            Name = "Skyline Test Dev",
            City = "Lahore",
            Type = OrganizationType.DeveloperFirm
        });
        var project = new Project
        {
            Name = "Test Scheme",
            Slug = "test-scheme",
            City = "Lahore",
            Area = "Raiwind Road",
            DeveloperOrgId = orgId
        };
        context.Projects.Add(project);
        await context.SaveChangesAsync();

        var available = new InventoryUnit
        {
            ProjectId = project.Id,
            UnitNumber = "P-1",
            UnitType = "Plot",
            Size = 5,
            SizeUnit = LandAreaUnit.Marla,
            BasePrice = 9_000_000m,
            Status = InventoryStatus.Available
        };
        var booked = new InventoryUnit
        {
            ProjectId = project.Id,
            UnitNumber = "P-2",
            UnitType = "Plot",
            Size = 5,
            SizeUnit = LandAreaUnit.Marla,
            BasePrice = 9_200_000m,
            Status = InventoryStatus.Booked
        };
        context.InventoryUnits.AddRange(available, booked);
        await context.SaveChangesAsync();

        context.Bookings.Add(new Booking
        {
            InventoryUnitId = booked.Id,
            CustomerId = Guid.NewGuid(),
            TotalAgreedPrice = 9_200_000m,
            Status = BookingStatus.Confirmed,
            BookedAtUtc = DateTime.UtcNow.AddDays(-3)
        });
        await context.SaveChangesAsync();

        var service = new IntelligenceService(context);
        var gaps = await service.GetDemandGapsAsync("Lahore", orgId);

        Assert.NotEmpty(gaps);
        Assert.All(gaps, g => Assert.Equal("live_units", g.SignalSource));
        Assert.Contains(gaps, g => g.SizeCategory == "5 Marla" && g.BookingsCount >= 1);
        Assert.All(gaps, g => Assert.NotEmpty(g.RecommendedAction));
    }

    [Fact]
    public async Task NeighborhoodIntelligence_ReturnsPoisAndHighLivabilityScoreForDha()
    {
        using var context = CreateInMemoryDbContext();
        var service = new IntelligenceService(context);

        var intelligence = await service.GetNeighborhoodIntelligenceAsync("Lahore", "DHA Phase 6");

        Assert.NotNull(intelligence);
        Assert.True(intelligence.LivabilityScore >= 90);
        Assert.NotEmpty(intelligence.PointsOfInterest);
        Assert.Contains(intelligence.PointsOfInterest, p => p.Category == "School");
        Assert.Contains(intelligence.PointsOfInterest, p => p.Category == "Hospital");
        Assert.Contains(intelligence.PointsOfInterest, p => p.Category == "Market");
        Assert.NotEmpty(intelligence.CommuteEstimatesMinutes);
        Assert.NotEmpty(intelligence.AiSummary);
        Assert.Equal("curated_seed", intelligence.SignalSource);
        Assert.Equal("seed", intelligence.PoiSource);
    }

    [Fact]
    public async Task DeveloperDemandRadar_FromLiveUnits_BuildsVelocityAndBudget()
    {
        using var context = CreateInMemoryDbContext();
        var orgId = Guid.NewGuid();
        context.Organizations.Add(new Organization
        {
            Id = orgId,
            Name = "Radar Dev",
            City = "Lahore",
            Type = OrganizationType.DeveloperFirm
        });
        var project = new Project
        {
            Name = "Radar Scheme",
            Slug = "radar-scheme",
            City = "Lahore",
            Area = "Raiwind Road",
            DeveloperOrgId = orgId,
            ProjectType = "HousingScheme"
        };
        context.Projects.Add(project);
        await context.SaveChangesAsync();

        for (var i = 0; i < 4; i++)
        {
            context.InventoryUnits.Add(new InventoryUnit
            {
                ProjectId = project.Id,
                UnitNumber = $"A-{i}",
                UnitType = "Plot",
                Size = 5,
                SizeUnit = LandAreaUnit.Marla,
                BasePrice = 9_000_000m + i * 100_000m,
                Status = i < 2 ? InventoryStatus.Booked : InventoryStatus.Available
            });
        }

        context.InventoryUnits.Add(new InventoryUnit
        {
            ProjectId = project.Id,
            UnitNumber = "B-1",
            UnitType = "Plot",
            Size = 10,
            SizeUnit = LandAreaUnit.Marla,
            BasePrice = 18_000_000m,
            Status = InventoryStatus.Available
        });
        await context.SaveChangesAsync();

        var bookedIds = context.InventoryUnits
            .Where(u => u.Status == InventoryStatus.Booked)
            .Select(u => u.Id)
            .ToList();
        foreach (var id in bookedIds)
        {
            context.Bookings.Add(new Booking
            {
                InventoryUnitId = id,
                CustomerId = Guid.NewGuid(),
                TotalAgreedPrice = 9_100_000m,
                Status = BookingStatus.Confirmed,
                BookedAtUtc = DateTime.UtcNow.AddDays(-10)
            });
        }

        context.PaymentPlans.Add(new PaymentPlan
        {
            ProjectId = project.Id,
            Name = "3Y",
            DurationMonths = 36,
            TotalPrice = 9_000_000m
        });
        await context.SaveChangesAsync();

        var service = new IntelligenceService(context);
        var radar = await service.GetDeveloperDemandRadarAsync("Lahore", orgId);

        Assert.NotNull(radar);
        Assert.Equal("live_units", radar.SignalSource);
        Assert.True(radar.TotalUnitsAnalyzed >= 5);
        Assert.NotEmpty(radar.UnitDemandSignals);
        Assert.Contains(radar.UnitDemandSignals, u => u.UnitType.Contains("5 Marla"));
        Assert.NotEmpty(radar.BudgetDistribution);
        Assert.Equal(36, radar.PreferredInstallmentDurationMonths);
        Assert.Contains("velocity", radar.KeyTakeaway, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void AdvancedInvestment_CalculatesCompoundedGrowthAndTaxSummary()
    {
        using var context = CreateInMemoryDbContext();
        var service = new IntelligenceService(context);

        var request = new AdvancedInvestmentAnalysisRequest
        {
            PropertyPrice = 25000000m,
            EstimatedMonthlyRent = 120000m,
            AnnualAppreciationRate = 10.0,
            AnnualRentalGrowthRate = 8.0,
            HoldingPeriodYears = 5,
            City = "Lahore",
            Area = "DHA Phase 6"
        };

        var response = service.CalculateAdvancedInvestment(request);

        Assert.NotNull(response);
        Assert.Equal(5, response.Projections.Count);
        Assert.True(response.ProjectedExitValue > request.PropertyPrice);
        Assert.True(response.CumulativeRentalIncome > 0);
        Assert.True(response.TotalReturnOnInvestmentPercentage > 50);
        Assert.NotNull(response.TaxImpact);
        Assert.Contains("Section 236K", response.TaxImpact.Section236KAdvanceTax);
        Assert.Contains("Section 7E", response.TaxImpact.Section7ECapitalGain);
        Assert.Contains("Estimates only", response.Disclaimer);
    }
}
