using System;

namespace VendorService.Entities;

public class Vendor
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;            // Company Name
    public string RegistrationNumber { get; set; } = string.Empty;
    public string VendorCode { get; set; } = string.Empty;
    public string GSTNo { get; set; } = string.Empty;
    public int? YearOfIncorporation { get; set; }
    public string AuthPersonName { get; set; } = string.Empty;  // Authorized Person
    public string Mobile { get; set; } = string.Empty;
    public string AlternativeNumber { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string RegistrationDetails { get; set; } = string.Empty;

    public Guid? CategoryId { get; set; }
    public VendorCategory? Category { get; set; }

    // Linked user account (from IdentityService)
    public Guid UserId { get; set; }

    public string Status { get; set; } = "Active"; // Active, On-Hold, Blacklisted
    public decimal PerformanceScore { get; set; } = 100.0m;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
