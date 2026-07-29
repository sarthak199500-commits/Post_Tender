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

    // Admin/PMU oversee every inspector's schedule; an inspector sees only their own. A login with
    // no inspector profile owns no visits, so it gets an empty list rather than everyone else's.
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

    public class CreateVisitRequest
    {
        public Guid WorkOrderId { get; set; }
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
        if (request.ScheduledDate == default) return BadRequest("scheduledDate is required.");
        if (string.IsNullOrWhiteSpace(request.Purpose)) return BadRequest("purpose is required.");

        var inspector = await CallerInspectorAsync();
        if (inspector is null)
            return BadRequest("No inspector profile is linked to this login, so a visit cannot be scheduled.");

        var visit = new InspectionVisit
        {
            WorkOrderId = request.WorkOrderId,
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

    // Scoped the same way as the list: an inspector may only close out or cancel their own visit,
    // and a visit belonging to someone else reads as not-found rather than advertising that it exists.
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Inspector,Admin,PMU")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
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
