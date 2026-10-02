using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Api.Controllers;
using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Application.DTOs.Verification;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;
using PropertyIQ.Infrastructure.Data;
using Xunit;

namespace PropertyIQ.UnitTests;

public class PhaseEVerificationTests
{
    private class FakeCurrentUserService : ICurrentUserService
    {
        public Guid? UserId { get; set; } = Guid.NewGuid();
        public string? UserEmail { get; set; } = "specialist@propertyiq.pk";
        public string? UserRole { get; set; } = "Specialist";
    }

    private ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options, new FakeCurrentUserService());
    }

    [Fact]
    public async Task CreateCase_GeneratesStandardPakistanChecklistAndFee()
    {
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var controller = new VerificationController(context, currentUserService);

        var property = new Property
        {
            Title = "1 Kanal Designer Bungalow DHA Lahore",
            City = "Lahore",
            Area = "DHA Phase 6",
            Price = 98000000m
        };
        context.Properties.Add(property);
        await context.SaveChangesAsync();

        var requestDto = new CreateVerificationCaseDto
        {
            PropertyId = property.Id,
            ServiceLevel = VerificationLevel.EnhancedDueDiligence,
            CustomerNotes = "Need full title chain check before paying token deposit."
        };

        var result = await controller.CreateCase(requestDto);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.NotNull(createdResult.Value);

        var vCase = await context.VerificationCases
            .Include(c => c.ChecklistItems)
            .FirstOrDefaultAsync(c => c.PropertyId == property.Id);

        Assert.NotNull(vCase);
        Assert.Equal(60000m, vCase.Fee); // Fee for Enhanced Due Diligence
        Assert.Equal(VerificationCaseStatus.Requested, vCase.Status);
        Assert.True(vCase.ChecklistItems.Count >= 7);

        // Verify standard categories present
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "Identity");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "OwnershipEvidence");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "MutationTransfer");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "SocietyApproval");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "SiteVisit");
    }

    [Fact]
    public async Task AssignSpecialist_TransitionsStatusToInProgress()
    {
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var controller = new VerificationController(context, currentUserService);

        var specialist = new User
        {
            FullName = "Zahid Hussain (PLRA Specialist)",
            Email = "zahid@propertyiq.pk",
            Role = UserRole.Specialist
        };
        var vCase = new VerificationCase
        {
            ServiceLevel = VerificationLevel.RecordCheck,
            Fee = 35000m,
            Status = VerificationCaseStatus.Requested
        };
        context.Users.Add(specialist);
        context.VerificationCases.Add(vCase);
        await context.SaveChangesAsync();

        var result = await controller.AssignSpecialist(vCase.Id, new AssignSpecialistDto
        {
            SpecialistId = specialist.Id,
            AssignmentNotes = "Assigned for PLRA Lahore revenue record search"
        });

        Assert.IsType<OkObjectResult>(result.Result);

        var updatedCase = await context.VerificationCases.FindAsync(vCase.Id);
        Assert.NotNull(updatedCase);
        Assert.Equal(specialist.Id, updatedCase.AssignedSpecialistId);
        Assert.Equal(VerificationCaseStatus.InProgress, updatedCase.Status);
        Assert.NotNull(updatedCase.AssignedAtUtc);
    }

    [Fact]
    public async Task UpdateChecklistItem_And_GenerateReport_PublishesImmutableReportAndVerifiesProperty()
    {
        using var context = CreateInMemoryDbContext();
        var currentUserService = new FakeCurrentUserService();
        var controller = new VerificationController(context, currentUserService);

        var property = new Property
        {
            Title = "5 Marla Commercial Plot Gulberg Lahore",
            VerificationStatus = PropertyVerificationStatus.Unverified
        };
        var vCase = new VerificationCase
        {
            Property = property,
            ServiceLevel = VerificationLevel.PropertySiteVisit,
            Fee = 25000m,
            Status = VerificationCaseStatus.InProgress
        };
        var checkItem = new VerificationChecklistItem
        {
            Case = vCase,
            Category = "SiteVisit",
            CheckCode = "CHK-VISIT-01",
            CheckTitle = "Physical boundaries & road access",
            Result = ChecklistResult.NotChecked
        };
        context.Properties.Add(property);
        context.VerificationCases.Add(vCase);
        context.VerificationChecklistItems.Add(checkItem);
        await context.SaveChangesAsync();

        // 1. Specialist updates checklist item to Pass
        var updateResult = await controller.UpdateChecklistItem(vCase.Id, checkItem.Id, new UpdateChecklistItemDto
        {
            Result = ChecklistResult.Pass,
            Notes = "Site visit conducted. 40ft carpeted road present. Clear physical boundaries."
        });
        Assert.IsType<OkObjectResult>(updateResult.Result);

        // 2. Generate final report
        var reportResult = await controller.GenerateReport(vCase.Id, new GenerateReportDto
        {
            Summary = "Property boundaries, registry records, and LDA clearance successfully verified.",
            SpecialistNotes = "Seller possesses valid registered deed. No physical encroachments observed.",
            CustomerRecommendations = "Ensure transfer deed is executed directly at the LDA One-Window Cell."
        });
        Assert.IsType<OkObjectResult>(reportResult.Result);

        var updatedCase = await context.VerificationCases
            .Include(c => c.Reports)
            .Include(c => c.Property)
            .FirstOrDefaultAsync(c => c.Id == vCase.Id);

        Assert.NotNull(updatedCase);
        Assert.Equal(VerificationCaseStatus.Completed, updatedCase.Status);
        Assert.NotNull(updatedCase.CompletedAtUtc);
        Assert.Single(updatedCase.Reports);

        var report = updatedCase.Reports.First();
        Assert.Equal(1, report.Version);
        Assert.True(report.IsImmutable);
        Assert.Contains("does not constitute a government title certificate", report.Limitations);

        // Property status transitioned to Verified
        Assert.NotNull(updatedCase.Property);
        Assert.Equal(PropertyVerificationStatus.Verified, updatedCase.Property.VerificationStatus);
    }
}
