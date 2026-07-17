using System;

namespace IdentityService.Contracts;

/// <summary>
/// Internal registration payload. VendorService calls this when an Admin/PMU creates a
/// vendor, forwarding the caller's bearer token so this endpoint can enforce its own
/// role check. VendorId is honoured only for Role.Vendor.
/// </summary>
public class RegisterRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "Vendor";
    public Guid? VendorId { get; set; }
}
