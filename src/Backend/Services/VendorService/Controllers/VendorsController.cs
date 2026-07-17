using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VendorService.Clients;
using VendorService.Persistence;
using VendorService.Entities;

namespace VendorService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VendorsController : ControllerBase
{
    private readonly VendorDbContext _context;
    private readonly IIdentityClient _identity;

    public VendorsController(VendorDbContext context, IIdentityClient identity)
    {
        _context = context;
        _identity = identity;
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
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> AddVendor([FromBody] VendorDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest("Email and password are required to provision a vendor login.");

        // VendorDto.CategoryId is a non-nullable Guid, so an omitted category arrives as
        // Guid.Empty. Vendor.CategoryId is a nullable FK, so Guid.Empty must become null or
        // SQLite rejects the insert with "FOREIGN KEY constraint failed".
        Guid? categoryId = dto.CategoryId == Guid.Empty ? null : dto.CategoryId;

        // Validate the category BEFORE registering the login. Anything that can fail the
        // save must fail here instead: registration is not transactional with this save, so
        // a later failure would strand a login whose vendorId claim points at no vendor.
        if (categoryId.HasValue &&
            !await _context.VendorCategories.AnyAsync(c => c.Id == categoryId.Value))
            return BadRequest($"Vendor category '{categoryId}' does not exist.");

        // Build in memory first so the row's Id can be handed to IdentityService, and so
        // nothing is persisted if registration fails.
        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            VendorCode = $"VEND-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}",
            GSTNo = dto.GSTNo ?? string.Empty,
            YearOfIncorporation = dto.YearOfIncorporation,
            AuthPersonName = dto.AuthPersonName ?? string.Empty,
            Mobile = dto.Mobile ?? string.Empty,
            AlternativeNumber = dto.AlternativeNumber ?? string.Empty,
            ContactEmail = dto.Email,
            CategoryId = categoryId,
            Status = "Active"
        };

        Guid userId;
        try
        {
            userId = await _identity.RegisterVendorAsync(dto.Name, dto.Email, dto.Password, vendor.Id);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest($"Could not provision vendor login: {ex.Message}");
        }

        vendor.UserId = userId;
        _context.Vendors.Add(vendor);
        await _context.SaveChangesAsync();

        return Ok(vendor);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin,PMU")]
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
    [Authorize(Roles = "Admin,PMU")]
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
