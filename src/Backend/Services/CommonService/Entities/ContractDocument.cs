using System;

namespace CommonService.Entities;

public class ContractDocument
{
    public Guid Id { get; set; }
    public Guid VendorId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // Financial, Compliance, Technical, General
    public string Size { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public string Status { get; set; } = "Pending"; // Pending, Verified, Rejected
}

