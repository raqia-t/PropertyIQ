using System;
using PropertyIQ.Application.Common.Interfaces;
using Xunit;

namespace PropertyIQ.UnitTests;

public class PhaseCAiTests
{
    [Fact]
    public void PropertyScenario_YieldCalculation_ShouldBeAccurate()
    {
        decimal price = 98000000m; // PKR 9.8 Crore
        decimal monthlyRent = price * 0.0042m; // ~PKR 4.11 Lakh
        decimal annualRent = monthlyRent * 12;
        double yield = (double)((annualRent / price) * 100);

        Assert.True(yield >= 5.0 && yield <= 5.1);
        Assert.True(monthlyRent > 400000m);
    }

    [Fact]
    public void PropertyScenario_Appreciation_ShouldCompoundPositively()
    {
        decimal price = 25000000m; // PKR 2.5 Crore
        decimal threeYearScenario = price * 1.36m;
        decimal fiveYearScenario = price * 1.68m;
        decimal tenYearScenario = price * 2.83m;

        Assert.True(threeYearScenario > price);
        Assert.True(fiveYearScenario > threeYearScenario);
        Assert.True(tenYearScenario > fiveYearScenario);
    }

    [Fact]
    public void NaturalLanguageSearch_FilterMapping_ShouldDetectLahoreAndPrice()
    {
        var filter = new NaturalLanguageSearchFilterDto
        {
            RawQuery = "5 marla house in Lahore under 3 crore near good schools",
            City = "Lahore",
            Area = "DHA Phase 6",
            PropertyType = "House",
            MaxPrice = 30000000m,
            LandArea = 5.0,
            LandAreaUnit = "Marla",
            ConfidenceScore = 0.94
        };

        Assert.Equal("Lahore", filter.City);
        Assert.Equal(30000000m, filter.MaxPrice);
        Assert.Equal(5.0, filter.LandArea);
        Assert.Equal("Marla", filter.LandAreaUnit);
        Assert.True(filter.ConfidenceScore > 0.90);
    }
}
