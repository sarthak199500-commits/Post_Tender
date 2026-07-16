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
}
