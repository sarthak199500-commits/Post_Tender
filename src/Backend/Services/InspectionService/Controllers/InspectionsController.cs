using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InspectionService.Persistence;
using InspectionService.Entities;
using InspectionService.Security;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace InspectionService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InspectionsController : ControllerBase
{
    private readonly InspectionServiceDbContext _context;

    public InspectionsController(InspectionServiceDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        return Ok(await _context.Inspections.Include(i => i.Defects).ToListAsync());
    }

    // The vendor's own inspections that carry at least one defect — this is the "Quality
    // Defects & Rectification" worklist. Scoped to the caller's vendor claim, fail closed.
    [HttpGet("vendor")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> ForVendor()
    {
        var me = CallerContext.VendorId(User);
        if (me is null) return Forbid();

        var inspections = await _context.Inspections
            .Include(i => i.Defects)
            .Where(i => i.VendorId == me && i.Defects.Any())
            .OrderByDescending(i => i.InspectionDate)
            .ToListAsync();

        return Ok(inspections);
    }

    // The inspector's own log — everything this inspector raised. Mirrors ForVendor but
    // scopes on the user id claim, since an inspector is a user rather than a tenant.
    [HttpGet("inspector")]
    [Authorize(Roles = "Inspector,Admin,PMU")]
    public async Task<IActionResult> ForInspector()
    {
        var query = _context.Inspections.Include(i => i.Defects).AsQueryable();

        // Admin/PMU oversee every inspector's log; an inspector sees only their own.
        if (User.IsInRole("Inspector"))
        {
            var me = CallerContext.UserId(User);
            if (me is null) return Forbid();
            query = query.Where(i => i.InspectorId == me);
        }

        return Ok(await query.OrderByDescending(i => i.InspectionDate).ToListAsync());
    }

    public class CreateInspectionDto
    {
        public Guid ProjectId { get; set; }
        // Denormalized from the project's work order by the caller — the work order lives
        // in TenderService and this codebase joins across services on the client. Without
        // it the vendor's own defect worklist (ForVendor) would never surface the defect.
        public Guid VendorId { get; set; }
        public string Remarks { get; set; } = string.Empty;
        public List<CreateDefectDto> Defects { get; set; } = new();
    }

    public class CreateDefectDto
    {
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = "Low";
    }

    // Inspector logs an inspection and the defects found. InspectorId comes from the token,
    // never the body.
    [HttpPost]
    [Authorize(Roles = "Inspector")]
    public async Task<IActionResult> Create([FromBody] CreateInspectionDto dto)
    {
        if (dto is null) return BadRequest("Request body is required.");
        if (dto.ProjectId == Guid.Empty) return BadRequest("projectId is required.");
        if (string.IsNullOrWhiteSpace(dto.Remarks)) return BadRequest("remarks is required.");
        if (dto.Defects.Count == 0) return BadRequest("At least one defect is required.");
        if (dto.Defects.Any(d => string.IsNullOrWhiteSpace(d.Description)))
            return BadRequest("Every defect needs a description.");

        var me = CallerContext.UserId(User);
        if (me is null) return Forbid();

        var inspection = new Inspection
        {
            ProjectId = dto.ProjectId,
            VendorId = dto.VendorId,
            InspectorId = me.Value,
            InspectionDate = DateTime.UtcNow,
            Remarks = dto.Remarks,
            Status = "Follow-up Required",
            Defects = dto.Defects.Select(d => new InspectionDefect
            {
                Description = d.Description,
                Severity = d.Severity,
                Status = "Open"
            }).ToList()
        };

        _context.Inspections.Add(inspection);
        await _context.SaveChangesAsync();

        return Ok(inspection);
    }

    public class VerifyRequest
    {
        public bool IsVerified { get; set; }
    }

    // Inspector closes out a vendor's rectification. Accepting moves the defect to
    // Verified; rejecting sends it back to Open so the vendor can rework and resubmit.
    // Only a Rectified defect is actionable — verifying an Open one would skip the vendor.
    [HttpPut("defect/{defectId}/verify")]
    [Authorize(Roles = "Inspector,Admin,PMU")]
    public async Task<IActionResult> VerifyDefect(Guid defectId, [FromBody] VerifyRequest request)
    {
        var query = _context.Inspections.Include(i => i.Defects).AsQueryable();

        if (User.IsInRole("Inspector"))
        {
            var me = CallerContext.UserId(User);
            if (me is null) return Forbid();
            query = query.Where(i => i.InspectorId == me);
        }

        var inspection = await query.FirstOrDefaultAsync(i => i.Defects.Any(d => d.Id == defectId));
        if (inspection is null) return NotFound("Defect not found.");

        var defect = inspection.Defects.First(d => d.Id == defectId);
        if (defect.Status != "Rectified")
            return BadRequest("Only a rectified defect can be verified.");

        if (request.IsVerified)
        {
            defect.Status = "Verified";
        }
        else
        {
            // Reopen for rework: drop the rejected evidence so the vendor must resubmit.
            defect.Status = "Open";
            defect.ReworkReportUrl = null;
            defect.RectifiedAt = null;
        }

        // The inspection is only resolved once nothing is left open or awaiting review.
        inspection.Status = inspection.Defects.All(d => d.Status == "Verified")
            ? "Resolved"
            : "Follow-up Required";

        await _context.SaveChangesAsync();

        return Ok(defect);
    }

    public class RectifyRequest
    {
        public string ReworkReportUrl { get; set; } = string.Empty;
    }

    // Vendor submits evidence that a defect has been fixed. Moves the defect Open -> Rectified;
    // a reviewer later verifies it. Scoped so a vendor can only rectify defects on its own
    // inspections.
    [HttpPut("defect/{defectId}/rectify")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> RectifyDefect(Guid defectId, [FromBody] RectifyRequest request)
    {
        var me = CallerContext.VendorId(User);
        if (me is null) return Forbid();

        if (string.IsNullOrWhiteSpace(request.ReworkReportUrl))
            return BadRequest("reworkReportUrl is required.");

        var inspection = await _context.Inspections
            .Include(i => i.Defects)
            .FirstOrDefaultAsync(i => i.VendorId == me && i.Defects.Any(d => d.Id == defectId));
        if (inspection is null) return NotFound("Defect not found.");

        var defect = inspection.Defects.First(d => d.Id == defectId);
        defect.Status = "Rectified";
        defect.ReworkReportUrl = request.ReworkReportUrl;
        defect.RectifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(defect);
    }
}
