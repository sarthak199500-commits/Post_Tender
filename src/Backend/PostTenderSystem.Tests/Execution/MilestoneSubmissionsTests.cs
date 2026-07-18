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
/// /api/milestonesubmissions did not exist at all — the gateway returned an empty 404,
/// so a vendor could never assemble or finalize a milestone completion package. These
/// cover the six calls MilestoneSubmissionPage.tsx makes plus the immutability rule:
/// once submitted, any mutation returns 409 Conflict.
/// </summary>
public class MilestoneSubmissionsTests
{
    private static MilestoneSubmissionsController Build(ExecutionServiceDbContext ctx, string role, Guid? vendorId)
    {
        var controller = new MilestoneSubmissionsController(ctx, TestAudit.ForExecution());
        FakeUser.Attach(controller, FakeUser.With(role, vendorId: vendorId));
        return controller;
    }

    private static MilestoneSubmission Seed(ExecutionServiceDbContext ctx, Guid vendorId, bool immutable = false, string status = "Draft")
    {
        var sub = new MilestoneSubmission
        {
            MilestoneId = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            VendorId = vendorId,
            Notes = "seed",
            Status = status,
            IsImmutable = immutable
        };
        ctx.MilestoneSubmissions.Add(sub);
        ctx.SaveChanges();
        return sub;
    }

