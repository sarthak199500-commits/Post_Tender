using Microsoft.EntityFrameworkCore;
using ExecutionService.Entities;
namespace ExecutionService.Persistence;
public class ExecutionServiceDbContext : DbContext {
    public ExecutionServiceDbContext(DbContextOptions<ExecutionServiceDbContext> options) : base(options) {}
    public DbSet<Milestone> Milestones { get; set; }
    public DbSet<MilestoneTemplate> MilestoneTemplates { get; set; }
    public DbSet<MilestoneSubmission> MilestoneSubmissions { get; set; }
    public DbSet<MilestoneDocument> MilestoneDocuments { get; set; }
    public DbSet<ProgressReport> ProgressReports { get; set; }
    public DbSet<Query> Queries { get; set; }
    public DbSet<QueryMessage> QueryMessages { get; set; }
}


