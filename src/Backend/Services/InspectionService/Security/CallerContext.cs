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
}
