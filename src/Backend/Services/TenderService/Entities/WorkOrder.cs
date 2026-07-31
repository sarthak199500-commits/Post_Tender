using System;
using System.Collections.Generic;

namespace TenderService.Entities;

public class WorkOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid TenderId { get; set; }
    public Tender? Tender { get; set; }
    
    public Guid VendorId { get; set; }
        
    public Guid? InspectorId { get; set; }
        
    public string WorkOrderNo { get; set; } = string.Empty;
    public decimal TotalValue { get; set; }
    
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    
    public string ScopeDescription { get; set; } = string.Empty;
    public string PaymentTerms { get; set; } = string.Empty;
    public string LiquidatedDamagesTerms { get; set; } = string.Empty;
    public string AgreementDocumentUrl { get; set; } = string.Empty;
    
    // The owning department. Departments are mastered in IdentityService, so only the
    // id is stored here and the name is joined client-side — the same cross-service
    // pattern used for vendor and inspector names.
    public Guid? DepartmentId { get; set; }

    public string Status { get; set; } = "Draft"; // Draft, Authority Approval, Pending Vendor Acceptance, Accepted, Project Activated, Completed, Cancelled
    

        
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Project> Projects { get; set; } = new List<Project>();
}


