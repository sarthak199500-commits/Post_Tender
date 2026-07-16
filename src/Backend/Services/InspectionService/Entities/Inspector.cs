using System;
using System.Collections.Generic;

namespace InspectionService.Entities;

public class Inspector
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    
    public Guid? UserId { get; set; }
        
    // e.g. "Department" or "3rd Party"
    public string Type { get; set; } = "Department"; 
    
    // Required only if Type is "3rd Party"
    public string? CompanyName { get; set; } 
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties if needed
    }


