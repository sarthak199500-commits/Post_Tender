using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExecutionService.Entities;
using ExecutionService.Persistence;
using ExecutionService.Security;
using ExecutionService.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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

    public class CreateProgressReportDto
    {
        public Guid ProjectId { get; set; }
        // Accepted for wire compatibility with the existing frontend payload but ignored:
        // the vendorId claim is authoritative, so a vendor cannot file under another tenant.
        public Guid VendorId { get; set; }
        public decimal PhysicalPercentage { get; set; }
        public string WorkDescription { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public List<string> MediaUrls { get; set; } = new();
        public Guid? MilestoneId { get; set; }
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateProgressReportDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (dto.ProjectId == Guid.Empty)
            return BadRequest("ProjectId is required.");

        if (dto.PhysicalPercentage < 0 || dto.PhysicalPercentage > 100)
            return BadRequest("PhysicalPercentage must be between 0 and 100.");

        var report = new ProgressReport
        {
            ProjectId = dto.ProjectId,
            VendorId = vendorId.Value,
            PhysicalPercentage = dto.PhysicalPercentage,
            WorkDescription = dto.WorkDescription,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            MediaUrls = dto.MediaUrls,
            MilestoneId = dto.MilestoneId,
            Status = "Submitted"
        };

        _context.ProgressReports.Add(report);
        await _context.SaveChangesAsync();

        await _audit.LogAsync("ProgressReport", report.Id.ToString(), "Progress submitted",
            $"{report.PhysicalPercentage}% reported for project {report.ProjectId}.");

        return Ok(report);
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

    // Both literal routes below MUST stay above [HttpGet("{id}")]. Declared after it,
    // "my" and "project" bind to the Guid id parameter and return 400 instead of matching.
    [HttpGet("my")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Mine()
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        return Ok(await _context.ProgressReports
            .Where(r => r.VendorId == vendorId)
            .OrderByDescending(r => r.ReportedAt)
            .ToListAsync());
    }

    [HttpGet("project/{projectId}")]
    public async Task<IActionResult> ByProject(Guid projectId)
    {
        var query = _context.ProgressReports.Where(r => r.ProjectId == projectId);

        // Reviewers see every vendor's reports on the project; a vendor sees only its own.
        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(r => r.VendorId == me);
        }

        return Ok(await query.OrderByDescending(r => r.ReportedAt).ToListAsync());
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

    public class ReviewRequest
    {
        public string Recommendation { get; set; } = string.Empty;  // Accept, Reject
        public string? Remarks { get; set; }
    }

    // Inspector review stage. An inspector inspects the reported work and records a
    // recommendation; only after this can the department approve. This is what turns the
    // two previously-independent buttons into a real Inspector -> Department chain.
    [HttpPost("{id}/review")]
    [Authorize(Roles = "Inspector")]
    public async Task<IActionResult> Review(Guid id, [FromBody] ReviewRequest request)
    {
        var report = await _context.ProgressReports.FirstOrDefaultAsync(r => r.Id == id);
        if (report is null) return NotFound();

        if (report.Status != "Submitted")
            return BadRequest($"Only a Submitted report can be reviewed (current: '{report.Status}').");

        if (request.Recommendation != "Accept" && request.Recommendation != "Reject")
            return BadRequest("Recommendation must be 'Accept' or 'Reject'.");

        report.InspectorRecommendation = request.Recommendation;
        report.InspectorRemarks = request.Remarks;
        report.ReviewedByInspectorId = Guid.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : null;
        report.InspectorReviewedAt = DateTime.UtcNow;
        report.Status = "Reviewed";

        await _context.SaveChangesAsync();

        await _audit.LogAsync("ProgressReport", id.ToString(), "Report Reviewed",
            $"Inspector recommendation: {request.Recommendation}.");

        return Ok(report);
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Department,Admin,PMU")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var report = await _context.ProgressReports.FindAsync(id);
        if (report == null) return NotFound("Report not found");

        if (report.Status != "Reviewed")
            return BadRequest("A report must be reviewed by an inspector before approval.");

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
