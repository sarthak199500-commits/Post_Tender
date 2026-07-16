using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using IdentityService.Entities;
using Xunit;

namespace PostTenderSystem.Tests.Identity;

public class LoginClaimTests
{
    [Fact]
    public void Login_VendorUser_TokenCarriesVendorIdClaim()
    {
        var vendorId = Guid.NewGuid();
        var token = TokenProbe.Issue(new User
        {
            Id = Guid.NewGuid(),
            Name = "Demo Vendor",
            Email = "vendor@posttender.local",
            Role = Role.Vendor,
            VendorId = vendorId
        });

        var claim = new JwtSecurityTokenHandler()
            .ReadJwtToken(token)
            .Claims.FirstOrDefault(c => c.Type == "vendorId");

        Assert.NotNull(claim);
        Assert.Equal(vendorId.ToString(), claim!.Value);
    }

    [Fact]
    public void Login_AdminUser_TokenHasNoVendorIdClaim()
    {
        var token = TokenProbe.Issue(new User
        {
            Id = Guid.NewGuid(),
            Name = "System Admin",
            Email = "admin@posttender.local",
            Role = Role.Admin
        });

        var claim = new JwtSecurityTokenHandler()
            .ReadJwtToken(token)
            .Claims.FirstOrDefault(c => c.Type == "vendorId");

        Assert.Null(claim);
    }
}
