using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace CommonService.Controllers;
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class LocationsController : ControllerBase
{
    private readonly CommonService.Persistence.CommonServiceDbContext _context;
    public LocationsController(CommonService.Persistence.CommonServiceDbContext context) { _context = context; }
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.Locations.ToListAsync());
    [HttpPost] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Post(CommonService.Entities.Location entity) { _context.Locations.Add(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, CommonService.Entities.Location entity) { entity.Id = id; _context.Locations.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.Locations.FindAsync(id); if (e!=null) { _context.Locations.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
