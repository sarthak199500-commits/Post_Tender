using System;
using System.Security.Claims;

namespace InspectionService.Security;

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

    /// <summary>
    /// The caller's own user id. Inspectors are users rather than tenants, so their work
    /// is scoped on this rather than on the vendorId claim.
    /// </summary>
    public static Guid? UserId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}
