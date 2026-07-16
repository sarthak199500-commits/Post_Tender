using System;
using System.Linq;
using VendorService.Entities;

namespace VendorService.Persistence;

/// <summary>
/// Links the demo Vendor login (seeded in IdentityService with a fixed UserId)
/// to an actual Vendor profile record, so the Vendor Dashboard has something to
/// resolve "who am I" against. UserId here must match
/// IdentityService.Persistence.DbSeeder.DemoIds.VendorUserId.
/// </summary>
public static class DbSeeder
{
    private static readonly Guid DemoVendorUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    // Fixed Vendor.Id so other services (e.g. the seeded TenderAllotment in TenderService)
    // can reference this vendor deterministically without a shared database.
    public static readonly Guid DemoVendorId = Guid.Parse("a0000000-0000-0000-0000-000000000001");

    public static void Seed(VendorDbContext context)
    {
        if (context.Vendors.Any())
            return;

        context.Vendors.Add(new Vendor
        {
            Id = DemoVendorId,
            UserId = DemoVendorUserId,
            Name = "Demo Construction Co.",
            VendorCode = "VEND-DEMO01",
            RegistrationNumber = "REG-DEMO-001",
            GSTNo = "29ABCDE1234F1Z5",
            AuthPersonName = "Demo Vendor",
            ContactEmail = "vendor@posttender.local",
            Status = "Active",
            PerformanceScore = 92
        });

        context.SaveChanges();
    }
}
