using System;
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

    private static InspectionVisitsController.CreateVisitRequest ValidRequest() => new()
    {
        WorkOrderId = Guid.NewGuid(),
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
}
