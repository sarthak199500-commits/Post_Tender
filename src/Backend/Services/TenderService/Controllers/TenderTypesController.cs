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
    [HttpGet] public async Task<IActionResult> Get() => Ok(await _context.TenderTypes.OrderBy(t => t.Name).ToListAsync());

    public class TenderTypeDto { public string Name { get; set; } = string.Empty; }

    // Takes a DTO rather than the entity: bound directly, a caller could set Id and
    // CreatedAt. Name is required and unique — two identically named rows render the
    // same in every dropdown and cannot be told apart afterwards.
    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(TenderTypeDto dto)
    {
        var name = dto?.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Tender type name is required.");

        if (await _context.TenderTypes.AnyAsync(t => t.Name.ToLower() == name.ToLower()))
            return BadRequest($"A tender type named \"{name}\" already exists.");

        var entity = new TenderService.Entities.TenderType { Name = name };
        _context.TenderTypes.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }
    [HttpPut("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Put(Guid id, TenderService.Entities.TenderType entity) { entity.Id = id; _context.TenderTypes.Update(entity); await _context.SaveChangesAsync(); return Ok(entity); }
    [HttpDelete("{id}")] [Authorize(Roles = "Admin,PMU")] public async Task<IActionResult> Delete(Guid id) { var e = await _context.TenderTypes.FindAsync(id); if (e!=null) { _context.TenderTypes.Remove(e); await _context.SaveChangesAsync(); } return Ok(); }
}
