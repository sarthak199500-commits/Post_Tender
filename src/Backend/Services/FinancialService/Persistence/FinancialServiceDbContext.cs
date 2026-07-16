using Microsoft.EntityFrameworkCore;
using FinancialService.Entities;
namespace FinancialService.Persistence;
public class FinancialServiceDbContext : DbContext {
    public FinancialServiceDbContext(DbContextOptions<FinancialServiceDbContext> options) : base(options) {}
    public DbSet<Bill> Bills { get; set; }
    public DbSet<TaxConfiguration> TaxConfigurations { get; set; }
}


