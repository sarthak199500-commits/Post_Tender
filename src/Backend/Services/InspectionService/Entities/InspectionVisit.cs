using System;

namespace InspectionService.Entities;

public class InspectionVisit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid WorkOrderId { get; set; }

    // Denormalized from the work order by the caller — work orders live in TenderService.
    // Without it a vendor's own upcoming visits can't be scoped (same rationale as
    // Inspection.VendorId).
    public Guid VendorId { get; set; }

    public Guid InspectorId { get; set; }
    public Inspector? Inspector { get; set; }
    
    public DateTime ScheduledDate { get; set; }
    public DateTime? ActualVisitDate { get; set; }
    
    public string Purpose { get; set; } = string.Empty; // e.g. "Monthly Audit", "Milestone Verification"
    public string Status { get; set; } = "Scheduled"; // Scheduled, Completed, Cancelled
    
    public string? Remarks { get; set; }
    public string? AttachmentUrl { get; set; } // Photo or report document
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


