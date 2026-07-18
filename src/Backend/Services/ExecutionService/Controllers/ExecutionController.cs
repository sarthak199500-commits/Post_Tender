using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExecutionService.Persistence;
using ExecutionService.Entities;
using ExecutionService.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ExecutionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExecutionController : ControllerBase
{
    private readonly ExecutionServiceDbContext _context;
    private readonly AuditLogger _audit;

    public ExecutionController(ExecutionServiceDbContext context, AuditLogger audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet("milestones")]
    public async Task<IActionResult> GetMilestones([FromQuery] Guid? workOrderId)
    {
        var query = _context.Milestones.AsQueryable();
        if (workOrderId.HasValue)
            query = query.Where(m => m.WorkOrderId == workOrderId.Value);

        return Ok(await query.ToListAsync());
    }

    // Bulk-creates the milestones for a Work Order. Called by the client immediately after
    // it creates the Work Order in TenderService (milestones are owned by this service).
    [HttpPost("milestones")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> CreateMilestones([FromBody] CreateMilestonesDto dto)
    {
        if (dto == null || dto.WorkOrderId == Guid.Empty)
            return BadRequest("workOrderId is required.");

        if (dto.Milestones == null || dto.Milestones.Count == 0)
            return BadRequest("At least one milestone is required.");

        var totalWeightage = dto.Milestones.Sum(m => m.Weightage);
        if (totalWeightage != 100)
            return BadRequest("Sum of Milestone Weightages must equal 100%.");

        var milestones = dto.Milestones.Select(m => new Milestone
        {
            WorkOrderId = dto.WorkOrderId,
            Title = m.Title,
            Weightage = m.Weightage,
            PaymentPercentage = m.PaymentPercentage,
            TargetDate = m.TargetDate,
            Status = "Pending"
        }).ToList();

        _context.Milestones.AddRange(milestones);
        await _context.SaveChangesAsync();

        return Ok(milestones);
    }

    // ── Milestone approvals ──────────────────────────────────────────────────
    // Milestones live in this service, but the frontend historically called
    // /api/projects/milestone/{id}/... which the gateway routed to TenderService — the
    // wrong service. These endpoints put the logic where the data is. Approving a milestone
    // marks it Completed, which is what unlocks a vendor's RA bill for that milestone.

    // Milestones for which a vendor has submitted a completion package awaiting approval.
    // Reviewers only; vendors must not see other tenants' pending work.
    [HttpGet("milestones/pending")]
    [Authorize(Roles = "Admin,PMU,Department,Inspector")]
    public async Task<IActionResult> PendingMilestones()
    {
        var submitted = await _context.MilestoneSubmissions
            .Where(s => s.Status == "Submitted")
            .OrderByDescending(s => s.SubmittedAt)
            .ToListAsync();

        var milestoneIds = submitted.Select(s => s.MilestoneId).Distinct().ToList();

        var milestones = await _context.Milestones
            .Where(m => milestoneIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id);

        // Progress reports tied to these milestones supply the evidence panel.
        var reports = await _context.ProgressReports
            .Where(r => r.MilestoneId.HasValue && milestoneIds.Contains(r.MilestoneId.Value))
            .ToListAsync();

        var result = submitted
            .Where(s => milestones.ContainsKey(s.MilestoneId))
            .Select(s =>
            {
                var m = milestones[s.MilestoneId];
                return new
                {
                    id = m.Id,                 // approve/return act on the milestone id
                    submissionId = s.Id,
                    m.Title,
                    m.Weightage,
                    m.PaymentPercentage,
                    m.TargetDate,
                    workOrderId = m.WorkOrderId,
                    projectId = s.ProjectId,
                    vendorId = s.VendorId,
                    status = s.Status,         // "Submitted" — gates the Approve button
                    notes = s.Notes,
                    reports = reports
                        .Where(r => r.MilestoneId == m.Id)
                        .OrderByDescending(r => r.ReportedAt)
                        .Select(r => new
                        {
                            r.Id,
                            r.PhysicalPercentage,
                            r.WorkDescription,
                            r.MediaUrls,
                            r.Status,
                            r.ReportedAt
                        })
                };
            });

        return Ok(result);
    }

    // Marks the milestone Completed (this is the gate the RA-bill flow checks) and any
    // submitted package for it Approved.
    [HttpPost("milestones/{id}/approve")]
    [Authorize(Roles = "Admin,PMU,Department")]
    public async Task<IActionResult> ApproveMilestone(Guid id)
    {
        var milestone = await _context.Milestones.FindAsync(id);
        if (milestone == null) return NotFound("Milestone not found.");

        milestone.Status = "Completed";
        milestone.CompletionDate = DateTime.UtcNow;

        var subs = await _context.MilestoneSubmissions
            .Where(s => s.MilestoneId == id && s.Status == "Submitted")
            .ToListAsync();
        foreach (var s in subs) s.Status = "Approved";

        await _context.SaveChangesAsync();

        await _audit.LogAsync("Milestone", id.ToString(), "Milestone Approved",
            $"Milestone '{milestone.Title}' marked Completed; RA billing unlocked.");

        return Ok(new { message = "Milestone approved and completed" });
    }

    // Returns the milestone package to the vendor with a reason, reopening it for edit.
    [HttpPost("milestones/{id}/return")]
    [Authorize(Roles = "Admin,PMU,Department")]
    public async Task<IActionResult> ReturnMilestone(Guid id, [FromBody] MilestoneActionRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest("A reason is required to return a milestone.");

        var milestone = await _context.Milestones.FindAsync(id);
        if (milestone == null) return NotFound("Milestone not found.");

        var subs = await _context.MilestoneSubmissions
            .Where(s => s.MilestoneId == id && s.Status == "Submitted")
            .ToListAsync();
        if (subs.Count == 0) return NotFound("No submitted package found for this milestone.");

        foreach (var s in subs)
        {
            s.Status = "Rejected";
            s.IsImmutable = false;   // let the vendor revise and resubmit
        }
        milestone.Remarks = request.Reason;

        await _context.SaveChangesAsync();

        await _audit.LogAsync("Milestone", id.ToString(), "Milestone Returned", request.Reason);

        return Ok(new { message = "Milestone returned to vendor" });
    }

    public class MilestoneActionRequest
    {
        public string? Reason { get; set; }
    }

    public class CreateMilestonesDto
    {
        public Guid WorkOrderId { get; set; }
        public List<MilestoneInput> Milestones { get; set; } = new();
    }

    public class MilestoneInput
    {
        public string Title { get; set; } = string.Empty;
        public decimal Weightage { get; set; }
        public decimal PaymentPercentage { get; set; }
        public DateTime TargetDate { get; set; }
    }
}
