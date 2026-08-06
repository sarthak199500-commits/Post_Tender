using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TenderService.Persistence;
using TenderService.Security;
using TenderService.Entities;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace TenderService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectsController : ControllerBase
{
    private readonly TenderServiceDbContext _context;

    public ProjectsController(TenderServiceDbContext context)
    {
        _context = context;
    }

    // Project carries no VendorId, but Project.WorkOrder.VendorId lives in this same
    // service, so a vendor's projects can be scoped without a cross-service call.
    private IQueryable<Project>? ScopedProjects()
    {
        var query = _context.Projects.AsQueryable();

        if (!CallerContext.IsVendor(User))
            return query;

        var me = CallerContext.VendorId(User);
        if (me is null) return null;   // fail closed

        return query.Where(p => p.WorkOrder != null && p.WorkOrder.VendorId == me);
    }

    [HttpGet]
    public async Task<IActionResult> GetProjects(
        [FromQuery] Guid? ulbId = null,
        [FromQuery] Guid? zoneId = null,
        [FromQuery] Guid? wardId = null)
    {
        var query = ScopedProjects();
        if (query is null) return Forbid();

        // Location filters. Applied after scoping so they can only ever narrow the result set.
        if (ulbId is Guid u) query = query.Where(x => x.UlbId == u);
        if (zoneId is Guid z) query = query.Where(x => x.ZoneId == z);
        if (wardId is Guid w) query = query.Where(x => x.WardId == w);

        return Ok(await query.OrderByDescending(p => p.CreatedAt).ToListAsync());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var query = ScopedProjects();
        if (query is null) return Forbid();

        // NotFound rather than Forbid for another tenant's project: a 403 would confirm
        // the id exists.
        var p = await query.FirstOrDefaultAsync(w => w.Id == id);
        if (p == null) return NotFound();
        return Ok(p);
    }
}
