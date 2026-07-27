using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TenderService.Persistence;
using TenderService.Entities;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace TenderService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenderAllotmentsController : ControllerBase
{
    private readonly TenderServiceDbContext _context;

    public TenderAllotmentsController(TenderServiceDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        // Join the local Tender (same DB) so the Issue Work Order wizard gets the tender
        // number/title/budget it needs. l1VendorName lives in VendorService and is resolved
        // on the client.
        var allotments = await _context.TenderAllotments
            .OrderByDescending(a => a.CreatedAt)
            .Join(_context.Tenders,
                a => a.TenderId,
                t => t.Id,
                (a, t) => new
                {
                    a.Id,
                    a.TenderId,
                    tenderNo = t.TenderNo,
                    tenderTitle = t.Title,
                    tenderBudget = t.Budget,
                    l1VendorId = a.L1VendorId,
                    a.CreatedAt
                })
            .ToListAsync();

        return Ok(allotments);
    }

    public class CreateAllotmentDto
    {
        public Guid TenderId { get; set; }
        public Guid? L1VendorId { get; set; }
        public Guid? L2VendorId { get; set; }
        public Guid? L3VendorId { get; set; }
    }

    // Records the bid ranking for a tender and awards it. The frontend has always POSTed
    // here but no handler existed, so "Save Allotment" returned 405 and nothing was saved.
    //
    // Awarding is what moves the tender into the Awarded list that the Issue Work Order
    // wizard reads from, so it is done here rather than left as a separate manual step —
    // otherwise a saved allotment would never reach the rest of the chain.
    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Create([FromBody] CreateAllotmentDto dto)
    {
        if (dto is null) return BadRequest("Request body is required.");
        if (dto.TenderId == Guid.Empty) return BadRequest("A tender must be selected.");
        if (dto.L1VendorId is null || dto.L1VendorId == Guid.Empty)
            return BadRequest("An L1 vendor is required.");

        // L1/L2/L3 are a ranking of competing bidders — the same vendor cannot hold two
        // places. Guid.Empty is treated as "not supplied" so an omitted optional slot
        // does not collide with another omitted one.
        var ranked = new[] { dto.L1VendorId, dto.L2VendorId, dto.L3VendorId }
            .Where(id => id.HasValue && id != Guid.Empty)
            .Select(id => id!.Value)
            .ToList();
        if (ranked.Distinct().Count() != ranked.Count)
            return BadRequest("L1, L2 and L3 must be three different vendors.");

        var tender = await _context.Tenders.FirstOrDefaultAsync(t => t.Id == dto.TenderId);
        if (tender is null) return BadRequest("Tender not found.");

        if (await _context.TenderAllotments.AnyAsync(a => a.TenderId == dto.TenderId))
            return BadRequest("This tender has already been allotted.");

        var allotment = new TenderAllotment
        {
            TenderId = dto.TenderId,
            L1VendorId = dto.L1VendorId,
            L2VendorId = dto.L2VendorId == Guid.Empty ? null : dto.L2VendorId,
            L3VendorId = dto.L3VendorId == Guid.Empty ? null : dto.L3VendorId,
        };

        _context.TenderAllotments.Add(allotment);
        tender.Status = "Awarded";
        await _context.SaveChangesAsync();

        return Ok(new
        {
            allotment.Id,
            allotment.TenderId,
            l1VendorId = allotment.L1VendorId,
            l2VendorId = allotment.L2VendorId,
            l3VendorId = allotment.L3VendorId,
            allotment.CreatedAt,
        });
    }
}
