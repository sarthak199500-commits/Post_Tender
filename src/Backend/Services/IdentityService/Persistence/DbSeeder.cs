using System;
using IdentityService.Entities;
using IdentityService.Security;

namespace IdentityService.Persistence;

/// <summary>
/// Seeds default accounts so the system is usable immediately after a fresh
/// database is created. Passwords are stored hashed; the plaintext values below
/// are development defaults only — change/remove for production.
/// The demo Vendor/Inspector user IDs are fixed (not random) so that
/// VendorService/InspectionService can seed matching profile records that
/// link back to these accounts via UserId. Keep DemoIds in sync across services.
/// </summary>
public static class DbSeeder
{
    public static class DemoIds
    {
        public static readonly Guid VendorUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        public static readonly Guid InspectorUserId = Guid.Parse("33333333-3333-3333-3333-333333333333");

        // Must equal VendorService.Persistence.DbSeeder.DemoVendorId. The services do not
        // share a database, so this pair is kept in sync by hand. TenderService's seeded
        // TenderAllotment also references this id — do not mint a new one.
        public static readonly Guid VendorRecordId = Guid.Parse("a0000000-0000-0000-0000-000000000001");
    }

    public static void Seed(IdentityDbContext context)
    {
        if (context.Users.Any())
            return;

        context.Users.AddRange(
            new User
            {
                Name = "System Admin",
                Email = "admin@posttender.local",
                Role = Role.Admin,
                PasswordHash = PasswordHasher.Hash("Admin@123")
            },
            new User
            {
                Name = "Demo PMU Officer",
                Email = "pmu@posttender.local",
                Role = Role.PMU,
                PasswordHash = PasswordHasher.Hash("Pmu@123456")
            },
            new User
            {
                Id = DemoIds.VendorUserId,
                Name = "Demo Vendor",
                Email = "vendor@posttender.local",
                Role = Role.Vendor,
                VendorId = DemoIds.VendorRecordId,
                PasswordHash = PasswordHasher.Hash("Vendor@123")
            },
            new User
            {
                Id = DemoIds.InspectorUserId,
                Name = "Demo Inspector",
                Email = "inspector@posttender.local",
                Role = Role.Inspector,
                PasswordHash = PasswordHasher.Hash("Inspector@123")
            },
            new User
            {
                Name = "Demo Department Officer",
                Email = "department@posttender.local",
                Role = Role.Department,
                PasswordHash = PasswordHasher.Hash("Department@123")
            },
            new User
            {
                Name = "Demo Finance Officer",
                Email = "finance@posttender.local",
                Role = Role.Finance,
                PasswordHash = PasswordHasher.Hash("Finance@123")
            }
        );

        context.SaveChanges();
    }
}
