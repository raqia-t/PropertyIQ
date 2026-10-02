using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PropertyIQ.Domain.Entities;

namespace PropertyIQ.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<Organization> Organizations { get; }
    DbSet<Property> Properties { get; }
    DbSet<PropertyMedia> PropertyMedia { get; }
    DbSet<Project> Projects { get; }
    DbSet<ProjectPhase> ProjectPhases { get; }
    DbSet<ProjectBlock> ProjectBlocks { get; }
    DbSet<InventoryUnit> InventoryUnits { get; }
    DbSet<PaymentPlan> PaymentPlans { get; }
    DbSet<Booking> Bookings { get; }
    DbSet<PaymentScheduleItem> PaymentScheduleItems { get; }
    DbSet<VerificationCase> VerificationCases { get; }
    DbSet<VerificationChecklistItem> VerificationChecklistItems { get; }
    DbSet<VerificationEvidence> VerificationEvidences { get; }
    DbSet<VerificationReport> VerificationReports { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<Inquiry> Inquiries { get; }
    DbSet<SavedProperty> SavedProperties { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IJwtTokenGenerator
{
    string GenerateToken(User user);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? UserEmail { get; }
    string? UserRole { get; }
}

public interface IFileStorageService
{
    Task<string> UploadFileAsync(string fileName, Stream content, string contentType, bool isPrivate = false, CancellationToken cancellationToken = default);
    Task<Stream?> GetFileAsync(string storageKey, CancellationToken cancellationToken = default);
    Task DeleteFileAsync(string storageKey, CancellationToken cancellationToken = default);
}
