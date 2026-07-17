using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using TenderService.Controllers;
using TenderService.Entities;
using TenderService.Persistence;
using Xunit;

namespace PostTenderSystem.Tests.Tender;

/// <summary>
/// GET /api/projects returned every tenant's projects to any caller, including a Vendor —
/// the same leak class as /vendors and /progressreports. Project has no VendorId, but it
/// has a WorkOrder navigation and WorkOrder.VendorId, both inside TenderService, so this
/// scopes without a cross-service call.
/// </summary>
public class ProjectScopingTests
{
    private static (Guid mine, Guid mineProject) Seed(TenderServiceDbContext ctx)
    {
        var mine = Guid.NewGuid();
        var theirs = Guid.NewGuid();

        var myWo = new WorkOrder { Id = Guid.NewGuid(), VendorId = mine, WorkOrderNo = "WO-MINE", TenderId = Guid.NewGuid() };
        var theirWo = new WorkOrder { Id = Guid.NewGuid(), VendorId = theirs, WorkOrderNo = "WO-THEIRS", TenderId = Guid.NewGuid() };
        ctx.WorkOrders.AddRange(myWo, theirWo);

        var myProject = new Project { Id = Guid.NewGuid(), WorkOrderId = myWo.Id, Name = "Mine" };
        ctx.Projects.AddRange(
            myProject,
            new Project { Id = Guid.NewGuid(), WorkOrderId = theirWo.Id, Name = "Theirs" });
        ctx.SaveChanges();

        return (mine, myProject.Id);
    }

    private static ProjectsController Build(TenderServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new ProjectsController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    private static List<Project> ProjectsIn(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsAssignableFrom<IEnumerable<Project>>(ok.Value).ToList();
    }

    [Fact]
    public async Task GetProjects_AsVendor_ReturnsOnlyOwnProjects()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var (mine, _) = Seed(ctx);

        var projects = ProjectsIn(await Build(ctx, "Vendor", mine).GetProjects());

        var only = Assert.Single(projects);
        Assert.Equal("Mine", only.Name);
    }

    [Fact]
    public async Task GetProjects_AsAdmin_ReturnsAll()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        Seed(ctx);

        Assert.Equal(2, ProjectsIn(await Build(ctx, "Admin", null).GetProjects()).Count);
    }

    [Fact]
    public async Task GetById_AsVendor_CannotReadAnotherTenantsProject()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        Seed(ctx);
        var theirProject = ctx.Projects.Single(p => p.Name == "Theirs");

        var result = await Build(ctx, "Vendor", Guid.NewGuid()).GetById(theirProject.Id);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetById_AsVendor_CanReadOwnProject()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var (mine, mineProject) = Seed(ctx);

        var result = await Build(ctx, "Vendor", mine).GetById(mineProject);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetProjects_AsVendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        Seed(ctx);

        Assert.IsType<ForbidResult>(await Build(ctx, "Vendor", null).GetProjects());
    }
}
