using System;
using System.Linq;
using InspectionService.Entities;

namespace InspectionService.Persistence;

/// <summary>
/// Links the demo Inspector login (seeded in IdentityService with a fixed
/// UserId) to an actual Inspector profile record, so the Inspector Dashboard
/// has something to resolve "who am I" against. UserId here must match
/// IdentityService.Persistence.DbSeeder.DemoIds.InspectorUserId.
/// </summary>
public static class DbSeeder
{
    private static readonly Guid DemoInspectorUserId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    public static void Seed(InspectionServiceDbContext context)
    {
        if (context.Inspectors.Any())
            return;

        context.Inspectors.Add(new Inspector
        {
            UserId = DemoInspectorUserId,
            Name = "Demo Inspector",
            Email = "inspector@posttender.local",
            Type = "Department"
        });

        context.SaveChanges();
    }
}
