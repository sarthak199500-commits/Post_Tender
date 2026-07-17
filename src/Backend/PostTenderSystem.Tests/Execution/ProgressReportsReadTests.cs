using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ExecutionService.Controllers;
using ExecutionService.Entities;
using ExecutionService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Execution;

/// <summary>
/// GET /progressreports/my and /progressreports/project/{id} did not exist, so
/// ProgressHistory.tsx, ProgressReporting.tsx and MilestoneSubmissionPage.tsx all failed.
/// </summary>
public class ProgressReportsReadTests
{
    private static ProgressReportsController Build(ExecutionServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new ProgressReportsController(ctx, TestAudit.ForExecution());
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    private static List<ProgressReport> ReportsIn(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsAssignableFrom<IEnumerable<ProgressReport>>(ok.Value).ToList();
    }

    [Fact]
    public async Task Mine_ReturnsOnlyCallersReports()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var mine = Guid.NewGuid();
        ctx.ProgressReports.AddRange(
            new ProgressReport { VendorId = mine, ProjectId = Guid.NewGuid(), WorkDescription = "A" },
            new ProgressReport { VendorId = mine, ProjectId = Guid.NewGuid(), WorkDescription = "B" },
            new ProgressReport { VendorId = Guid.NewGuid(), ProjectId = Guid.NewGuid(), WorkDescription = "Theirs" });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx, "Vendor", mine);

        var reports = ReportsIn(await controller.Mine());
        Assert.Equal(2, reports.Count);
        Assert.DoesNotContain(reports, r => r.WorkDescription == "Theirs");
    }

    [Fact]
    public async Task Mine_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", null);

        Assert.IsType<ForbidResult>(await controller.Mine());
    }

    [Fact]
    public async Task ByProject_AsVendor_ScopesToOwnReportsWithinThatProject()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var mine = Guid.NewGuid();
        var project = Guid.NewGuid();
        ctx.ProgressReports.AddRange(
            new ProgressReport { VendorId = mine, ProjectId = project, WorkDescription = "Mine/this" },
            new ProgressReport { VendorId = mine, ProjectId = Guid.NewGuid(), WorkDescription = "Mine/other" },
            new ProgressReport { VendorId = Guid.NewGuid(), ProjectId = project, WorkDescription = "Theirs/this" });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx, "Vendor", mine);

        var reports = ReportsIn(await controller.ByProject(project));
        var only = Assert.Single(reports);
        Assert.Equal("Mine/this", only.WorkDescription);
    }

    [Fact]
    public async Task ByProject_AsDepartment_ReturnsAllVendorsReportsForThatProject()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var project = Guid.NewGuid();
        ctx.ProgressReports.AddRange(
            new ProgressReport { VendorId = Guid.NewGuid(), ProjectId = project, WorkDescription = "V1" },
            new ProgressReport { VendorId = Guid.NewGuid(), ProjectId = project, WorkDescription = "V2" },
            new ProgressReport { VendorId = Guid.NewGuid(), ProjectId = Guid.NewGuid(), WorkDescription = "Elsewhere" });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx, "Department", null);

        Assert.Equal(2, ReportsIn(await controller.ByProject(project)).Count);
    }
}
