using System;
using PropertyIQ.Domain.Common;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Domain.Entities;

public class User : BaseEntity
{
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Customer;
    public Guid? OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public bool IsActive { get; set; } = true;
    public bool EmailVerified { get; set; } = false;
    public bool PhoneVerified { get; set; } = false;
    public bool IdentityVerified { get; set; } = false;
}

public class Organization : BaseEntity, IAuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public OrganizationType Type { get; set; } = OrganizationType.Agency;
    public string City { get; set; } = string.Empty;
    public string? LicenseNumber { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public bool IsVerified { get; set; } = false;
    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
