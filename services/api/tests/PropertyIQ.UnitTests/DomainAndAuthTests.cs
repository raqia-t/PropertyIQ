using System;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;
using Xunit;

namespace PropertyIQ.UnitTests;

public class DomainAndAuthTests
{
    [Fact]
    public void Property_DefaultCurrency_ShouldBePKR()
    {
        var property = new Property
        {
            Title = "5 Marla House in Lahore",
            Price = 25000000m
        };

        Assert.Equal("PKR", property.Currency);
        Assert.Equal(ListingStatus.Draft, property.Status);
        Assert.Equal(PropertyVerificationStatus.Unverified, property.VerificationStatus);
    }

    [Fact]
    public void InventoryUnit_DefaultStatus_ShouldBeAvailable()
    {
        var unit = new InventoryUnit
        {
            UnitNumber = "Plot-55",
            BasePrice = 8500000m,
            Size = 5,
            SizeUnit = LandAreaUnit.Marla
        };

        Assert.Equal(InventoryStatus.Available, unit.Status);
        Assert.Equal("PKR", unit.Currency);
    }

    [Fact]
    public void PasswordHashing_ShouldVerifyCorrectly()
    {
        var rawPassword = "StrongSecretPassword@2026";
        var hash = BCrypt.Net.BCrypt.HashPassword(rawPassword);

        Assert.True(BCrypt.Net.BCrypt.Verify(rawPassword, hash));
        Assert.False(BCrypt.Net.BCrypt.Verify("WrongPassword", hash));
    }

    [Fact]
    public void VerificationCase_DefaultSLA_ShouldBe48Hours()
    {
        var vCase = new VerificationCase
        {
            ServiceLevel = VerificationLevel.BasicDocumentReview,
            Fee = 15000m
        };

        Assert.Equal(48, vCase.SLAHours);
        Assert.Equal(VerificationCaseStatus.Requested, vCase.Status);
        Assert.Equal("PKR", vCase.Currency);
    }
}
