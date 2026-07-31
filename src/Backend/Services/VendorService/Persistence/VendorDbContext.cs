using Microsoft.EntityFrameworkCore;
using VendorService.Entities;

namespace VendorService.Persistence;

public class VendorDbContext : DbContext
{
    public VendorDbContext(DbContextOptions<VendorDbContext> options) : base(options)
    {
    }

    public DbSet<Vendor> Vendors { get; set; }
    public DbSet<VendorCategory> VendorCategories { get; set; }

    // SQL Server has no implicit decimal store type; unstated, EF falls back to
    // decimal(18,2) and warns for every property. PerformanceScore is a 0-100 score,
    // so two decimal places is deliberate rather than inherited.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.VendorCode).IsUnique();
        });

        modelBuilder.Entity<VendorCategory>(entity =>
        {
            entity.HasKey(e => e.Id);
        });
    }
}
