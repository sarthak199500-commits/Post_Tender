using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinancialService.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace FinancialService.Controllers;

/// <summary>
/// Tax configuration master. Writes bind a DTO rather than the entity: binding
/// TaxConfiguration directly let a caller set Id and CreatedAt (over-posting), and
/// accepted an empty body outright — POST {} created a row with a blank name and a 0%
/// rate, and a negative percentage was stored without complaint.
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class TaxConfigurationsController : ControllerBase
{
    private readonly FinancialService.Persistence.FinancialServiceDbContext _context;
    public TaxConfigurationsController(FinancialService.Persistence.FinancialServiceDbContext context) { _context = context; }

    public class TaxConfigurationDto
    {
        [Required(AllowEmptyStrings = false), StringLength(100, MinimumLength = 2)]
        public string TaxName { get; set; } = string.Empty;

        [Required(AllowEmptyStrings = false), StringLength(30, MinimumLength = 1)]
        public string Code { get; set; } = string.Empty;

        [Range(0, 100, ErrorMessage = "Percentage must be between 0 and 100.")]
        public decimal Percentage { get; set; }

        public bool IsActive { get; set; } = true;
    }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _context.TaxConfigurations.ToListAsync());

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(TaxConfigurationDto dto)
    {
        var error = await Validate(dto, null);
        if (error is not null) return BadRequest(error);

        var entity = new TaxConfiguration
        {
            TaxName = dto.TaxName.Trim(),
            Code = dto.Code.Trim(),
            Percentage = dto.Percentage,
            IsActive = dto.IsActive
        };

        _context.TaxConfigurations.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, TaxConfigurationDto dto)
    {
        var entity = await _context.TaxConfigurations.FindAsync(id);
        if (entity is null) return NotFound();

        var error = await Validate(dto, id);
        if (error is not null) return BadRequest(error);

        entity.TaxName = dto.TaxName.Trim();
        entity.Code = dto.Code.Trim();
        entity.Percentage = dto.Percentage;
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.TaxConfigurations.FindAsync(id);
        if (e != null) { _context.TaxConfigurations.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>Rules the annotations cannot express. `excludeId` is the row being edited.</summary>
    private async Task<string?> Validate(TaxConfigurationDto dto, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(dto.TaxName)) return "Tax name is required.";
        if (string.IsNullOrWhiteSpace(dto.Code)) return "Code is required.";
        if (dto.Percentage < 0 || dto.Percentage > 100) return "Percentage must be between 0 and 100.";

        var code = dto.Code.Trim();
        if (await _context.TaxConfigurations.AnyAsync(t => t.Code == code && (excludeId == null || t.Id != excludeId)))
            return $"A tax configuration with code '{code}' already exists.";

        return null;
    }
}
