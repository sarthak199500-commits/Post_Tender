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
    [Authorize(Roles = "Admin,PMU,Department")]
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
                t.DepartmentId,
                HasWorkOrder = t.WorkOrders.Any()
            })
            .ToListAsync();

        return Ok(awardedTenders);
    }

    // Read-only projection (no document URLs), so every reviewing role may read it.
    // Inspector and Finance both need it to resolve tender titles and budgets for their
    // own dashboards; without it their client-side joins silently degrade to blanks and
    // Finance's "Total Budget" renders as a confident ₹0.
    [HttpGet]
    [Authorize(Roles = "Admin,PMU,Department,Inspector,Finance")]
    public async Task<IActionResult> GetAllTenders(
        [FromQuery] Guid? ulbId = null,
        [FromQuery] Guid? zoneId = null,
        [FromQuery] Guid? wardId = null)
    {
        var query = _context.Tenders.AsQueryable();

        // Location filters. Applied after scoping so they can only ever narrow the result set.
        if (ulbId is Guid u) query = query.Where(x => x.UlbId == u);
        if (zoneId is Guid z) query = query.Where(x => x.ZoneId == z);
        if (wardId is Guid w) query = query.Where(x => x.WardId == w);

        var tenders = await query
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.TenderNo, t.Title, t.TenderType, t.Budget,
                t.EMDAmount, t.Portal, t.DocumentUrl,
                t.PublishDate, t.CloseDate, t.Status, t.CreatedAt, t.DepartmentId
            })
            .ToListAsync();
        return Ok(tenders);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> AddTender([FromForm] TenderFormDto dto)
    {
        var validationError = await ValidateTender(dto, null);
        if (validationError is not null) return BadRequest(validationError);

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
            TenderNo    = dto.TenderNo.Trim(),
            Title       = dto.Title.Trim(),
            Description = dto.Description ?? string.Empty,
            TenderType  = dto.TenderType ?? string.Empty,
            Budget      = dto.Budget,
            EMDAmount   = dto.EMDAmount,
            Portal      = dto.Portal ?? string.Empty,
            DepartmentId = dto.DepartmentId,
            UlbId = dto.UlbId,
            ZoneId = dto.ZoneId,
            WardId = dto.WardId,
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
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> UpdateTender(Guid id, [FromForm] TenderFormDto dto)
    {
        var tender = await _context.Tenders.FindAsync(id);
        if (tender == null) return NotFound();

        var validationError = await ValidateTender(dto, id);
        if (validationError is not null) return BadRequest(validationError);

        tender.TenderNo = dto.TenderNo.Trim();
        tender.Title = dto.Title.Trim();
        tender.Description = dto.Description ?? string.Empty;
        tender.TenderType = dto.TenderType ?? string.Empty;
        tender.Budget = dto.Budget;
        tender.EMDAmount = dto.EMDAmount;
        tender.Portal = dto.Portal ?? string.Empty;
        tender.DepartmentId = dto.DepartmentId;
        tender.UlbId = dto.UlbId;
        tender.ZoneId = dto.ZoneId;
        tender.WardId = dto.WardId;
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
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> DeleteTender(Guid id)
    {
        var tender = await _context.Tenders.FindAsync(id);
        if (tender == null) return NotFound();
        _context.Tenders.Remove(tender);
        await _context.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Shared by create and update. Only TenderNo used to be checked, so a tender could be
    /// filed with no title, a zero or negative budget, an EMD larger than the budget, or a
    /// close date before its publish date. `excludeId` is the tender being edited.
    /// </summary>
    private async Task<string?> ValidateTender(TenderFormDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.TenderNo)) return "Tender ID is required.";
        if (string.IsNullOrWhiteSpace(dto.Title)) return "Title is required.";

        var tenderNo = dto.TenderNo.Trim();
        if (await _context.Tenders.AnyAsync(t => t.TenderNo == tenderNo && (excludeId == null || t.Id != excludeId)))
            return $"A tender numbered '{tenderNo}' already exists.";

        if (dto.Budget <= 0) return "Budget must be greater than zero.";
        if (dto.EMDAmount < 0) return "EMD amount cannot be negative.";

        // EMD is earnest money against the contract; larger than the contract is nonsense.
        if (dto.EMDAmount > dto.Budget)
            return "EMD amount cannot exceed the tender budget.";

        if (dto.PublishDate is DateTime publish && dto.CloseDate is DateTime close && close <= publish)
            return "Close date must be after the publish date.";

        return null;
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
        public Guid? DepartmentId { get; set; }
        public Guid? UlbId { get; set; }
        public Guid? ZoneId { get; set; }
        public Guid? WardId { get; set; }
    }
}


