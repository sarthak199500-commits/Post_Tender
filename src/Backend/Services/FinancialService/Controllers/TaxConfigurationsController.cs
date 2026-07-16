using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace FinancialService.Controllers;
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class TaxConfigurationsController : ControllerBase
{
    private readonly FinancialService.Persistence.FinancialServiceDbContext _context;
    public TaxConfigurationsController(FinancialService.Persistence.FinancialServiceDbContext context) { _context = context; }
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.TaxConfigurations.ToListAsync());
    [HttpPost] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Post(FinancialService.Entities.TaxConfiguration entity) { _context.TaxConfigurations.Add(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, FinancialService.Entities.TaxConfiguration entity) { entity.Id = id; _context.TaxConfigurations.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.TaxConfigurations.FindAsync(id); if (e!=null) { _context.TaxConfigurations.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
