using System;

namespace IdentityService.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public Role Role { get; set; }

    // Set only for Role.Vendor accounts. Links this login to its VendorService
    // Vendor record so login can mint a vendorId claim without a cross-service call.
    public Guid? VendorId { get; set; }

    // Set when an admin resets the password to a temporary one. Login still succeeds —
    // blocking it would leave the user unable to clear the flag — but the response carries
    // the flag so the client can route straight to the change-password screen.
    public bool MustChangePassword { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
