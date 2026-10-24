using System;
using System.IO;
using System.Linq;
using System.Threading;
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
        public Guid? UserId { get; set; }
        public string? UserEmail { get; set; } = "specialist@propertyiq.pk";
        public string? UserRole { get; set; } = "Specialist";
    }

    private class FakeFileStorageService : IFileStorageService
    {
        public Task<string> UploadFileAsync(
            string fileName,
            Stream content,
            string contentType,
            bool isPrivate = false,
            CancellationToken cancellationToken = default)
            => Task.FromResult($"private/{Guid.NewGuid()}_{fileName}");

        public Task<Stream?> GetFileAsync(string storageKey, CancellationToken cancellationToken = default)
            => Task.FromResult<Stream?>(null);

        public Task DeleteFileAsync(string storageKey, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private ApplicationDbContext CreateInMemoryDbContext(FakeCurrentUserService currentUser)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options, currentUser);
    }

    private static VerificationController CreateController(
        ApplicationDbContext context,
        FakeCurrentUserService currentUser) =>
        new(context, currentUser, new FakeFileStorageService());

    [Fact]
    public async Task CreateCase_GeneratesStandardPakistanChecklistAndFee()
    {
        var currentUserService = new FakeCurrentUserService
        {
            UserRole = "Customer"
        };
        using var context = CreateInMemoryDbContext(currentUserService);

        var customer = new User
        {
            FullName = "Test Buyer",
            Email = "buyer@test.pk",
            Role = UserRole.Customer,
            PasswordHash = "x"
        };
        context.Users.Add(customer);
        await context.SaveChangesAsync();
        currentUserService.UserId = customer.Id;

        var controller = CreateController(context, currentUserService);

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
            CustomerNotes = "Need full title chain check before paying token deposit.",
            AcknowledgeFee = true
        };

        var result = await controller.CreateCase(requestDto);

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.NotNull(createdResult.Value);

        var vCase = await context.VerificationCases
            .Include(c => c.ChecklistItems)
            .FirstOrDefaultAsync(c => c.PropertyId == property.Id);

        Assert.NotNull(vCase);
        Assert.Equal(60000m, vCase.Fee);
        Assert.Equal(VerificationCaseStatus.Requested, vCase.Status);
        Assert.True(vCase.IsPaid);
        Assert.True(vCase.ChecklistItems.Count >= 7);

        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "Identity");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "OwnershipEvidence");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "MutationTransfer");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "SocietyApproval");
        Assert.Contains(vCase.ChecklistItems, ci => ci.Category == "SiteVisit");
    }

    [Fact]
    public async Task AssignSpecialist_TransitionsStatusToAssigned()
    {
        var currentUserService = new FakeCurrentUserService();
        using var context = CreateInMemoryDbContext(currentUserService);

        var specialist = new User
        {
            FullName = "Zahid Hussain (PLRA Specialist)",
            Email = "zahid@propertyiq.pk",
            Role = UserRole.Specialist,
            PasswordHash = "x"
        };
        context.Users.Add(specialist);
        await context.SaveChangesAsync();
        currentUserService.UserId = specialist.Id;

        var vCase = new VerificationCase
        {
            ServiceLevel = VerificationLevel.RecordCheck,
            Fee = 35000m,
            Status = VerificationCaseStatus.Requested,
            IsPaid = true,
            PaidAtUtc = DateTime.UtcNow,
            CustomerId = specialist.Id
        };
        context.VerificationCases.Add(vCase);
        await context.SaveChangesAsync();

        var controller = CreateController(context, currentUserService);
        var result = await controller.AssignSpecialist(vCase.Id, new AssignSpecialistDto
        {
            SpecialistId = specialist.Id,
            AssignmentNotes = "Assigned for PLRA Lahore revenue record search"
        });

        Assert.IsType<OkObjectResult>(result.Result);

        var updatedCase = await context.VerificationCases.FindAsync(vCase.Id);
        Assert.NotNull(updatedCase);
        Assert.Equal(specialist.Id, updatedCase.AssignedSpecialistId);
        Assert.Equal(VerificationCaseStatus.Assigned, updatedCase.Status);
        Assert.NotNull(updatedCase.AssignedAtUtc);
    }

    [Fact]
    public async Task UpdateChecklistItem_And_GenerateReport_PublishesImmutableReportAndVerifiesProperty()
    {
        var currentUserService = new FakeCurrentUserService();
        using var context = CreateInMemoryDbContext(currentUserService);

        var specialist = new User
        {
            FullName = "Specialist",
            Email = "specialist@propertyiq.pk",
            Role = UserRole.Specialist,
            PasswordHash = "x"
        };
        context.Users.Add(specialist);
        await context.SaveChangesAsync();
        currentUserService.UserId = specialist.Id;

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
            Status = VerificationCaseStatus.Assigned,
            AssignedSpecialistId = specialist.Id,
            IsPaid = true,
            PaidAtUtc = DateTime.UtcNow,
            CustomerId = specialist.Id
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

        var controller = CreateController(context, currentUserService);

        var updateResult = await controller.UpdateChecklistItem(vCase.Id, checkItem.Id, new UpdateChecklistItemDto
        {
            Result = ChecklistResult.Pass,
            Notes = "Site visit conducted. 40ft carpeted road present. Clear physical boundaries."
        });
        Assert.IsType<OkObjectResult>(updateResult.Result);

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

        Assert.NotNull(updatedCase.Property);
        Assert.Equal(PropertyVerificationStatus.Verified, updatedCase.Property.VerificationStatus);
    }
}
