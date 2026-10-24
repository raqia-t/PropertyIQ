using System;
using PropertyIQ.Domain.Common;

namespace PropertyIQ.Domain.Entities;

/// <summary>
/// Listing detail page view event for agent conversion analytics.
/// </summary>
public class PropertyView : BaseEntity
{
    public Guid PropertyId { get; set; }
    public Property? Property { get; set; }

    public Guid? ViewerUserId { get; set; }
    public User? ViewerUser { get; set; }

    /// <summary>Anonymous browser session key for light dedupe.</summary>
    public string? SessionKey { get; set; }

    public DateTime ViewedAtUtc { get; set; } = DateTime.UtcNow;
}
