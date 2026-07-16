using System;
using System.Collections.Generic;

namespace ExecutionService.Entities;

public class Milestone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid? ProjectId { get; set; }
        
    public Guid? WorkOrderId { get; set; }

    public string Title { get; set; } = string.Empty;
    public decimal Weightage { get; set; } // 0-100%
    public decimal PaymentPercentage { get; set; } // 0-100%
    public DateTime TargetDate { get; set; }
    public DateTime? CompletionDate { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Completed, Delayed
    public string Remarks { get; set; } = string.Empty;
    
    public ICollection<MilestoneSubmission> Submissions { get; set; } = new List<MilestoneSubmission>();
}



