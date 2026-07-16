using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CommonService.Persistence;
using CommonService.Entities;
using System.Linq;
using System.Threading.Tasks;

namespace CommonService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly CommonServiceDbContext _context;

    public DocumentsController(CommonServiceDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        return Ok(await _context.ContractDocuments.ToListAsync());
    }
}
