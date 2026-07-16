using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ExecutionService.Controllers;
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class MilestoneTemplatesController : ControllerBase
{
    private readonly ExecutionService.Persistence.ExecutionServiceDbContext _context;
    public MilestoneTemplatesController(ExecutionService.Persistence.ExecutionServiceDbContext context) { _context = context; }
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.MilestoneTemplates.ToListAsync());
    [HttpPost] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Post(ExecutionService.Entities.MilestoneTemplate entity) { _context.MilestoneTemplates.Add(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, ExecutionService.Entities.MilestoneTemplate entity) { entity.Id = id; _context.MilestoneTemplates.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.MilestoneTemplates.FindAsync(id); if (e!=null) { _context.MilestoneTemplates.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
