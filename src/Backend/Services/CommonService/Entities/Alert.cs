using System;
using System.Collections.Generic;

namespace CommonService.Entities;

/// <summary>
/// A durable notification about something that happened at a point in time.
///
/// The bell menu previously derived everything client-side by refetching live data and
/// filtering it — which works for *states* ("3 bills awaiting approval", always current)
/// but not for *events* ("your bill was returned on the 12th"). A derived feed has no
/// read/unread state, no history, and silently forgets an event the moment the underlying
/// record moves on. Persisted alerts cover the event half; the derived feed still covers
/// the state half, and the client merges the two.
/// </summary>
public class Alert
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>critical | warning | info | success — drives the icon and tint.</summary>
    public string Type { get; set; } = "info";

    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;

    // Targeting. All three null/empty means "everyone" (a broadcast).
    // Role and vendor targeting are what the publishing services use; TargetUserId exists
    // for anything addressed to one named person.
    public string? TargetRole { get; set; }
    public Guid? TargetUserId { get; set; }
    public Guid? TargetVendorId { get; set; }

    // What the alert is about, so the UI can deep-link to it.
    public string? EntityName { get; set; }
    public string? RecordId { get; set; }
    public string? Link { get; set; }

    /// <summary>Null for a system-published alert; set when a human broadcast it.</summary>
    public Guid? RaisedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<AlertRead> Reads { get; set; } = new();
}

/// <summary>
/// Marks one alert as read by one user.
///
/// Read state has to be per-user rather than a flag on the Alert itself, because a single
/// broadcast is delivered to many people — one reader dismissing it must not clear it for
/// everyone else.
/// </summary>
public class AlertRead
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AlertId { get; set; }
    // No back-reference to Alert: Alert.Reads already carries these, and a navigation the
    // other way makes System.Text.Json recurse until it throws on the cycle.
    public Guid UserId { get; set; }
    public DateTime ReadAt { get; set; } = DateTime.UtcNow;
}
