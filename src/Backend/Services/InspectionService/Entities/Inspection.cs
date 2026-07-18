using System;
using System.Collections.Generic;

namespace InspectionService.Entities;

public class Inspection
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }

    // Denormalized from the project's work order so the vendor's defects can be scoped
    // without a cross-service call (same rationale as Bill.VendorId).
    public Guid VendorId { get; set; }

    public Guid InspectorId { get; set; }
        
    public DateTime InspectionDate { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public string Status { get; set; } = "Pass"; // Pass, Fail, Follow-up Required
    
    // Detailed Observations / Defects
    public List<InspectionDefect> Defects { get; set; } = new List<InspectionDefect>();
    
    public string EvidenceUrl { get; set; } = string.Empty; // Image/Video of inspection
}

public class InspectionDefect
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Description { get; set; } = string.Empty;
    public string Severity { get; set; } = "Low"; // Low, Medium, High, Critical
    public string Status { get; set; } = "Open"; // Open, Rectified, Verified
    public string? ReworkReportUrl { get; set; } // Evidence of rectification submitted by vendor
    public DateTime? RectifiedAt { get; set; }
}




