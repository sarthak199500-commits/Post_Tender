using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InspectionService.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace InspectionService.Controllers;

/// <summary>
/// Defect category master. Writes bind a DTO rather than the entity: binding
/// DefectCategory directly let a caller set Id and CreatedAt (over-posting), and accepted
/// an empty body outright — POST {} created a row with a blank name.
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class DefectCategoriesController : ControllerBase
{
    private readonly InspectionService.Persistence.InspectionServiceDbContext _context;
    public DefectCategoriesController(InspectionService.Persistence.InspectionServiceDbContext context) { _context = context; }

    public class DefectCategoryDto
    {
        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;
    }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _context.DefectCategories.ToListAsync());

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(DefectCategoryDto dto)
    {
        var error = await Validate(dto, null);
        if (error is not null) return BadRequest(error);

        var entity = new DefectCategory
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = dto.IsActive
        };

        _context.DefectCategories.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, DefectCategoryDto dto)
    {
        var entity = await _context.DefectCategories.FindAsync(id);
        if (entity is null) return NotFound();

        var error = await Validate(dto, id);
        if (error is not null) return BadRequest(error);

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.DefectCategories.FindAsync(id);
        if (e != null) { _context.DefectCategories.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>Rules the annotations cannot express. `excludeId` is the row being edited.</summary>
    private async Task<string?> Validate(DefectCategoryDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";

        // No code column here, so the name is the identifying field and must be unique.
        var name = dto.Name.Trim();
        if (await _context.DefectCategories.AnyAsync(d => d.Name == name && (excludeId == null || d.Id != excludeId)))
            return $"A defect category named '{name}' already exists.";

        return null;
    }
}
