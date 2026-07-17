using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PostTenderSystem.Tests.Helpers;
using VendorService.Clients;
using VendorService.Controllers;
using VendorService.Persistence;
using Xunit;

namespace PostTenderSystem.Tests.Vendor;

public class VendorProvisioningTests
{
    private static VendorsController Build(VendorDbContext ctx, IIdentityClient identity)
    {
        var controller = new VendorsController(ctx, identity);
        FakeUser.Attach(controller, FakeUser.With("Admin"));
        return controller;
    }

    [Fact]
    public async Task AddVendor_RegistersLogin_AndLinksUserId()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var userId = Guid.NewGuid();

        var identity = new Mock<IIdentityClient>();
        identity.Setup(c => c.RegisterVendorAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(userId);

        var controller = Build(ctx, identity.Object);

        var result = await controller.AddVendor(new VendorsController.VendorDto
        {
            Name = "Acme Contracting",
            Email = "acme@vendor.local",
            Password = "Acme@12345"
        });

        Assert.IsType<OkObjectResult>(result);
        var vendor = Assert.Single(ctx.Vendors);
        Assert.Equal(userId, vendor.UserId);
        Assert.Equal("acme@vendor.local", vendor.ContactEmail);
        Assert.StartsWith("VEND-", vendor.VendorCode);
    }

    [Fact]
    public async Task AddVendor_SendsItsOwnVendorId_ToIdentity()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        Guid sentVendorId = Guid.Empty;

        var identity = new Mock<IIdentityClient>();
        identity.Setup(c => c.RegisterVendorAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .Callback<string, string, string, Guid, CancellationToken>(
                    (_, _, _, vendorId, _) => sentVendorId = vendorId)
                .ReturnsAsync(Guid.NewGuid());

        var controller = Build(ctx, identity.Object);

        await controller.AddVendor(new VendorsController.VendorDto
        {
            Name = "Acme", Email = "acme@vendor.local", Password = "Acme@12345"
        });

        // The id Identity stores as User.VendorId must be the row we actually saved,
        // otherwise the vendorId claim points at a vendor that does not exist.
        Assert.Equal(ctx.Vendors.Single().Id, sentVendorId);
    }

    [Fact]
    public async Task AddVendor_WhenRegistrationFails_SavesNoVendor()
    {
        using var ctx = TestDb.Create<VendorDbContext>();

        var identity = new Mock<IIdentityClient>();
        identity.Setup(c => c.RegisterVendorAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("duplicate email"));

        var controller = Build(ctx, identity.Object);

        var result = await controller.AddVendor(new VendorsController.VendorDto
        {
            Name = "Acme", Email = "acme@vendor.local", Password = "Acme@12345"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Vendors);
    }

    // Regression: VendorDto.CategoryId is a non-nullable Guid, so an omitted category
    // arrives as Guid.Empty. Storing that violates the FK to VendorCategories and SQLite
    // throws "FOREIGN KEY constraint failed" — but only in production. The EF InMemory
    // provider does not enforce foreign keys, so this must be asserted on the value.
    [Fact]
    public async Task AddVendor_WithNoCategory_StoresNullCategoryId()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var identity = new Mock<IIdentityClient>();
        identity.Setup(c => c.RegisterVendorAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Guid.NewGuid());

        var controller = Build(ctx, identity.Object);

        await controller.AddVendor(new VendorsController.VendorDto
        {
            Name = "No Category", Email = "nocat@vendor.local", Password = "Valid@12345"
            // CategoryId deliberately not set -> Guid.Empty
        });

        Assert.Null(ctx.Vendors.Single().CategoryId);
    }

    // The orphan guard: an unknown category must be rejected BEFORE IdentityService is
    // called, otherwise registration succeeds, the vendor save fails, and we are left with
    // a login whose vendorId claim points at a vendor row that does not exist.
    [Fact]
    public async Task AddVendor_WithUnknownCategory_IsRejectedBeforeRegistering()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var identity = new Mock<IIdentityClient>();
        var controller = Build(ctx, identity.Object);

        var result = await controller.AddVendor(new VendorsController.VendorDto
        {
            Name = "Ghost Cat", Email = "ghost@vendor.local", Password = "Valid@12345",
            CategoryId = Guid.NewGuid()   // no such category
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Vendors);
        identity.Verify(c => c.RegisterVendorAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddVendor_RequiresPassword()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var identity = new Mock<IIdentityClient>();
        var controller = Build(ctx, identity.Object);

        var result = await controller.AddVendor(new VendorsController.VendorDto
        {
            Name = "Acme", Email = "acme@vendor.local", Password = ""
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Vendors);
        identity.Verify(c => c.RegisterVendorAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
