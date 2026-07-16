using System;
using System.Collections.Generic;

namespace ExecutionService.Entities;

public class ProgressReport
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid ProjectId { get; set; }
        
    public Guid VendorId { get; set; }
        
    public decimal PhysicalPercentage { get; set; }
    public string WorkDescription { get; set; } = string.Empty;
    
    // Geo-location data
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    
    // Evidence links (Images/Videos)
    public List<string> MediaUrls { get; set; } = new List<string>();
    
    public DateTime ReportedAt { get; set; } = DateTime.UtcNow;
    
    public string Status { get; set; } = "Submitted"; // Submitted, Reviewed, Returned
    public bool IsImmutable { get; set; } = true;
    
    // Optional link to milestone
    public Guid? MilestoneId { get; set; }
    public Milestone? Milestone { get; set; }
}


