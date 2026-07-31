using System;
using System.Collections.Generic;
using System.Linq;

namespace FinancialService.Entities;

public class Bill
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkOrderId { get; set; }

    // Denormalized from the WorkOrder so FinancialService can scope bills to a vendor
    // without a cross-service call. Stamped from the vendorId claim at creation.
    public Guid VendorId { get; set; }

    public string BillNo { get; set; } = string.Empty;
    public string Type { get; set; } = "RA"; // RA (Running Account), Final
    
    public decimal Amount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount => Amount + TaxAmount;
    
    public string Status { get; set; } = "Submitted"; // Submitted, Under Review, Approved, Paid, Returned

    public string AttachmentUrl { get; set; } = string.Empty; // Digital submission PDF

    public string? RejectionReason { get; set; }

    // Links to milestones
    public List<Guid> MilestoneIds { get; set; } = new List<Guid>();

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public string? PaymentVoucherNo { get; set; }

    public bool IsImmutable { get; set; } = true;

    // Snapshotted from BillingPolicy at creation so a later policy change never rewrites a
    // bill already in flight. 0 on an Advance bill — retention applies to executed work,
    // not to a mobilisation payment made before any work has happened.
    public decimal RetentionPercentage { get; set; }
    public decimal RetainedAmount { get; set; }
    public bool RetentionReleased { get; set; }
    public DateTime? RetentionReleasedAt { get; set; }

    // How much of this bill's claim was withheld to recover an outstanding advance on the
    // same work order. Snapshotted at creation for the same reason as retention.
    public decimal AdvanceRecovered { get; set; }

    public List<BillDeduction> Deductions { get; set; } = new List<BillDeduction>();

    /// <summary>Instalments released against this bill. See BillPayment for why.</summary>
    public List<BillPayment> Payments { get; set; } = new List<BillPayment>();

    // What actually gets released to the vendor: the claim plus tax, minus everything
    // withheld against it. Deductions are loaded separately (a real relation, not an
    // inline column), so this only sums what is already in memory — callers that need it
    // accurate must Include(b => b.Deductions) first.
    /// Floored at zero: deductions can in principle exceed the claim (a large liquidated
    /// damages charge against a small bill), and a negative payable is meaningless — the
    /// vendor is never asked to pay the client. The excess is simply not recovered here.
    public decimal NetPayableAmount => Math.Max(0,
        TotalAmount - RetainedAmount - AdvanceRecovered - Deductions.Sum(d => d.Amount));

    /// <summary>
    /// Sum of instalments released so far. Requires Include(b => b.Payments).
    ///
    /// Bills settled before instalments existed carry no BillPayment rows, so they would
    /// otherwise read as entirely unpaid and show a full outstanding balance. A bill that
    /// reached "Paid" was by definition paid in full, so fall back to that rather than
    /// backfilling synthetic payment rows into historical data.
    /// </summary>
    public decimal AmountPaid =>
        Payments.Count > 0 ? Payments.Sum(p => p.Amount)
        : Status == "Paid" ? NetPayableAmount
        : 0m;

    /// <summary>What is still owed. Never negative — overpayment is rejected at the API.</summary>
    public decimal BalanceAmount => Math.Max(0, NetPayableAmount - AmountPaid);
}



