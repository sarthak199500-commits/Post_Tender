using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace IdentityService.Controllers;
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly IdentityService.Persistence.IdentityDbContext _context;
    public DepartmentsController(IdentityService.Persistence.IdentityDbContext context) { _context = context; }
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.Departments.ToListAsync());
    [HttpPost] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Post(IdentityService.Entities.Department entity) { _context.Departments.Add(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, IdentityService.Entities.Department entity) { entity.Id = id; _context.Departments.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.Departments.FindAsync(id); if (e!=null) { _context.Departments.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
