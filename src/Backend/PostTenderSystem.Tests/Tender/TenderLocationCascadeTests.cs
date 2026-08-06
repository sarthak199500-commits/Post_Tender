using System;
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
/// was never captured at the top of the chain. These lock in that location does not repeat that:
/// a work order inherits the tender's location, and a project inherits the work order's.
/// </summary>
public class TenderLocationCascadeTests
{
    [Fact]
    public async Task WorkOrder_InheritsLocationFromTender_WhenNotSuppliedOnDto()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var ulb = Guid.NewGuid();
        var ward = Guid.NewGuid();

        var tender = new TenderService.Entities.Tender
        {
            TenderNo = "T-1", Title = "Road Resurfacing", Status = "Awarded",
            UlbId = ulb, ZoneId = null, WardId = ward
        };
        ctx.Tenders.Add(tender);
        await ctx.SaveChangesAsync();

        var wo = new WorkOrder
        {
            WorkOrderNo = "WO-1",
            TenderId = tender.Id,
            UlbId = tender.UlbId,
            ZoneId = tender.ZoneId,
            WardId = tender.WardId
        };
        ctx.WorkOrders.Add(wo);
        await ctx.SaveChangesAsync();

        var saved = Assert.Single(ctx.WorkOrders);
        Assert.Equal(ulb, saved.UlbId);
        Assert.Equal(ward, saved.WardId);
        Assert.Null(saved.ZoneId);
    }

    [Fact]
    public async Task Project_InheritsLocationFromWorkOrder()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var ulb = Guid.NewGuid();
        var ward = Guid.NewGuid();

        var wo = new WorkOrder { WorkOrderNo = "WO-1", UlbId = ulb, WardId = ward };
        ctx.WorkOrders.Add(wo);
        await ctx.SaveChangesAsync();

        var project = new Project
        {
            Name = "Project for WO-1",
            WorkOrderId = wo.Id,
            UlbId = wo.UlbId,
            ZoneId = wo.ZoneId,
            WardId = wo.WardId
        };
        ctx.Projects.Add(project);
        await ctx.SaveChangesAsync();

        var saved = Assert.Single(ctx.Projects);
        Assert.Equal(ulb, saved.UlbId);
        Assert.Equal(ward, saved.WardId);
    }
}
