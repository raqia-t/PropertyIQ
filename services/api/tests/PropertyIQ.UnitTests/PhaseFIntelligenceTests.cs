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
    public async Task DemandGaps_IdentifiesHighDemandLowSupplySegments()
    {
        using var context = CreateInMemoryDbContext();
        var service = new IntelligenceService(context);

        var gaps = await service.GetDemandGapsAsync("Lahore");

        Assert.NotEmpty(gaps);
        var highGap = gaps.FirstOrDefault(g => g.GapLevel == "HighDemandLowSupply");
        Assert.NotNull(highGap);
        Assert.True(highGap.DemandSupplyRatio > 5.0);
        Assert.NotEmpty(highGap.RecommendedAction);
        Assert.True(highGap.MonthlySearchVolume > 1000);
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
    }

    [Fact]
    public async Task DeveloperDemandRadar_ReturnsUnitVelocityAndBudgetDistribution()
    {
        using var context = CreateInMemoryDbContext();
        var service = new IntelligenceService(context);

        var radar = await service.GetDeveloperDemandRadarAsync("Lahore");

        Assert.NotNull(radar);
        Assert.NotEmpty(radar.UnitDemandSignals);
        Assert.Contains(radar.UnitDemandSignals, u => u.DemandIndex >= 90);
        Assert.NotEmpty(radar.BudgetDistribution);
        Assert.Equal(36, radar.PreferredInstallmentDurationMonths);
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
        Assert.True(response.TotalReturnOnInvestmentPercentage > 50); // 5-year combined return
        Assert.NotNull(response.TaxImpact);
        Assert.Contains("Section 236K", response.TaxImpact.Section236KAdvanceTax);
        Assert.Contains("Section 7E", response.TaxImpact.Section7ECapitalGain);
        Assert.Contains("Estimates only", response.Disclaimer);
    }
}
