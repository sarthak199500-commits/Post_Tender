using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinancialService.Persistence;
using FinancialService.Entities;
using FinancialService.Security;
using FinancialService.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FinancialService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BillsController : ControllerBase
{
    private readonly FinancialServiceDbContext _context;
    private readonly AuditLogger _audit;
    private readonly WorkOrderVerifier _verifier;

    public BillsController(FinancialServiceDbContext context, AuditLogger audit, WorkOrderVerifier verifier)
    {
        _context = context;
        _audit = audit;
        _verifier = verifier;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var query = _context.Bills.Include(b => b.Deductions).AsQueryable();

        // A vendor sees only their own bills. Reviewers (Department/Finance/Admin/PMU)
        // see all. Fail closed if a vendor token carries no claim.
        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(b => b.VendorId == me);
        }

        return Ok(await query.OrderByDescending(b => b.SubmittedAt).ToListAsync());
    }

    // A bill in one of these states is still in play, so it holds its milestone claim and
    // its share of an outstanding advance recovery. "Returned" is deliberately absent — a
    // returned bill has been handed back for correction and must release both.
    private static readonly string[] ClaimingStatuses = { "Submitted", "Under Review", "Approved", "Paid" };

    // Only a bill still awaiting a department decision can be approved. Approving a
    // Returned bill would release funds for the very submission that was handed back,
    // without the vendor ever correcting it.
    private static readonly string[] ApprovableStatuses = { "Submitted", "Under Review" };

    private static readonly string[] AllowedTypes = { "RA", "Final", "Advance" };

    public class CreateBillDto
    {
        public Guid WorkOrderId { get; set; }
        public string BillNo { get; set; } = string.Empty;
        public string Type { get; set; } = "RA";
        public decimal Amount { get; set; }
        public decimal TaxAmount { get; set; }
        public string AttachmentUrl { get; set; } = string.Empty;
        public List<Guid> MilestoneIds { get; set; } = new();
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateBillDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (dto.WorkOrderId == Guid.Empty) return BadRequest("WorkOrderId is required.");
        if (dto.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        if (!AllowedTypes.Contains(dto.Type)) return BadRequest($"Type must be one of: {string.Join(", ", AllowedTypes)}.");
        if (dto.TaxAmount < 0) return BadRequest("Tax amount cannot be negative.");

        var billNo = dto.BillNo?.Trim() ?? string.Empty;
        if (billNo.Length == 0) return BadRequest("Bill number is required.");

        // The bill number is the vendor's invoice reference and is what payment vouchers
        // are reconciled against, so it must be unique for this vendor.
        if (await _context.Bills.AnyAsync(b => b.VendorId == vendorId.Value && b.BillNo == billNo))
            return BadRequest($"You have already submitted a bill numbered '{billNo}'.");

        var isAdvance = dto.Type == "Advance";

        // An advance is a mobilisation payment made before any work is claimed, so it
        // carries no milestones — whatever the client sent for one is ignored, not
        // rejected, since the field simply does not apply.
        var milestoneIds = isAdvance ? new List<Guid>() : dto.MilestoneIds;

        // A milestone may only be claimed once at a time. Only a bill that is still alive
        // holds its claim: a Returned bill has been handed back for correction, so its
        // milestones must be free for the vendor to resubmit. This previously excluded
        // "Rejected", a status no code path ever assigns (both Query and Reject set
        // "Returned"), which left every returned bill owning its milestones forever and
        // made the correct-and-resubmit loop impossible to complete.
        if (milestoneIds.Count > 0)
        {
            var alreadyClaimed = await _context.Bills
                .Where(b => b.WorkOrderId == dto.WorkOrderId && ClaimingStatuses.Contains(b.Status))
                .Select(b => b.MilestoneIds)
                .ToListAsync();

            var duplicate = milestoneIds.FirstOrDefault(id => alreadyClaimed.Any(list => list.Contains(id)));
            if (duplicate != Guid.Empty)
                return BadRequest($"Milestone {duplicate} has already been claimed on another bill for this work order.");
        }

        // The work order and its milestones live in other services, so this is the only
        // point where "is this yours, and is it actually finished" can be answered.
        var check = await _verifier.ValidateAsync(dto.WorkOrderId, vendorId.Value, milestoneIds);
        if (!check.Ok) return BadRequest(check.Error);

        var policy = await BillingPolicyController.GetOrSeedAsync(_context);

        var bill = new Bill
        {
            WorkOrderId = dto.WorkOrderId,
            VendorId = vendorId.Value,
            BillNo = billNo,
            Type = dto.Type,
            Amount = dto.Amount,
            TaxAmount = dto.TaxAmount,
            AttachmentUrl = dto.AttachmentUrl,
            MilestoneIds = milestoneIds,
            Status = "Submitted"
        };

        if (isAdvance)
        {
            // One outstanding advance per work order at a time: a pending request (not
            // yet paid) or a paid one not yet fully recovered both block a new request,
            // otherwise recovery bookkeeping across two overlapping advances gets
            // ambiguous — which bill is a given RA/Final's deduction paying down?
            var hasPending = await _context.Bills.AnyAsync(b =>
                b.WorkOrderId == dto.WorkOrderId && b.Type == "Advance" &&
                (b.Status == "Submitted" || b.Status == "Under Review" || b.Status == "Approved"));
            if (hasPending)
                return BadRequest("An advance request is already pending on this work order.");

            var outstanding = await GetOutstandingAdvanceAsync(dto.WorkOrderId);
            if (outstanding > 0)
                return BadRequest($"An advance of {outstanding:C} is still outstanding on this work order and must be recovered before another can be requested.");

            var cap = check.TotalValue * (policy.MaxAdvancePercentage / 100m);
            if (dto.Amount > cap)
                return BadRequest($"An advance cannot exceed {policy.MaxAdvancePercentage}% of the contract value ({cap:C}).");
        }
        else
        {
            bill.RetentionPercentage = policy.RetentionPercentage;
            bill.RetainedAmount = Math.Round(dto.Amount * (policy.RetentionPercentage / 100m), 2);

            var outstanding = await GetOutstandingAdvanceAsync(dto.WorkOrderId);
            if (outstanding > 0)
                bill.AdvanceRecovered = Math.Min(Math.Round(dto.Amount * (policy.AdvanceRecoveryPercentage / 100m), 2), outstanding);

            // If the work order this bill claims against is overdue, suggest a liquidated
            // damages deduction using the same formula the Admin project list has always
            // displayed but never enforced. Department/Finance can remove it before
            // approval if an extension was actually granted — this system has no record
            // of extensions, so it can only flag lateness, not adjudicate the reason.
            var ld = LiquidatedDamagesCalculator.Compute(check.TotalValue, check.EndDate, check.WorkOrderStatus);
            if (ld.Amount > 0)
            {
                bill.Deductions.Add(new BillDeduction
                {
                    BillId = bill.Id,
                    Type = "LiquidatedDamages",
                    Description = $"Work order is {ld.WeeksLate} week(s) past its scheduled end date. " +
                                   "Computed at 0.5%/week of contract value, capped at 10%. Remove if an extension was granted.",
                    Amount = Math.Round(ld.Amount, 2),
                    IsSystemGenerated = true
                });
            }
        }

        _context.Bills.Add(bill);
        await _context.SaveChangesAsync();

        await _audit.LogAsync("Bill", bill.Id.ToString(), "Bill submitted",
            $"{bill.Type} bill {bill.BillNo} for {bill.TotalAmount:C} submitted.");

        return Ok(bill);
    }

    // Bills currently claiming an outstanding advance keep that claim until they leave
    // ClaimingStatuses (paid, or still in flight) — a Returned bill releases it, mirroring
    // the milestone-claim rule above.
    //
    // Summed client-side after materializing: SQLite's EF Core provider cannot translate
    // SUM() over a decimal column (NotSupportedException at query time), the same reason
    // NextVoucherNoAsync below reads the rows first and aggregates in memory.
    private async Task<decimal> GetOutstandingAdvanceAsync(Guid workOrderId)
    {
        var paidAdvance = (await _context.Bills
            .Where(b => b.WorkOrderId == workOrderId && b.Type == "Advance" && b.Status == "Paid")
            .Select(b => b.Amount)
            .ToListAsync()).Sum();

        var recovered = (await _context.Bills
            .Where(b => b.WorkOrderId == workOrderId && b.Type != "Advance" && ClaimingStatuses.Contains(b.Status))
            .Select(b => b.AdvanceRecovered)
            .ToListAsync()).Sum();

        return Math.Max(0, paidAdvance - recovered);
    }

    public class ActionRequest
    {
        public string? Reason { get; set; }
    }

    // Department: approve a submitted/under-review bill for fund release.
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Department,Admin,PMU")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill == null) return NotFound("Bill not found");

        if (bill.Status == "Paid")
            return BadRequest("A paid bill cannot be re-approved.");
        if (!ApprovableStatuses.Contains(bill.Status))
            return BadRequest($"A bill that is '{bill.Status}' cannot be approved. Only a bill awaiting review can be.");

        bill.Status = "Approved";
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Bill", id.ToString(), "Bill Approved", "Approved for payment by department.");
        return Ok(new { message = "Bill approved for payment" });
    }

    // Department: return a bill to the vendor with a query/discrepancy note.
    [HttpPost("{id}/query")]
    [Authorize(Roles = "Department,Admin,PMU")]
    public async Task<IActionResult> Query(Guid id, [FromBody] ActionRequest request)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill == null) return NotFound("Bill not found");

        if (bill.Status == "Paid")
            return BadRequest("A paid bill cannot be returned.");

        bill.Status = "Returned";
        bill.RejectionReason = request?.Reason;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Bill", id.ToString(), "Bill Returned (query)", request?.Reason ?? "");
        return Ok(new { message = "Bill returned with query" });
    }

    // Finance: release funds for a department-approved bill.
    [HttpPost("{id}/pay")]
    [Authorize(Roles = "Finance,Admin,PMU")]
    public async Task<IActionResult> Pay(Guid id)
    {
        var bill = await _context.Bills.Include(b => b.Deductions).FirstOrDefaultAsync(b => b.Id == id);
        if (bill == null) return NotFound("Bill not found");

        if (bill.Status != "Approved")
            return BadRequest("Only approved bills can be paid.");

        bill.Status = "Paid";
        bill.PaidAt = DateTime.UtcNow;
        bill.PaymentVoucherNo = await NextVoucherNoAsync();
        await _context.SaveChangesAsync();

        var netPayable = bill.NetPayableAmount;
        await _audit.LogAsync("Bill", id.ToString(), "Funds Released",
            $"Voucher {bill.PaymentVoucherNo} issued for {netPayable:C} net of retention/advance recovery/deductions.");

        return Ok(new { message = "Funds released successfully", voucherNo = bill.PaymentVoucherNo, netPayable });
    }

    // A voucher number is the reconciliation key for a released payment, so it has to be
    // unique. It was `new Random().Next(1000, 9999)` — 9,000 possible values per day, seeded
    // from the clock, so two payments released in the same tick could draw the same number.
    // Sequential within the day makes collisions impossible and the ordering meaningful.
    private async Task<string> NextVoucherNoAsync()
    {
        var today = DateTime.UtcNow;
        var prefix = $"VOUCHER-{today:yyyyMMdd}-";

        var issuedToday = await _context.Bills
            .Where(b => b.PaymentVoucherNo != null && b.PaymentVoucherNo.StartsWith(prefix))
            .Select(b => b.PaymentVoucherNo!)
            .ToListAsync();

        var highest = issuedToday
            .Select(v => int.TryParse(v.Substring(prefix.Length), out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();

        return $"{prefix}{highest + 1:D4}";
    }

    // Finance: reject a bill back to the vendor (post department approval).
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Finance,Admin,PMU")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ActionRequest request)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill == null) return NotFound("Bill not found");

        if (bill.Status == "Paid")
            return BadRequest("A paid bill cannot be rejected.");

        bill.Status = "Returned";
        bill.RejectionReason = request?.Reason;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Bill", id.ToString(), "Bill Rejected", request?.Reason ?? "");
        return Ok(new { message = "Bill rejected and returned" });
    }

    public class AddDeductionDto
    {
        public string Type { get; set; } = "Other";
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    // Department/Finance: net a line item off a bill before it is paid — TDS, labour
    // cess, security deposit, or anything else that is not the auto-suggested LD
    // deduction (which Create adds itself when the work order is overdue).
    [HttpPost("{id}/deductions")]
    [Authorize(Roles = "Department,Finance,Admin,PMU")]
    public async Task<IActionResult> AddDeduction(Guid id, [FromBody] AddDeductionDto dto)
    {
        if (dto is null) return BadRequest("Request body is required.");
        if (dto.Amount <= 0) return BadRequest("Deduction amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(dto.Description)) return BadRequest("A description is required.");

        var bill = await _context.Bills.FindAsync(id);
        if (bill is null) return NotFound("Bill not found");
        if (bill.Status == "Paid") return BadRequest("Cannot add a deduction to a bill that has already been paid.");

        var deduction = new BillDeduction
        {
            BillId = id,
            Type = string.IsNullOrWhiteSpace(dto.Type) ? "Other" : dto.Type,
            Description = dto.Description.Trim(),
            Amount = dto.Amount
        };
        _context.BillDeductions.Add(deduction);
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Bill", id.ToString(), "Deduction added", $"{deduction.Type}: {deduction.Description} ({deduction.Amount:C})");
        return Ok(deduction);
    }

    [HttpDelete("{id}/deductions/{deductionId}")]
    [Authorize(Roles = "Department,Finance,Admin,PMU")]
    public async Task<IActionResult> RemoveDeduction(Guid id, Guid deductionId)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill is null) return NotFound("Bill not found");
        if (bill.Status == "Paid") return BadRequest("Cannot remove a deduction from a bill that has already been paid.");

        var deduction = await _context.BillDeductions.FirstOrDefaultAsync(d => d.Id == deductionId && d.BillId == id);
        if (deduction is null) return NotFound("Deduction not found");

        _context.BillDeductions.Remove(deduction);
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Bill", id.ToString(), "Deduction removed", $"{deduction.Type}: {deduction.Description} ({deduction.Amount:C})");
        return Ok(new { message = "Deduction removed" });
    }

    // Finance: hand back the retention withheld on a bill once it is safe to (defects
    // liability period elapsed, no outstanding claims). Nothing in this codebase tracks
    // a DLP end date, so there is no automatic trigger — this is a deliberate human call.
    [HttpPost("{id}/release-retention")]
    [Authorize(Roles = "Finance,Admin,PMU")]
    public async Task<IActionResult> ReleaseRetention(Guid id)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill is null) return NotFound("Bill not found");
        if (bill.Status != "Paid") return BadRequest("Retention can only be released once the bill has been paid.");
        if (bill.RetainedAmount <= 0) return BadRequest("This bill has no retention withheld.");
        if (bill.RetentionReleased) return BadRequest("Retention has already been released for this bill.");

        bill.RetentionReleased = true;
        bill.RetentionReleasedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Bill", id.ToString(), "Retention Released", $"{bill.RetainedAmount:C} released.");
        return Ok(bill);
    }
}
