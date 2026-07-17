using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExecutionService.Persistence;
using ExecutionService.Security;
using ExecutionService.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ExecutionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProgressReportsController : ControllerBase
{
    private readonly ExecutionServiceDbContext _context;
    private readonly AuditLogger _audit;

    public ProgressReportsController(ExecutionServiceDbContext context, AuditLogger audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var query = _context.ProgressReports.AsQueryable();

        // A vendor sees only their own reports. Reviewers (Inspector/Department/Admin/PMU)
        // must still see everyone's, so scope on the Vendor role rather than on the claim
        // being present. Fail closed if a vendor token carries no claim.
        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(r => r.VendorId == me);
        }

        return Ok(await query.OrderByDescending(r => r.ReportedAt).ToListAsync());
    }

    // Reports still awaiting inspector/department review. milestoneTitle is joined locally;
    // vendor/tender/work-order names live in other services and are composed on the client.
    [HttpGet("pending-review")]
    public async Task<IActionResult> PendingReview()
    {
        var reports = await _context.ProgressReports
            .Where(r => r.Status != "Reviewed" && r.Status != "Approved")
            .OrderByDescending(r => r.ReportedAt)
            .ToListAsync();

        var milestoneIds = reports.Where(r => r.MilestoneId.HasValue)
            .Select(r => r.MilestoneId!.Value).ToList();
        var titleById = await _context.Milestones
            .Where(m => milestoneIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, m => m.Title);

        var result = reports.Select(r => new
        {
            r.Id,
            r.ProjectId,
            r.VendorId,
            milestoneId = r.MilestoneId,
            milestoneTitle = r.MilestoneId.HasValue && titleById.ContainsKey(r.MilestoneId.Value)
                ? titleById[r.MilestoneId.Value] : "N/A",
            progressPercentage = r.PhysicalPercentage,
            submittedAt = r.ReportedAt,
            r.Status
        });

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var report = await _context.ProgressReports.FindAsync(id);
        if (report == null) return NotFound();
        return Ok(report);
    }

    public class ActionRequest
    {
        public string? Reason { get; set; }
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Department,Admin,PMU")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var report = await _context.ProgressReports.FindAsync(id);
        if (report == null) return NotFound("Report not found");

        report.Status = "Approved";
        await _context.SaveChangesAsync();

        await _audit.LogAsync("ProgressReport", id.ToString(), "Report Approved", "Progress report approved.");

        return Ok(new { message = "Report approved successfully" });
    }

    [HttpPost("{id}/query")]
    [Authorize(Roles = "Department,Admin,PMU")]
    public async Task<IActionResult> Query(Guid id, [FromBody] ActionRequest request)
    {
        var report = await _context.ProgressReports.FindAsync(id);
        if (report == null) return NotFound("Report not found");

        report.Status = "QueryRaised";
        await _context.SaveChangesAsync();

        await _audit.LogAsync("ProgressReport", id.ToString(), "Query Raised", request?.Reason ?? "");

        return Ok(new { message = "Query raised on report" });
    }
}
