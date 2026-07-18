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
/// Milestone approval lived on the wrong service: the frontend called
/// /api/projects/milestone/{id}/approve, which the gateway routed to TenderService where
/// milestones do not exist. These endpoints now sit on the owning service. Approving a
/// milestone marks it Completed — the gate the RA-bill flow checks — so this is the seam
/// that connects milestone sign-off to billing.
/// </summary>
public class MilestoneApprovalTests
{
    private static ExecutionController Build(ExecutionServiceDbContext ctx)
        => new ExecutionController(ctx, TestAudit.ForExecution());

    private static (Milestone, MilestoneSubmission) SeedSubmitted(ExecutionServiceDbContext ctx)
    {
        var milestone = new Milestone
        {
            WorkOrderId = Guid.NewGuid(),
            Title = "Foundation",
            Weightage = 40,
            PaymentPercentage = 40,
            TargetDate = DateTime.UtcNow.AddDays(30),
            Status = "Pending"
        };
        var submission = new MilestoneSubmission
        {
            MilestoneId = milestone.Id,
            ProjectId = Guid.NewGuid(),
            VendorId = Guid.NewGuid(),
            Status = "Submitted",
            IsImmutable = true,
            SubmittedAt = DateTime.UtcNow
        };
        ctx.Milestones.Add(milestone);
        ctx.MilestoneSubmissions.Add(submission);
        ctx.SaveChanges();
        return (milestone, submission);
    }

    [Fact]
    public async Task Pending_ReturnsSubmittedPackages_KeyedByMilestoneWithFields()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var (milestone, _) = SeedSubmitted(ctx);
        // A draft package for another milestone must NOT surface as pending.
        ctx.MilestoneSubmissions.Add(new MilestoneSubmission { MilestoneId = Guid.NewGuid(), Status = "Draft" });
        ctx.SaveChanges();

        var result = await Build(ctx).PendingMilestones();

        var ok = Assert.IsType<OkObjectResult>(result);
        var items = ((IEnumerable<object>)ok.Value!).ToList();
        var only = Assert.Single(items);
        // the pending item exposes the milestone id (approve/return act on it) and its fields
        var idProp = only.GetType().GetProperty("id")!.GetValue(only);
        Assert.Equal(milestone.Id, idProp);
        var status = only.GetType().GetProperty("status")!.GetValue(only);
        Assert.Equal("Submitted", status);
    }

    [Fact]
    public async Task Approve_MarksMilestoneCompleted_AndSubmissionApproved()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var (milestone, submission) = SeedSubmitted(ctx);

        var result = await Build(ctx).ApproveMilestone(milestone.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Completed", ctx.Milestones.Single().Status);
        Assert.NotNull(ctx.Milestones.Single().CompletionDate);
        Assert.Equal("Approved", ctx.MilestoneSubmissions.Single().Status);
    }

    [Fact]
    public async Task Approve_UnknownMilestone_IsNotFound()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var result = await Build(ctx).ApproveMilestone(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Return_RequiresReason()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var (milestone, _) = SeedSubmitted(ctx);

        var result = await Build(ctx).ReturnMilestone(milestone.Id,
            new ExecutionController.MilestoneActionRequest { Reason = "  " });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Pending", ctx.Milestones.Single().Status);   // untouched
    }

    [Fact]
    public async Task Return_SetsRejected_AndReopensPackageForEdit()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var (milestone, _) = SeedSubmitted(ctx);

        var result = await Build(ctx).ReturnMilestone(milestone.Id,
            new ExecutionController.MilestoneActionRequest { Reason = "Photos unclear" });

        Assert.IsType<OkObjectResult>(result);
        var sub = ctx.MilestoneSubmissions.Single();
        Assert.Equal("Rejected", sub.Status);
        Assert.False(sub.IsImmutable);                 // vendor may revise and resubmit
        Assert.Equal("Photos unclear", ctx.Milestones.Single().Remarks);
    }
}
