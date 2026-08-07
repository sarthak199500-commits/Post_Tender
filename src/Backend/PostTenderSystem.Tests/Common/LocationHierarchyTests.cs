using System;
using System.Linq;
using System.Threading.Tasks;
using CommonService.Controllers;
using CommonService.Entities;
using CommonService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Common;

/// <summary>
/// The Location table was always a tree (ParentLocationId) but nothing used it, and there
/// was no way to say "this row is a Nagar Nigam". These cover the UP ULB hierarchy:
/// UlbType on the corporation row, and reading a level by parent/type.
/// </summary>
public class LocationHierarchyTests
{
    private static LocationsController Build(CommonServiceDbContext ctx, string role = "Admin")
    {
        var controller = new LocationsController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    [Fact]
    public async Task Post_PersistsUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var controller = Build(ctx);

        var result = await controller.Post(new LocationsController.LocationDto
        {
            Name = "Lucknow Nagar Nigam",
            Code = "NN-LKO",
            LocationType = "Ulb",
            UlbType = "NagarNigam"
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.Locations);
        Assert.Equal("NagarNigam", saved.UlbType);
        Assert.Equal("Ulb", saved.LocationType);
    }

    [Fact]
    public async Task Post_RejectsUnknownUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var controller = Build(ctx);

        var result = await controller.Post(new LocationsController.LocationDto
        {
            Name = "Bogus Body", Code = "X-1", LocationType = "Ulb", UlbType = "Panchayat Samiti"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("UlbType", bad.Value!.ToString());
        Assert.Empty(ctx.Locations);
    }

    private static Location Row(string name, string code, string type, Guid? parent = null, string? ulbType = null)
        => new() { Name = name, Code = code, LocationType = type, ParentLocationId = parent, UlbType = ulbType };

    [Fact]
    public async Task Get_FiltersByTypeAndUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        ctx.Locations.AddRange(
            Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam"),
            Row("Sitapur", "NPP-STP", "Ulb", ulbType: "NagarPalikaParishad"));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: "Ulb", ulbType: "NagarNigam", parentId: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal("Lucknow Nagar Nigam", Assert.Single(rows).Name);
    }

    [Fact]
    public async Task Get_FiltersByParent()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam");
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();
        ctx.Locations.AddRange(
            Row("Ward 1", "NN-LKO-W001", "Ward", ulb.Id),
            Row("Ward 2", "NN-LKO-W002", "Ward", ulb.Id),
            Row("Ward 1", "NN-KNP-W001", "Ward", Guid.NewGuid()));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: null, ulbType: null, parentId: ulb.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(2, rows.Count());
    }

