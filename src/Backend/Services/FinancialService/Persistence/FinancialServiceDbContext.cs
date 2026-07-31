using Microsoft.EntityFrameworkCore;
using FinancialService.Entities;
namespace FinancialService.Persistence;
public class FinancialServiceDbContext : DbContext {
    public FinancialServiceDbContext(DbContextOptions<FinancialServiceDbContext> options) : base(options) {}
    public DbSet<Bill> Bills { get; set; }
    public DbSet<TaxConfiguration> TaxConfigurations { get; set; }
    public DbSet<BillDeduction> BillDeductions { get; set; }
    public DbSet<BillingPolicy> BillingPolicies { get; set; }
    public DbSet<BillPayment> BillPayments { get; set; }

    // SQLite stored decimals as TEXT at arbitrary precision. SQL Server needs a real
    // store type, and left unstated EF silently falls back to decimal(18,2) while warning
    // about every property. Stating it makes the money semantics deliberate: 16 integer
    // digits and exactly the two paise of scale these amounts are rounded to anyway.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // NetPayableAmount is computed in memory (it needs Deductions loaded, which is a
        // real relation, not a column) — without this EF tries to map it to a column too.
        modelBuilder.Entity<Bill>().Ignore(b => b.NetPayableAmount);
        modelBuilder.Entity<Bill>().Ignore(b => b.AmountPaid);
        modelBuilder.Entity<Bill>().Ignore(b => b.BalanceAmount);

        modelBuilder.Entity<Bill>()
            .HasMany(b => b.Deductions)
            .WithOne(d => d.Bill)
            .HasForeignKey(d => d.BillId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Bill>()
            .HasMany(b => b.Payments)
            .WithOne()
            .HasForeignKey(p => p.BillId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}


