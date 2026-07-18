using System;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using ExecutionService.Controllers;
using ExecutionService.Entities;
using ExecutionService.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Execution;

/// <summary>
/// system_map.md marked the Inspector-review and Department-approve steps [MISSING]:
/// approval was a lone button with nothing before it. These lock in the real chain —
/// an inspector must record a recommendation before the department can approve.
/// </summary>
public class ProgressReportReviewTests
{
    private static ProgressReportsController Build(ExecutionServiceDbContext ctx, string role, Guid? userId = null)
    {
        var controller = new ProgressReportsController(ctx, TestAudit.ForExecution());
        FakeUser.Attach(controller, FakeUser.With(role, userId: userId));
        return controller;
    }

    private static ProgressReport Seed(ExecutionServiceDbContext ctx, string status = "Submitted")
    {
        var report = new ProgressReport
        {
            ProjectId = Guid.NewGuid(),
            VendorId = Guid.NewGuid(),
            PhysicalPercentage = 50,
            WorkDescription = "Slab work",
            Status = status
        };
        ctx.ProgressReports.Add(report);
        ctx.SaveChanges();
        return report;
    }

    // ── Review ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Review_MarksReviewed_AndStampsInspectorAndRecommendation()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var report = Seed(ctx);
        var inspectorId = Guid.NewGuid();
        var controller = Build(ctx, "Inspector", userId: inspectorId);

        var result = await controller.Review(report.Id, new ProgressReportsController.ReviewRequest
        {
            Recommendation = "Accept",
            Remarks = "Work matches the reported progress."
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = ctx.ProgressReports.Single();
        Assert.Equal("Reviewed", saved.Status);
        Assert.Equal("Accept", saved.InspectorRecommendation);
        Assert.Equal("Work matches the reported progress.", saved.InspectorRemarks);
        Assert.Equal(inspectorId, saved.ReviewedByInspectorId);
        Assert.NotNull(saved.InspectorReviewedAt);
    }

    [Fact]
    public async Task Review_OnAlreadyReviewedReport_IsRejected()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var report = Seed(ctx, status: "Reviewed");
        var controller = Build(ctx, "Inspector", userId: Guid.NewGuid());

        var result = await controller.Review(report.Id, new ProgressReportsController.ReviewRequest
        {
            Recommendation = "Accept"
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Review_WithInvalidRecommendation_IsRejected()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var report = Seed(ctx);
        var controller = Build(ctx, "Inspector", userId: Guid.NewGuid());

        var result = await controller.Review(report.Id, new ProgressReportsController.ReviewRequest
        {
            Recommendation = "Maybe"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Submitted", ctx.ProgressReports.Single().Status);   // untouched
    }

    [Fact]
    public async Task Review_UnknownReport_IsNotFound()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Inspector", userId: Guid.NewGuid());

        var result = await controller.Review(Guid.NewGuid(), new ProgressReportsController.ReviewRequest
        {
            Recommendation = "Accept"
        });

        Assert.IsType<NotFoundResult>(result);
    }

    // ── Approve gate ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Approve_BeforeReview_IsRejected()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var report = Seed(ctx);   // Submitted, not yet reviewed
        var controller = Build(ctx, "Department");

        var result = await controller.Approve(report.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Submitted", ctx.ProgressReports.Single().Status);
    }

    [Fact]
    public async Task Approve_AfterReview_Succeeds()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var report = Seed(ctx, status: "Reviewed");
        var controller = Build(ctx, "Department");

        var result = await controller.Approve(report.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Approved", ctx.ProgressReports.Single().Status);
    }

    // ── RBAC (attributes aren't evaluated on a direct call, so assert on metadata) ──

    [Fact]
    public void Review_IsInspectorOnly()
    {
        var attr = typeof(ProgressReportsController)
            .GetMethod(nameof(ProgressReportsController.Review))!
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        var roles = attr!.Roles!.Split(',').Select(r => r.Trim()).ToArray();
        Assert.Contains("Inspector", roles);
        Assert.DoesNotContain("Department", roles);   // department approves, it does not review
    }
}
