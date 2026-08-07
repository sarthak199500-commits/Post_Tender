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
///
/// Also covers the update-time counterpart: <see cref="WorkOrdersController.UpdateLocation"/>
/// and <see cref="ProjectsController.UpdateLocation"/>, the PATCH {id}/location endpoints that
/// let a pre-existing row (created before these columns existed) be backfilled directly.
/// </summary>
public class TenderLocationCascadeTests
{
    private static WorkOrdersController Build(TenderServiceDbContext ctx, string role)
    {
        var controller = new WorkOrdersController(ctx, TestAudit.ForTender());
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    private static ProjectsController BuildProjects(TenderServiceDbContext ctx, string role)
    {
        var controller = new ProjectsController(ctx);
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

    /// <summary>
    /// Mirrors the work-order and project location PATCH. Tender already had a full update
    /// endpoint, but it binds [FromForm] and its read projection never returns Description,
    /// so any caller updating location through it silently blanks the description. This
    /// narrow endpoint touches only the three location columns.
    /// </summary>
    [Fact]
    public async Task PatchLocation_ReplacesAllThreeFields_WithoutTouchingDescription()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var tender = SeedTender(ctx, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        tender.Description = "Resurface Main Street, 2.4km";
        await ctx.SaveChangesAsync();

        var ulb = Guid.NewGuid();
        var ward = Guid.NewGuid();
        // IWebHostEnvironment is only reached by the document-upload path in AddTender/
        // UpdateTender; UpdateLocation never touches it.
        var controller = new TendersController(ctx, null!);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        // Zone deliberately null: a city or town has none, and this is a replace, not a merge.
        var result = await controller.UpdateLocation(tender.Id,
            new TendersController.UpdateLocationRequest { UlbId = ulb, ZoneId = null, WardId = ward });

        Assert.IsType<OkObjectResult>(result);
        var saved = ctx.Tenders.Single(t => t.Id == tender.Id);
        Assert.Equal(ulb, saved.UlbId);
        Assert.Null(saved.ZoneId);
        Assert.Equal(ward, saved.WardId);
        Assert.Equal("Resurface Main Street, 2.4km", saved.Description);
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

    // --- PATCH {id}/location: the update-time counterpart, for rows that already existed
    // before UlbId/ZoneId/WardId were added and so never went through the cascade above. ---

    [Fact]
    public async Task PatchLocation_ReplacesAllThreeFields_OnWorkOrder()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var wo = new WorkOrder
        {
            WorkOrderNo = "WO-PATCH-LOC",
            Status = "Draft",
            VendorId = Guid.NewGuid(),
            TotalValue = 10_000m,
            UlbId = Guid.NewGuid(),
            ZoneId = Guid.NewGuid(),
            WardId = Guid.NewGuid()
        };
        ctx.WorkOrders.Add(wo);
        await ctx.SaveChangesAsync();

        var newUlb = Guid.NewGuid();
        var newWard = Guid.NewGuid();

        // ZoneId is explicitly sent as null here — this is a full replace, so the old
        // (non-null) ZoneId must be overwritten with null, not preserved.
        var request = new WorkOrdersController.UpdateLocationRequest
        {
            UlbId = newUlb,
            ZoneId = null,
            WardId = newWard
        };

        var result = await Build(ctx, "Admin").UpdateLocation(wo.Id, request);

        Assert.IsType<OkObjectResult>(result);
        var saved = ctx.WorkOrders.Single(w => w.Id == wo.Id);
        Assert.Equal(newUlb, saved.UlbId);
        Assert.Null(saved.ZoneId);
        Assert.Equal(newWard, saved.WardId);
    }

    [Fact]
    public async Task PatchLocation_ReturnsNotFound_ForNonexistentWorkOrder()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var request = new WorkOrdersController.UpdateLocationRequest
        {
            UlbId = Guid.NewGuid(),
            ZoneId = Guid.NewGuid(),
            WardId = Guid.NewGuid()
        };

        var result = await Build(ctx, "Admin").UpdateLocation(Guid.NewGuid(), request);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task PatchLocation_ReplacesAllThreeFields_OnProject()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var wo = new WorkOrder
        {
            WorkOrderNo = "WO-FOR-PROJECT-PATCH",
            Status = "Accepted",
            VendorId = Guid.NewGuid(),
            TotalValue = 10_000m
        };
        ctx.WorkOrders.Add(wo);

        var project = new TenderService.Entities.Project
        {
            WorkOrderId = wo.Id,
            Name = "Project for patch test",
            Budget = 10_000m,
            UlbId = Guid.NewGuid(),
            ZoneId = Guid.NewGuid(),
            WardId = Guid.NewGuid()
        };
        ctx.Projects.Add(project);
        await ctx.SaveChangesAsync();

        var newUlb = Guid.NewGuid();
        var newZone = Guid.NewGuid();
        var newWard = Guid.NewGuid();
        var request = new ProjectsController.UpdateLocationRequest
        {
            UlbId = newUlb,
            ZoneId = newZone,
            WardId = newWard
        };

        var result = await BuildProjects(ctx, "Admin").UpdateLocation(project.Id, request);

        Assert.IsType<OkObjectResult>(result);
        var saved = ctx.Projects.Single(p => p.Id == project.Id);
        Assert.Equal(newUlb, saved.UlbId);
        Assert.Equal(newZone, saved.ZoneId);
        Assert.Equal(newWard, saved.WardId);
    }
}
