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
}


