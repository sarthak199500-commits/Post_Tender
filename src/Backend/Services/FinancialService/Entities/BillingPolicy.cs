using System;

namespace FinancialService.Entities;

/// <summary>
/// Org-wide billing policy: how much is withheld as retention, how much of a subsequent
/// bill goes toward recovering an outstanding advance, and the cap on an advance request.
/// Modeled as a single active row rather than a list like TaxConfiguration — this is one
/// policy the organisation sets, not a set of named rates to choose between per bill.
/// </summary>
public class BillingPolicy
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public decimal RetentionPercentage { get; set; } = 5m;
    public decimal AdvanceRecoveryPercentage { get; set; } = 10m;
    public decimal MaxAdvancePercentage { get; set; } = 10m;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
