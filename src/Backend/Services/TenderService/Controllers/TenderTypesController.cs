using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace TenderService.Controllers;
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenderTypesController : ControllerBase
{
    private readonly TenderService.Persistence.TenderServiceDbContext _context;
    public TenderTypesController(TenderService.Persistence.TenderServiceDbContext context) { _context = context; }
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.TenderTypes.ToListAsync());
    [HttpPost] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Post(TenderService.Entities.TenderType entity) { _context.TenderTypes.Add(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, TenderService.Entities.TenderType entity) { entity.Id = id; _context.TenderTypes.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.TenderTypes.FindAsync(id); if (e!=null) { _context.TenderTypes.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
