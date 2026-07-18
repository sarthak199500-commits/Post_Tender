using System;
using System.Collections.Generic;
using System.Linq;
using InspectionService.Entities;

namespace InspectionService.Persistence;

/// <summary>
/// Links the demo Inspector login (seeded in IdentityService with a fixed
/// UserId) to an actual Inspector profile record, so the Inspector Dashboard
/// has something to resolve "who am I" against. UserId here must match
/// IdentityService.Persistence.DbSeeder.DemoIds.InspectorUserId.
///
/// Also seeds one demo inspection with open defects against the demo vendor so the
/// vendor's "Quality Defects & Rectification" worklist has something to act on. The
/// VendorId is the fixed demo VendorRecordId; the ProjectId is illustrative.
/// </summary>
public static class DbSeeder
{
    private static readonly Guid DemoInspectorUserId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid DemoVendorId = Guid.Parse("a0000000-0000-0000-0000-000000000001");
    private static readonly Guid DemoProjectId = Guid.Parse("8269bb9d-36bd-4221-bb43-e4b2bb3b5590");

    public static void Seed(InspectionServiceDbContext context)
    {
        if (!context.Inspectors.Any())
        {
            context.Inspectors.Add(new Inspector
            {
                UserId = DemoInspectorUserId,
                Name = "Demo Inspector",
                Email = "inspector@posttender.local",
                Type = "Department"
            });
            context.SaveChanges();
        }

        if (!context.Inspections.Any())
        {
            context.Inspections.Add(new Inspection
            {
                ProjectId = DemoProjectId,
                VendorId = DemoVendorId,
                InspectorId = DemoInspectorUserId,
                InspectionDate = DateTime.UtcNow.AddDays(-3),
                Status = "Follow-up Required",
                Remarks = "Site inspection flagged finishing defects requiring rework.",
                Defects = new List<InspectionDefect>
                {
                    new() { Description = "Honeycombing observed on the north column face.", Severity = "High", Status = "Open" },
                    new() { Description = "Cover blocks missing in slab reinforcement.", Severity = "Medium", Status = "Open" }
                }
            });
            context.SaveChanges();
        }
    }
}
