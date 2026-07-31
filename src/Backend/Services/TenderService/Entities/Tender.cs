using System;
using System.Collections.Generic;

namespace TenderService.Entities;

public class Tender
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TenderNo { get; set; } = string.Empty;      // Tender ID
    public string Title { get; set; } = string.Empty;         // Tender Name
    public string Description { get; set; } = string.Empty;
    public string TenderType { get; set; } = string.Empty;    // e.g. Open, Limited, GeM
    public decimal Budget { get; set; }
    public decimal EMDAmount { get; set; }
    public string Portal { get; set; } = string.Empty;        // e.g. GeM Portal, CPPP
    public string DocumentUrl { get; set; } = string.Empty;   // Uploaded tender copy
    public DateTime? PublishDate { get; set; }
    public DateTime? CloseDate { get; set; }
    public string Status { get; set; } = "Open";              // Open, Closed, Awarded

    // The owning department. Departments are mastered in IdentityService, so only the
    // id is stored here and the name is joined client-side — the same cross-service
    // pattern used for vendor and inspector names.
    public Guid? DepartmentId { get; set; }


    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
}

