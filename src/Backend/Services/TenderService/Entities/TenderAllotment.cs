using System;

namespace TenderService.Entities;

public class TenderAllotment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenderId { get; set; }
    public Tender? Tender { get; set; }

    public Guid? L1VendorId { get; set; }
    
    public Guid? L2VendorId { get; set; }
    
    public Guid? L3VendorId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


