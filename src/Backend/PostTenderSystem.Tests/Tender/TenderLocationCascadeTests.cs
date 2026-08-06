using System;
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
/// Department exists on all three entities but is null on every legacy row, because the value
/// was never captured at the top of the chain. These drive the real
/// <see cref="WorkOrdersController.Create"/> and <see cref="WorkOrdersController.UpdateStatus"/>
/// actions — not a hand-copied Arrange step — so they fail if the `dto.X ?? tender.X` /
/// `workOrder.X` cascade lines are ever removed or reversed.
/// </summary>
public class TenderLocationCascadeTests
{
    private static WorkOrdersController Build(TenderServiceDbContext ctx, string role)
    {
        var controller = new WorkOrdersController(ctx, TestAudit.ForTender());
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    private static TenderService.Entities.Tender SeedTender(TenderServiceDbContext ctx, Guid? ulbId, Guid? zoneId, Guid? wardId)
    {
        var tender = new TenderService.Entities.Tender
        {
            TenderNo = "T-" + Guid.NewGuid().ToString("N")[..8],
            Title = "Road Resurfacing",
            Status = "Awarded",
            Budget = 100_000m,
            UlbId = ulbId,
            ZoneId = zoneId,
            WardId = wardId
        };
        ctx.Tenders.Add(tender);
        ctx.SaveChanges();
        return tender;
    }

    private static WorkOrdersController.CreateWorkOrderDto ValidDto(Guid tenderId, string workOrderNo) => new()
    {
        TenderId = tenderId,
        VendorId = Guid.NewGuid(),
        WorkOrderNo = workOrderNo,
        TotalValue = 10_000m,
        ScopeDescription = "Resurface Main Street",
        PaymentTerms = "Net 30",
        StartDate = new DateTime(2026, 1, 1),
        EndDate = new DateTime(2026, 6, 1),
        LiquidatedDamagesTerms = "1% per week"
    };

    [Fact]
    public async Task Create_WorkOrder_InheritsLocationFromTender_WhenDtoOmitsIt()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var ulb = Guid.NewGuid();
        var ward = Guid.NewGuid();
        var tender = SeedTender(ctx, ulb, null, ward);

        // UlbId/ZoneId/WardId are left at their default (null) on the DTO — the caller
        // supplied nothing, so Create must fall back to the tender's location.
        var dto = ValidDto(tender.Id, "WO-INHERIT");

        var result = await Build(ctx, "Admin").Create(dto);

        Assert.IsType<OkObjectResult>(result);
        var saved = ctx.WorkOrders.Single(w => w.WorkOrderNo == "WO-INHERIT");
        Assert.Equal(ulb, saved.UlbId);
        Assert.Equal(ward, saved.WardId);
        Assert.Null(saved.ZoneId);
    }

    [Fact]
    public async Task Create_WorkOrder_ExplicitDtoLocation_WinsOverTenderInheritance()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var tender = SeedTender(ctx, Guid.NewGuid(), null, Guid.NewGuid());

        var dtoUlb = Guid.NewGuid();
        var dtoZone = Guid.NewGuid();
        var dtoWard = Guid.NewGuid();
        var dto = ValidDto(tender.Id, "WO-EXPLICIT");
        dto.UlbId = dtoUlb;
        dto.ZoneId = dtoZone;
        dto.WardId = dtoWard;

        var result = await Build(ctx, "Admin").Create(dto);

        Assert.IsType<OkObjectResult>(result);
        var saved = ctx.WorkOrders.Single(w => w.WorkOrderNo == "WO-EXPLICIT");
        Assert.Equal(dtoUlb, saved.UlbId);
        Assert.Equal(dtoZone, saved.ZoneId);
        Assert.Equal(dtoWard, saved.WardId);
    }

    [Fact]
    public async Task Accept_CreatesProject_InheritingLocationFromWorkOrder()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var ulb = Guid.NewGuid();
        var zone = Guid.NewGuid();
        var ward = Guid.NewGuid();

        var wo = new WorkOrder
        {
            WorkOrderNo = "WO-ACCEPT",
            Status = "Pending Vendor Acceptance",
            VendorId = Guid.NewGuid(),
            TotalValue = 10_000m,
            UlbId = ulb,
            ZoneId = zone,
            WardId = ward
        };
        ctx.WorkOrders.Add(wo);
        await ctx.SaveChangesAsync();

        // Only a Vendor may accept — this is the transition that activates the Project.
        var result = await Build(ctx, "Vendor").UpdateStatus(wo.Id,
            new WorkOrdersController.UpdateStatusRequest { NewStatus = "Accepted" });

        Assert.IsType<OkObjectResult>(result);
        var project = ctx.Projects.Single(p => p.WorkOrderId == wo.Id);
        Assert.Equal(ulb, project.UlbId);
        Assert.Equal(zone, project.ZoneId);
        Assert.Equal(ward, project.WardId);
    }
}
