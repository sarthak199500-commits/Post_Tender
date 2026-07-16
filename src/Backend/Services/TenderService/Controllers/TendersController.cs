using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TenderService.Persistence;
using TenderService.Entities;
using System.Linq;
using System.Threading.Tasks;
using System.IO;
using Microsoft.AspNetCore.Http;

namespace TenderService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TendersController : ControllerBase
{
    private readonly TenderServiceDbContext _context;
    private readonly IWebHostEnvironment _env;

    public TendersController(TenderServiceDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [HttpGet("awarded")]
    [Authorize(Roles = "Admin,Department")]
    public async Task<IActionResult> GetAwardedTenders()
    {
        var awardedTenders = await _context.Tenders
            .Where(t => t.Status == "Awarded")
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                t.TenderNo,
                t.Title,
                t.Description,
                t.Budget,
                t.CreatedAt,
                HasWorkOrder = t.WorkOrders.Any()
            })
            .ToListAsync();

        return Ok(awardedTenders);
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllTenders()
    {
        var tenders = await _context.Tenders
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.TenderNo, t.Title, t.TenderType, t.Budget,
                t.EMDAmount, t.Portal, t.DocumentUrl,
                t.PublishDate, t.CloseDate, t.Status, t.CreatedAt
            })
            .ToListAsync();
        return Ok(tenders);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddTender([FromForm] TenderFormDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.TenderNo))
            return BadRequest("Tender ID is required.");

        string documentUrl = string.Empty;

        if (dto.Document != null && dto.Document.Length > 0)
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "Tenders");
            Directory.CreateDirectory(uploadsDir);
            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(dto.Document.FileName)}";
            var filePath = Path.Combine(uploadsDir, fileName);
            using var stream = new FileStream(filePath, FileMode.Create);
            await dto.Document.CopyToAsync(stream);
            documentUrl = $"/Uploads/Tenders/{fileName}";
        }

        var tender = new Tender
        {
            TenderNo    = dto.TenderNo,
            Title       = dto.Title,
            Description = dto.Description ?? string.Empty,
            TenderType  = dto.TenderType ?? string.Empty,
            Budget      = dto.Budget,
            EMDAmount   = dto.EMDAmount,
            Portal      = dto.Portal ?? string.Empty,
            DocumentUrl = documentUrl,
            PublishDate = dto.PublishDate,
            CloseDate   = dto.CloseDate,
            Status      = "Open"
        };

        _context.Tenders.Add(tender);
        await _context.SaveChangesAsync();
        return Ok(tender);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateTender(Guid id, [FromForm] TenderFormDto dto)
    {
        var tender = await _context.Tenders.FindAsync(id);
        if (tender == null) return NotFound();

        tender.TenderNo = dto.TenderNo;
        tender.Title = dto.Title;
        tender.Description = dto.Description ?? string.Empty;
        tender.TenderType = dto.TenderType ?? string.Empty;
        tender.Budget = dto.Budget;
        tender.EMDAmount = dto.EMDAmount;
        tender.Portal = dto.Portal ?? string.Empty;
        tender.PublishDate = dto.PublishDate;
        tender.CloseDate = dto.CloseDate;

        if (dto.Document != null && dto.Document.Length > 0)
        {
            var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "Tenders");
            Directory.CreateDirectory(uploadsDir);
            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(dto.Document.FileName)}";
            var filePath = Path.Combine(uploadsDir, fileName);
            using var stream = new FileStream(filePath, FileMode.Create);
            await dto.Document.CopyToAsync(stream);
            tender.DocumentUrl = $"/Uploads/Tenders/{fileName}";
        }

        await _context.SaveChangesAsync();
        return Ok(tender);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTender(Guid id)
    {
        var tender = await _context.Tenders.FindAsync(id);
        if (tender == null) return NotFound();
        _context.Tenders.Remove(tender);
        await _context.SaveChangesAsync();
        return Ok();
    }

    public class TenderFormDto
    {
        public string TenderNo { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? TenderType { get; set; }
        public decimal Budget { get; set; }
        public decimal EMDAmount { get; set; }
        public string? Portal { get; set; }
        public IFormFile? Document { get; set; }
        public DateTime? PublishDate { get; set; }
        public DateTime? CloseDate { get; set; }
    }
}


