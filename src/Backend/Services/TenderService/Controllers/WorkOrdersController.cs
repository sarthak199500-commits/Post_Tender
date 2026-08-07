using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TenderService.Persistence;
using TenderService.Entities;
using TenderService.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace TenderService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WorkOrdersController : ControllerBase
{
    private readonly TenderServiceDbContext _context;
    private readonly AuditLogger _audit;

    public WorkOrdersController(TenderServiceDbContext context, AuditLogger audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetWorkOrders(
        [FromQuery] Guid? vendorId,
        [FromQuery] Guid? inspectorId,
        [FromQuery] Guid? ulbId = null,
        [FromQuery] Guid? zoneId = null,
        [FromQuery] Guid? wardId = null)
    {
        var query = _context.WorkOrders.AsQueryable();

        if (vendorId.HasValue)
            query = query.Where(w => w.VendorId == vendorId.Value);

        if (inspectorId.HasValue)
            query = query.Where(w => w.InspectorId == inspectorId.Value);

        // Location filters. Applied after scoping so they can only ever narrow the result set.
        if (ulbId is Guid u) query = query.Where(x => x.UlbId == u);
        if (zoneId is Guid z) query = query.Where(x => x.ZoneId == z);
        if (wardId is Guid w) query = query.Where(x => x.WardId == w);

        var workOrders = await query.OrderByDescending(w => w.CreatedAt).ToListAsync();
        return Ok(workOrders);
    }

    // The detail pages render the tender title off this payload. Tender lives in this
    // service, so it is flattened into a projection here rather than left to a second
    // client call — but it must NOT be a plain .Include: Tender.WorkOrders is a back
    // reference and no ReferenceHandler is configured, so EF fixup would produce a cycle
    // and the serializer would 500. Vendor, inspector and milestones belong to other
    // services and stay composed on the client.
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var wo = await _context.WorkOrders
            .Where(w => w.Id == id)
            .Select(w => new
            {
                w.Id,
                w.TenderId,
                w.VendorId,
                w.InspectorId,
                w.WorkOrderNo,
                w.TotalValue,
                w.StartDate,
                w.EndDate,
                w.ScopeDescription,
                w.PaymentTerms,
                w.LiquidatedDamagesTerms,
                w.AgreementDocumentUrl,
                w.Status,
                w.DepartmentId,
                w.UlbId,
                w.ZoneId,
                w.WardId,
                w.CreatedAt,
                Tender = w.Tender == null ? null : new
                {
                    w.Tender.Id,
                    w.Tender.TenderNo,
                    w.Tender.Title,
                    w.Tender.Budget
                },
                // Lets the client pull this work order's progress reports through the
                // existing GET /progressreports/project/{id} instead of needing a
                // work-order-keyed endpoint in a service that has no Project table.
                ProjectIds = w.Projects.Select(p => p.Id).ToList()
            })
            .FirstOrDefaultAsync();

        if (wo == null) return NotFound();
        return Ok(wo);
    }

    // Creates a Work Order in "Draft" status. Milestones travel in the payload but are
    // owned by ExecutionService, so they are validated here and persisted by the caller in
    // a follow-up POST /api/execution/milestones (this codebase composes across services on
    // the client rather than making service-to-service calls).
    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Create([FromBody] CreateWorkOrderDto dto)
    {
        if (dto == null) return BadRequest("Request body is required.");

        if (dto.Milestones.Count > 0)
        {
            if (dto.Milestones.Any(m => string.IsNullOrWhiteSpace(m.Title)))
                return BadRequest("Every milestone needs a title.");

            if (dto.Milestones.Any(m => m.Weightage < 0 || m.PaymentPercentage < 0))
                return BadRequest("Milestone weightage and payment percentage cannot be negative.");

            var totalWeightage = dto.Milestones.Sum(m => m.Weightage);
            if (totalWeightage != 100)
                return BadRequest("Sum of Milestone Weightages must equal 100%.");
        }

        var workOrderNo = dto.WorkOrderNo?.Trim() ?? string.Empty;
        if (workOrderNo.Length == 0)
            return BadRequest("Work Order number is required.");

        // The number is the human key printed on the contract; duplicates make the audit
        // trail ambiguous and break lookups by number.
        if (await _context.WorkOrders.AnyAsync(w => w.WorkOrderNo == workOrderNo))
            return BadRequest($"A work order numbered '{workOrderNo}' already exists.");

        // A negative value used to sail through the budget ceiling below, since any
        // negative number is comfortably less than the tender budget.
        if (dto.TotalValue <= 0)
            return BadRequest("Project cost must be greater than zero.");

        var tender = await _context.Tenders.FindAsync(dto.TenderId);
        if (tender == null) return BadRequest("Tender not found.");

        if (dto.TotalValue > tender.Budget)
            return BadRequest($"Project Cost ({dto.TotalValue}) cannot exceed Tender Budget ({tender.Budget}).");

        if (dto.VendorId == Guid.Empty) return BadRequest("Vendor is required.");

        if (dto.StartDate == default || dto.EndDate == default)
            return BadRequest("Start date and completion date are both required.");

        if (dto.EndDate <= dto.StartDate)
            return BadRequest("Completion date must be after the start date.");

        // Milestones outside the contract window can never be met on time, and the LD
        // calculation keys off the work-order dates.
        var strayMilestone = dto.Milestones.FirstOrDefault(m => m.TargetDate < dto.StartDate || m.TargetDate > dto.EndDate);
        if (strayMilestone is not null)
            return BadRequest($"Milestone '{strayMilestone.Title}' has a target date outside the work order period.");

        var workOrder = new WorkOrder
        {
            VendorId = dto.VendorId,
            TenderId = dto.TenderId,
            WorkOrderNo = workOrderNo,
            TotalValue = dto.TotalValue,
            ScopeDescription = dto.ScopeDescription,
            PaymentTerms = dto.PaymentTerms,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            LiquidatedDamagesTerms = dto.LiquidatedDamagesTerms,
            AgreementDocumentUrl = dto.AgreementDocumentUrl,
            InspectorId = dto.InspectorId,
            // Work almost always sits with the department that floated the tender, so
            // inherit it rather than making the caller restate it; an explicit value wins.
            DepartmentId = dto.DepartmentId ?? tender.DepartmentId,
            UlbId = dto.UlbId ?? tender.UlbId,
            ZoneId = dto.ZoneId ?? tender.ZoneId,
            WardId = dto.WardId ?? tender.WardId,
            Status = "Draft"
        };

        _context.WorkOrders.Add(workOrder);
        await _context.SaveChangesAsync();

        await _audit.LogAsync("WorkOrder", workOrder.Id.ToString(), "Draft Created",
            $"Work Order {workOrder.WorkOrderNo} created with {dto.Milestones.Count} milestone(s).");

        // Return a scalar projection: the tracked Tender is fixed up onto workOrder.Tender by
        // EF, which would otherwise serialize as a WorkOrder<->Tender reference cycle.
        return Ok(new
        {
            workOrder.Id,
            workOrder.TenderId,
            workOrder.VendorId,
            workOrder.InspectorId,
            workOrder.WorkOrderNo,
            workOrder.TotalValue,
            workOrder.StartDate,
            workOrder.EndDate,
            workOrder.ScopeDescription,
            workOrder.PaymentTerms,
            workOrder.LiquidatedDamagesTerms,
            workOrder.AgreementDocumentUrl,
            workOrder.Status,
            workOrder.DepartmentId,
            workOrder.UlbId,
            workOrder.ZoneId,
            workOrder.WardId,
            workOrder.CreatedAt
        });
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.NewStatus))
            return BadRequest("newStatus is required.");

        var workOrder = await _context.WorkOrders.FirstOrDefaultAsync(w => w.Id == id);
        if (workOrder == null) return NotFound("Work Order not found.");

        var userRole = User.FindFirstValue(ClaimTypes.Role);
        var oldStatus = workOrder.Status;

        // Only these transitions are legal; anything else (typos, arbitrary jumps such as
        // Draft -> Completed, or regressions) is rejected so a client cannot skip the workflow.
        // Cancellation is allowed only BEFORE the vendor has accepted the work order — once a
        // vendor has accepted and work is in flight, closing it out is a different process, so
        // Cancelled is deliberately absent from Accepted/Project Activated/Completed.
        var allowedTransitions = new Dictionary<string, string[]>
        {
            ["Draft"] = new[] { "Authority Approval", "Pending Vendor Acceptance", "Cancelled" },
            ["Authority Approval"] = new[] { "Pending Vendor Acceptance", "Cancelled" },
            ["Pending Vendor Acceptance"] = new[] { "Accepted", "Cancelled" },
            ["Accepted"] = new[] { "Project Activated", "Completed" },
            ["Project Activated"] = new[] { "Completed" }
        };

        if (!allowedTransitions.TryGetValue(oldStatus, out var nextStates) ||
            !nextStates.Contains(request.NewStatus))
            return BadRequest($"Illegal status transition: '{oldStatus}' -> '{request.NewStatus}'.");

        // Only a Vendor may accept a Work Order (matches the original workflow rules).
        if (request.NewStatus == "Accepted" && userRole != "Vendor")
            return Forbid();

        // Only Admin/PMU may cancel a work order.
        if (request.NewStatus == "Cancelled" && userRole != "Admin" && userRole != "PMU")
            return Forbid();

        workOrder.Status = request.NewStatus;

        // On acceptance the system activates a Project record for the Work Order.
        // Idempotent: only one Project per Work Order, so a double-click/retry cannot create duplicates.
        // NOTE: Milestones are owned by ExecutionService, so linking them to this Project
        // (the monolith set milestone.ProjectId here) is not done cross-service.
        if (request.NewStatus == "Accepted" &&
            !await _context.Projects.AnyAsync(p => p.WorkOrderId == workOrder.Id))
        {
            _context.Projects.Add(new Project
            {
                WorkOrderId = workOrder.Id,
                Name = $"Project for WO {workOrder.WorkOrderNo}",
                Budget = workOrder.TotalValue,
                DepartmentId = workOrder.DepartmentId,
                UlbId = workOrder.UlbId,
                ZoneId = workOrder.ZoneId,
                WardId = workOrder.WardId,
                Status = "Activated"
            });
        }

        await _context.SaveChangesAsync();

        await _audit.LogAsync("WorkOrder", id.ToString(), "Status changed",
            $"{oldStatus} -> {request.NewStatus}");

        return Ok(new { message = $"Status successfully transitioned to {request.NewStatus}" });
    }

    // Authority approval step: moves a Work Order from "Authority Approval" to the vendor.
    [HttpPut("{id}/approve")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Approve(Guid id)
    {
        var workOrder = await _context.WorkOrders.FirstOrDefaultAsync(w => w.Id == id);
        if (workOrder == null) return NotFound("Work Order not found.");

        // Only a Work Order awaiting authority approval can be approved — prevents regressing
        // an already-Accepted/Completed Work Order back to "Pending Vendor Acceptance".
        if (workOrder.Status != "Draft" && workOrder.Status != "Authority Approval")
            return BadRequest($"Only a Draft or Authority Approval work order can be approved (current: '{workOrder.Status}').");

        workOrder.Status = "Pending Vendor Acceptance";
        await _context.SaveChangesAsync();

        await _audit.LogAsync("WorkOrder", id.ToString(), "Approved & sent to vendor",
            $"Work Order {workOrder.WorkOrderNo} sent for vendor acceptance.");

        return Ok(new { message = "Work Order approved and sent to vendor." });
    }

    // Narrow, location-only update for a pre-existing Work Order. Deliberately not a generic
    // PUT: a full-entity update endpoint here would be much larger surface than the one thing
    // this needs to fix (backfilling UlbId/ZoneId/WardId onto rows created before those columns
    // existed), and the Tender service's generic form-based PUT already shows the footgun that
    // shape invites — it silently blanks Description because the read side never round-trips it.
    // This is a full replace of the three fields, not a merge: the caller is expected to always
    // send all three, so a field left off the request body clears that field rather than
    // preserving the old value.
    [HttpPatch("{id}/location")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> UpdateLocation(Guid id, [FromBody] UpdateLocationRequest request)
    {
        if (request == null) return BadRequest("Request body is required.");

        var workOrder = await _context.WorkOrders.FirstOrDefaultAsync(w => w.Id == id);
        if (workOrder == null) return NotFound("Work Order not found.");

        workOrder.UlbId = request.UlbId;
        workOrder.ZoneId = request.ZoneId;
        workOrder.WardId = request.WardId;

        await _context.SaveChangesAsync();

        return Ok(new { workOrder.Id, workOrder.UlbId, workOrder.ZoneId, workOrder.WardId });
    }

    public class CreateWorkOrderDto
    {
        public Guid VendorId { get; set; }
        public Guid TenderId { get; set; }
        public string WorkOrderNo { get; set; } = string.Empty;
        public decimal TotalValue { get; set; }
        public string ScopeDescription { get; set; } = string.Empty;
        public string PaymentTerms { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string LiquidatedDamagesTerms { get; set; } = string.Empty;
        public string AgreementDocumentUrl { get; set; } = string.Empty;
        public Guid? InspectorId { get; set; }
        /// <summary>Optional — defaults to the parent tender's department.</summary>
        public Guid? DepartmentId { get; set; }
        /// <summary>Optional — each defaults to the parent tender's corresponding location id.</summary>
        public Guid? UlbId { get; set; }
        public Guid? ZoneId { get; set; }
        public Guid? WardId { get; set; }
        public List<MilestoneInput> Milestones { get; set; } = new();
    }

    public class MilestoneInput
    {
        public string Title { get; set; } = string.Empty;
        public decimal Weightage { get; set; }
        public decimal PaymentPercentage { get; set; }
        public DateTime TargetDate { get; set; }
    }

    public class UpdateStatusRequest
    {
        public string NewStatus { get; set; } = string.Empty;
    }

    public class UpdateLocationRequest
    {
        public Guid? UlbId { get; set; }
        public Guid? ZoneId { get; set; }
        public Guid? WardId { get; set; }
    }
}
