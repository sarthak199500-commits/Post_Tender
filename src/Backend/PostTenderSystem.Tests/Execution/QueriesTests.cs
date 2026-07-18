using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ExecutionService.Controllers;
using ExecutionService.Entities;
using ExecutionService.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Execution;

/// <summary>
/// /api/queries could only read (and even that was broken — no .Include(Messages), so every
/// thread rendered blank). A vendor could never raise a clarification and no one could reply.
/// </summary>
public class QueriesTests
{
    [Fact]
    public async Task Create_StampsVendorAndSenderFromClaims()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var myVendor = Guid.NewGuid();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: myVendor));

        var result = await controller.Create(new QueriesController.CreateQueryDto
        {
            Subject = "Site access blocked",
            Messages = new List<QueriesController.CreateMessageDto> { new() { Content = "Gate is locked." } }
        });

        Assert.IsType<OkObjectResult>(result);

        var saved = await ctx.Queries.Include(q => q.Messages).SingleAsync();
        Assert.Equal(myVendor, saved.VendorId);
        Assert.Equal("Open", saved.Status);
        Assert.NotEqual(default, saved.CreatedAt);   // guards the missing-default gotcha

        var message = Assert.Single(saved.Messages);
        Assert.Equal("Gate is locked.", message.Content);
        Assert.Equal("Vendor", message.SenderRole);
        Assert.NotEqual(default, message.Timestamp);
    }

    [Fact]
    public async Task Create_RequiresSubject()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: Guid.NewGuid()));

        var result = await controller.Create(new QueriesController.CreateQueryDto { Subject = "  " });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Queries);
    }

    [Fact]
    public async Task Create_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: null));

        var result = await controller.Create(new QueriesController.CreateQueryDto { Subject = "x" });

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(ctx.Queries);
    }

    [Fact]
    public async Task Get_AsVendor_ReturnsOnlyOwnQueries_WithMessages()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var mine = Guid.NewGuid();
        ctx.Queries.AddRange(
            new Query
            {
                VendorId = mine, Subject = "Mine", CreatedAt = DateTime.UtcNow,
                Messages = new List<QueryMessage>
                {
                    new() { Content = "hello", Timestamp = DateTime.UtcNow, SenderRole = "Vendor" }
                }
            },
            new Query { VendorId = Guid.NewGuid(), Subject = "Theirs", CreatedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: mine));

        var ok = Assert.IsType<OkObjectResult>(await controller.Get());
        var queries = Assert.IsAssignableFrom<IEnumerable<Query>>(ok.Value).ToList();

        var only = Assert.Single(queries);
        Assert.Equal("Mine", only.Subject);
        Assert.Single(only.Messages);   // regression guard: the missing .Include()
    }

    [Fact]
    public async Task Get_AsAdmin_ReturnsAllQueries()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        ctx.Queries.AddRange(
            new Query { VendorId = Guid.NewGuid(), Subject = "A", CreatedAt = DateTime.UtcNow },
            new Query { VendorId = Guid.NewGuid(), Subject = "B", CreatedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var ok = Assert.IsType<OkObjectResult>(await controller.Get());
        Assert.Equal(2, Assert.IsAssignableFrom<IEnumerable<Query>>(ok.Value).Count());
    }

    [Fact]
    public async Task AddMessage_AsAdmin_AppendsWithAdminSenderRole()
    {
        var db = Guid.NewGuid().ToString();
        Guid queryId;
        using (var seed = TestDb.Create<ExecutionServiceDbContext>(db))
        {
            var query = new Query { VendorId = Guid.NewGuid(), Subject = "Q", CreatedAt = DateTime.UtcNow };
            seed.Queries.Add(query);
            await seed.SaveChangesAsync();
            queryId = query.Id;
        }

        using var ctx = TestDb.Create<ExecutionServiceDbContext>(db);
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var result = await controller.AddMessage(queryId, new QueriesController.CreateMessageDto { Content = "Unlocking it." });

        Assert.IsType<OkObjectResult>(result);
        var saved = await ctx.Queries.Include(q => q.Messages).SingleAsync();
        var message = Assert.Single(saved.Messages);
        Assert.Equal("Admin", message.SenderRole);
        Assert.Equal("In Progress", saved.Status);   // Open -> In Progress on first reply
    }

    [Fact]
    public async Task AddMessage_AsVendor_CannotPostToAnotherVendorsQuery()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var query = new Query { VendorId = Guid.NewGuid(), Subject = "Theirs", CreatedAt = DateTime.UtcNow };
        ctx.Queries.Add(query);
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: Guid.NewGuid()));

        var result = await controller.AddMessage(query.Id, new QueriesController.CreateMessageDto { Content = "sneaky" });

        Assert.IsType<ForbidResult>(result);
        var saved = await ctx.Queries.Include(q => q.Messages).SingleAsync();
        Assert.Empty(saved.Messages);
    }

    [Fact]
    public async Task AddMessage_UnknownQuery_Returns404()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var result = await controller.AddMessage(Guid.NewGuid(), new QueriesController.CreateMessageDto { Content = "x" });

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
