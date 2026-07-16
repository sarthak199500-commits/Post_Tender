using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FinancialService.Persistence;
using FinancialService.Entities;
using FinancialService.Services;
using System;
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
        return Ok(await _context.Bills.ToListAsync());
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
