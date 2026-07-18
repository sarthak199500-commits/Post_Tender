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

    public BillsController(FinancialServiceDbContext context, AuditLogger audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var query = _context.Bills.AsQueryable();

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
        if (dto.Type != "RA" && dto.Type != "Final") return BadRequest("Type must be 'RA' or 'Final'.");

        var bill = new Bill
        {
            WorkOrderId = dto.WorkOrderId,
            VendorId = vendorId.Value,
            BillNo = dto.BillNo,
            Type = dto.Type,
            Amount = dto.Amount,
            TaxAmount = dto.TaxAmount,
            AttachmentUrl = dto.AttachmentUrl,
            MilestoneIds = dto.MilestoneIds,
            Status = "Submitted"
        };

        _context.Bills.Add(bill);
        await _context.SaveChangesAsync();

        await _audit.LogAsync("Bill", bill.Id.ToString(), "Bill submitted",
            $"{bill.Type} bill {bill.BillNo} for {bill.TotalAmount:C} submitted.");

        return Ok(bill);
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
        var bill = await _context.Bills.FindAsync(id);
        if (bill == null) return NotFound("Bill not found");

        if (bill.Status != "Approved")
            return BadRequest("Only approved bills can be paid.");

        bill.Status = "Paid";
        bill.PaidAt = DateTime.UtcNow;
        bill.PaymentVoucherNo = $"VOUCHER-{DateTime.UtcNow:yyyyMMdd}-{new Random().Next(1000, 9999)}";
        await _context.SaveChangesAsync();

        await _audit.LogAsync("Bill", id.ToString(), "Funds Released", $"Voucher {bill.PaymentVoucherNo} issued.");

        return Ok(new { message = "Funds released successfully", voucherNo = bill.PaymentVoucherNo });
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
}
