using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ExecutionService.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace ExecutionService.Controllers;

/// <summary>
/// Milestone template master. Writes bind a DTO rather than the entity: binding
/// MilestoneTemplate directly let a caller set Id and CreatedAt (over-posting), and
/// accepted an empty body outright — POST {} created a row with a blank name.
///
/// The DTO keeps the template's Items so a template can be defined in one call; when
/// items are supplied their release percentages must total 100, mirroring the rule
/// ExecutionController enforces on real milestones.
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class MilestoneTemplatesController : ControllerBase
{
    private readonly ExecutionService.Persistence.ExecutionServiceDbContext _context;
    public MilestoneTemplatesController(ExecutionService.Persistence.ExecutionServiceDbContext context) { _context = context; }

    public class TemplateItemDto
    {
        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string StepName { get; set; } = string.Empty;

        [Range(0, 100, ErrorMessage = "PercentageReleasing must be between 0 and 100.")]
        public decimal PercentageReleasing { get; set; }

        [Range(0, int.MaxValue)]
        public int SequenceOrder { get; set; }
    }

    public class MilestoneTemplateDto
    {
        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;

        public List<TemplateItemDto> Items { get; set; } = new();
    }

    [HttpGet]
    public async Task<IActionResult> Get() =>
        Ok(await _context.MilestoneTemplates.Include(t => t.Items).ToListAsync());

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(MilestoneTemplateDto dto)
    {
        var error = await Validate(dto, null);
        if (error is not null) return BadRequest(error);

        var entity = new MilestoneTemplate
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = dto.IsActive,
            Items = dto.Items.Select(i => new MilestoneTemplateItem
            {
                StepName = i.StepName.Trim(),
                PercentageReleasing = i.PercentageReleasing,
                SequenceOrder = i.SequenceOrder
            }).ToList()
        };

        _context.MilestoneTemplates.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, MilestoneTemplateDto dto)
    {
        var entity = await _context.MilestoneTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null) return NotFound();

        var error = await Validate(dto, id);
        if (error is not null) return BadRequest(error);

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.IsActive = dto.IsActive;

        // Items are replaced wholesale only when the caller sends them; the master screen
        // edits name/description alone and must not silently wipe an existing breakdown.
        if (dto.Items.Count > 0)
        {
            // MilestoneTemplateItem has no DbSet — it is discovered through the navigation,
            // so remove through the context rather than a typed set.
            _context.RemoveRange(entity.Items);
            entity.Items = dto.Items.Select(i => new MilestoneTemplateItem
            {
                MilestoneTemplateId = entity.Id,
                StepName = i.StepName.Trim(),
                PercentageReleasing = i.PercentageReleasing,
                SequenceOrder = i.SequenceOrder
            }).ToList();
        }

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.MilestoneTemplates.FindAsync(id);
        if (e != null) { _context.MilestoneTemplates.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>Rules the annotations cannot express. `excludeId` is the row being edited.</summary>
    private async Task<string?> Validate(MilestoneTemplateDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";

        var name = dto.Name.Trim();
        if (await _context.MilestoneTemplates.AnyAsync(t => t.Name == name && (excludeId == null || t.Id != excludeId)))
            return $"A milestone template named '{name}' already exists.";

        if (dto.Items.Count > 0)
        {
            if (dto.Items.Any(i => string.IsNullOrWhiteSpace(i.StepName)))
                return "Every template step needs a name.";

            if (dto.Items.Any(i => i.PercentageReleasing < 0 || i.PercentageReleasing > 100))
                return "Each step's release percentage must be between 0 and 100.";

            if (dto.Items.Sum(i => i.PercentageReleasing) != 100)
                return "Template step release percentages must total exactly 100%.";
        }

        return null;
    }
}
