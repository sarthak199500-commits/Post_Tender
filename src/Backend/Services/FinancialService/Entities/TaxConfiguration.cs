namespace FinancialService.Entities;

public class TaxConfiguration
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TaxName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

