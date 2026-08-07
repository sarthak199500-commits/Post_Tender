using System;
using System.Collections.Generic;


namespace TenderService.Entities;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid WorkOrderId { get; set; }
    public WorkOrder? WorkOrder { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public decimal Budget { get; set; }
    public decimal Progress { get; set; } = 0; // Percentage 0-100
    // The owning department. Departments are mastered in IdentityService, so only the
    // id is stored here and the name is joined client-side — the same cross-service
    // pattern used for vendor and inspector names.
    public Guid? DepartmentId { get; set; }

    // Urban local body location. Locations are mastered in CommonService, so only ids are
    // stored here and names are joined client-side — the same cross-service pattern as
    // DepartmentId. All three levels are denormalised (rather than deriving Ulb/Zone by
    // walking up from the ward) so list filters stay a single-table query.
    public Guid? UlbId { get; set; }
    public Guid? ZoneId { get; set; }   // null wherever the ULB has no zones
    public Guid? WardId { get; set; }

    public string Status { get; set; } = "Not Started";
    
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

            }


