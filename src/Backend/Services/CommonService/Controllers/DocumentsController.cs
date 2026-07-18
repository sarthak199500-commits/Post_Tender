using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CommonService.Persistence;
using CommonService.Entities;
using CommonService.Security;
using System;
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
        var query = _context.ContractDocuments.AsQueryable();

        // A vendor sees only its own documents; reviewers (Admin/PMU/Department) see all.
        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(d => d.VendorId == me);
        }

        return Ok(await query.OrderByDescending(d => d.UploadedAt).ToListAsync());
    }

    public class CreateDocumentDto
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = "General";
        public string Size { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }

    // Records the metadata for a file already uploaded via POST /api/files/upload. Without
    // this endpoint the upload succeeded but the record 404'd, orphaning the file on disk.
    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateDocumentDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name is required.");
        if (string.IsNullOrWhiteSpace(dto.Url)) return BadRequest("Url is required.");

        var document = new ContractDocument
        {
            Id = Guid.NewGuid(),
            VendorId = vendorId.Value,
            Name = dto.Name,
            Type = string.IsNullOrWhiteSpace(dto.Type) ? "General" : dto.Type,
            Size = dto.Size,
            Url = dto.Url,
            UploadedAt = DateTime.UtcNow,
            Status = "Pending"
        };

        _context.ContractDocuments.Add(document);
        await _context.SaveChangesAsync();

        return Ok(document);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var me = CallerContext.VendorId(User);
        if (me is null) return Forbid();

        // NotFound (not Forbid) for another vendor's document, so a 403 cannot confirm the id.
        var document = await _context.ContractDocuments.FirstOrDefaultAsync(d => d.Id == id);
        if (document is null || document.VendorId != me) return NotFound();

        _context.ContractDocuments.Remove(document);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Document removed" });
    }
}
