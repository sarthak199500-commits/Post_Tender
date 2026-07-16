using System;
using System.Collections.Generic;

namespace ExecutionService.Entities;

public class MilestoneSubmission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid MilestoneId { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public Milestone? Milestone { get; set; }
    
    public Guid VendorId { get; set; }

    public Guid ProjectId { get; set; }

    // Vendor's submission notes
    public string Notes { get; set; } = string.Empty;
    
    // IDs of existing ProgressReports the vendor links to this submission
    public List<Guid> LinkedReportIds { get; set; } = new();
    
    // Status: Draft, Submitted, Under Review, Approved, Rejected
    public string Status { get; set; } = "Draft";
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    
    public bool IsImmutable { get; set; } = false; // becomes true on submit
    
    // Navigation
    public ICollection<MilestoneDocument> Documents { get; set; } = new List<MilestoneDocument>();
}


