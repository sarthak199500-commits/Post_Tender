using Microsoft.EntityFrameworkCore;
using CommonService.Entities;
namespace CommonService.Persistence;
public class CommonServiceDbContext : DbContext {
    public CommonServiceDbContext(DbContextOptions<CommonServiceDbContext> options) : base(options) {}
    public DbSet<Location> Locations { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<ContractDocument> ContractDocuments { get; set; }
    public DbSet<Alert> Alerts { get; set; }
    public DbSet<AlertRead> AlertReads { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Alert>()
            .HasMany(a => a.Reads)
            .WithOne()
            .HasForeignKey(r => r.AlertId)
            .OnDelete(DeleteBehavior.Cascade);

        // One read mark per user per alert — a second "mark as read" must be a no-op,
        // not a duplicate row.
        modelBuilder.Entity<AlertRead>()
            .HasIndex(r => new { r.AlertId, r.UserId })
            .IsUnique();
    }
}


