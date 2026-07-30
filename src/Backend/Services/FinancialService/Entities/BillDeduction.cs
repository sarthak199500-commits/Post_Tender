using System;
using System.Text.Json.Serialization;

namespace FinancialService.Entities;

/// <summary>
/// A line item subtracted from a bill before payout — TDS, labour cess, liquidated
/// damages, security deposit, or anything else Department/Finance need to net off.
/// A Bill needs a real one-to-many relation here (not a value-converted list like
/// MilestoneIds) because each deduction carries its own type, description, and amount.
/// </summary>
public class BillDeduction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BillId { get; set; }

    // Ignored on serialization: Bill.Deductions already carries this object, so a bill
    // with any deduction serialized the parent back through here, then that parent's
    // Deductions back through here again — System.Text.Json throws on the cycle rather
    // than looping forever, which took down bill creation the moment a deduction (even
    // the auto-generated LD one) existed on the new bill.
    [JsonIgnore]
    public Bill? Bill { get; set; }

    public string Type { get; set; } = "Other"; // LiquidatedDamages, TDS, LabourCess, SecurityDeposit, Other
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    // True for the LiquidatedDamages line the server inserts automatically at bill
    // creation when the work order is overdue — flagged so the UI can explain where it
    // came from, and so Department/Finance know it is a suggestion, not a manual entry.
    public bool IsSystemGenerated { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
