using Microsoft.EntityFrameworkCore;
using TenderService.Entities;
namespace TenderService.Persistence;
public class TenderServiceDbContext : DbContext {
    public TenderServiceDbContext(DbContextOptions<TenderServiceDbContext> options) : base(options) {}
    public DbSet<Tender> Tenders { get; set; }
    public DbSet<TenderType> TenderTypes { get; set; }
    public DbSet<TenderAllotment> TenderAllotments { get; set; }
    public DbSet<WorkOrder> WorkOrders { get; set; }
    public DbSet<Project> Projects { get; set; }
    public DbSet<TimeExtension> TimeExtensions { get; set; }

    // SQL Server has no implicit decimal store type; unstated, EF falls back to
    // decimal(18,2) and warns for every property. Budgets and contract values need the
    // integer headroom, percentages need the two places — 18,2 covers both deliberately.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }
}


