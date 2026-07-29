using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using IdentityService.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace IdentityService.Controllers;

/// <summary>
/// Department master. Writes bind a DTO rather than the entity: binding Department
/// directly let a caller set Id and CreatedAt (over-posting), and accepted an empty body
/// outright — POST {} created a row with a blank name and code.
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly IdentityService.Persistence.IdentityDbContext _context;
    public DepartmentsController(IdentityService.Persistence.IdentityDbContext context) { _context = context; }

    public class DepartmentDto
    {
        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [Required(AllowEmptyStrings = false), StringLength(30, MinimumLength = 1)]
        public string Code { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;
    }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _context.Departments.ToListAsync());

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(DepartmentDto dto)
    {
        var error = await Validate(dto, null);
        if (error is not null) return BadRequest(error);

        var entity = new Department
        {
            Name = dto.Name.Trim(),
            Code = dto.Code.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = dto.IsActive
        };

        _context.Departments.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, DepartmentDto dto)
    {
        var entity = await _context.Departments.FindAsync(id);
        if (entity is null) return NotFound();

        var error = await Validate(dto, id);
        if (error is not null) return BadRequest(error);

        entity.Name = dto.Name.Trim();
        entity.Code = dto.Code.Trim();
        entity.Description = dto.Description?.Trim();
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.Departments.FindAsync(id);
        if (e != null) { _context.Departments.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>Rules the annotations cannot express. `excludeId` is the row being edited.</summary>
    private async Task<string?> Validate(DepartmentDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";
        if (string.IsNullOrWhiteSpace(dto.Code)) return "Code is required.";

        var code = dto.Code.Trim();
        if (await _context.Departments.AnyAsync(d => d.Code == code && (excludeId == null || d.Id != excludeId)))
            return $"A department with code '{code}' already exists.";

        return null;
    }
}
