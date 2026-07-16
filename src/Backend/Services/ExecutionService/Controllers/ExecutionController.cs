using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExecutionService.Persistence;
using ExecutionService.Entities;
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

    public ExecutionController(ExecutionServiceDbContext context)
    {
        _context = context;
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
