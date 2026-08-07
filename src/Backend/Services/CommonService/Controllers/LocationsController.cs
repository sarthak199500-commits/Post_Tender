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

    /// <summary>
    /// All filters are optional and compose. No filter returns everything, which is what the
    /// Locations master screen wants; the cascade passes parentId (or type+ulbType at the top).
    /// Ordered by Name so the dropdowns are alphabetical without client-side sorting — except
    /// Wards, which sort by zero-padded Code because "Ward 10" must not precede "Ward 2".
    ///
    /// The ward rule keys off each row's own LocationType, not off the `type` argument: the
    /// cascade fetches a ULB's children by parentId alone (it needs Zones and Wards together
    /// to decide whether the Zone step applies), so keying off the request sorted every real
    /// ward dropdown as Ward 1, Ward 10, Ward 100 while a type=Ward test still passed.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? type,
        [FromQuery] string? ulbType,
        [FromQuery] Guid? parentId)
    {
        var q = _context.Locations.AsQueryable();

        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(l => l.LocationType == type);
        if (!string.IsNullOrWhiteSpace(ulbType)) q = q.Where(l => l.UlbType == ulbType);
        if (parentId is Guid p) q = q.Where(l => l.ParentLocationId == p);

        q = q.OrderBy(l => l.LocationType == "Ward" ? l.Code : l.Name);

        return Ok(await q.ToListAsync());
    }

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
        if (e is null) return Ok();

        // Nothing enforced this before, so deleting a corporation silently orphaned its zones
        // and every ward beneath them — 118 rows for Lucknow — leaving tenders pointing at ids
        // that no longer resolve. Cheaper to refuse than to repair.
        var children = await _context.Locations.CountAsync(l => l.ParentLocationId == id);
        if (children > 0)
            return BadRequest($"'{e.Name}' still has {children} location(s) under it. Delete or move those first.");

        _context.Locations.Remove(e);
        await _context.SaveChangesAsync();
        return Ok();
    }

    /// <summary>
    /// Rules the annotations cannot express. `excludeId` is the row being edited.
    ///
    /// The three UP tiers do not share a shape, and the shape rules below enforce that:
    ///   Nagar Nigam (metropolitan)        Ulb -> Zone -> Ward
    ///   Nagar Palika Parishad (city)      Ulb -> Ward
    ///   Nagar Panchayat (town)            Ulb -> Ward
    /// Only a Nagar Nigam has Zones. Without these checks the master accepted a Zone under a
    /// town, or a ward hung straight off a corporation — trees the cascade cannot render and
    /// which quietly misreport which body a tender belongs to.
    /// </summary>
    private async Task<string?> Validate(LocationDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";
        if (string.IsNullOrWhiteSpace(dto.Code)) return "Code is required.";

        var code = dto.Code.Trim();
        if (await _context.Locations.AnyAsync(l => l.Code == code && (excludeId == null || l.Id != excludeId)))
            return $"A location with code '{code}' already exists.";

        // Loaded rather than merely existence-checked: the shape rules below need its tier.
        Location? parent = null;
        if (dto.ParentLocationId is Guid parentId)
        {
            if (parentId == excludeId) return "A location cannot be its own parent.";
            parent = await _context.Locations.FirstOrDefaultAsync(l => l.Id == parentId);
            if (parent is null) return $"Parent location '{parentId}' does not exist.";
        }

        if (!string.IsNullOrWhiteSpace(dto.UlbType) && !UlbTypes.Contains(dto.UlbType.Trim()))
            return $"UlbType must be one of: {string.Join(", ", UlbTypes)}.";

        // Legacy levels (e.g. District) predate this hierarchy and are left unconstrained.
        switch (dto.LocationType?.Trim())
        {
            case "Ulb":
                if (string.IsNullOrWhiteSpace(dto.UlbType))
                    return $"UlbType is required for an urban local body — one of: {string.Join(", ", UlbTypes)}.";
                break;

            case "Zone":
                if (parent is null)
                    return "A zone must belong to a Nagar Nigam.";
                if (parent.LocationType != "Ulb" || parent.UlbType != "NagarNigam")
                    return $"'{parent.Name}' is not a Nagar Nigam. Only a Nagar Nigam is divided into zones; "
                         + "a Nagar Palika Parishad or Nagar Panchayat holds its wards directly.";
                break;

            case "Ward":
                if (parent is null)
                    return "A ward must belong to a zone or an urban local body.";
                if (parent.LocationType == "Ulb" && parent.UlbType == "NagarNigam")
                    return $"'{parent.Name}' is a Nagar Nigam, so its wards belong to one of its zones, "
                         + "not to the corporation directly.";
                if (parent.LocationType != "Zone" && parent.LocationType != "Ulb")
                    return $"A ward's parent must be a zone or an urban local body, not a {parent.LocationType}.";
                break;
        }

        return null;
    }
}
