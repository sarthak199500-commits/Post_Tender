using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using InspectionService.Controllers;
using InspectionService.Entities;
using InspectionService.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Inspection;

/// <summary>
/// InspectionsController was GET-only, so a vendor could neither see its defects nor submit
/// a rectification. These cover the scoped worklist and the defect-rectification write.
/// </summary>
public class InspectionsTests
{
    private static InspectionsController Build(InspectionServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new InspectionsController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    private static InspectionService.Entities.Inspection Seed(
        InspectionServiceDbContext ctx, Guid vendorId, bool withDefect = true)
    {
        var inspection = new InspectionService.Entities.Inspection
        {
            ProjectId = Guid.NewGuid(),
            VendorId = vendorId,
            InspectorId = Guid.NewGuid(),
            InspectionDate = DateTime.UtcNow,
            Status = "Follow-up Required",
            Defects = withDefect
                ? new List<InspectionDefect> { new() { Description = "Crack", Severity = "High", Status = "Open" } }
                : new List<InspectionDefect>()
        };
        ctx.Inspections.Add(inspection);
        ctx.SaveChanges();
        return inspection;
    }

    [Fact]
    public async Task ForVendor_ReturnsOnlyOwnInspectionsWithDefects()
    {
        using var ctx = TestDb.Create<InspectionServiceDbContext>();
        var mine = Guid.NewGuid();
        Seed(ctx, mine);
        Seed(ctx, Guid.NewGuid());          // another vendor
        Seed(ctx, mine, withDefect: false); // mine but no defects -> excluded

        var ok = Assert.IsType<OkObjectResult>(await Build(ctx, "Vendor", mine).ForVendor());
        var list = Assert.IsAssignableFrom<IEnumerable<InspectionService.Entities.Inspection>>(ok.Value).ToList();

        var only = Assert.Single(list);
        Assert.Equal(mine, only.VendorId);
        Assert.NotEmpty(only.Defects);
    }

    [Fact]
    public async Task ForVendor_WithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<InspectionServiceDbContext>();
        var result = await Build(ctx, "Vendor", null).ForVendor();
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task RectifyDefect_SetsRectifiedAndEvidence()
    {
        using var ctx = TestDb.Create<InspectionServiceDbContext>();
        var me = Guid.NewGuid();
        var inspection = Seed(ctx, me);
        var defectId = inspection.Defects.First().Id;

        var result = await Build(ctx, "Vendor", me).RectifyDefect(defectId,
            new InspectionsController.RectifyRequest { ReworkReportUrl = "/api/files/rework.jpg" });

        Assert.IsType<OkObjectResult>(result);
        var defect = ctx.Inspections.Include(i => i.Defects).Single().Defects.First();
        Assert.Equal("Rectified", defect.Status);
        Assert.Equal("/api/files/rework.jpg", defect.ReworkReportUrl);
        Assert.NotNull(defect.RectifiedAt);
    }

    [Fact]
    public async Task RectifyDefect_RequiresEvidence()
    {
        using var ctx = TestDb.Create<InspectionServiceDbContext>();
        var me = Guid.NewGuid();
        var inspection = Seed(ctx, me);
        var defectId = inspection.Defects.First().Id;

        var result = await Build(ctx, "Vendor", me).RectifyDefect(defectId,
            new InspectionsController.RectifyRequest { ReworkReportUrl = "  " });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Open", ctx.Inspections.Include(i => i.Defects).Single().Defects.First().Status);
    }

    [Fact]
    public async Task RectifyDefect_OnAnotherVendorsDefect_IsNotFound()
    {
        using var ctx = TestDb.Create<InspectionServiceDbContext>();
        var owner = Guid.NewGuid();
        var inspection = Seed(ctx, owner);
        var defectId = inspection.Defects.First().Id;

        var result = await Build(ctx, "Vendor", Guid.NewGuid()).RectifyDefect(defectId,
            new InspectionsController.RectifyRequest { ReworkReportUrl = "/x.jpg" });

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal("Open", ctx.Inspections.Include(i => i.Defects).Single().Defects.First().Status);
    }

    [Fact]
    public async Task RectifyDefect_UnknownDefect_IsNotFound()
    {
        using var ctx = TestDb.Create<InspectionServiceDbContext>();
        var me = Guid.NewGuid();
        Seed(ctx, me);

        var result = await Build(ctx, "Vendor", me).RectifyDefect(Guid.NewGuid(),
            new InspectionsController.RectifyRequest { ReworkReportUrl = "/x.jpg" });

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
