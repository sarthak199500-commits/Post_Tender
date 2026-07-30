using Microsoft.EntityFrameworkCore;
using FinancialService.Entities;
namespace FinancialService.Persistence;
public class FinancialServiceDbContext : DbContext {
    public FinancialServiceDbContext(DbContextOptions<FinancialServiceDbContext> options) : base(options) {}
    public DbSet<Bill> Bills { get; set; }
    public DbSet<TaxConfiguration> TaxConfigurations { get; set; }
    public DbSet<BillDeduction> BillDeductions { get; set; }
    public DbSet<BillingPolicy> BillingPolicies { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // NetPayableAmount is computed in memory (it needs Deductions loaded, which is a
        // real relation, not a column) — without this EF tries to map it to a column too.
        modelBuilder.Entity<Bill>().Ignore(b => b.NetPayableAmount);

        modelBuilder.Entity<Bill>()
            .HasMany(b => b.Deductions)
            .WithOne(d => d.Bill)
            .HasForeignKey(d => d.BillId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}


