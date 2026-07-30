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

    // What actually gets released to the vendor: the claim plus tax, minus everything
    // withheld against it. Deductions are loaded separately (a real relation, not an
    // inline column), so this only sums what is already in memory — callers that need it
    // accurate must Include(b => b.Deductions) first.
    public decimal NetPayableAmount =>
        TotalAmount - RetainedAmount - AdvanceRecovered - Deductions.Sum(d => d.Amount);
}



