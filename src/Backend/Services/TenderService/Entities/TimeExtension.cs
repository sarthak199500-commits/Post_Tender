using System;

namespace TenderService.Entities;

/// <summary>
/// A vendor's request to move a work order's end date, and the authority's decision on it.
///
/// This exists to close a loop that was previously manual and unauditable. Liquidated
/// damages are computed from WorkOrder.EndDate (0.5%/week overdue, capped at 10%) and are
/// attached automatically to any bill raised against a late work order. Before this entity
/// there was nowhere to record that an extension had been granted, so the only way to stop
/// LD being charged was for someone to delete the deduction by hand on every bill — leaving
/// no trace of who allowed it or why.
///
/// Approving an extension now moves WorkOrder.EndDate itself, so LD simply stops accruing,
/// and OriginalEndDate preserves what the date was before, for audit.
/// </summary>
public class TimeExtension
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }

    // Stamped from the caller's vendorId claim, never the request body.
    public Guid VendorId { get; set; }

    /// <summary>The work order's end date at the moment the request was raised.</summary>
    public DateTime OriginalEndDate { get; set; }

    /// <summary>The date the vendor is asking for. Must be later than OriginalEndDate.</summary>
    public DateTime RequestedEndDate { get; set; }

    /// <summary>Set only on approval — the date actually granted, which may be earlier
    /// than the vendor asked for if the authority grants a shorter extension.</summary>
    public DateTime? ApprovedEndDate { get; set; }

    public string Reason { get; set; } = string.Empty;

    /// <summary>Supporting document (rainfall records, site handover delay, etc.).</summary>
    public string? DocumentUrl { get; set; }

    public string Status { get; set; } = "Requested"; // Requested, Approved, Rejected

    public string? DecisionRemarks { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public DateTime? DecidedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
