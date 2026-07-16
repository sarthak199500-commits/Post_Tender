using System;

namespace ExecutionService.Entities;

public class MilestoneDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid MilestoneSubmissionId { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public MilestoneSubmission? MilestoneSubmission { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // Completion Certificate, Test Report, Quality Certificate, Other
    public string Url { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

