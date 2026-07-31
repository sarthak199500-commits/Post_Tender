using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TenderService.Entities;
using TenderService.Persistence;
using TenderService.Security;
using TenderService.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace TenderService.Controllers;

/// <summary>
/// Extension-of-time requests against a work order.
///
/// Approving one moves WorkOrder.EndDate, which is what liquidated damages are computed
/// from — so a granted extension stops LD accruing automatically instead of someone having
/// to delete the auto-attached deduction on each bill.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TimeExtensionsController : ControllerBase
{
    private readonly TenderServiceDbContext _context;
    private readonly AuditLogger _audit;

    public TimeExtensionsController(TenderServiceDbContext context, AuditLogger audit)
    {
        _context = context;
        _audit = audit;
    }

    // A request in one of these states is still live and blocks a second request on the
    // same work order — two open requests would make it ambiguous which one an approval
    // is moving the end date for.
    private static readonly string[] OpenStatuses = { "Requested" };

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? workOrderId)
    {
        var query = _context.TimeExtensions.AsQueryable();

        // A vendor sees only their own requests. Fail closed on a vendor token with no claim.
        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(t => t.VendorId == me);
        }

        if (workOrderId is not null && workOrderId != Guid.Empty)
            query = query.Where(t => t.WorkOrderId == workOrderId);

        return Ok(await query.OrderByDescending(t => t.CreatedAt).ToListAsync());
    }

    public class CreateTimeExtensionDto
    {
        public Guid WorkOrderId { get; set; }
        public DateTime RequestedEndDate { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string? DocumentUrl { get; set; }
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateTimeExtensionDto dto)
    {
        if (dto is null) return BadRequest("Request body is required.");

        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (dto.WorkOrderId == Guid.Empty) return BadRequest("workOrderId is required.");
        if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest("A reason is required.");

        var workOrder = await _context.WorkOrders.FirstOrDefaultAsync(w => w.Id == dto.WorkOrderId);
        if (workOrder is null) return NotFound("Work order not found.");

        // Unlike bills, the work order lives in this service, so ownership is checked directly.
        if (workOrder.VendorId != vendorId.Value)
            return BadRequest("That work order belongs to another vendor.");

        // An extension only means something while the contract is live.
        if (workOrder.Status is "Completed" or "Cancelled")
            return BadRequest($"A work order that is '{workOrder.Status}' cannot be extended.");

        if (dto.RequestedEndDate.Date <= workOrder.EndDate.Date)
            return BadRequest($"The requested end date must be later than the current end date ({workOrder.EndDate:yyyy-MM-dd}).");

        if (await _context.TimeExtensions.AnyAsync(t => t.WorkOrderId == dto.WorkOrderId && OpenStatuses.Contains(t.Status)))
            return BadRequest("An extension request is already pending on this work order.");

        var extension = new TimeExtension
        {
            WorkOrderId = dto.WorkOrderId,
            VendorId = vendorId.Value,
            OriginalEndDate = workOrder.EndDate,
            RequestedEndDate = dto.RequestedEndDate,
            Reason = dto.Reason.Trim(),
            DocumentUrl = dto.DocumentUrl,
            Status = "Requested"
        };

        _context.TimeExtensions.Add(extension);
        await _context.SaveChangesAsync();

        await _audit.LogAsync("TimeExtension", extension.Id.ToString(), "Extension requested",
            $"{workOrder.WorkOrderNo}: {workOrder.EndDate:yyyy-MM-dd} -> {dto.RequestedEndDate:yyyy-MM-dd}. {extension.Reason}");

        return Ok(extension);
    }

    public class DecisionDto
    {
        /// <summary>Optional — lets the authority grant a shorter extension than asked for.
        /// Defaults to the requested date.</summary>
        public DateTime? ApprovedEndDate { get; set; }
        public string? Remarks { get; set; }
    }

    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin,PMU,Department")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] DecisionDto? dto)
    {
        var extension = await _context.TimeExtensions.FirstOrDefaultAsync(t => t.Id == id);
        if (extension is null) return NotFound("Extension request not found.");
        if (extension.Status != "Requested")
            return BadRequest($"This request has already been {extension.Status.ToLowerInvariant()}.");

        var workOrder = await _context.WorkOrders.FirstOrDefaultAsync(w => w.Id == extension.WorkOrderId);
        if (workOrder is null) return NotFound("Work order not found.");

        var granted = dto?.ApprovedEndDate ?? extension.RequestedEndDate;
        if (granted.Date <= extension.OriginalEndDate.Date)
            return BadRequest($"The approved end date must be later than the original end date ({extension.OriginalEndDate:yyyy-MM-dd}).");

        extension.Status = "Approved";
        extension.ApprovedEndDate = granted;
        extension.DecisionRemarks = dto?.Remarks;
        extension.DecidedByUserId = CallerContext.UserId(User);
        extension.DecidedAt = DateTime.UtcNow;

        // This is the point of the whole feature: moving the end date is what stops
        // liquidated damages accruing on bills raised after the extension.
        var previousEndDate = workOrder.EndDate;
        workOrder.EndDate = granted;

        await _context.SaveChangesAsync();

        await _audit.LogAsync("WorkOrder", workOrder.Id.ToString(), "End date extended",
            $"{workOrder.WorkOrderNo}: {previousEndDate:yyyy-MM-dd} -> {granted:yyyy-MM-dd} (extension {extension.Id}).");

        return Ok(extension);
    }

    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin,PMU,Department")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] DecisionDto? dto)
    {
        var extension = await _context.TimeExtensions.FirstOrDefaultAsync(t => t.Id == id);
        if (extension is null) return NotFound("Extension request not found.");
        if (extension.Status != "Requested")
            return BadRequest($"This request has already been {extension.Status.ToLowerInvariant()}.");

        extension.Status = "Rejected";
        extension.DecisionRemarks = dto?.Remarks;
        extension.DecidedByUserId = CallerContext.UserId(User);
        extension.DecidedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _audit.LogAsync("TimeExtension", id.ToString(), "Extension rejected", dto?.Remarks ?? "");

        return Ok(extension);
    }
}
