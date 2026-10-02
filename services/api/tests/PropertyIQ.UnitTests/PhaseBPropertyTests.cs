using System;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;
using Xunit;

namespace PropertyIQ.UnitTests;

public class PhaseBPropertyTests
{
    [Fact]
    public void Inquiry_InitialState_ShouldBeNew()
    {
        var inquiry = new Inquiry
        {
            ContactName = "Ahmed Khan",
            ContactEmail = "ahmed.khan@gmail.com",
            ContactPhone = "+923001122334",
            Message = "I am interested in this 1 Kanal house in DHA Phase 6. Can I visit this Saturday?"
        };

        Assert.Equal(InquiryStatus.New, inquiry.Status);
        Assert.NotNull(inquiry.ContactName);
        Assert.False(inquiry.IsDeleted);
    }

    [Fact]
    public void SavedProperty_Creation_ShouldHoldUserAndPropertyIds()
    {
        var userId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();

        var saved = new SavedProperty
        {
            UserId = userId,
            PropertyId = propertyId
        };

        Assert.Equal(userId, saved.UserId);
        Assert.Equal(propertyId, saved.PropertyId);
    }

    [Fact]
    public void Property_UpdatePriceAndStatus_ShouldReflectChanges()
    {
        var property = new Property
        {
            Title = "Original Title",
            Price = 50000000m,
            Status = ListingStatus.Draft
        };

        property.Price = 48000000m;
        property.Status = ListingStatus.Published;

        Assert.Equal(48000000m, property.Price);
        Assert.Equal(ListingStatus.Published, property.Status);
    }
}
