using System;

namespace TenderService.Entities;

public class TenderType
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty; // e.g. Open, Limited, GeM, Global, etc.
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

