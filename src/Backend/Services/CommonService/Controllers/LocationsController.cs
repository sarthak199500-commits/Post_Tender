using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CommonService.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace CommonService.Controllers;

/// <summary>
/// Location master. Writes bind a DTO rather than the entity: binding Location directly
/// let a caller set Id and CreatedAt (over-posting), and accepted an empty body outright —
/// POST {} created a row with a blank name and code.
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class LocationsController : ControllerBase
{
    private readonly CommonService.Persistence.CommonServiceDbContext _context;
    public LocationsController(CommonService.Persistence.CommonServiceDbContext context) { _context = context; }

    /// <summary>UP has exactly three statutory ULB tiers. Kept in code because this build is
    /// UP-only; promote to a master table if another state is ever onboarded.</summary>
    private static readonly string[] UlbTypes = { "NagarNigam", "NagarPalikaParishad", "NagarPanchayat" };

    public class LocationDto
    {
        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [Required(AllowEmptyStrings = false), StringLength(30, MinimumLength = 1)]
        public string Code { get; set; } = string.Empty;

        [StringLength(50)]
        public string LocationType { get; set; } = string.Empty;

        [StringLength(40)]
        public string? UlbType { get; set; }

        public Guid? ParentLocationId { get; set; }
        public bool IsActive { get; set; } = true;
    }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _context.Locations.ToListAsync());

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(LocationDto dto)
    {
        var error = await Validate(dto, null);
        if (error is not null) return BadRequest(error);

        var entity = new Location
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim(),
            LocationType = dto.LocationType?.Trim() ?? string.Empty,
            UlbType = string.IsNullOrWhiteSpace(dto.UlbType) ? null : dto.UlbType.Trim(),
            ParentLocationId = dto.ParentLocationId,
            IsActive = dto.IsActive
        };

        _context.Locations.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, LocationDto dto)
    {
        var entity = await _context.Locations.FindAsync(id);
        if (entity is null) return NotFound();

        var error = await Validate(dto, id);
        if (error is not null) return BadRequest(error);

        entity.Name = dto.Name.Trim();
        entity.Code = dto.Code.Trim();
        entity.LocationType = dto.LocationType?.Trim() ?? string.Empty;
        entity.UlbType = string.IsNullOrWhiteSpace(dto.UlbType) ? null : dto.UlbType.Trim();
        entity.ParentLocationId = dto.ParentLocationId;
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.Locations.FindAsync(id);
        if (e != null) { _context.Locations.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>Rules the annotations cannot express. `excludeId` is the row being edited.</summary>
    private async Task<string?> Validate(LocationDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";
        if (string.IsNullOrWhiteSpace(dto.Code)) return "Code is required.";

        var code = dto.Code.Trim();
        if (await _context.Locations.AnyAsync(l => l.Code == code && (excludeId == null || l.Id != excludeId)))
            return $"A location with code '{code}' already exists.";

        if (dto.ParentLocationId is Guid parent)
        {
            if (parent == excludeId) return "A location cannot be its own parent.";
            if (!await _context.Locations.AnyAsync(l => l.Id == parent))
                return $"Parent location '{parent}' does not exist.";
        }

        if (!string.IsNullOrWhiteSpace(dto.UlbType) && !UlbTypes.Contains(dto.UlbType.Trim()))
            return $"UlbType must be one of: {string.Join(", ", UlbTypes)}.";

        return null;
    }
}
