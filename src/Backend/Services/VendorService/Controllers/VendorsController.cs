using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VendorService.Persistence;
using VendorService.Entities;

namespace VendorService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VendorsController : ControllerBase
{
    private readonly VendorDbContext _context;

    public VendorsController(VendorDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetVendors([FromQuery] string? search, [FromQuery] string? status)
    {
        var query = _context.Vendors.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(v => v.Name.Contains(search) || v.VendorCode.Contains(search));
        }
        
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(v => v.Status == status);
        }

        var vendors = await query.OrderByDescending(v => v.CreatedAt).Select(v => new
        {
            v.Id,
            v.UserId,
            v.Name,
            v.VendorCode,
            v.GSTNo,
            v.ContactEmail,
            v.Status,
            v.PerformanceScore,
            v.CreatedAt
        }).ToListAsync();

        return Ok(vendors);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddVendor([FromBody] VendorDto dto)
    {
        // In a true Microservices architecture, creating a Vendor user account
        // should be done via a synchronous HTTP call to IdentityService or via RabbitMQ Event.
        // For this local SQLite migration demo, we assume the user creation is handled by IdentityService API.
        
        var generatedUserId = Guid.NewGuid(); // Mocking identity creation for now

        var vendor = new Vendor
        {
            Name = dto.Name,
            VendorCode = $"VEND-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}",
            GSTNo = dto.GSTNo ?? string.Empty,
            YearOfIncorporation = dto.YearOfIncorporation,
            AuthPersonName = dto.AuthPersonName ?? string.Empty,
            Mobile = dto.Mobile ?? string.Empty,
            AlternativeNumber = dto.AlternativeNumber ?? string.Empty,
            ContactEmail = dto.Email,
            UserId = generatedUserId,
            CategoryId = dto.CategoryId,
            Status = "Active"
        };

        _context.Vendors.Add(vendor);
        await _context.SaveChangesAsync();

        return Ok(vendor);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateVendorStatus(Guid id, [FromBody] StatusUpdateDto dto)
    {
        var vendor = await _context.Vendors.FindAsync(id);
        if (vendor == null) return NotFound();

        vendor.Status = dto.Status;
        await _context.SaveChangesAsync();
        return Ok(vendor);
    }

    public class StatusUpdateDto
    {
        public string Status { get; set; } = string.Empty;
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteVendor(Guid id)
    {
        var vendor = await _context.Vendors.FindAsync(id);
        if (vendor == null) return NotFound();

        _context.Vendors.Remove(vendor);
        // Note: We no longer delete the User here. IdentityService handles that. 
        // We would emit a VendorDeletedEvent.

        await _context.SaveChangesAsync();
        return Ok();
    }

    public class VendorDto
    {
        public string Name { get; set; } = string.Empty;
        public string? GSTNo { get; set; }
        public int? YearOfIncorporation { get; set; }
        public string? AuthPersonName { get; set; }
        public string? Mobile { get; set; }
        public string? AlternativeNumber { get; set; }
        public string Email { get; set; } = string.Empty;
        public Guid CategoryId { get; set; }
        public string Password { get; set; } = string.Empty;
    }
}
