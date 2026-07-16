using System;
using System.Collections.Generic;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace PostTenderSystem.Tests.Helpers;

/// <summary>
/// Builds the ClaimsPrincipal a controller sees, mirroring the claims AuthController
/// actually mints: NameIdentifier, Role, and (for vendor logins) vendorId.
/// </summary>
public static class FakeUser
{
    public static ClaimsPrincipal With(string role, Guid? userId = null, Guid? vendorId = null, string? name = null)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Role, role),
            new Claim(ClaimTypes.NameIdentifier, (userId ?? Guid.NewGuid()).ToString()),
            new Claim("Name", name ?? $"Test {role}")
        };

        if (vendorId.HasValue)
            claims.Add(new Claim("vendorId", vendorId.Value.ToString()));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    public static void Attach(ControllerBase controller, ClaimsPrincipal principal)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }
}
