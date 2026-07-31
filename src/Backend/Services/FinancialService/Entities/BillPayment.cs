using System;

namespace FinancialService.Entities;

/// <summary>
/// One instalment released against a bill.
///
/// Payment used to be all-or-nothing: a single Pay call set the bill to Paid, stamped one
/// PaidAt and one PaymentVoucherNo. That cannot express "release half now, the rest when
/// the guarantee arrives", which is ordinary in works contracts.
///
/// Each instalment now gets its own voucher number, because a voucher is the
/// reconciliation key for a *disbursement* — not for a bill. Bill.PaymentVoucherNo and
/// Bill.PaidAt are kept and carry the FINAL instalment, so existing records and any
/// caller still reading those fields continue to work.
/// </summary>
public class BillPayment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid BillId { get; set; }

    // No back-reference to Bill: Bill.Payments already carries these, and a navigation the
    // other way makes System.Text.Json recurse until it throws on the cycle — the same
    // trap BillDeduction hit.
    public decimal Amount { get; set; }

    public string VoucherNo { get; set; } = string.Empty;

    /// <summary>Free text — cheque number, UTR, NEFT reference.</summary>
    public string? Reference { get; set; }

    public Guid? PaidByUserId { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
}
