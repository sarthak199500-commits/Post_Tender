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

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        return Ok(await _context.InspectionVisits.OrderByDescending(v => v.ScheduledDate).ToListAsync());
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
    public async Task<IActionResult> Post([FromBody] CreateVisitRequest request)
    {
        if (request is null) return BadRequest("Request body is required.");
        if (request.WorkOrderId == Guid.Empty) return BadRequest("workOrderId is required.");
        if (request.ScheduledDate == default) return BadRequest("scheduledDate is required.");
        if (string.IsNullOrWhiteSpace(request.Purpose)) return BadRequest("purpose is required.");

        var userId = CallerContext.UserId(User);
        if (userId is null) return Forbid();

        var inspector = await _context.Inspectors.FirstOrDefaultAsync(i => i.UserId == userId);
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

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        var visit = await _context.InspectionVisits.FindAsync(id);
        if (visit == null) return NotFound();

        visit.Status = request.Status;
        visit.Remarks = request.Remarks;
        if (request.Status == "Completed")
            visit.ActualVisitDate = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(visit);
    }
}
