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
/// GET /api/progressreports returned every tenant's reports to any authenticated caller.
/// ProgressReport already carries VendorId, so scoping is a filter once the claim exists.
/// </summary>
public class ProgressReportScopingTests
{
    private static ProgressReportsController Build(ExecutionServiceDbContext ctx) =>
        new ProgressReportsController(ctx, TestAudit.ForExecution());

    private static Guid SeedTwoVendorsReports(ExecutionServiceDbContext ctx)
    {
        var mine = Guid.NewGuid();
        ctx.ProgressReports.AddRange(
            new ProgressReport { VendorId = mine, ProjectId = Guid.NewGuid(), WorkDescription = "Mine", PhysicalPercentage = 10 },
            new ProgressReport { VendorId = Guid.NewGuid(), ProjectId = Guid.NewGuid(), WorkDescription = "Theirs", PhysicalPercentage = 20 });
        ctx.SaveChanges();
        return mine;
    }

    private static List<ProgressReport> ReportsIn(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsAssignableFrom<IEnumerable<ProgressReport>>(ok.Value).ToList();
    }

    [Fact]
    public async Task Get_AsVendor_ReturnsOnlyOwnReports()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var mine = SeedTwoVendorsReports(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: mine));

        var reports = ReportsIn(await controller.Get());
        Assert.Single(reports);
        Assert.Equal("Mine", reports[0].WorkDescription);
    }

    [Fact]
    public async Task Get_AsDepartment_ReturnsAllReports()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        SeedTwoVendorsReports(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Department"));

        Assert.Equal(2, ReportsIn(await controller.Get()).Count);
    }

    [Fact]
    public async Task Get_AsInspector_ReturnsAllReports()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        SeedTwoVendorsReports(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Inspector"));

        // The inspector reviews everyone's work; scoping must not blind them.
        Assert.Equal(2, ReportsIn(await controller.Get()).Count);
    }

    [Fact]
    public async Task Get_AsVendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        SeedTwoVendorsReports(ctx);

        var controller = Build(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor")); // no vendorId claim

        Assert.IsType<ForbidResult>(await controller.Get());
    }
}
