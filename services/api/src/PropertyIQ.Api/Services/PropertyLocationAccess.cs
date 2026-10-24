using PropertyIQ.Application.Common.Interfaces;
using PropertyIQ.Domain.Entities;
using PropertyIQ.Domain.Enums;

namespace PropertyIQ.Api.Services;

public static class PropertyLocationAccess
{
    /// <summary>
    /// Whether the viewer may receive exact latitude/longitude for this listing.
    /// </summary>
    public static bool ViewerSeesExactPin(Property property, ICurrentUserService currentUser)
    {
        if (property.Latitude == null || property.Longitude == null)
            return false;

        if (property.PrivacyLevel == LocationPrivacyLevel.Exact)
            return true;

        var userId = currentUser.UserId;
        if (!userId.HasValue)
            return false;

        if (property.OwnerOrAgentId == userId.Value)
            return true;

        var role = currentUser.UserRole ?? string.Empty;
        if (role == UserRole.SuperAdmin.ToString())
            return true;

        // Field verifiers (specialists) always see the exact pin for due diligence.
        if (role == UserRole.Specialist.ToString())
            return true;

        return false;
    }
}
