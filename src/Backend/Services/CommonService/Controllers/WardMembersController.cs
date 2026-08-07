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
/// Ward Member (Sabhasad) master. Reference data only — creating one never provisions a login.
/// Binds a DTO rather than the entity so a caller cannot set Id/CreatedAt (over-posting).
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class WardMembersController : ControllerBase
{
    private readonly CommonService.Persistence.CommonServiceDbContext _context;
    public WardMembersController(CommonService.Persistence.CommonServiceDbContext context) { _context = context; }

    public class WardMemberDto
    {
        [Required]
        public Guid WardId { get; set; }

        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [StringLength(100)] public string? Designation { get; set; }
        [StringLength(20)]  public string? Phone { get; set; }
        [StringLength(150)] public string? Email { get; set; }
        public bool IsActive { get; set; } = true;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? wardId)
    {
        var q = _context.WardMembers.AsQueryable();
        if (wardId is Guid w) q = q.Where(m => m.WardId == w);
        return Ok(await q.OrderBy(m => m.Name).ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(WardMemberDto dto)
    {
        var error = await Validate(dto);
        if (error is not null) return BadRequest(error);

        var entity = new WardMember
        {
            WardId = dto.WardId,
            Name = dto.Name.Trim(),
            Designation = dto.Designation?.Trim(),
            Phone = dto.Phone?.Trim(),
            Email = dto.Email?.Trim(),
            IsActive = dto.IsActive
        };

        _context.WardMembers.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, WardMemberDto dto)
    {
        var entity = await _context.WardMembers.FindAsync(id);
        if (entity is null) return NotFound();

        var error = await Validate(dto);
        if (error is not null) return BadRequest(error);

        entity.WardId = dto.WardId;
        entity.Name = dto.Name.Trim();
        entity.Designation = dto.Designation?.Trim();
        entity.Phone = dto.Phone?.Trim();
        entity.Email = dto.Email?.Trim();
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.WardMembers.FindAsync(id);
        if (e != null) { _context.WardMembers.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>
    /// The ward must exist AND actually be a Ward. Without the type check a member could be
    /// attached to a corporation or a zone, which makes the ward-member dropdown nonsensical.
    /// </summary>
    private async Task<string?> Validate(WardMemberDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";

        var ward = await _context.Locations.FirstOrDefaultAsync(l => l.Id == dto.WardId);
        if (ward is null) return $"Ward '{dto.WardId}' does not exist.";
        if (ward.LocationType != "Ward") return $"Location '{ward.Name}' is a {ward.LocationType}, not a Ward.";

        return null;
    }
}
