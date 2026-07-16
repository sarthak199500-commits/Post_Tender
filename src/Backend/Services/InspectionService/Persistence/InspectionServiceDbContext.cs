using Microsoft.EntityFrameworkCore;
using InspectionService.Entities;
namespace InspectionService.Persistence;
public class InspectionServiceDbContext : DbContext {
    public InspectionServiceDbContext(DbContextOptions<InspectionServiceDbContext> options) : base(options) {}
    public DbSet<Inspection> Inspections { get; set; }
    public DbSet<InspectionVisit> InspectionVisits { get; set; }
    public DbSet<Inspector> Inspectors { get; set; }
    public DbSet<DefectCategory> DefectCategories { get; set; }
}


