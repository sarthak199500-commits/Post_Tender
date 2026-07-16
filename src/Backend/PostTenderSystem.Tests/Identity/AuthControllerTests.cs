using System;
using IdentityService.Entities;
using Xunit;

namespace PostTenderSystem.Tests.Identity;

public class UserEntityTests
{
    [Fact]
    public void User_CanCarryVendorId()
    {
        var vendorId = Guid.NewGuid();
        var user = new User { Email = "v@x.local", Role = Role.Vendor, VendorId = vendorId };

        Assert.Equal(vendorId, user.VendorId);
    }

    [Fact]
    public void User_VendorId_IsNullForNonVendorRoles()
    {
        var user = new User { Email = "a@x.local", Role = Role.Admin };

        Assert.Null(user.VendorId);
    }
}
