using System;
using System.Linq;
using TenderService.Entities;

namespace TenderService.Persistence;

/// <summary>
/// Seeds one awarded Tender and a matching TenderAllotment so the "Issue Work Order"
/// wizard has an awarded tender (with an L1 vendor) to pick from out of the box.
/// The L1 vendor id must match VendorService.Persistence.DbSeeder.DemoVendorId.
/// </summary>
public static class DbSeeder
{
    private static readonly Guid AwardedTenderId = Guid.Parse("b0000000-0000-0000-0000-000000000001");
    private static readonly Guid DemoVendorId = Guid.Parse("a0000000-0000-0000-0000-000000000001");

    public static void Seed(TenderServiceDbContext context)
    {
        if (context.Tenders.Any())
            return;

        context.Tenders.Add(new Tender
        {
            Id = AwardedTenderId,
            TenderNo = "TND-2026-001",
            Title = "Municipal Road Resurfacing – Sector 14",
            Description = "Resurfacing and drainage works for Sector 14 arterial roads.",
            TenderType = "Open",
            Budget = 25000000m,
            EMDAmount = 250000m,
            Portal = "GeM Portal",
            Status = "Awarded"
        });

        context.TenderAllotments.Add(new TenderAllotment
        {
            TenderId = AwardedTenderId,
            L1VendorId = DemoVendorId
        });

        context.SaveChanges();
    }
}
