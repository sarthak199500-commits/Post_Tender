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
/// POST /api/progressreports did not exist, so ProgressReporting.tsx and
/// ProgressSubmissionForm.tsx both 404'd — a vendor could never report progress.
/// </summary>
public class ProgressReportsCreateTests
{
    private static ProgressReportsController Build(ExecutionServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new ProgressReportsController(ctx, TestAudit.ForExecution());
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    [Fact]
    public async Task Create_StampsVendorIdFromClaim_IgnoringBody()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var myVendor = Guid.NewGuid();
        var controller = Build(ctx, "Vendor", myVendor);

        var result = await controller.Create(new ProgressReportsController.CreateProgressReportDto
        {
            ProjectId = Guid.NewGuid(),
            VendorId = Guid.NewGuid(),          // hostile: another vendor's id
            PhysicalPercentage = 40,
            WorkDescription = "Foundation poured"
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.ProgressReports);
        Assert.Equal(myVendor, saved.VendorId);   // claim wins, body ignored
        Assert.Equal("Submitted", saved.Status);
        Assert.Equal(40, saved.PhysicalPercentage);
    }

    [Fact]
    public async Task Create_AsNonVendor_IsRejected()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Admin", null);

        var result = await controller.Create(new ProgressReportsController.CreateProgressReportDto
        {
            ProjectId = Guid.NewGuid(), PhysicalPercentage = 10
        });

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(ctx.ProgressReports);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(140)]
    public async Task Create_RejectsPercentageOutOfRange(decimal percentage)
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Create(new ProgressReportsController.CreateProgressReportDto
        {
            ProjectId = Guid.NewGuid(), PhysicalPercentage = percentage
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.ProgressReports);
    }

    [Fact]
    public async Task Create_RequiresProjectId()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Create(new ProgressReportsController.CreateProgressReportDto
        {
            ProjectId = Guid.Empty, PhysicalPercentage = 10
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.ProgressReports);
    }

    [Fact]
    public async Task Create_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", null);   // vendor token, no claim

        var result = await controller.Create(new ProgressReportsController.CreateProgressReportDto
        {
            ProjectId = Guid.NewGuid(), PhysicalPercentage = 10
        });

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task Create_PersistsEvidenceAndGeotag()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        await controller.Create(new ProgressReportsController.CreateProgressReportDto
        {
            ProjectId = Guid.NewGuid(),
            PhysicalPercentage = 55,
            Latitude = 19.076,
            Longitude = 72.8777,
            MediaUrls = new List<string> { "/uploads/a.jpg", "/uploads/b.jpg" }
        });

        var saved = ctx.ProgressReports.Single();
        Assert.Equal(19.076, saved.Latitude);
        Assert.Equal(72.8777, saved.Longitude);
        Assert.Equal(2, saved.MediaUrls.Count);
    }
}
