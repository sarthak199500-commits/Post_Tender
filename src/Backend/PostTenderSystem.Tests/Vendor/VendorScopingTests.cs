using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PostTenderSystem.Tests.Helpers;
using VendorService.Clients;
using VendorService.Controllers;
using VendorService.Entities;
using VendorService.Persistence;
using Xunit;

namespace PostTenderSystem.Tests.Vendor;

/// <summary>
/// GET /api/vendors returned every tenant's record to any authenticated caller, including
/// a Vendor. The frontend depended on that leak to answer "which vendor am I" — now that
/// the vendorId claim exists, the leak can close.
/// </summary>
public class VendorScopingTests
{
    private static VendorsController Build(VendorDbContext ctx) =>
        new VendorsController(ctx, Mock.Of<IIdentityClient>());

    private static (Guid mine, Guid theirs) SeedTwo(VendorDbContext ctx)
    {
        var mine = Guid.NewGuid();
        var theirs = Guid.NewGuid();
        ctx.Vendors.AddRange(
            new VendorService.Entities.Vendor { Id = mine, Name = "Mine", VendorCode = "VEND-MINE", Status = "Active" },
            new VendorService.Entities.Vendor { Id = theirs, Name = "Theirs", VendorCode = "VEND-THEM", Status = "Active" });
        ctx.SaveChanges();
        return (mine, theirs);
    }

    private static int CountOf(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return ((System.Collections.IEnumerable)ok.Value!).Cast<object>().Count();
    }

    [Fact]
    public async Task GetVendors_AsVendor_ReturnsOnlyOwnRecord()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var (mine, _) = SeedTwo(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: mine));

        Assert.Equal(1, CountOf(await controller.GetVendors(null, null)));
    }

    [Fact]
    public async Task GetVendors_AsAdmin_ReturnsAll()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        SeedTwo(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        Assert.Equal(2, CountOf(await controller.GetVendors(null, null)));
    }

    [Fact]
    public async Task GetVendors_AsPmu_ReturnsAll()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        SeedTwo(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("PMU"));

        Assert.Equal(2, CountOf(await controller.GetVendors(null, null)));
    }

    [Fact]
    public async Task GetVendors_AsVendor_CannotSearchAcrossTenants()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var (mine, _) = SeedTwo(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: mine));

        // Searching for the other tenant by name must not surface it.
        Assert.Equal(0, CountOf(await controller.GetVendors("Theirs", null)));
    }

    [Fact]
    public async Task GetVendors_AsVendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        SeedTwo(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor")); // no vendorId claim

        // Fail closed: a vendor token with no claim must not fall through to "return all".
        Assert.IsType<ForbidResult>(await controller.GetVendors(null, null));
    }
}
