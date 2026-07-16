namespace ExecutionService.Entities;

public class MilestoneTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<MilestoneTemplateItem> Items { get; set; } = new List<MilestoneTemplateItem>();
}

public class MilestoneTemplateItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MilestoneTemplateId { get; set; }
    public MilestoneTemplate? MilestoneTemplate { get; set; }
    public string StepName { get; set; } = string.Empty;
    public decimal PercentageReleasing { get; set; }
    public int SequenceOrder { get; set; }
}

