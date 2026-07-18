using System;
using System.Collections.Generic;

namespace ExecutionService.Entities;

public class Query
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VendorId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = "Open"; // Open, In Progress, Resolved
    public DateTime CreatedAt { get; set; }
    public List<QueryMessage> Messages { get; set; } = new List<QueryMessage>();
}

public class QueryMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    // Explicit FK (maps to the existing QueryId column that was previously a shadow property).
    // Having a real FK + DbSet lets writes go through the set instead of the parent's
    // collection navigation, which the EF in-memory provider mishandles for an existing parent.
    public Guid? QueryId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string SenderRole { get; set; } = string.Empty; // Vendor, PMU
    public string SenderName { get; set; } = string.Empty;
}

