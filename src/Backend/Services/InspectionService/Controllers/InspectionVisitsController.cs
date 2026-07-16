using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InspectionService.Persistence;
using InspectionService.Entities;
using System;
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

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] CreateVisitRequest request)
    {
        var inspectorId = Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : Guid.Empty;
        var visit = new InspectionVisit
        {
            WorkOrderId = request.WorkOrderId,
            InspectorId = inspectorId,
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
