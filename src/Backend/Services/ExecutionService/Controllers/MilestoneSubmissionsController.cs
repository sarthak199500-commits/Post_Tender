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
using System.Threading.Tasks;

namespace ExecutionService.Controllers;

/// <summary>
/// A vendor assembles a milestone completion package here: notes, links to existing
/// progress reports, and supporting documents. The package is a mutable Draft until the
/// vendor submits it, at which point it becomes immutable (an audit-grade evidence record
/// that inspectors and reviewers read but no one edits). Reviewers may read any vendor's
/// package; a vendor sees only its own.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MilestoneSubmissionsController : ControllerBase
{
    private readonly ExecutionServiceDbContext _context;
    private readonly AuditLogger _audit;

    public MilestoneSubmissionsController(ExecutionServiceDbContext context, AuditLogger audit)
    {
        _context = context;
        _audit = audit;
    }

    // The frontend calls this to discover whether a package already exists for a milestone.
    // Reviewers (Inspector/Department/Admin/PMU) view any vendor's package; a vendor sees
    // only its own and fails closed if its token carries no claim.
    [HttpGet("milestone/{milestoneId}")]
    public async Task<IActionResult> GetByMilestone(Guid milestoneId)
    {
        var query = _context.MilestoneSubmissions
            .Include(s => s.Documents)
            .Where(s => s.MilestoneId == milestoneId);

        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(s => s.VendorId == me);
        }

        return Ok(await query.OrderByDescending(s => s.CreatedAt).ToListAsync());
    }

    public class CreateSubmissionDto
    {
        public Guid MilestoneId { get; set; }
        public Guid ProjectId { get; set; }
        public string Notes { get; set; } = string.Empty;
        public List<Guid> LinkedReportIds { get; set; } = new();
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateSubmissionDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (dto.MilestoneId == Guid.Empty) return BadRequest("MilestoneId is required.");

        var submission = new MilestoneSubmission
        {
            MilestoneId = dto.MilestoneId,
            ProjectId = dto.ProjectId,
            VendorId = vendorId.Value,
            Notes = dto.Notes,
            LinkedReportIds = dto.LinkedReportIds ?? new(),
            Status = "Draft",
            IsImmutable = false
        };

        _context.MilestoneSubmissions.Add(submission);
        await _context.SaveChangesAsync();

        return Ok(submission);
    }

    public class UpdateSubmissionDto
    {
        public string Notes { get; set; } = string.Empty;
        public List<Guid> LinkedReportIds { get; set; } = new();
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSubmissionDto dto)
    {
        var (submission, error) = await LoadOwned(id);
        if (error is not null) return error;

        if (submission!.IsImmutable)
            return Conflict("A submitted milestone package is immutable and cannot be edited.");

        submission.Notes = dto.Notes;
        submission.LinkedReportIds = dto.LinkedReportIds ?? new();
        await _context.SaveChangesAsync();

        return Ok(submission);
    }

    [HttpPost("{id}/submit")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Submit(Guid id)
    {
        var (submission, error) = await LoadOwned(id);
        if (error is not null) return error;

        if (submission!.IsImmutable)
            return Conflict("This milestone package has already been submitted.");

        submission.Status = "Submitted";
        submission.SubmittedAt = DateTime.UtcNow;
        submission.IsImmutable = true;
        await _context.SaveChangesAsync();

        await _audit.LogAsync("MilestoneSubmission", submission.Id.ToString(), "Milestone submitted",
            $"Milestone {submission.MilestoneId} package submitted for inspection.");

        return Ok(submission);
    }

    public class AddDocumentDto
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string Size { get; set; } = string.Empty;
    }

    [HttpPost("{id}/documents")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> AddDocument(Guid id, [FromBody] AddDocumentDto dto)
    {
        var (submission, error) = await LoadOwned(id);
        if (error is not null) return error;

        if (submission!.IsImmutable)
            return Conflict("Documents cannot be added to a submitted package.");

        var document = new MilestoneDocument
        {
            MilestoneSubmissionId = submission.Id,
            Name = dto.Name,
            Type = dto.Type,
            Url = dto.Url,
            Size = dto.Size
        };

        _context.MilestoneDocuments.Add(document);
        await _context.SaveChangesAsync();

        return Ok(document);
    }

    [HttpDelete("{id}/documents/{docId}")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> RemoveDocument(Guid id, Guid docId)
    {
        var (submission, error) = await LoadOwned(id);
        if (error is not null) return error;

        if (submission!.IsImmutable)
            return Conflict("Documents cannot be removed from a submitted package.");

        var document = await _context.MilestoneDocuments
            .FirstOrDefaultAsync(d => d.Id == docId && d.MilestoneSubmissionId == submission.Id);
        if (document is null) return NotFound();

        _context.MilestoneDocuments.Remove(document);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Document removed" });
    }

    // Loads a submission that belongs to the calling vendor. Returns Forbid when the token
    // carries no vendor claim, and NotFound when the id is unknown OR owned by another
    // vendor — a 403 there would confirm the id exists to a caller who shouldn't know.
    private async Task<(MilestoneSubmission?, IActionResult?)> LoadOwned(Guid id)
    {
        var me = CallerContext.VendorId(User);
        if (me is null) return (null, Forbid());

        var submission = await _context.MilestoneSubmissions.FindAsync(id);
        if (submission is null || submission.VendorId != me) return (null, NotFound());

        return (submission, null);
    }
}
