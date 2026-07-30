using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinancialService.Entities;
using FinancialService.Persistence;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace FinancialService.Controllers;

/// <summary>
/// The single org-wide retention/advance policy. Modeled as one row rather than a CRUD
/// list of named entries — see BillingPolicy for why. GET seeds a default row on first
/// access so BillsController always has a policy to read even before an admin visits
/// the settings screen.
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class BillingPolicyController : ControllerBase
{
    private readonly FinancialServiceDbContext _context;
    public BillingPolicyController(FinancialServiceDbContext context) { _context = context; }

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await GetOrSeedAsync(_context));

    public class UpdateBillingPolicyDto
    {
        [System.ComponentModel.DataAnnotations.Range(0, 100)]
        public decimal RetentionPercentage { get; set; }

        [System.ComponentModel.DataAnnotations.Range(0, 100)]
        public decimal AdvanceRecoveryPercentage { get; set; }

        [System.ComponentModel.DataAnnotations.Range(0, 100)]
        public decimal MaxAdvancePercentage { get; set; }
    }

    [HttpPut]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Update([FromBody] UpdateBillingPolicyDto dto)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var policy = await GetOrSeedAsync(_context);
        policy.RetentionPercentage = dto.RetentionPercentage;
        policy.AdvanceRecoveryPercentage = dto.AdvanceRecoveryPercentage;
        policy.MaxAdvancePercentage = dto.MaxAdvancePercentage;
        policy.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(policy);
    }

    // Internal — used by BillsController when it needs the current policy for a
    // calculation, without a second HTTP round trip to itself.
    internal static async Task<BillingPolicy> GetOrSeedAsync(FinancialServiceDbContext context)
    {
        var policy = await context.BillingPolicies.FirstOrDefaultAsync();
        if (policy is not null) return policy;

        policy = new BillingPolicy();
        context.BillingPolicies.Add(policy);
        await context.SaveChangesAsync();
        return policy;
    }
}
