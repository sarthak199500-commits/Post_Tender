using System;
using System.Linq;
using System.Threading.Tasks;
using TenderService.Controllers;
using TenderService.Entities;
using TenderService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Tender;

/// <summary>
/// Cancelling a work order was impossible — Cancelled was in no allowedTransitions value, so
/// every attempt returned 400. Product decision: a work order may be cancelled only BEFORE
/// the vendor accepts it (Draft / Authority Approval / Pending Vendor Acceptance), and only
/// by Admin/PMU. Once accepted and in flight it must be closed out, not cancelled.
/// </summary>
public class WorkOrderCancellationTests
{
    private static WorkOrdersController Build(TenderServiceDbContext ctx, string role)
    {
        var controller = new WorkOrdersController(ctx, TestAudit.ForTender());
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    private static WorkOrder Seed(TenderServiceDbContext ctx, string status)
    {
        var wo = new WorkOrder { WorkOrderNo = "WO-1", Status = status, VendorId = Guid.NewGuid() };
        ctx.WorkOrders.Add(wo);
        ctx.SaveChanges();
        return wo;
    }

    [Theory]
    [InlineData("Draft")]
    [InlineData("Authority Approval")]
    [InlineData("Pending Vendor Acceptance")]
    public async Task Cancel_BeforeAcceptance_Succeeds(string fromStatus)
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var wo = Seed(ctx, fromStatus);

        var result = await Build(ctx, "Admin").UpdateStatus(wo.Id,
            new WorkOrdersController.UpdateStatusRequest { NewStatus = "Cancelled" });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Cancelled", ctx.WorkOrders.Single().Status);
    }

    [Theory]
    [InlineData("Accepted")]
    [InlineData("Project Activated")]
    [InlineData("Completed")]
    public async Task Cancel_AfterAcceptance_IsRejected(string fromStatus)
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var wo = Seed(ctx, fromStatus);

        var result = await Build(ctx, "Admin").UpdateStatus(wo.Id,
            new WorkOrdersController.UpdateStatusRequest { NewStatus = "Cancelled" });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(fromStatus, ctx.WorkOrders.Single().Status);   // unchanged
    }

    [Fact]
    public async Task Cancel_ByPmu_Succeeds()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var wo = Seed(ctx, "Draft");

        var result = await Build(ctx, "PMU").UpdateStatus(wo.Id,
            new WorkOrdersController.UpdateStatusRequest { NewStatus = "Cancelled" });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Cancelled", ctx.WorkOrders.Single().Status);
    }

    [Fact]
    public async Task Cancel_ByVendor_IsForbidden()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var wo = Seed(ctx, "Pending Vendor Acceptance");

        var result = await Build(ctx, "Vendor").UpdateStatus(wo.Id,
            new WorkOrdersController.UpdateStatusRequest { NewStatus = "Cancelled" });

        Assert.IsType<ForbidResult>(result);
        Assert.Equal("Pending Vendor Acceptance", ctx.WorkOrders.Single().Status);
    }
}
