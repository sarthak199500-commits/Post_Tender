using System;
using System.Collections.Generic;

namespace FinancialService.Entities;

public class Bill
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid WorkOrderId { get; set; }

    public string BillNo { get; set; } = string.Empty;
    public string Type { get; set; } = "RA"; // RA (Running Account), Final
    
    public decimal Amount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount => Amount + TaxAmount;
    
    public string Status { get; set; } = "Submitted"; // Submitted, Under Review, Approved, Paid, Returned
    
    public string AttachmentUrl { get; set; } = string.Empty; // Digital submission PDF
    
    public string? RejectionReason { get; set; }
    
    // Links to milestones
    public List<Guid> MilestoneIds { get; set; } = new List<Guid>();
    
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public string? PaymentVoucherNo { get; set; }
    
    public bool IsImmutable { get; set; } = true;
}