    // ── Create ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Create_StampsVendorFromClaim_AndStartsDraft()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.Create(new MilestoneSubmissionsController.CreateSubmissionDto
        {
            MilestoneId = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            Notes = "Foundation done",
            LinkedReportIds = new List<Guid> { Guid.NewGuid() }
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.MilestoneSubmissions);
        Assert.Equal(me, saved.VendorId);
        Assert.Equal("Draft", saved.Status);
        Assert.False(saved.IsImmutable);
        Assert.Single(saved.LinkedReportIds);
    }

    [Fact]
    public async Task Create_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", null);

        var result = await controller.Create(new MilestoneSubmissionsController.CreateSubmissionDto
        {
            MilestoneId = Guid.NewGuid(), ProjectId = Guid.NewGuid()
        });

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(ctx.MilestoneSubmissions);
    }

    [Fact]
    public async Task Create_RequiresMilestoneId()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", Guid.NewGuid());

        var result = await controller.Create(new MilestoneSubmissionsController.CreateSubmissionDto
        {
            MilestoneId = Guid.Empty, ProjectId = Guid.NewGuid()
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.MilestoneSubmissions);
    }

    // ── Read (by milestone) ─────────────────────────────────────────────────

    [Fact]
    public async Task GetByMilestone_VendorSeesOnlyOwn()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var mine = Guid.NewGuid();
        var theirs = Guid.NewGuid();
        var milestoneId = Guid.NewGuid();

        ctx.MilestoneSubmissions.Add(new MilestoneSubmission { MilestoneId = milestoneId, VendorId = mine });
        ctx.MilestoneSubmissions.Add(new MilestoneSubmission { MilestoneId = milestoneId, VendorId = theirs });
        ctx.SaveChanges();

        var controller = Build(ctx, "Vendor", mine);
        var result = await controller.GetByMilestone(milestoneId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IEnumerable<MilestoneSubmission>>(ok.Value);
        var only = Assert.Single(list);
        Assert.Equal(mine, only.VendorId);
    }

    [Fact]
    public async Task GetByMilestone_ReviewerSeesAll()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var milestoneId = Guid.NewGuid();
        ctx.MilestoneSubmissions.Add(new MilestoneSubmission { MilestoneId = milestoneId, VendorId = Guid.NewGuid() });
        ctx.MilestoneSubmissions.Add(new MilestoneSubmission { MilestoneId = milestoneId, VendorId = Guid.NewGuid() });
        ctx.SaveChanges();

        var controller = Build(ctx, "Inspector", null);
        var result = await controller.GetByMilestone(milestoneId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<IEnumerable<MilestoneSubmission>>(ok.Value);
        Assert.Equal(2, list.Count());
    }

    [Fact]
    public async Task GetByMilestone_VendorWithoutClaim_IsForbidden()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = Build(ctx, "Vendor", null);

        var result = await controller.GetByMilestone(Guid.NewGuid());
        Assert.IsType<ForbidResult>(result);
    }

    // ── Update ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_ChangesNotesAndReports()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me);
        var controller = Build(ctx, "Vendor", me);

        var newReports = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() };
        var result = await controller.Update(sub.Id, new MilestoneSubmissionsController.UpdateSubmissionDto
        {
            Notes = "Updated notes",
            LinkedReportIds = newReports
        });

        Assert.IsType<OkObjectResult>(result);
        var reloaded = ctx.MilestoneSubmissions.Single();
        Assert.Equal("Updated notes", reloaded.Notes);
        Assert.Equal(2, reloaded.LinkedReportIds.Count);
    }

    [Fact]
    public async Task Update_OnImmutableSubmission_Returns409()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me, immutable: true, status: "Submitted");
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.Update(sub.Id, new MilestoneSubmissionsController.UpdateSubmissionDto
        {
            Notes = "sneaky edit"
        });

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Equal("seed", ctx.MilestoneSubmissions.Single().Notes);
    }

    [Fact]
    public async Task Update_AnotherVendorsSubmission_IsNotFound()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var owner = Guid.NewGuid();
        var sub = Seed(ctx, owner);
        var controller = Build(ctx, "Vendor", Guid.NewGuid());   // a different vendor

        var result = await controller.Update(sub.Id, new MilestoneSubmissionsController.UpdateSubmissionDto
        {
            Notes = "not yours"
        });

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal("seed", ctx.MilestoneSubmissions.Single().Notes);
    }

    // ── Submit ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Submit_FlipsToSubmittedImmutableAndStamps()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me);
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.Submit(sub.Id);

        Assert.IsType<OkObjectResult>(result);
        var reloaded = ctx.MilestoneSubmissions.Single();
        Assert.Equal("Submitted", reloaded.Status);
        Assert.True(reloaded.IsImmutable);
        Assert.NotNull(reloaded.SubmittedAt);
    }

    [Fact]
    public async Task Submit_AlreadySubmitted_Returns409()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me, immutable: true, status: "Submitted");
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.Submit(sub.Id);
        Assert.IsType<ConflictObjectResult>(result);
    }

    // ── Documents ───────────────────────────────────────────────────────────

    [Fact]
    public async Task AddDocument_AppendsToSubmission()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me);
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.AddDocument(sub.Id, new MilestoneSubmissionsController.AddDocumentDto
        {
            Name = "cert.pdf", Type = "Completion Certificate", Url = "/uploads/cert.pdf", Size = "12.3 KB"
        });

        Assert.IsType<OkObjectResult>(result);
        var doc = Assert.Single(ctx.MilestoneDocuments);
        Assert.Equal(sub.Id, doc.MilestoneSubmissionId);
        Assert.Equal("cert.pdf", doc.Name);
    }

    [Fact]
    public async Task AddDocument_OnImmutableSubmission_Returns409()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me, immutable: true, status: "Submitted");
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.AddDocument(sub.Id, new MilestoneSubmissionsController.AddDocumentDto
        {
            Name = "late.pdf", Type = "Other", Url = "/x", Size = "1 KB"
        });

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Empty(ctx.MilestoneDocuments);
    }

    [Fact]
    public async Task RemoveDocument_DeletesIt()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me);
        var doc = new MilestoneDocument { MilestoneSubmissionId = sub.Id, Name = "a.pdf" };
        ctx.MilestoneDocuments.Add(doc);
        ctx.SaveChanges();
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.RemoveDocument(sub.Id, doc.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(ctx.MilestoneDocuments);
    }

    [Fact]
    public async Task RemoveDocument_OnImmutableSubmission_Returns409()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var me = Guid.NewGuid();
        var sub = Seed(ctx, me, immutable: true, status: "Submitted");
        var doc = new MilestoneDocument { MilestoneSubmissionId = sub.Id, Name = "a.pdf" };
        ctx.MilestoneDocuments.Add(doc);
        ctx.SaveChanges();
        var controller = Build(ctx, "Vendor", me);

        var result = await controller.RemoveDocument(sub.Id, doc.Id);

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Single(ctx.MilestoneDocuments);
    }
}
