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

    // SQL Server has no implicit decimal store type; unstated, EF falls back to
    // decimal(18,2) and warns for every property. Weightage, payment and physical
    // percentages are all 0-100 with at most two places, so state it rather than inherit it.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }
}


