using System;
using System.Linq;
using System.Threading.Tasks;
using IdentityService.Contracts;
using IdentityService.Controllers;
using IdentityService.Entities;
using IdentityService.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Identity;

public class RegisterEndpointTests
{
    // Register does not read Jwt:Key, so an empty configuration is enough to satisfy
    // the AuthController(IdentityDbContext, IConfiguration) constructor.
    private static AuthController Build(IdentityDbContext ctx)
    {
        var controller = new AuthController(ctx, new ConfigurationBuilder().Build());
        FakeUser.Attach(controller, FakeUser.With("Admin"));
        return controller;
    }

    [Fact]
    public async Task Register_CreatesVendorUser_LinkedToVendorId()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        var controller = Build(ctx);
        var vendorId = Guid.NewGuid();

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Acme Contracting",
            Email = "acme@vendor.local",
            Password = "Acme@12345",
            Role = "Vendor",
            VendorId = vendorId
        });

        Assert.IsType<OkObjectResult>(result);
        var user = Assert.Single(ctx.Users);
        Assert.Equal(Role.Vendor, user.Role);
        Assert.Equal(vendorId, user.VendorId);
        Assert.NotEqual("Acme@12345", user.PasswordHash);
    }

    [Fact]
    public async Task Register_RejectsDuplicateEmail()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        ctx.Users.Add(new User { Email = "dupe@vendor.local", Role = Role.Vendor });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Dupe", Email = "dupe@vendor.local", Password = "Xx@123456", Role = "Vendor"
        });

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Single(ctx.Users);
    }

    [Fact]
    public async Task Register_NormalisesEmailToLowercase()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        var controller = Build(ctx);

        await controller.Register(new RegisterRequest
        {
            Name = "Mixed Case", Email = "  Acme@Vendor.LOCAL  ", Password = "Acme@12345", Role = "Vendor"
        });

        Assert.Equal("acme@vendor.local", ctx.Users.Single().Email);
    }

    [Fact]
    public async Task Register_RejectsShortPassword()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        var controller = Build(ctx);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Weak", Email = "weak@vendor.local", Password = "short", Role = "Vendor"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Users);
    }

    [Fact]
    public async Task Register_RejectsUnknownRole()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        var controller = Build(ctx);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Nobody", Email = "nobody@vendor.local", Password = "Valid@12345", Role = "Wizard"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Users);
    }

    [Fact]
    public async Task Register_NonVendorRole_DoesNotStoreVendorId()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        var controller = Build(ctx);

        await controller.Register(new RegisterRequest
        {
            Name = "Fin Officer",
            Email = "fin@posttender.local",
            Password = "Valid@12345",
            Role = "Finance",
            VendorId = Guid.NewGuid()   // must be ignored for a non-vendor role
        });

        var user = ctx.Users.Single();
        Assert.Equal(Role.Finance, user.Role);
        Assert.Null(user.VendorId);
    }
}
