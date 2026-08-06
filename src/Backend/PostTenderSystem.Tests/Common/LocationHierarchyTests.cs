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
}
