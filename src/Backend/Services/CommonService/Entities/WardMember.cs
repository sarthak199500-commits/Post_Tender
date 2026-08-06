using System;

namespace CommonService.Entities;

/// <summary>
/// The elected representative of a ward (Sabhasad / Parshad). Deliberately reference data,
/// not an account — there is no login, no role and no IdentityService provisioning. If they
/// ever need to sign in, that is a User row linked to this, not a change of shape here.
/// </summary>
public class WardMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The Ward this member represents — a Location row with LocationType == "Ward".</summary>
    public Guid WardId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
