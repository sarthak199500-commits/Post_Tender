using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using InspectionService.Controllers;
using InspectionService.Entities;
using InspectionService.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Inspection;

/// <summary>
/// Scheduling a visit wrote the caller's user id into InspectionVisits.InspectorId, which is a
/// foreign key to Inspectors.Id — a different value entirely, since an inspector profile stores
/// the user id in its own UserId column. Every schedule attempt died on the FK constraint.
///
/// These run against real SQLite rather than the shared InMemory helper: InMemory ignores foreign
/// keys, so it would have reported the broken insert as a success.
/// </summary>
public class InspectionVisitsTests : IDisposable
{
    private readonly SqliteConnection _connection;

    public InspectionVisitsTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
    }

    public void Dispose() => _connection.Dispose();

    private InspectionServiceDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<InspectionServiceDbContext>()
            .UseSqlite(_connection)
            .Options;
        return new InspectionServiceDbContext(options);
    }

    private static InspectionVisitsController Build(InspectionServiceDbContext ctx, Guid userId, string role = "Inspector")
    {
        var controller = new InspectionVisitsController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role, userId: userId));
        return controller;
    }

    private static Inspector SeedInspector(InspectionServiceDbContext ctx, Guid userId)
    {
        var inspector = new Inspector
        {
            UserId = userId,
            Name = "Test Inspector",
            Email = "inspector@test.local",
            Type = "Department"
        };
        ctx.Inspectors.Add(inspector);
        ctx.SaveChanges();
        return inspector;
    }

    private static InspectionVisit SeedVisit(
        InspectionServiceDbContext ctx, Guid inspectorProfileId, string status = "Scheduled")
    {
        var visit = new InspectionVisit
        {
            WorkOrderId = Guid.NewGuid(),
            InspectorId = inspectorProfileId,
            ScheduledDate = DateTime.UtcNow.AddDays(1),
            Purpose = "Routine audit",
            Status = status
        };
        ctx.InspectionVisits.Add(visit);
        ctx.SaveChanges();
        return visit;
    }

    private static InspectionVisitsController.CreateVisitRequest ValidRequest() => new()
    {
        WorkOrderId = Guid.NewGuid(),
        // Denormalized from the work order by the caller so the vendor's own schedule can
        // be scoped; the endpoint rejects a visit without it.
        VendorId = Guid.NewGuid(),
        ScheduledDate = DateTime.UtcNow.AddDays(2),
        Purpose = "Foundation quality check"
    };

    [Fact]
    public async Task Post_StoresTheInspectorProfileId_NotTheCallersUserId()
    {
        using var ctx = NewContext();
        var userId = Guid.NewGuid();
        var inspector = SeedInspector(ctx, userId);

        var result = await Build(ctx, userId).Post(ValidRequest());

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(NewContext().InspectionVisits.ToList());
        Assert.Equal(inspector.Id, saved.InspectorId);
        Assert.NotEqual(userId, saved.InspectorId);
        Assert.Equal("Scheduled", saved.Status);
    }

    [Fact]
    public async Task Post_WithoutAnInspectorProfile_IsRejectedRatherThanCrashing()
    {
        using var ctx = NewContext();

        var result = await Build(ctx, Guid.NewGuid()).Post(ValidRequest());

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(NewContext().InspectionVisits.ToList());
    }

    [Theory]
    [InlineData("workOrder")]
    [InlineData("scheduledDate")]
    [InlineData("purpose")]
    public async Task Post_WithMissingFields_IsBadRequest(string missing)
    {
        using var ctx = NewContext();
        var userId = Guid.NewGuid();
        SeedInspector(ctx, userId);

        var request = ValidRequest();
        if (missing == "workOrder") request.WorkOrderId = Guid.Empty;
        if (missing == "scheduledDate") request.ScheduledDate = default;
        if (missing == "purpose") request.Purpose = "   ";

        var result = await Build(ctx, userId).Post(request);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(NewContext().InspectionVisits.ToList());
    }

    // ── Ownership scoping ────────────────────────────────────────────────────
    // The list and the status write were keyed on nothing but the visit id, so an inspector
    // saw the whole organisation's schedule and could close out someone else's visit.

    [Fact]
    public async Task Get_AsInspector_ReturnsOnlyTheirOwnVisits()
    {
        using var ctx = NewContext();
        var userId = Guid.NewGuid();
        var me = SeedInspector(ctx, userId);
        var someoneElse = SeedInspector(ctx, Guid.NewGuid());
        var mine = SeedVisit(ctx, me.Id);
        SeedVisit(ctx, someoneElse.Id);

        var ok = Assert.IsType<OkObjectResult>(await Build(ctx, userId).Get());
        var listed = Assert.IsAssignableFrom<IEnumerable<InspectionVisit>>(ok.Value).ToList();

        var only = Assert.Single(listed);
        Assert.Equal(mine.Id, only.Id);
    }

    [Fact]
    public async Task Get_AsAdmin_ReturnsEveryInspectorsVisits()
    {
        using var ctx = NewContext();
        var one = SeedInspector(ctx, Guid.NewGuid());
        var two = SeedInspector(ctx, Guid.NewGuid());
        SeedVisit(ctx, one.Id);
        SeedVisit(ctx, two.Id);

        var ok = Assert.IsType<OkObjectResult>(await Build(ctx, Guid.NewGuid(), "Admin").Get());
        var listed = Assert.IsAssignableFrom<IEnumerable<InspectionVisit>>(ok.Value).ToList();

        Assert.Equal(2, listed.Count);
    }

    [Fact]
    public async Task Get_AsInspectorWithoutProfile_ReturnsNothingRatherThanEverything()
    {
        using var ctx = NewContext();
        var other = SeedInspector(ctx, Guid.NewGuid());
        SeedVisit(ctx, other.Id);

        var ok = Assert.IsType<OkObjectResult>(await Build(ctx, Guid.NewGuid()).Get());
        var listed = Assert.IsAssignableFrom<IEnumerable<InspectionVisit>>(ok.Value).ToList();

        Assert.Empty(listed);
    }

    [Fact]
    public async Task UpdateStatus_OnAnotherInspectorsVisit_IsRefusedAndChangesNothing()
    {
        using var ctx = NewContext();
        var intruderUserId = Guid.NewGuid();
        SeedInspector(ctx, intruderUserId);
        var owner = SeedInspector(ctx, Guid.NewGuid());
        var theirVisit = SeedVisit(ctx, owner.Id);

        var result = await Build(ctx, intruderUserId)
            .UpdateStatus(theirVisit.Id, new InspectionVisitsController.UpdateStatusRequest
            {
                Status = "Cancelled",
                Remarks = "not mine to cancel"
            });

        Assert.IsType<NotFoundResult>(result);
        var untouched = NewContext().InspectionVisits.Single(v => v.Id == theirVisit.Id);
        Assert.Equal("Scheduled", untouched.Status);
        Assert.Null(untouched.Remarks);
    }

    [Fact]
    public async Task UpdateStatus_OnOwnVisit_CompletesAndStampsTheVisitDate()
    {
        using var ctx = NewContext();
        var userId = Guid.NewGuid();
        var me = SeedInspector(ctx, userId);
        var mine = SeedVisit(ctx, me.Id);

        var result = await Build(ctx, userId)
            .UpdateStatus(mine.Id, new InspectionVisitsController.UpdateStatusRequest
            {
                Status = "Completed",
                Remarks = "Foundation verified."
            });

        Assert.IsType<OkObjectResult>(result);
        var saved = NewContext().InspectionVisits.Single(v => v.Id == mine.Id);
        Assert.Equal("Completed", saved.Status);
        Assert.Equal("Foundation verified.", saved.Remarks);
        Assert.NotNull(saved.ActualVisitDate);
    }

    [Fact]
    public async Task UpdateStatus_AsAdmin_MayCloseOutAnyVisit()
    {
        using var ctx = NewContext();
        var owner = SeedInspector(ctx, Guid.NewGuid());
        var theirVisit = SeedVisit(ctx, owner.Id);

        var result = await Build(ctx, Guid.NewGuid(), "Admin")
            .UpdateStatus(theirVisit.Id, new InspectionVisitsController.UpdateStatusRequest
            {
                Status = "Cancelled",
                Remarks = "Withdrawn centrally."
            });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Cancelled", NewContext().InspectionVisits.Single(v => v.Id == theirVisit.Id).Status);
    }
}
