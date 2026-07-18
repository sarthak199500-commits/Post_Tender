using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InspectionService.Persistence;
using InspectionService.Entities;
using InspectionService.Security;
using System;
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