    [Fact]
    public async Task Get_WithNoFilters_ReturnsEverything()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        ctx.Locations.AddRange(
            Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam"),
            Row("Ward 1", "NN-LKO-W001", "Ward", Guid.NewGuid()));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: null, ulbType: null, parentId: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(2, rows.Count());
    }

    [Fact]
    public async Task Get_OrdersWardsByCode_NotByName()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam");
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();
        // Name-order and Code-order deliberately disagree here: by Name, "Ward 10" < "Ward 2"
        // (string comparison), but by zero-padded Code, W002 < W010. Only a Code sort yields
        // the numerically sensible [Ward 2, Ward 10]; OrderBy(Name) would yield the reverse.
        ctx.Locations.AddRange(
            Row("Ward 10", "NN-LKO-W010", "Ward", ulb.Id),
            Row("Ward 2", "NN-LKO-W002", "Ward", ulb.Id));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: "Ward", ulbType: null, parentId: ulb.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(new[] { "Ward 2", "Ward 10" }, rows.Select(r => r.Name));
    }

    /// <summary>
    /// The cascade loads a ULB's children with parentId alone and no `type`, because it has to
    /// see Zones and Wards together to decide whether the Zone step applies at all. Ordering
    /// therefore has to key off each row's own LocationType, not off whether the caller
    /// happened to pass `type` — keying off the request meant every real ward dropdown
    /// rendered as Ward 1, Ward 10, Ward 100, Ward 101 while the type=Ward test above passed.
    /// </summary>
    [Fact]
    public async Task Get_ByParentOnly_StillOrdersWardsByCode()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam");
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();
        ctx.Locations.AddRange(
            Row("Ward 10", "NN-LKO-W010", "Ward", ulb.Id),
            Row("Ward 2", "NN-LKO-W002", "Ward", ulb.Id));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: null, ulbType: null, parentId: ulb.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(new[] { "Ward 2", "Ward 10" }, rows.Select(r => r.Name));
    }

    // --- Shape rules -----------------------------------------------------------------------
    // UP's three tiers do not share a shape. A Nagar Nigam (metropolitan corporation) is divided
    // into Zones and its wards sit under those Zones. A Nagar Palika Parishad (city) and a Nagar
    // Panchayat (town) have no Zones and hold their wards directly.

    /// <summary>Seeds one urban local body of the given tier and returns it.</summary>
    private static async Task<Location> SeedUlb(CommonServiceDbContext ctx, string ulbType)
    {
        var ulb = Row($"{ulbType} Body", $"C-{Guid.NewGuid().ToString("N")[..6]}", "Ulb", ulbType: ulbType);
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();
        return ulb;
    }

    [Fact]
    public async Task Zone_IsRejected_UnderANagarPalikaParishad()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = await SeedUlb(ctx, "NagarPalikaParishad");

        var result = await Build(ctx).Post(new LocationsController.LocationDto
        {
            Name = "Zone A", Code = "Z-A", LocationType = "Zone", ParentLocationId = ulb.Id
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Nagar Nigam", bad.Value!.ToString());
        Assert.Single(ctx.Locations);   // nothing created
    }

    [Fact]
    public async Task Zone_IsAccepted_UnderANagarNigam()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = await SeedUlb(ctx, "NagarNigam");

        var result = await Build(ctx).Post(new LocationsController.LocationDto
        {
            Name = "Zone 1", Code = "Z-1", LocationType = "Zone", ParentLocationId = ulb.Id
        });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Zone 1", ctx.Locations.Single(l => l.LocationType == "Zone").Name);
    }

    [Fact]
    public async Task Ward_IsRejected_DirectlyUnderANagarNigam()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = await SeedUlb(ctx, "NagarNigam");

        // The whole point of the rule: a corporation's wards belong to one of its zones.
        var result = await Build(ctx).Post(new LocationsController.LocationDto
        {
            Name = "Ward 1", Code = "W-1", LocationType = "Ward", ParentLocationId = ulb.Id
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("zone", bad.Value!.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Single(ctx.Locations);
    }

    [Theory]
    [InlineData("NagarPalikaParishad")]
    [InlineData("NagarPanchayat")]
    public async Task Ward_IsAccepted_DirectlyUnderACityOrTown(string ulbType)
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = await SeedUlb(ctx, ulbType);

        var result = await Build(ctx).Post(new LocationsController.LocationDto
        {
            Name = "Ward 1", Code = "W-1", LocationType = "Ward", ParentLocationId = ulb.Id
        });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Ward 1", ctx.Locations.Single(l => l.LocationType == "Ward").Name);
    }

    [Fact]
    public async Task Ward_IsAccepted_UnderAZone()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam");
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();
        var zone = Row("Zone 1", "NN-LKO-Z1", "Zone", ulb.Id);
        ctx.Locations.Add(zone);
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Post(new LocationsController.LocationDto
        {
            Name = "Ward 1", Code = "NN-LKO-W001", LocationType = "Ward", ParentLocationId = zone.Id
        });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(zone.Id, ctx.Locations.Single(l => l.LocationType == "Ward").ParentLocationId);
    }

    [Fact]
    public async Task Ulb_RequiresAUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();

        // Without a tier the cascade cannot place the body at all, and the shape rules above
        // have nothing to test against.
        var result = await Build(ctx).Post(new LocationsController.LocationDto
        {
            Name = "Some Body", Code = "SB-1", LocationType = "Ulb"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("UlbType", bad.Value!.ToString());
        Assert.Empty(ctx.Locations);
    }

    /// <summary>Non-ward levels stay alphabetical: the municipality dropdown is browsed by name.</summary>
    [Fact]
    public async Task Get_OrdersNonWardLevelsByName()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        ctx.Locations.AddRange(
            Row("Varanasi Nagar Nigam", "NN-VNS", "Ulb", ulbType: "NagarNigam"),
            Row("Agra Nagar Nigam", "NN-AGR", "Ulb", ulbType: "NagarNigam"));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: "Ulb", ulbType: null, parentId: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(new[] { "Agra Nagar Nigam", "Varanasi Nagar Nigam" }, rows.Select(r => r.Name));
    }
}
