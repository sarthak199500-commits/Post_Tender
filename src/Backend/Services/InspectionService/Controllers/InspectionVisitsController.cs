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
public class InspectionVisitsController : ControllerBase
{
    private readonly InspectionServiceDbContext _context;

    public InspectionVisitsController(InspectionServiceDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// The caller's inspector profile, or null when the login has none. Visits are keyed on the
    /// profile id while the token carries the user id, so every ownership check goes through here.
    /// </summary>
    private async Task<Inspector?> CallerInspectorAsync()
    {
        var userId = CallerContext.UserId(User);
        if (userId is null) return null;
        return await _context.Inspectors.FirstOrDefaultAsync(i => i.UserId == userId);
    }

    // Oversight roles only — a vendor's own visits come from ForVendor below. Admin/PMU oversee
    // every inspector's schedule; an inspector sees only their own. A login with no inspector
    // profile owns no visits, so it gets an empty list rather than everyone else's.
    [HttpGet]
    [Authorize(Roles = "Inspector,Admin,PMU")]
    public async Task<IActionResult> Get()
    {
        var query = _context.InspectionVisits.AsQueryable();

        if (User.IsInRole("Inspector"))
        {
            var me = await CallerInspectorAsync();
            if (me is null) return Ok(Array.Empty<InspectionVisit>());
            query = query.Where(v => v.InspectorId == me.Id);
        }

        return Ok(await query.OrderByDescending(v => v.ScheduledDate).ToListAsync());
    }

    // The visits booked against this vendor's own work orders, so the vendor can see who is
    // coming and when. Scoped to the caller's vendor claim, fail closed.
    [HttpGet("vendor")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> ForVendor()
    {
        var me = CallerContext.VendorId(User);
        if (me is null) return Forbid();

        return Ok(await _context.InspectionVisits
            .Where(v => v.VendorId == me)
            .OrderBy(v => v.ScheduledDate)
            .ToListAsync());
    }

    public class VisitVendorMapping
    {
        public Guid WorkOrderId { get; set; }
        public Guid VendorId { get; set; }
    }

    // One-off repair for visits scheduled before InspectionVisit carried a VendorId: those
    // rows were backfilled with Guid.Empty and so belong to nobody, leaving them invisible on
    // the vendor's schedule. Work orders live in TenderService, so the caller supplies the
    // workOrderId -> vendorId mapping (the same cross-service join the clients already do).
    // Only ever fills a blank VendorId — an already-attributed visit is never reassigned.
    [HttpPost("backfill-vendor")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> BackfillVendor([FromBody] List<VisitVendorMapping> mappings)
    {
        if (mappings is null || mappings.Count == 0)
            return BadRequest("At least one workOrderId/vendorId mapping is required.");

        var byWorkOrder = mappings
            .Where(m => m.WorkOrderId != Guid.Empty && m.VendorId != Guid.Empty)
            .GroupBy(m => m.WorkOrderId)
            .ToDictionary(g => g.Key, g => g.First().VendorId);

        if (byWorkOrder.Count == 0)
            return BadRequest("Every mapping must carry a non-empty workOrderId and vendorId.");

        var orphans = await _context.InspectionVisits
            .Where(v => v.VendorId == Guid.Empty)
            .ToListAsync();

        var updated = 0;
        foreach (var visit in orphans)
        {
            if (!byWorkOrder.TryGetValue(visit.WorkOrderId, out var vendorId)) continue;
            visit.VendorId = vendorId;
            updated++;
        }

        if (updated > 0) await _context.SaveChangesAsync();

        return Ok(new { matched = updated, unresolved = orphans.Count - updated });
    }

    public class CreateVisitRequest
    {
        public Guid WorkOrderId { get; set; }
        // Denormalized by the caller from the selected work order — see InspectionVisit.VendorId.
        public Guid VendorId { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string Purpose { get; set; } = string.Empty;
    }

    // InspectionVisit.InspectorId is a foreign key to Inspectors.Id, so it must carry the
    // inspector's profile id — not the caller's user id, which is what the token holds and which
    // no Inspectors row is keyed on. Work orders are assigned on the same profile id, which is
    // why the client resolves the profile too before listing them.
    [HttpPost]
    [Authorize(Roles = "Inspector")]
    public async Task<IActionResult> Post([FromBody] CreateVisitRequest request)
    {
        if (request is null) return BadRequest("Request body is required.");
        if (request.WorkOrderId == Guid.Empty) return BadRequest("workOrderId is required.");
        if (request.VendorId == Guid.Empty) return BadRequest("vendorId is required.");
        if (request.ScheduledDate == default) return BadRequest("scheduledDate is required.");
        if (string.IsNullOrWhiteSpace(request.Purpose)) return BadRequest("purpose is required.");

        var inspector = await CallerInspectorAsync();
        if (inspector is null)
            return BadRequest("No inspector profile is linked to this login, so a visit cannot be scheduled.");

        var visit = new InspectionVisit
        {
            WorkOrderId = request.WorkOrderId,
            VendorId = request.VendorId,
            InspectorId = inspector.Id,
            ScheduledDate = request.ScheduledDate,
            Purpose = request.Purpose,
            Status = "Scheduled"
        };
        _context.InspectionVisits.Add(visit);
        await _context.SaveChangesAsync();
        return Ok(visit);
    }

    public class UpdateStatusRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? Remarks { get; set; }
    }

    private static readonly string[] AllowedVisitStatuses = { "Scheduled", "Completed", "Cancelled" };

    // Closing out a visit is the inspector's call, never the vendor's — a vendor who knows a
    // visit id (their own now come back from ForVendor) could otherwise cancel the inspection
    // booked against them, or mark it Completed without anyone attending. Scoped the same way
    // as the list: an inspector may only close out or cancel their own visit, and a visit
    // belonging to someone else reads as not-found rather than advertising that it exists.
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Inspector,Admin,PMU")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        if (request is null) return BadRequest("Request body is required.");
        if (!AllowedVisitStatuses.Contains(request.Status))
            return BadRequest($"'{request.Status}' is not a valid visit status. Use one of: {string.Join(", ", AllowedVisitStatuses)}.");

        var query = _context.InspectionVisits.AsQueryable();

        if (User.IsInRole("Inspector"))
        {
            var me = await CallerInspectorAsync();
            if (me is null) return NotFound();
            query = query.Where(v => v.InspectorId == me.Id);
        }

        var visit = await query.FirstOrDefaultAsync(v => v.Id == id);
        if (visit == null) return NotFound();

        visit.Status = request.Status;
        visit.Remarks = request.Remarks;
        if (request.Status == "Completed")
            visit.ActualVisitDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(visit);
    }
}
