using Microsoft.EntityFrameworkCore;
using CommonService.Entities;
namespace CommonService.Persistence;
public class CommonServiceDbContext : DbContext {
    public CommonServiceDbContext(DbContextOptions<CommonServiceDbContext> options) : base(options) {}
    public DbSet<Location> Locations { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<ContractDocument> ContractDocuments { get; set; }
}


