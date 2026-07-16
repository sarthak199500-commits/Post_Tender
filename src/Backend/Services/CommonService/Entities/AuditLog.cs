using System;

namespace CommonService.Entities;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EntityName { get; set; } = string.Empty;
    public string RecordId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // e.g. "Draft -> Authority Approval"
    
    public Guid? UserId { get; set; }
        
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string ChangesInfo { get; set; } = string.Empty; // Store event name or basic change info
}


