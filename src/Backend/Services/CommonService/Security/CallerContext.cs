using System;
using System.Security.Claims;

namespace CommonService.Security;

/// <summary>
/// Reads the caller's tenant identity from the JWT. VendorId is minted into the token at
/// login from IdentityService's User.VendorId and is present only for Vendor logins.
///
/// Deliberately duplicated per service rather than shared: these services have no common
/// package, and a three-line helper does not justify creating one.
/// </summary>
public static class CallerContext
{
    public static Guid? VendorId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("vendorId"), out var id) ? id : null;

    public static bool IsVendor(ClaimsPrincipal user) => user.IsInRole("Vendor");

    /// <summary>The acting login's own id — alerts are marked read per user.</summary>
    public static Guid? UserId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static string? Role(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.Role);
}
