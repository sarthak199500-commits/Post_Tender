using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CommonService.Controllers;
using CommonService.Entities;
using CommonService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Common;

public class WardMembersTests
{
    private static WardMembersController Build(CommonServiceDbContext ctx, string role = "Admin")
    {
        var controller = new WardMembersController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    private static Guid SeedWard(CommonServiceDbContext ctx, string code = "NN-LKO-W001")
    {
        var ward = new Location { Name = "Ward 1", Code = code, LocationType = "Ward" };
        ctx.Locations.Add(ward);
        ctx.SaveChanges();
        return ward.Id;
    }

    [Fact]
    public async Task Post_CreatesMember()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var wardId = SeedWard(ctx);

        var result = await Build(ctx).Post(new WardMembersController.WardMemberDto
        {
            WardId = wardId, Name = "R. Sharma", Designation = "Sabhasad", Phone = "9999999999"
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.WardMembers);
        Assert.Equal("R. Sharma", saved.Name);
        Assert.Equal(wardId, saved.WardId);
        Assert.True(saved.IsActive);
    }

    [Fact]
    public async Task Post_RejectsWardThatIsNotAWard()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = new Location { Name = "Lucknow Nagar Nigam", Code = "NN-LKO", LocationType = "Ulb" };
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Post(new WardMembersController.WardMemberDto
        {
            WardId = ulb.Id, Name = "R. Sharma"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Ward", bad.Value!.ToString());
        Assert.Empty(ctx.WardMembers);
    }

    [Fact]
    public async Task Get_FiltersByWard()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var w1 = SeedWard(ctx, "NN-LKO-W001");
        var w2 = SeedWard(ctx, "NN-LKO-W002");
        ctx.WardMembers.AddRange(
            new WardMember { WardId = w1, Name = "A" },
            new WardMember { WardId = w2, Name = "B" });
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(wardId: w1);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<IEnumerable<WardMember>>(ok.Value);
        Assert.Equal("A", Assert.Single(rows).Name);
    }
}
