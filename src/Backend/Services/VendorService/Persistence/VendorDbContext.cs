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
