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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
