using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

// InspectionService DefectCategories
namespace InspectionService.Controllers;
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class DefectCategoriesController : ControllerBase
{
    private readonly InspectionService.Persistence.InspectionServiceDbContext _context;
    public DefectCategoriesController(InspectionService.Persistence.InspectionServiceDbContext context) { _context = context; }
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.DefectCategories.ToListAsync());
    [HttpPost] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Post(InspectionService.Entities.DefectCategory entity) { _context.DefectCategories.Add(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, InspectionService.Entities.DefectCategory entity) { entity.Id = id; _context.DefectCategories.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.DefectCategories.FindAsync(id); if (e!=null) { _context.DefectCategories.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
