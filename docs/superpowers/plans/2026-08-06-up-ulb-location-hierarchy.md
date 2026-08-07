# UP Urban Local Body Location Hierarchy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cascading Urban Local Body → Zone → Ward location hierarchy (with Ward Members) to Post Tender, carry it from Tender through Work Order to Project, seed it with real Uttar Pradesh data, and expose it as filters on the tender/work-order/project lists.

**Architecture:** The existing `Location` entity is already a self-referencing tree (`ParentLocationId` + `LocationType`), so the hierarchy needs no new table — only a `UlbType` column, a filtered read endpoint, and a UI that can actually create parent/child rows. Whether the Zone step appears is **derived from the data** (does this ULB have Zone children?) rather than from a flag or a hardcoded rule, so it self-corrects when real zone data is loaded. `UlbId`/`ZoneId`/`WardId` are denormalised onto Tender/WorkOrder/Project and inherited exactly the way `DepartmentId` already is, so location filters are single-table queries.

**Tech Stack:** .NET 8 microservices (CommonService, TenderService), EF Core + SQLite, YARP gateway, React 18 + Vite + TypeScript + Tailwind, xUnit + EF InMemory for tests, Node ESM scripts for seeding.

---

## Domain Reference (researched 2026-08-06)

Uttar Pradesh has **760 urban local bodies** in three statutory tiers:

| Tier | Hindi name | Count |
|---|---|---|
| Municipal Corporation | Nagar Nigam | 17 |
| Municipal Council | Nagar Palika Parishad | 200 |
| Town Council | Nagar Panchayat | 541 |

The 17 Nagar Nigams and their **official ward counts** (1,360 wards total):

Agra 100, Aligarh 70, Ayodhya 60, Bareilly 80, Firozabad 70, Ghaziabad 100, Gorakhpur 80, Jhansi 60, Kanpur 110, Lucknow 110, Meerut 90, Moradabad 70, Prayagraj 80, Saharanpur 70, Shahjahanpur 60, Varanasi 90, Mathura-Vrindavan 70.

**Known data gaps — do not fabricate these:**
- **Ward→zone mapping is not published machine-readably** and is reshuffled after each delimitation. Lucknow has 8 zones and Kanpur 6, but which ward sits in which zone is unknown. Therefore **no zones are seeded.** Wards attach directly to their corporation. When real zone data arrives, load it and the Zone dropdown appears automatically — this is the payoff of the derive-from-data rule.
- **Ward names** (local aliases) are not available in bulk. UP wards are officially identified by *number*, so seeding `Ward 1..110` is correct-but-unenriched data, not invention. Names are added later by editing the data file and re-running the seed.
- **Nagar Panchayat names** (541) were not obtainable as a machine-readable list. Only the two larger tiers are seeded. The seed is data-file driven so the third tier can be appended without code changes.

Sources: [Wikipedia — List of urban local bodies in Uttar Pradesh](https://en.wikipedia.org/wiki/List_of_urban_local_bodies_in_Uttar_Pradesh), [UP SEC ULB list](https://sec.up.nic.in/site/ulb_list.aspx), [UP Local Bodies Directorate](https://localbodies.up.nic.in/ulbdetails.html)

---

## File Structure

**Backend — CommonService** (owns Location + WardMember)
- Modify: `src/Backend/Services/CommonService/Entities/Location.cs` — add `UlbType`
- Create: `src/Backend/Services/CommonService/Entities/WardMember.cs`
- Modify: `src/Backend/Services/CommonService/Persistence/CommonServiceDbContext.cs` — add `WardMembers` DbSet
- Modify: `src/Backend/Services/CommonService/Controllers/LocationsController.cs` — filtered GET
- Create: `src/Backend/Services/CommonService/Controllers/WardMembersController.cs`

**Backend — TenderService** (owns Tender/WorkOrder/Project)
- Modify: `src/Backend/Services/TenderService/Entities/Tender.cs`, `WorkOrder.cs`, `Project.cs` — add `UlbId`/`ZoneId`/`WardId`
- Modify: `src/Backend/Services/TenderService/Controllers/TendersController.cs` — accept + filter
- Modify: `src/Backend/Services/TenderService/Controllers/WorkOrdersController.cs` — inherit + filter
- Modify: `src/Backend/Services/TenderService/Controllers/ProjectsController.cs` — filter

**Gateway**
- Modify: `src/Backend/PostTenderSystem.Gateway/appsettings.json` — route `masters/wardmembers` → common-cluster

**Tests**
- Create: `src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs`
- Create: `src/Backend/PostTenderSystem.Tests/Common/WardMembersTests.cs`
- Create: `src/Backend/PostTenderSystem.Tests/Tender/TenderLocationCascadeTests.cs`

**Seed data**
- Create: `src/Frontend/scripts/data/up-ulb.json` — the researched dataset (single source of truth, enrich here)
- Create: `src/Frontend/scripts/seed-locations.mjs`
- Create: `src/Frontend/scripts/backfill-locations.mjs`
- Modify: `src/Frontend/package.json` — `seed:locations`, `backfill:locations`

**Frontend**
- Create: `src/Frontend/src/components/LocationCascade.tsx` — the reusable 2–4 step selector
- Create: `src/Frontend/src/api/locationsService.ts` — hierarchy fetch + cache
- Rewrite: `src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx` — hierarchy-aware
- Create: `src/Frontend/src/pages/Admin/Masters/WardMemberMaster.tsx`
- Modify: `src/Frontend/src/pages/Admin/AddTender.tsx` — capture location
- Modify: `src/Frontend/src/App.tsx` — route + nav for Ward Members
- Modify: `src/Frontend/src/pages/Admin/AllottedTenders.tsx`, `WorkOrderManagement.tsx`, `GlobalProjects.tsx` — filters

---

## Environment Notes (read before starting)

These have cost real time before — see `posttender-build-topology` and `posttender-local-run-gotchas`:

1. Services lock `bin/Debug` DLLs while running. Build/test into a throwaway config: `dotnet test -c TestRun` (then delete stray `bin/TestRun` + `obj/TestRun`).
2. `dotnet ef database update --no-build` silently skips a just-added migration. Always `dotnet build` between `migrations add` and `database update`.
3. Services need `$env:ASPNETCORE_ENVIRONMENT="Development"` or they fail fast on missing `Jwt:Key`.
4. Each service runs `db.Database.Migrate()` at startup, so a new migration only lands on service restart.
5. EF InMemory ignores foreign keys — an FK violation still passes in tests. Location parentage is validated in the controller, which is what the tests assert.
6. Commit with `git commit -F <file>`; PowerShell here-strings break `-m`.

---

## Task 1: Add `UlbType` to Location

**Files:**
- Modify: `src/Backend/Services/CommonService/Entities/Location.cs`
- Modify: `src/Backend/Services/CommonService/Controllers/LocationsController.cs:25-38` (DTO), `:50-57` (POST), `:74-78` (PUT)
- Test: `src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs`

- [ ] **Step 1: Write the failing test**

Create `src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs`:

```csharp
using System;
using System.Linq;
using System.Threading.Tasks;
using CommonService.Controllers;
using CommonService.Entities;
using CommonService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Common;

/// <summary>
/// The Location table was always a tree (ParentLocationId) but nothing used it, and there
/// was no way to say "this row is a Nagar Nigam". These cover the UP ULB hierarchy:
/// UlbType on the corporation row, and reading a level by parent/type.
/// </summary>
public class LocationHierarchyTests
{
    private static LocationsController Build(CommonServiceDbContext ctx, string role = "Admin")
    {
        var controller = new LocationsController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    [Fact]
    public async Task Post_PersistsUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var controller = Build(ctx);

        var result = await controller.Post(new LocationsController.LocationDto
        {
            Name = "Lucknow Nagar Nigam",
            Code = "NN-LKO",
            LocationType = "Ulb",
            UlbType = "NagarNigam"
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.Locations);
        Assert.Equal("NagarNigam", saved.UlbType);
        Assert.Equal("Ulb", saved.LocationType);
    }

    [Fact]
    public async Task Post_RejectsUnknownUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var controller = Build(ctx);

        var result = await controller.Post(new LocationsController.LocationDto
        {
            Name = "Bogus Body", Code = "X-1", LocationType = "Ulb", UlbType = "Panchayat Samiti"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("UlbType", bad.Value!.ToString());
        Assert.Empty(ctx.Locations);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter LocationHierarchyTests`
Expected: FAIL — `LocationDto` has no property `UlbType`; compile error.

- [ ] **Step 3: Add the column to the entity**

Replace `src/Backend/Services/CommonService/Entities/Location.cs` in full:

```csharp
namespace CommonService.Entities;

public class Location
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public Guid? ParentLocationId { get; set; }

    /// <summary>Ulb | Zone | Ward. (Historically also State/District — legacy rows keep those.)</summary>
    public string LocationType { get; set; } = string.Empty;

    /// <summary>
    /// Only meaningful when LocationType == "Ulb": NagarNigam | NagarPalikaParishad | NagarPanchayat.
    /// This is a classification of the body, not a place, which is why it is a column here rather
    /// than its own level in the tree — "Nagar Nigam" must never be selectable as a location.
    /// </summary>
    public string? UlbType { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 4: Add UlbType to the DTO and both write paths**

In `src/Backend/Services/CommonService/Controllers/LocationsController.cs`, add to `LocationDto` after the `LocationType` property:

```csharp
        [StringLength(40)]
        public string? UlbType { get; set; }
```

In `Post`, add to the `new Location { ... }` initialiser after `LocationType`:

```csharp
            UlbType = string.IsNullOrWhiteSpace(dto.UlbType) ? null : dto.UlbType.Trim(),
```

In `Put`, add after the `entity.LocationType = ...` line:

```csharp
        entity.UlbType = string.IsNullOrWhiteSpace(dto.UlbType) ? null : dto.UlbType.Trim();
```

At the top of the class, add the allowed set:

```csharp
    /// <summary>UP has exactly three statutory ULB tiers. Kept in code because this build is
    /// UP-only; promote to a master table if another state is ever onboarded.</summary>
    private static readonly string[] UlbTypes = { "NagarNigam", "NagarPalikaParishad", "NagarPanchayat" };
```

In `Validate`, insert before `return null;`:

```csharp
        if (!string.IsNullOrWhiteSpace(dto.UlbType) && !UlbTypes.Contains(dto.UlbType.Trim()))
            return $"UlbType must be one of: {string.Join(", ", UlbTypes)}.";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter LocationHierarchyTests`
Expected: PASS — 2 passed.

- [ ] **Step 6: Generate and apply the migration**

Stop CommonService first (it locks its DLLs). Then:

```bash
cd "src/Backend/Services/CommonService" && dotnet ef migrations add AddUlbTypeToLocation && dotnet build && dotnet ef database update
```

Expected: `Done.` — and `Migrations/<timestamp>_AddUlbTypeToLocation.cs` exists.

- [ ] **Step 7: Commit**

```bash
git add src/Backend/Services/CommonService src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs
git commit -m "feat(location): add UlbType to Location master"
```

---

## Task 2: Filtered location reads

`GET /api/masters/locations` currently returns every row. The cascade needs "children of X" and "all ULBs of type Y". Filters are optional so the existing LocationMaster keeps working.

**Files:**
- Modify: `src/Backend/Services/CommonService/Controllers/LocationsController.cs:40-41`
- Test: `src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs`

- [ ] **Step 1: Write the failing tests**

Append inside `LocationHierarchyTests`:

```csharp
    private static Location Row(string name, string code, string type, Guid? parent = null, string? ulbType = null)
        => new() { Name = name, Code = code, LocationType = type, ParentLocationId = parent, UlbType = ulbType };

    [Fact]
    public async Task Get_FiltersByTypeAndUlbType()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        ctx.Locations.AddRange(
            Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam"),
            Row("Sitapur", "NPP-STP", "Ulb", ulbType: "NagarPalikaParishad"));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: "Ulb", ulbType: "NagarNigam", parentId: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal("Lucknow Nagar Nigam", Assert.Single(rows).Name);
    }

    [Fact]
    public async Task Get_FiltersByParent()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam");
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();
        ctx.Locations.AddRange(
            Row("Ward 1", "NN-LKO-W001", "Ward", ulb.Id),
            Row("Ward 2", "NN-LKO-W002", "Ward", ulb.Id),
            Row("Ward 1", "NN-KNP-W001", "Ward", Guid.NewGuid()));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: null, ulbType: null, parentId: ulb.Id);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(2, rows.Count());
    }

    [Fact]
    public async Task Get_WithNoFilters_ReturnsEverything()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        ctx.Locations.AddRange(
            Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam"),
            Row("Ward 1", "NN-LKO-W001", "Ward", Guid.NewGuid()));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(type: null, ulbType: null, parentId: null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<System.Collections.Generic.IEnumerable<Location>>(ok.Value);
        Assert.Equal(2, rows.Count());
    }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter LocationHierarchyTests`
Expected: FAIL — `Get` takes no arguments.

- [ ] **Step 3: Implement the filtered read**

Replace the `Get` method in `LocationsController.cs`:

```csharp
    /// <summary>
    /// All filters are optional and compose. No filter returns everything, which is what the
    /// Locations master screen wants; the cascade passes parentId (or type+ulbType at the top).
    /// Ordered by Name so the dropdowns are alphabetical without client-side sorting — except
    /// Wards, which sort by Code because "Ward 10" must not precede "Ward 2".
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? type,
        [FromQuery] string? ulbType,
        [FromQuery] Guid? parentId)
    {
        var q = _context.Locations.AsQueryable();

        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(l => l.LocationType == type);
        if (!string.IsNullOrWhiteSpace(ulbType)) q = q.Where(l => l.UlbType == ulbType);
        if (parentId is Guid p) q = q.Where(l => l.ParentLocationId == p);

        q = type == "Ward" ? q.OrderBy(l => l.Code) : q.OrderBy(l => l.Name);

        return Ok(await q.ToListAsync());
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter LocationHierarchyTests`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/Backend/Services/CommonService src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs
git commit -m "feat(location): filter locations by type, ulbType and parent"
```

---

## Task 3: WardMember entity + DbSet

Ward Members are reference data only — a name attached to a ward. No login, no role, no `User` row.

**Files:**
- Create: `src/Backend/Services/CommonService/Entities/WardMember.cs`
- Modify: `src/Backend/Services/CommonService/Persistence/CommonServiceDbContext.cs`

- [ ] **Step 1: Create the entity**

Create `src/Backend/Services/CommonService/Entities/WardMember.cs`:

```csharp
namespace CommonService.Entities;

/// <summary>
/// The elected representative of a ward (Sabhasad / Parshad). Deliberately reference data,
/// not an account — there is no login, no role and no IdentityService provisioning. If they
/// ever need to sign in, that is a User row linked to this, not a change of shape here.
/// </summary>
public class WardMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The Ward this member represents — a Location row with LocationType == "Ward".</summary>
    public Guid WardId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Register the DbSet**

In `src/Backend/Services/CommonService/Persistence/CommonServiceDbContext.cs`, add alongside the existing `DbSet<Location> Locations`:

```csharp
    public DbSet<WardMember> WardMembers { get; set; }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd "src/Backend/Services/CommonService" && dotnet build -c TestRun`
Expected: `Build succeeded.`

- [ ] **Step 4: Commit**

```bash
git add src/Backend/Services/CommonService
git commit -m "feat(wardmember): add WardMember entity and DbSet"
```

---

## Task 4: WardMembersController + gateway route

**Files:**
- Create: `src/Backend/Services/CommonService/Controllers/WardMembersController.cs`
- Modify: `src/Backend/PostTenderSystem.Gateway/appsettings.json`
- Test: `src/Backend/PostTenderSystem.Tests/Common/WardMembersTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `src/Backend/PostTenderSystem.Tests/Common/WardMembersTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CommonService.Controllers;
using CommonService.Entities;
using CommonService.Persistence;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Common;

public class WardMembersTests
{
    private static WardMembersController Build(CommonServiceDbContext ctx, string role = "Admin")
    {
        var controller = new WardMembersController(ctx);
        FakeUser.Attach(controller, FakeUser.With(role));
        return controller;
    }

    private static Guid SeedWard(CommonServiceDbContext ctx, string code = "NN-LKO-W001")
    {
        var ward = new Location { Name = "Ward 1", Code = code, LocationType = "Ward" };
        ctx.Locations.Add(ward);
        ctx.SaveChanges();
        return ward.Id;
    }

    [Fact]
    public async Task Post_CreatesMember()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var wardId = SeedWard(ctx);

        var result = await Build(ctx).Post(new WardMembersController.WardMemberDto
        {
            WardId = wardId, Name = "R. Sharma", Designation = "Sabhasad", Phone = "9999999999"
        });

        Assert.IsType<OkObjectResult>(result);
        var saved = Assert.Single(ctx.WardMembers);
        Assert.Equal("R. Sharma", saved.Name);
        Assert.Equal(wardId, saved.WardId);
        Assert.True(saved.IsActive);
    }

    [Fact]
    public async Task Post_RejectsWardThatIsNotAWard()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var ulb = new Location { Name = "Lucknow Nagar Nigam", Code = "NN-LKO", LocationType = "Ulb" };
        ctx.Locations.Add(ulb);
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Post(new WardMembersController.WardMemberDto
        {
            WardId = ulb.Id, Name = "R. Sharma"
        });

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Ward", bad.Value!.ToString());
        Assert.Empty(ctx.WardMembers);
    }

    [Fact]
    public async Task Get_FiltersByWard()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var w1 = SeedWard(ctx, "NN-LKO-W001");
        var w2 = SeedWard(ctx, "NN-LKO-W002");
        ctx.WardMembers.AddRange(
            new WardMember { WardId = w1, Name = "A" },
            new WardMember { WardId = w2, Name = "B" });
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Get(wardId: w1);

        var ok = Assert.IsType<OkObjectResult>(result);
        var rows = Assert.IsAssignableFrom<IEnumerable<WardMember>>(ok.Value);
        Assert.Equal("A", Assert.Single(rows).Name);
    }
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter WardMembersTests`
Expected: FAIL — `WardMembersController` does not exist.

- [ ] **Step 3: Implement the controller**

Create `src/Backend/Services/CommonService/Controllers/WardMembersController.cs`:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CommonService.Entities;
using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace CommonService.Controllers;

/// <summary>
/// Ward Member (Sabhasad) master. Reference data only — creating one never provisions a login.
/// Binds a DTO rather than the entity so a caller cannot set Id/CreatedAt (over-posting).
/// </summary>
[ApiController]
[Route("api/masters/[controller]")]
[Authorize]
public class WardMembersController : ControllerBase
{
    private readonly CommonService.Persistence.CommonServiceDbContext _context;
    public WardMembersController(CommonService.Persistence.CommonServiceDbContext context) { _context = context; }

    public class WardMemberDto
    {
        [Required]
        public Guid WardId { get; set; }

        [Required(AllowEmptyStrings = false), StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [StringLength(100)] public string? Designation { get; set; }
        [StringLength(20)]  public string? Phone { get; set; }
        [StringLength(150)] public string? Email { get; set; }
        public bool IsActive { get; set; } = true;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? wardId)
    {
        var q = _context.WardMembers.AsQueryable();
        if (wardId is Guid w) q = q.Where(m => m.WardId == w);
        return Ok(await q.OrderBy(m => m.Name).ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Post(WardMemberDto dto)
    {
        var error = await Validate(dto);
        if (error is not null) return BadRequest(error);

        var entity = new WardMember
        {
            WardId = dto.WardId,
            Name = dto.Name.Trim(),
            Designation = dto.Designation?.Trim(),
            Phone = dto.Phone?.Trim(),
            Email = dto.Email?.Trim(),
            IsActive = dto.IsActive
        };

        _context.WardMembers.Add(entity);
        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Put(Guid id, WardMemberDto dto)
    {
        var entity = await _context.WardMembers.FindAsync(id);
        if (entity is null) return NotFound();

        var error = await Validate(dto);
        if (error is not null) return BadRequest(error);

        entity.WardId = dto.WardId;
        entity.Name = dto.Name.Trim();
        entity.Designation = dto.Designation?.Trim();
        entity.Phone = dto.Phone?.Trim();
        entity.Email = dto.Email?.Trim();
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.WardMembers.FindAsync(id);
        if (e != null) { _context.WardMembers.Remove(e); await _context.SaveChangesAsync(); }
        return Ok();
    }

    /// <summary>
    /// The ward must exist AND actually be a Ward. Without the type check a member could be
    /// attached to a corporation or a zone, which makes the ward-member dropdown nonsensical.
    /// </summary>
    private async Task<string?> Validate(WardMemberDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return "Name is required.";

        var ward = await _context.Locations.FirstOrDefaultAsync(l => l.Id == dto.WardId);
        if (ward is null) return $"Ward '{dto.WardId}' does not exist.";
        if (ward.LocationType != "Ward") return $"Location '{ward.Name}' is a {ward.LocationType}, not a Ward.";

        return null;
    }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter WardMembersTests`
Expected: PASS — 3 passed.

- [ ] **Step 5: Add the gateway route**

In `src/Backend/PostTenderSystem.Gateway/appsettings.json`, add immediately after the `"masters-locations"` block:

```json
      "masters-wardmembers": {
        "ClusterId": "common-cluster",
        "Match": {
          "Path": "/api/masters/wardmembers/{**catch-all}"
        }
      },
```

- [ ] **Step 6: Generate and apply the migration**

Stop CommonService first. Then:

```bash
cd "src/Backend/Services/CommonService" && dotnet ef migrations add AddWardMembers && dotnet build && dotnet ef database update
```

Expected: `Done.`

- [ ] **Step 7: Commit**

```bash
git add src/Backend/Services/CommonService src/Backend/PostTenderSystem.Gateway src/Backend/PostTenderSystem.Tests/Common/WardMembersTests.cs
git commit -m "feat(wardmember): add WardMembers CRUD and gateway route"
```

---

## Task 5: Location columns on Tender, WorkOrder and Project

All three ids are stored (not just the leaf) so location filters stay single-table. This mirrors the existing `Bill.VendorId` / `Inspection.VendorId` denormalisation.

**Files:**
- Modify: `src/Backend/Services/TenderService/Entities/Tender.cs`, `WorkOrder.cs`, `Project.cs`
- Test: `src/Backend/PostTenderSystem.Tests/Tender/TenderLocationCascadeTests.cs`

- [ ] **Step 1: Add the columns to all three entities**

Add this block to each of `Tender.cs`, `WorkOrder.cs` and `Project.cs`, directly beneath the existing `DepartmentId` property:

```csharp
    // Urban local body location. Locations are mastered in CommonService, so only ids are
    // stored here and names are joined client-side — the same cross-service pattern as
    // DepartmentId. All three levels are denormalised (rather than deriving Ulb/Zone by
    // walking up from the ward) so list filters stay a single-table query.
    public Guid? UlbId { get; set; }
    public Guid? ZoneId { get; set; }   // null wherever the ULB has no zones
    public Guid? WardId { get; set; }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "src/Backend/Services/TenderService" && dotnet build -c TestRun`
Expected: `Build succeeded.`

- [ ] **Step 3: Generate and apply the migration**

Stop TenderService first. Then:

```bash
cd "src/Backend/Services/TenderService" && dotnet ef migrations add AddUlbLocationToTenderWorkOrderProject && dotnet build && dotnet ef database update
```

Expected: `Done.`

- [ ] **Step 4: Commit**

```bash
git add src/Backend/Services/TenderService
git commit -m "feat(tender): add ULB/zone/ward columns to Tender, WorkOrder and Project"
```

---

## Task 6: Carry location through the chain

`DepartmentId` already flows Tender → WorkOrder → Project (`WorkOrdersController.cs:162` and `:246`). Location follows the identical path. **This is the step that stops the columns being null forever** — the Department field ended up empty on every legacy row precisely because nothing populated the source.

**Files:**
- Modify: `src/Backend/Services/TenderService/Controllers/TendersController.cs:99`, `:128` (DTO + write)
- Modify: `src/Backend/Services/TenderService/Controllers/WorkOrdersController.cs:162`, `:246`
- Test: `src/Backend/PostTenderSystem.Tests/Tender/TenderLocationCascadeTests.cs`

- [ ] **Step 1: Write the failing test**

Create `src/Backend/PostTenderSystem.Tests/Tender/TenderLocationCascadeTests.cs`:

```csharp
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using PostTenderSystem.Tests.Helpers;
using TenderService.Controllers;
using TenderService.Entities;
using TenderService.Persistence;
using Xunit;

namespace PostTenderSystem.Tests.Tender;

/// <summary>
/// Department exists on all three entities but is null on every legacy row, because the value
/// was never captured at the top of the chain. These lock in that location does not repeat that:
/// a work order inherits the tender's location, and a project inherits the work order's.
/// </summary>
public class TenderLocationCascadeTests
{
    [Fact]
    public async Task WorkOrder_InheritsLocationFromTender_WhenNotSuppliedOnDto()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var ulb = Guid.NewGuid();
        var ward = Guid.NewGuid();

        var tender = new TenderService.Entities.Tender
        {
            TenderNo = "T-1", Title = "Road Resurfacing", Status = "Awarded",
            UlbId = ulb, ZoneId = null, WardId = ward
        };
        ctx.Tenders.Add(tender);
        await ctx.SaveChangesAsync();

        var wo = new WorkOrder
        {
            WorkOrderNo = "WO-1",
            TenderId = tender.Id,
            UlbId = tender.UlbId,
            ZoneId = tender.ZoneId,
            WardId = tender.WardId
        };
        ctx.WorkOrders.Add(wo);
        await ctx.SaveChangesAsync();

        var saved = Assert.Single(ctx.WorkOrders);
        Assert.Equal(ulb, saved.UlbId);
        Assert.Equal(ward, saved.WardId);
        Assert.Null(saved.ZoneId);
    }

    [Fact]
    public async Task Project_InheritsLocationFromWorkOrder()
    {
        using var ctx = TestDb.Create<TenderServiceDbContext>();
        var ulb = Guid.NewGuid();
        var ward = Guid.NewGuid();

        var wo = new WorkOrder { WorkOrderNo = "WO-1", UlbId = ulb, WardId = ward };
        ctx.WorkOrders.Add(wo);
        await ctx.SaveChangesAsync();

        var project = new Project
        {
            Name = "Project for WO-1",
            WorkOrderId = wo.Id,
            UlbId = wo.UlbId,
            ZoneId = wo.ZoneId,
            WardId = wo.WardId
        };
        ctx.Projects.Add(project);
        await ctx.SaveChangesAsync();

        var saved = Assert.Single(ctx.Projects);
        Assert.Equal(ulb, saved.UlbId);
        Assert.Equal(ward, saved.WardId);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "src/Backend" && dotnet test -c TestRun --filter TenderLocationCascadeTests`
Expected: FAIL if Task 5 was skipped; PASS once the entities carry the columns. This test guards the *shape*; the controller wiring in Steps 3–5 is what makes it real.

- [ ] **Step 3: Accept location on the tender DTO**

In `src/Backend/Services/TenderService/Controllers/TendersController.cs`, add to the create/update DTO next to `DepartmentId`:

```csharp
        public Guid? UlbId { get; set; }
        public Guid? ZoneId { get; set; }
        public Guid? WardId { get; set; }
```

At line ~99 (the `new Tender { ... }` initialiser), add after `DepartmentId = dto.DepartmentId,`:

```csharp
            UlbId = dto.UlbId,
            ZoneId = dto.ZoneId,
            WardId = dto.WardId,
```

At line ~128 (the update path), add after `tender.DepartmentId = dto.DepartmentId;`:

```csharp
        tender.UlbId = dto.UlbId;
        tender.ZoneId = dto.ZoneId;
        tender.WardId = dto.WardId;
```

- [ ] **Step 4: Inherit onto WorkOrder and Project**

In `src/Backend/Services/TenderService/Controllers/WorkOrdersController.cs`, add to the work-order DTO:

```csharp
        public Guid? UlbId { get; set; }
        public Guid? ZoneId { get; set; }
        public Guid? WardId { get; set; }
```

At line ~162, beside `DepartmentId = dto.DepartmentId ?? tender.DepartmentId,`:

```csharp
            UlbId = dto.UlbId ?? tender.UlbId,
            ZoneId = dto.ZoneId ?? tender.ZoneId,
            WardId = dto.WardId ?? tender.WardId,
```

At line ~246 (project creation), beside `DepartmentId = workOrder.DepartmentId,`:

```csharp
                UlbId = workOrder.UlbId,
                ZoneId = workOrder.ZoneId,
                WardId = workOrder.WardId,
```

- [ ] **Step 5: Run the whole backend suite**

Run: `cd "src/Backend" && dotnet test -c TestRun`
Expected: PASS — all previously green tests plus the new ones.

- [ ] **Step 6: Commit**

```bash
git add src/Backend/Services/TenderService src/Backend/PostTenderSystem.Tests/Tender/TenderLocationCascadeTests.cs
git commit -m "feat(tender): carry ULB/zone/ward from tender to work order to project"
```

---

## Task 7: Location filters on the list endpoints

**Files:**
- Modify: `src/Backend/Services/TenderService/Controllers/TendersController.cs` (GET list)
- Modify: `src/Backend/Services/TenderService/Controllers/WorkOrdersController.cs` (GET list)
- Modify: `src/Backend/Services/TenderService/Controllers/ProjectsController.cs` (GET list)

- [ ] **Step 1: Add the filter block to each list endpoint**

For each of the three `GET` list actions, add these optional query parameters to the signature:

```csharp
        [FromQuery] Guid? ulbId,
        [FromQuery] Guid? zoneId,
        [FromQuery] Guid? wardId,
```

and apply them to the `IQueryable` **after** any existing tenant/vendor scoping (so a vendor still cannot widen their scope with a filter):

```csharp
        // Location filters. Applied after scoping so they can only ever narrow the result set.
        if (ulbId is Guid u) q = q.Where(x => x.UlbId == u);
        if (zoneId is Guid z) q = q.Where(x => x.ZoneId == z);
        if (wardId is Guid w) q = q.Where(x => x.WardId == w);
```

- [ ] **Step 2: Verify the suite still passes**

Run: `cd "src/Backend" && dotnet test -c TestRun`
Expected: PASS — no regressions.

- [ ] **Step 3: Commit**

```bash
git add src/Backend/Services/TenderService
git commit -m "feat(tender): filter tenders, work orders and projects by ULB, zone and ward"
```

---

## Task 8: The UP dataset

A single JSON file is the source of truth. Enriching ward names, adding zones, or appending the 541 Nagar Panchayats means editing **this file** and re-running the seed — no code change. That is the promised import path.

**Files:**
- Create: `src/Frontend/scripts/data/up-ulb.json`

- [ ] **Step 1: Create the data file**

Create `src/Frontend/scripts/data/up-ulb.json`. `wardCount` generates numbered wards; an optional `wards` array (`[{ "no": 1, "name": "Aishbagh" }]`) overrides it once real names are known; an optional `zones` array introduces the Zone level for that body.

```json
{
  "_readme": "Source of truth for UP urban local bodies. Ward counts are official (2023 delimitation). Ward NAMES and ward->zone mapping are not published machine-readably; add them here as they are obtained and re-run `npm run seed:locations` (the seed is idempotent by code). Nagar Panchayats (541) are not yet listed.",
  "ulbTypes": [
    { "key": "NagarNigam", "label": "Nagar Nigam (Municipal Corporation)" },
    { "key": "NagarPalikaParishad", "label": "Nagar Palika Parishad (Municipal Council)" },
    { "key": "NagarPanchayat", "label": "Nagar Panchayat" }
  ],
  "nagarNigams": [
    { "name": "Agra Nagar Nigam", "code": "NN-AGR", "district": "Agra", "wardCount": 100 },
    { "name": "Aligarh Nagar Nigam", "code": "NN-ALG", "district": "Aligarh", "wardCount": 70 },
    { "name": "Ayodhya Nagar Nigam", "code": "NN-AYO", "district": "Ayodhya", "wardCount": 60 },
    { "name": "Bareilly Nagar Nigam", "code": "NN-BLY", "district": "Bareilly", "wardCount": 80 },
    { "name": "Firozabad Nagar Nigam", "code": "NN-FZD", "district": "Firozabad", "wardCount": 70 },
    { "name": "Ghaziabad Nagar Nigam", "code": "NN-GZB", "district": "Ghaziabad", "wardCount": 100 },
    { "name": "Gorakhpur Nagar Nigam", "code": "NN-GKP", "district": "Gorakhpur", "wardCount": 80 },
    { "name": "Jhansi Nagar Nigam", "code": "NN-JHS", "district": "Jhansi", "wardCount": 60 },
    { "name": "Kanpur Nagar Nigam", "code": "NN-KNP", "district": "Kanpur Nagar", "wardCount": 110 },
    { "name": "Lucknow Nagar Nigam", "code": "NN-LKO", "district": "Lucknow", "wardCount": 110 },
    { "name": "Mathura-Vrindavan Nagar Nigam", "code": "NN-MTV", "district": "Mathura", "wardCount": 70 },
    { "name": "Meerut Nagar Nigam", "code": "NN-MRT", "district": "Meerut", "wardCount": 90 },
    { "name": "Moradabad Nagar Nigam", "code": "NN-MBD", "district": "Moradabad", "wardCount": 70 },
    { "name": "Prayagraj Nagar Nigam", "code": "NN-PRJ", "district": "Prayagraj", "wardCount": 80 },
    { "name": "Saharanpur Nagar Nigam", "code": "NN-SRE", "district": "Saharanpur", "wardCount": 70 },
    { "name": "Shahjahanpur Nagar Nigam", "code": "NN-SJP", "district": "Shahjahanpur", "wardCount": 60 },
    { "name": "Varanasi Nagar Nigam", "code": "NN-VNS", "district": "Varanasi", "wardCount": 90 }
  ],
  "nagarPalikaParishads": [
    { "name": "Achhnera", "district": "Agra" }, { "name": "Afzalgarh", "district": "Bijnor" },
    { "name": "Ahraura", "district": "Mirzapur" }, { "name": "Akbarpur", "district": "Ambedkar Nagar" },
    { "name": "Aliganj", "district": "Etah" }, { "name": "Amroha", "district": "Amroha" },
    { "name": "Anupshahr", "district": "Bulandshahr" }, { "name": "Aonla", "district": "Bareilly" },
    { "name": "Atarra", "district": "Banda" }, { "name": "Atrauli", "district": "Aligarh" },
    { "name": "Auraiya", "district": "Auraiya" }, { "name": "Awagarh", "district": "Etah" },
    { "name": "Azamgarh", "district": "Azamgarh" }, { "name": "Bachhraon", "district": "Amroha" },
    { "name": "Baghpat", "district": "Bagpat" }, { "name": "Bah", "district": "Agra" },
    { "name": "Baheri", "district": "Bareilly" }, { "name": "Bahjoi", "district": "Sambhal" },
    { "name": "Bahraich", "district": "Bahraich" }, { "name": "Ballia", "district": "Ballia" },
    { "name": "Balrampur", "district": "Balrampur" }, { "name": "Banda", "district": "Banda" },
    { "name": "Bangarmau", "district": "Unnao" }, { "name": "Bansi", "district": "Siddharthanagar" },
    { "name": "Baraut", "district": "Bagpat" }, { "name": "Barua Sagar", "district": "Jhansi" },
    { "name": "Basti", "district": "Basti" }, { "name": "Bela Pratapgarh", "district": "Pratapgarh" },
    { "name": "Bhadohi", "district": "Bhadohi" }, { "name": "Bharthana", "district": "Etawah" },
    { "name": "Bharwari", "district": "Kaushambi" }, { "name": "Bhinga", "district": "Shravasti" },
    { "name": "Bijnor", "district": "Bijnor" }, { "name": "Bilari", "district": "Moradabad" },
    { "name": "Bilariaganj", "district": "Azamgarh" }, { "name": "Bilaspur", "district": "Rampur" },
    { "name": "Bilgram", "district": "Hardoi" }, { "name": "Bilhaur", "district": "Kanpur Nagar" },
    { "name": "Bilsi", "district": "Budaun" }, { "name": "Bindki", "district": "Fatehpur" },
    { "name": "Bisalpur", "district": "Pilibhit" }, { "name": "Bisauli", "district": "Budaun" },
    { "name": "Biswan", "district": "Sitapur" }, { "name": "Budaun", "district": "Budaun" },
    { "name": "Bulandshahr", "district": "Bulandshahr" }, { "name": "Chandausi", "district": "Sambhal" },
    { "name": "Chandpur", "district": "Bijnor" }, { "name": "Charkhari", "district": "Mahoba" },
    { "name": "Chhibramau", "district": "Kannauj" }, { "name": "Chirgaon", "district": "Jhansi" },
    { "name": "Chitrakoot Dham Karwi", "district": "Chitrakoot" }, { "name": "Chunar", "district": "Mirzapur" },
    { "name": "Colonelganj", "district": "Gonda" }, { "name": "Dadri", "district": "Gautam Buddha Nagar" },
    { "name": "Dataganj", "district": "Budaun" }, { "name": "Deoband", "district": "Saharanpur" },
    { "name": "Deoria", "district": "Deoria" }, { "name": "Dhampur", "district": "Bijnor" },
    { "name": "Dhanaura", "district": "Amroha" }, { "name": "Dibai", "district": "Bulandshahr" },
    { "name": "Etah", "district": "Etah" }, { "name": "Etawah", "district": "Etawah" },
    { "name": "Etmadpur", "district": "Agra" }, { "name": "Faridpur", "district": "Bareilly" },
    { "name": "Farrukhabad", "district": "Farrukhabad" }, { "name": "Fatehpur", "district": "Fatehpur" },
    { "name": "Fatehpur Sikri", "district": "Agra" }, { "name": "Gajraula", "district": "Amroha" },
    { "name": "Gangaghat", "district": "Unnao" }, { "name": "Gangoh", "district": "Saharanpur" },
    { "name": "Ganj Dundawara", "district": "Kasganj" }, { "name": "Garhmukteshwar", "district": "Hapur" },
    { "name": "Gaura Barhaj", "district": "Deoria" }, { "name": "Gauriganj", "district": "Amethi" },
    { "name": "Ghatampur", "district": "Kanpur Nagar" }, { "name": "Ghazipur", "district": "Ghazipur" },
    { "name": "Gola Gokarannath", "district": "Lakhimpur Kheri" }, { "name": "Gonda", "district": "Gonda" },
    { "name": "Gopiganj", "district": "Bhadohi" }, { "name": "Gulaothi", "district": "Bulandshahr" },
    { "name": "Gursahaiganj", "district": "Kannauj" }, { "name": "Gursarai", "district": "Jhansi" },
    { "name": "Haldaur", "district": "Bijnor" }, { "name": "Hamirpur", "district": "Hamirpur" },
    { "name": "Hapur", "district": "Hapur" }, { "name": "Hardoi", "district": "Hardoi" },
    { "name": "Hasanpur", "district": "Amroha" }, { "name": "Hata", "district": "Kushinagar" },
    { "name": "Hathras", "district": "Hathras" }, { "name": "Jahangirabad", "district": "Bulandshahr" },
    { "name": "Jais", "district": "Amethi" }, { "name": "Jalalabad", "district": "Shahjahanpur" },
    { "name": "Jalalpur", "district": "Ambedkar Nagar" }, { "name": "Jalaun", "district": "Jalaun" },
    { "name": "Jalesar", "district": "Etah" }, { "name": "Jaswantnagar", "district": "Etawah" },
    { "name": "Jaunpur", "district": "Jaunpur" }, { "name": "Jhinjhak", "district": "Kanpur Dehat" },
    { "name": "Kaimganj", "district": "Farrukhabad" }, { "name": "Kairana", "district": "Shamli" },
    { "name": "Kakrala", "district": "Budaun" }, { "name": "Kalpi", "district": "Jalaun" },
    { "name": "Kandhla", "district": "Shamli" }, { "name": "Kannauj", "district": "Kannauj" },
    { "name": "Kasganj", "district": "Kasganj" }, { "name": "Khair", "district": "Aligarh" },
    { "name": "Khairabad", "district": "Sitapur" }, { "name": "Khalilabad", "district": "Sant Kabir Nagar" },
    { "name": "Khatauli", "district": "Muzaffarnagar" }, { "name": "Khekada", "district": "Bagpat" },
    { "name": "Khoda-Makanpur", "district": "Ghaziabad" }, { "name": "Khurja", "district": "Bulandshahr" },
    { "name": "Kiratpur", "district": "Bijnor" }, { "name": "Konch", "district": "Jalaun" },
    { "name": "Kosi Kalan", "district": "Mathura" }, { "name": "Kushinagar", "district": "Kushinagar" },
    { "name": "Laharpur", "district": "Sitapur" }, { "name": "Lakhimpur", "district": "Lakhimpur Kheri" },
    { "name": "Lalitpur", "district": "Lalitpur" }, { "name": "Loni", "district": "Ghaziabad" },
    { "name": "Maharajganj", "district": "Maharajganj" }, { "name": "Mahmoodabad", "district": "Sitapur" },
    { "name": "Mahoba", "district": "Mahoba" }, { "name": "Mainpuri", "district": "Mainpuri" },
    { "name": "Mallawan", "district": "Hardoi" }, { "name": "Manjhanpur", "district": "Kaushambi" },
    { "name": "Marhara", "district": "Etah" }, { "name": "Mau", "district": "Mau" },
    { "name": "Maudaha", "district": "Hamirpur" }, { "name": "Mauranipur", "district": "Jhansi" },
    { "name": "Mawana", "district": "Meerut" }, { "name": "Milak", "district": "Rampur" },
    { "name": "Mirzapur", "district": "Mirzapur" }, { "name": "Misrikh Neemsar", "district": "Sitapur" },
    { "name": "Modinagar", "district": "Ghaziabad" }, { "name": "Mohammadabad", "district": "Ghazipur" },
    { "name": "Mohammadi", "district": "Lakhimpur Kheri" }, { "name": "Mubarakpur", "district": "Azamgarh" },
    { "name": "Mungra Badshahpur", "district": "Jaunpur" }, { "name": "Muradnagar", "district": "Ghaziabad" },
    { "name": "Muzaffarnagar", "district": "Muzaffarnagar" }, { "name": "Nagina", "district": "Bijnor" },
    { "name": "Najibabad", "district": "Bijnor" }, { "name": "Nakur", "district": "Saharanpur" },
    { "name": "Nanpara", "district": "Bahraich" }, { "name": "Nautanwa", "district": "Maharajganj" },
    { "name": "Nawabganj (Bareilly)", "district": "Bareilly" }, { "name": "Nawabganj (Gonda)", "district": "Gonda" },
    { "name": "Nawabganj (Barabanki)", "district": "Barabanki" }, { "name": "Nehtaur", "district": "Bijnor" },
    { "name": "Noorpur", "district": "Bijnor" }, { "name": "Orai", "district": "Jalaun" },
    { "name": "Padrauna", "district": "Kushinagar" }, { "name": "Paliya Kalan", "district": "Lakhimpur Kheri" },
    { "name": "Pihani", "district": "Hardoi" }, { "name": "Pilibhit", "district": "Pilibhit" },
    { "name": "Pilkhuwa", "district": "Hapur" }, { "name": "Powayan", "district": "Shahjahanpur" },
    { "name": "Pt. Deen Dayal Upadhyaya Nagar", "district": "Chandauli" }, { "name": "Pukhrayan", "district": "Kanpur Dehat" },
    { "name": "Puranpur", "district": "Pilibhit" }, { "name": "Raebareli", "district": "Raebareli" },
    { "name": "Rampur", "district": "Rampur" }, { "name": "Rasara", "district": "Ballia" },
    { "name": "Rath", "district": "Hamirpur" }, { "name": "Robertsganj", "district": "Sonbhadra" },
    { "name": "Rudauli", "district": "Ayodhya" }, { "name": "Sahaswan", "district": "Budaun" },
    { "name": "Sambhal", "district": "Sambhal" }, { "name": "Samthar", "district": "Jhansi" },
    { "name": "Sandi", "district": "Hardoi" }, { "name": "Sandila", "district": "Hardoi" },
    { "name": "Sardhana", "district": "Meerut" }, { "name": "Sarsawa", "district": "Saharanpur" },
    { "name": "Seohara", "district": "Bijnor" }, { "name": "Shahabad", "district": "Hardoi" },
    { "name": "Shahganj", "district": "Jaunpur" }, { "name": "Shamli", "district": "Shamli" },
    { "name": "Shamsabad", "district": "Agra" }, { "name": "Sherkot", "district": "Bijnor" },
    { "name": "Shikarpur", "district": "Bulandshahr" }, { "name": "Shikohabad", "district": "Firozabad" },
    { "name": "Siddharthanagar", "district": "Siddharthanagar" }, { "name": "Sikandra Rao", "district": "Hathras" },
    { "name": "Sikandrabad", "district": "Bulandshahr" }, { "name": "Sirsaganj", "district": "Firozabad" },
    { "name": "Siswa Bazar", "district": "Maharajganj" }, { "name": "Sitapur", "district": "Sitapur" },
    { "name": "Soron", "district": "Kasganj" }, { "name": "Suar", "district": "Rampur" },
    { "name": "Sultanpur", "district": "Sultanpur" }, { "name": "Syana", "district": "Bulandshahr" },
    { "name": "Tanda (Rampur)", "district": "Rampur" }, { "name": "Tanda (Ambedkar Nagar)", "district": "Ambedkar Nagar" },
    { "name": "Thakurdwara", "district": "Moradabad" }, { "name": "Tilhar", "district": "Shahjahanpur" },
    { "name": "Tundla", "district": "Firozabad" }, { "name": "Ujhani", "district": "Budaun" },
    { "name": "Unnao", "district": "Unnao" }, { "name": "Utraula", "district": "Balrampur" },
    { "name": "Zamania", "district": "Ghazipur" }
  ],
  "nagarPanchayats": []
}
```

- [ ] **Step 2: Sanity-check the file parses and the counts are right**

```bash
cd "src/Frontend" && node -e "const d=require('./scripts/data/up-ulb.json');console.log('NN',d.nagarNigams.length,'wards',d.nagarNigams.reduce((s,x)=>s+x.wardCount,0),'NPP',d.nagarPalikaParishads.length)"
```

Expected: `NN 17 wards 1360 NPP 201`

- [ ] **Step 3: Commit**

```bash
git add src/Frontend/scripts/data/up-ulb.json
git commit -m "data: add researched UP urban local body dataset"
```

---

## Task 9: Seed script

**Files:**
- Create: `src/Frontend/scripts/seed-locations.mjs`
- Modify: `src/Frontend/package.json`

- [ ] **Step 1: Write the seed script**

Create `src/Frontend/scripts/seed-locations.mjs`:

```javascript
/**
 * Seeds UP urban local bodies + wards through the gateway API.
 *
 * Idempotent by Code: an existing code is skipped, so re-running after enriching
 * scripts/data/up-ulb.json only adds what is new. Zones are seeded only where the data
 * file declares them — no zone is invented, because the real ward->zone mapping is not
 * published. Run: npm run seed:locations
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = process.env.VITE_API_URL ?? 'http://localhost:5249';
const EMAIL = process.env.SEED_EMAIL ?? 'admin@posttender.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, 'data', 'up-ulb.json'), 'utf8'));

let token = '';
const api = async (method, path, body) => {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const login = async () => {
  const r = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  token = r.token;
  console.log(`Signed in as ${EMAIL}`);
};

const main = async () => {
  await login();

  const existing = await api('GET', '/masters/locations');
  const byCode = new Map(existing.map((l) => [l.code, l]));
  console.log(`${existing.length} locations already present`);

  let created = 0;
  const ensure = async (row) => {
    const hit = byCode.get(row.code);
    if (hit) return hit;
    const saved = await api('POST', '/masters/locations', row);
    byCode.set(saved.code, saved);
    created++;
    return saved;
  };

  // --- Nagar Nigams + their wards -----------------------------------------
  for (const nn of data.nagarNigams) {
    const ulb = await ensure({
      name: nn.name, code: nn.code, locationType: 'Ulb',
      ulbType: 'NagarNigam', isActive: true,
    });

    // Zones only where the data file declares them.
    const zoneByNo = new Map();
    for (const z of nn.zones ?? []) {
      const zone = await ensure({
        name: z.name, code: `${nn.code}-Z${String(z.no).padStart(2, '0')}`,
        locationType: 'Zone', parentLocationId: ulb.id, isActive: true,
      });
      zoneByNo.set(z.no, zone);
    }

    // Explicit ward list wins; otherwise generate 1..wardCount. UP wards are officially
    // numbered, so a numbered ward is real data awaiting its local name.
    const wards = nn.wards ?? Array.from({ length: nn.wardCount }, (_, i) => ({ no: i + 1 }));
    for (const w of wards) {
      const parent = w.zone != null && zoneByNo.has(w.zone) ? zoneByNo.get(w.zone) : ulb;
      await ensure({
        name: w.name ? `Ward ${w.no} - ${w.name}` : `Ward ${w.no}`,
        code: `${nn.code}-W${String(w.no).padStart(3, '0')}`,
        locationType: 'Ward', parentLocationId: parent.id, isActive: true,
      });
    }
    console.log(`  ${nn.name}: ${wards.length} wards`);
  }

  // --- Nagar Palika Parishads / Nagar Panchayats ---------------------------
  const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  for (const [list, ulbType, prefix] of [
    [data.nagarPalikaParishads, 'NagarPalikaParishad', 'NPP'],
    [data.nagarPanchayats, 'NagarPanchayat', 'NP'],
  ]) {
    for (const b of list) {
      const ulb = await ensure({
        name: b.name, code: b.code ?? `${prefix}-${slug(b.name)}`,
        locationType: 'Ulb', ulbType, isActive: true,
      });
      for (const w of b.wards ?? Array.from({ length: b.wardCount ?? 0 }, (_, i) => ({ no: i + 1 }))) {
        await ensure({
          name: w.name ? `Ward ${w.no} - ${w.name}` : `Ward ${w.no}`,
          code: `${ulb.code}-W${String(w.no).padStart(3, '0')}`,
          locationType: 'Ward', parentLocationId: ulb.id, isActive: true,
        });
      }
    }
    console.log(`  ${list.length} ${ulbType} bodies`);
  }

  console.log(`\nDone. ${created} new location rows created.`);
};

main().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Register the npm script**

In `src/Frontend/package.json`, add to `"scripts"` beside the existing `seed:demo`:

```json
    "seed:locations": "node scripts/seed-locations.mjs",
```

- [ ] **Step 3: Run it against the live stack**

Start the services first (`$env:ASPNETCORE_ENVIRONMENT="Development"`), then:

```bash
cd "src/Frontend" && npm run seed:locations
```

Expected: 17 corporation lines each reporting their ward count, then `201 NagarPalikaParishad bodies`, then `Done. 1578 new location rows created.`

- [ ] **Step 4: Verify a level reads back correctly**

```bash
curl -s "http://localhost:5249/api/masters/locations?type=Ulb&ulbType=NagarNigam" -H "Authorization: Bearer $TOKEN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).length,'Nagar Nigams'))"
```

Expected: `17 Nagar Nigams`

- [ ] **Step 5: Commit**

```bash
git add src/Frontend/scripts/seed-locations.mjs src/Frontend/package.json
git commit -m "feat(seed): seed UP urban local bodies and wards"
```

---

## Task 10: Backfill existing records

The 17 tenders / 20 work orders / 15 projects predate these columns and would vanish from every location filter. Assign them real wards deterministically, then push down the chain.

**Files:**
- Create: `src/Frontend/scripts/backfill-locations.mjs`
- Modify: `src/Frontend/package.json`

- [ ] **Step 1: Write the backfill script**

Create `src/Frontend/scripts/backfill-locations.mjs`:

```javascript
/**
 * Backfills UlbId/ZoneId/WardId on existing tenders, then pushes the value down to their
 * work orders and projects.
 *
 * Existing rows predate the columns, so without this they are invisible to every location
 * filter. Assignment is deterministic (hash of the row id over the seeded Lucknow/Kanpur
 * wards) so re-running is stable and a given tender always lands in the same ward.
 * Only touches rows whose wardId is still null. Run: npm run backfill:locations
 */
const API = process.env.VITE_API_URL ?? 'http://localhost:5249';
const EMAIL = process.env.SEED_EMAIL ?? 'admin@posttender.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123';
const DRY_RUN = process.argv.includes('--dry-run');

let token = '';
const api = async (method, path, body) => {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

/** Stable index from a guid so the same tender always maps to the same ward. */
const pick = (id, list) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

const main = async () => {
  ({ token } = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD }));

  const locations = await api('GET', '/masters/locations');
  const ulbs = locations.filter((l) => l.locationType === 'Ulb' && l.ulbType === 'NagarNigam');
  if (!ulbs.length) throw new Error('No Nagar Nigams found — run `npm run seed:locations` first.');

  // Confine the demo data to two real corporations so the filters have visible clustering.
  const targets = ulbs.filter((u) => ['NN-LKO', 'NN-KNP'].includes(u.code));
  const wardsByUlb = new Map(
    targets.map((u) => [u.id, locations.filter((l) => l.locationType === 'Ward' && l.parentLocationId === u.id)])
  );

  const tenders = await api('GET', '/tenders');
  const pending = tenders.filter((t) => !t.wardId);
  console.log(`${pending.length} of ${tenders.length} tenders need a location`);

  for (const t of pending) {
    const ulb = pick(t.id, targets);
    const ward = pick(t.id, wardsByUlb.get(ulb.id));
    console.log(`  ${t.tenderNo} -> ${ulb.name} / ${ward.name}`);
    if (DRY_RUN) continue;
    await api('PUT', `/tenders/${t.id}`, { ...t, ulbId: ulb.id, zoneId: null, wardId: ward.id });
  }

  // Work orders and projects inherit at creation time, but these already exist — push down.
  const workOrders = await api('GET', '/workorders');
  const tenderById = new Map((await api('GET', '/tenders')).map((t) => [t.id, t]));
  for (const wo of workOrders.filter((w) => !w.wardId)) {
    const t = tenderById.get(wo.tenderId);
    if (!t?.wardId) continue;
    console.log(`  ${wo.workOrderNo} <- ${t.tenderNo}`);
    if (DRY_RUN) continue;
    await api('PUT', `/workorders/${wo.id}`, { ...wo, ulbId: t.ulbId, zoneId: t.zoneId, wardId: t.wardId });
  }

  const projects = await api('GET', '/projects');
  const woById = new Map((await api('GET', '/workorders')).map((w) => [w.id, w]));
  for (const p of projects.filter((x) => !x.wardId)) {
    const wo = woById.get(p.workOrderId);
    if (!wo?.wardId) continue;
    console.log(`  ${p.name} <- ${wo.workOrderNo}`);
    if (DRY_RUN) continue;
    await api('PUT', `/projects/${p.id}`, { ...p, ulbId: wo.ulbId, zoneId: wo.zoneId, wardId: wo.wardId });
  }

  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nBackfill complete.');
};

main().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Register the npm script**

In `src/Frontend/package.json`:

```json
    "backfill:locations": "node scripts/backfill-locations.mjs",
```

- [ ] **Step 3: Dry run first**

```bash
cd "src/Frontend" && npm run backfill:locations -- --dry-run
```

Expected: every tender/work-order/project listed with its target ward, ending `Dry run — nothing written.`

- [ ] **Step 4: Run for real, then verify**

```bash
cd "src/Frontend" && npm run backfill:locations
```

Expected: `Backfill complete.` Then confirm nothing is left unassigned:

```bash
curl -s "http://localhost:5249/api/projects" -H "Authorization: Bearer $TOKEN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);console.log(p.filter(x=>!x.wardId).length,'projects still without a ward')})"
```

Expected: `0 projects still without a ward`

- [ ] **Step 5: Commit**

```bash
git add src/Frontend/scripts/backfill-locations.mjs src/Frontend/package.json
git commit -m "feat(seed): backfill ULB location onto existing tenders, work orders and projects"
```

---

## Task 11: Location service + cascade component

**Files:**
- Create: `src/Frontend/src/api/locationsService.ts`
- Create: `src/Frontend/src/components/LocationCascade.tsx`

- [ ] **Step 1: Write the service**

Create `src/Frontend/src/api/locationsService.ts`:

```typescript
import axiosInstance from './axiosInstance';

export type UlbTypeKey = 'NagarNigam' | 'NagarPalikaParishad' | 'NagarPanchayat';

export interface LocationRow {
  id: string;
  name: string;
  code: string;
  locationType: string;
  ulbType?: string | null;
  parentLocationId?: string | null;
  isActive: boolean;
}

export interface WardMemberRow {
  id: string;
  wardId: string;
  name: string;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

/** UP has exactly three statutory tiers. UP-only build — see the plan's domain reference. */
export const ULB_TYPES: { key: UlbTypeKey; label: string }[] = [
  { key: 'NagarNigam', label: 'Nagar Nigam (Municipal Corporation)' },
  { key: 'NagarPalikaParishad', label: 'Nagar Palika Parishad (Municipal Council)' },
  { key: 'NagarPanchayat', label: 'Nagar Panchayat' },
];

// Locations are static master data and the cascade remounts on every route change, so a
// module-level cache keeps this to one request per level per session. Same rationale as
// notificationsService's cache.
const cache = new Map<string, LocationRow[]>();

const get = async (params: Record<string, string>): Promise<LocationRow[]> => {
  const key = JSON.stringify(params);
  if (cache.has(key)) return cache.get(key)!;
  const { data } = await axiosInstance.get<LocationRow[]>('/masters/locations', { params });
  const rows = (data ?? []).filter((r) => r.isActive);
  cache.set(key, rows);
  return rows;
};

export const fetchUlbs = (ulbType: UlbTypeKey) => get({ type: 'Ulb', ulbType });

export const fetchChildren = (parentId: string) => get({ parentId });

/**
 * Whether the Zone step applies is read from the data, never from the ULB type or a flag.
 * "Maintains zones" literally means "has Zone children". A flag could disagree with reality
 * and strand the user on an empty dropdown; this cannot.
 */
export const splitChildren = (children: LocationRow[]) => ({
  zones: children.filter((c) => c.locationType === 'Zone'),
  wards: children.filter((c) => c.locationType === 'Ward'),
});

export const fetchWardMembers = async (wardId: string): Promise<WardMemberRow[]> => {
  const { data } = await axiosInstance.get<WardMemberRow[]>('/masters/wardmembers', { params: { wardId } });
  return data ?? [];
};

export const clearLocationCache = () => cache.clear();
```

- [ ] **Step 2: Write the cascade component**

Create `src/Frontend/src/components/LocationCascade.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  ULB_TYPES, fetchUlbs, fetchChildren, splitChildren,
  type LocationRow, type UlbTypeKey,
} from '../api/locationsService';

export interface LocationValue {
  ulbId: string;
  zoneId: string;
  wardId: string;
}

interface Props {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Renders compactly on one row for filter bars. */
  inline?: boolean;
  disabled?: boolean;
}

const selectCls =
  'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';

/**
 * Urban Local Body Type -> ULB -> (Zone) -> Ward.
 *
 * The Zone step appears only when the selected ULB actually has Zone children. Nothing here
 * keys off the ULB type: a Nagar Nigam without zone data correctly skips the step, and a
 * Palika Parishad that later gains zones gains the step, with no code change.
 */
export const LocationCascade: React.FC<Props> = ({ value, onChange, inline = false, disabled = false }) => {
  const [ulbType, setUlbType] = useState<UlbTypeKey | ''>('');
  const [ulbs, setUlbs] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<LocationRow[]>([]);
  const [wards, setWards] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ulbType) { setUlbs([]); return; }
    setLoading(true);
    fetchUlbs(ulbType)
      .then(setUlbs)
      .catch(() => setUlbs([]))
      .finally(() => setLoading(false));
  }, [ulbType]);

  // Children of the ULB decide whether Zone applies.
  useEffect(() => {
    if (!value.ulbId) { setZones([]); setWards([]); return; }
    setLoading(true);
    fetchChildren(value.ulbId)
      .then((children) => {
        const { zones: z, wards: w } = splitChildren(children);
        setZones(z);
        setWards(w);
      })
      .catch(() => { setZones([]); setWards([]); })
      .finally(() => setLoading(false));
  }, [value.ulbId]);

  // When a zone is chosen the wards come from under it instead.
  useEffect(() => {
    if (!value.zoneId) return;
    setLoading(true);
    fetchChildren(value.zoneId)
      .then((children) => setWards(splitChildren(children).wards))
      .catch(() => setWards([]))
      .finally(() => setLoading(false));
  }, [value.zoneId]);

  const hasZones = zones.length > 0;
  const wrap = inline ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4';
  const field = inline ? 'min-w-[180px] flex-1' : '';

  return (
    <div className={wrap}>
      <div className={field}>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Urban Local Body Type</label>
        <select
          aria-label="Urban Local Body Type"
          className={selectCls}
          disabled={disabled}
          value={ulbType}
          onChange={(e) => {
            setUlbType(e.target.value as UlbTypeKey | '');
            onChange({ ulbId: '', zoneId: '', wardId: '' });
          }}
        >
          <option value="">Select Urban Local Body</option>
          {ULB_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      <div className={field}>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Municipality</label>
        <select
          aria-label="Municipality"
          className={selectCls}
          disabled={disabled || !ulbType || loading}
          value={value.ulbId}
          onChange={(e) => onChange({ ulbId: e.target.value, zoneId: '', wardId: '' })}
        >
          <option value="">{ulbType ? 'Select Municipality' : 'Select a type first'}</option>
          {ulbs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {hasZones && (
        <div className={field}>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Zone</label>
          <select
            aria-label="Zone"
            className={selectCls}
            disabled={disabled || !value.ulbId}
            value={value.zoneId}
            onChange={(e) => onChange({ ...value, zoneId: e.target.value, wardId: '' })}
          >
            <option value="">Select Zone</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      )}

      <div className={field}>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Ward</label>
        <select
          aria-label="Ward"
          className={selectCls}
          disabled={disabled || !value.ulbId || (hasZones && !value.zoneId)}
          value={value.wardId}
          onChange={(e) => onChange({ ...value, wardId: e.target.value })}
        >
          <option value="">
            {hasZones && !value.zoneId ? 'Select a zone first' : 'Select Ward'}
          </option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Typecheck**

Run: `cd "src/Frontend" && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/Frontend/src/api/locationsService.ts src/Frontend/src/components/LocationCascade.tsx
git commit -m "feat(location): add locations service and cascading selector"
```

---

## Task 12: Wire the cascade into Add Tender

**Files:**
- Modify: `src/Frontend/src/pages/Admin/AddTender.tsx:20` (type), `:35` (initial state), `:107` (submit), `:174` (form)

- [ ] **Step 1: Extend the form state**

In the form-data interface next to `departmentId`, add:

```typescript
  ulbId?: string | null;
  zoneId?: string | null;
  wardId?: string | null;
```

In the initial state object beside `departmentId: ''`, add:

```typescript
    ulbId: '', zoneId: '', wardId: '',
```

- [ ] **Step 2: Send the values**

Directly beneath the existing `if (formData.departmentId) data.append('departmentId', formData.departmentId);`:

```typescript
    // Only send what was chosen. Zone is legitimately blank for a ULB with no zones, and an
    // empty string would fail Guid binding server-side.
    if (formData.ulbId) data.append('ulbId', formData.ulbId);
    if (formData.zoneId) data.append('zoneId', formData.zoneId);
    if (formData.wardId) data.append('wardId', formData.wardId);
```

- [ ] **Step 3: Render the cascade**

Import at the top:

```typescript
import { LocationCascade } from '../../components/LocationCascade';
```

Immediately after the department `<select>` block, add:

```tsx
              <div className="md:col-span-2">
                <LocationCascade
                  value={{
                    ulbId: formData.ulbId ?? '',
                    zoneId: formData.zoneId ?? '',
                    wardId: formData.wardId ?? '',
                  }}
                  onChange={(next) => setFormData({ ...formData, ...next })}
                />
              </div>
```

- [ ] **Step 4: Typecheck and lint**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/pages/Admin/AddTender.tsx
```

Expected: no output from either.

- [ ] **Step 5: Verify in the browser**

Start the services and dev server, sign in as `admin@posttender.local / Admin@123`, go to **Tenders → Add Tender**. Confirm:
- "Urban Local Body Type" lists exactly 3 options
- choosing *Nagar Nigam* populates 17 municipalities
- choosing *Lucknow Nagar Nigam* shows **no Zone dropdown** (none seeded) and 110 wards
- saving the tender persists the ward — reopen it and the ward is still selected

- [ ] **Step 6: Commit**

```bash
git add src/Frontend/src/pages/Admin/AddTender.tsx
git commit -m "feat(tender): capture urban local body location on tender creation"
```

---

## Task 13: Rebuild the Locations master for hierarchy

Today the form has no parent field, so a hierarchy cannot be created through the UI at all.

**Files:**
- Rewrite: `src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx`

- [ ] **Step 1: Add parent, type and ULB-type controls**

Change the `Location` interface to include the hierarchy fields:

```typescript
interface Location {
    id: string;
    name: string;
    code: string;
    locationType: string;
    ulbType?: string | null;
    parentLocationId?: string | null;
    isActive: boolean;
    createdAt: string;
}
```

Replace the free-text "Type (State/District)" input with a constrained select, and add parent + ULB type. Insert these three fields in place of the existing type input:

```tsx
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Level</label>
                        <select aria-label="Level" value={formData.locationType || ''}
                            onChange={e => setFormData({...formData, locationType: e.target.value, ulbType: '', parentLocationId: ''})}
                            className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required>
                            <option value="">Select level</option>
                            <option value="Ulb">Urban Local Body</option>
                            <option value="Zone">Zone</option>
                            <option value="Ward">Ward</option>
                        </select>
                    </div>

                    {formData.locationType === 'Ulb' && (
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-semibold text-slate-700 mb-1">ULB Type</label>
                            <select aria-label="ULB Type" value={formData.ulbType || ''}
                                onChange={e => setFormData({...formData, ulbType: e.target.value})}
                                className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required>
                                <option value="">Select ULB type</option>
                                {ULB_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                        </div>
                    )}

                    {(formData.locationType === 'Zone' || formData.locationType === 'Ward') && (
                        <div className="flex-1 min-w-[240px]">
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Parent</label>
                            <select aria-label="Parent" value={formData.parentLocationId || ''}
                                onChange={e => setFormData({...formData, parentLocationId: e.target.value})}
                                className="w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" required>
                                <option value="">Select parent</option>
                                {data
                                    .filter(l => formData.locationType === 'Zone'
                                        ? l.locationType === 'Ulb'
                                        : l.locationType === 'Ulb' || l.locationType === 'Zone')
                                    .map(l => <option key={l.id} value={l.id}>{l.name} ({l.locationType})</option>)}
                            </select>
                        </div>
                    )}
```

Import the shared list at the top so the three tiers are defined in exactly one place:

```typescript
import { ULB_TYPES } from '../../../api/locationsService';
```

- [ ] **Step 2: Show the hierarchy in the table**

Replace the type column header and cell. Header:

```tsx
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Level</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Parent</th>
```

Cells (add a lookup above the `return`):

```tsx
    const nameById = new Map(data.map(l => [l.id, l.name]));
```

```tsx
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {item.locationType}{item.ulbType ? ` · ${item.ulbType}` : ''}
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    {item.parentLocationId ? nameById.get(item.parentLocationId) ?? '—' : '—'}
                                </td>
```

- [ ] **Step 3: Reset the new fields after save**

Replace both occurrences of the reset literal `{"name":"","code":"","locationType":""}` with:

```typescript
{ name: '', code: '', locationType: '', ulbType: '', parentLocationId: '' }
```

- [ ] **Step 4: Typecheck, lint and verify**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/pages/Admin/Masters/LocationMaster.tsx
```

Expected: no output. Then in the browser at **Masters → Locations**, create a Zone under *Lucknow Nagar Nigam*, reload **Add Tender**, and confirm the Zone dropdown now appears for Lucknow — this is the derive-from-data rule proving itself.

- [ ] **Step 5: Commit**

```bash
git add src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx
git commit -m "feat(location): make the Locations master hierarchy-aware"
```

---

## Task 14: Ward Member master page

**Files:**
- Create: `src/Frontend/src/pages/Admin/Masters/WardMemberMaster.tsx`
- Modify: `src/Frontend/src/App.tsx` (import, `PAGE_META`, nav item, route)

- [ ] **Step 1: Create the page**

Create `src/Frontend/src/pages/Admin/Masters/WardMemberMaster.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../api/axiosInstance';
import { describeApiError } from '../../../api/apiError';
import { LocationCascade, type LocationValue } from '../../../components/LocationCascade';
import type { WardMemberRow } from '../../../api/locationsService';

const inputCls =
  'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';

const empty = { name: '', designation: '', phone: '', email: '' };

const WardMemberMaster: React.FC = () => {
  const [data, setData] = useState<WardMemberRow[]>([]);
  const [wardNames, setWardNames] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationValue>({ ulbId: '', zoneId: '', wardId: '' });
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState('');

  const fetchData = async () => {
    try {
      const [members, locations] = await Promise.all([
        axiosInstance.get<WardMemberRow[]>('/masters/wardmembers'),
        axiosInstance.get<{ id: string; name: string }[]>('/masters/locations', { params: { type: 'Ward' } }),
      ]);
      setData(members.data ?? []);
      setWardNames(new Map((locations.data ?? []).map((l) => [l.id, l.name])));
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setData([]);
      setLoadError(describeApiError(err, 'Could not load ward members'));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!location.wardId) { setSaveError('Select a ward first.'); return; }
    try {
      const body = { ...form, wardId: location.wardId, isActive: true };
      if (editId) await axiosInstance.put(`/masters/wardmembers/${editId}`, body);
      else await axiosInstance.post('/masters/wardmembers', body);
      setForm(empty);
      setEditId('');
      fetchData();
    } catch (err) {
      setSaveError(describeApiError(err, 'Failed to save'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this ward member?')) return;
    try {
      await axiosInstance.delete(`/masters/wardmembers/${id}`);
      fetchData();
    } catch (err) {
      setSaveError(describeApiError(err, 'Failed to delete'));
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Ward Members</h1>

      <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
        <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} Ward Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <LocationCascade value={location} onChange={setLocation} />
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
              <input className={inputCls} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Designation</label>
              <input className={inputCls} placeholder="Sabhasad" value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
              <input className={inputCls} value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input className={inputCls} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
              {editId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {(loadError || saveError) && (
        <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
        </div>
      )}

      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Ward</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Designation</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{m.name}</td>
                <td className="px-6 py-4 text-slate-600">{wardNames.get(m.wardId) ?? '—'}</td>
                <td className="px-6 py-4 text-slate-600">{m.designation || '—'}</td>
                <td className="px-6 py-4 text-slate-600">{m.phone || m.email || '—'}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => { setEditId(m.id); setForm({ name: m.name, designation: m.designation ?? '', phone: m.phone ?? '', email: m.email ?? '' }); setLocation({ ulbId: '', zoneId: '', wardId: m.wardId }); }}
                    className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                  <button onClick={() => handleDelete(m.id)}
                    className="text-red-700 font-bold underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {data.length === 0 && !loadError && <div className="p-10 text-center text-slate-600">No ward members yet.</div>}
      </div>
    </div>
  );
};

export default WardMemberMaster;
```

- [ ] **Step 2: Register route, nav and page title**

In `src/Frontend/src/App.tsx` add the import beside the other masters:

```typescript
import WardMemberMaster from './pages/Admin/Masters/WardMemberMaster';
```

Add to `PAGE_META` beside the other `/admin/masters/*` entries:

```typescript
  '/admin/masters/ward-members': { title: 'Ward Members', subtitle: 'Elected ward representatives (Sabhasad)' },
```

Add the route beside the other masters routes:

```tsx
      <Route path="/admin/masters/ward-members" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><WardMemberMaster /></Layout></PrivateRoute>} />
```

Add a nav item inside the Masters group, directly after the Locations item:

```tsx
                <NavItem to="/admin/masters/ward-members" text="Ward Members" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} />
```

- [ ] **Step 3: Typecheck, lint, verify**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src
```

Expected: no output. In the browser go to **Masters → Ward Members**, pick Nagar Nigam → Lucknow → Ward 1, add "R. Sharma / Sabhasad", and confirm the row lists with its ward name.

- [ ] **Step 4: Commit**

```bash
git add src/Frontend/src/pages/Admin/Masters/WardMemberMaster.tsx src/Frontend/src/App.tsx
git commit -m "feat(wardmember): add Ward Members master page"
```

---

## Task 15: Location filters on the list screens

**Files:**
- Modify: `src/Frontend/src/pages/Admin/AllottedTenders.tsx`
- Modify: `src/Frontend/src/pages/Admin/WorkOrderManagement.tsx`
- Modify: `src/Frontend/src/pages/Admin/GlobalProjects.tsx`

- [ ] **Step 1: Add the filter bar to each screen**

Apply this identical change to all three files. Import:

```typescript
import { LocationCascade, type LocationValue } from '../../components/LocationCascade';
```

Add state beside the existing filter state:

```typescript
  const [locationFilter, setLocationFilter] = useState<LocationValue>({ ulbId: '', zoneId: '', wardId: '' });
```

Pass the ids as query params on the existing fetch (replace the bare `axiosInstance.get('/tenders')` — or `/workorders`, `/projects` — with):

```typescript
      axiosInstance.get('/tenders', {
        params: {
          ...(locationFilter.ulbId && { ulbId: locationFilter.ulbId }),
          ...(locationFilter.zoneId && { zoneId: locationFilter.zoneId }),
          ...(locationFilter.wardId && { wardId: locationFilter.wardId }),
        },
      })
```

Add `locationFilter` to that effect's dependency array so changing a filter refetches.

Render above the table:

```tsx
      <div className="bg-white p-4 rounded-card border border-slate-200 mb-6">
        <div className="flex items-end gap-3 flex-wrap">
          <LocationCascade value={locationFilter} onChange={setLocationFilter} inline />
          {(locationFilter.ulbId || locationFilter.wardId) && (
            <button type="button"
              onClick={() => setLocationFilter({ ulbId: '', zoneId: '', wardId: '' })}
              className="px-4 py-2 rounded-control font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200">
              Clear
            </button>
          )}
        </div>
      </div>
```

- [ ] **Step 2: Typecheck and lint**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src
```

Expected: no output.

- [ ] **Step 3: Verify filtering end to end**

In the browser, open **Execution & Progress → Projects**. Filter to *Nagar Nigam → Lucknow Nagar Nigam* and confirm the list narrows to the backfilled Lucknow projects; clear and confirm all 15 return. Repeat on the tenders and work-orders screens.

- [ ] **Step 4: Commit**

```bash
git add src/Frontend/src/pages/Admin
git commit -m "feat(filters): filter tenders, work orders and projects by urban local body"
```

---

## Task 16: Full verification

- [ ] **Step 1: Backend suite**

Run: `cd "src/Backend" && dotnet test -c TestRun`
Expected: all green, including the 10 new tests. Delete stray `bin/TestRun` and `obj/TestRun` afterwards.

- [ ] **Step 2: Frontend gates**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src && npm run build
```

Expected: no output from the first two; a successful Vite build.

- [ ] **Step 3: E2E chain still passes**

```bash
cd "src/Frontend" && npx playwright test tests/e2e-vendor-chain.spec.ts --project=chromium
```

Expected: 2 passed. (Services must be running.)

- [ ] **Step 4: Commit any fixes and update the system map**

Add a short section to `system_map.md` describing the ULB hierarchy, the derive-from-data zone rule, and the two seed scripts.

```bash
git add -A
git commit -m "docs: record UP urban local body hierarchy in the system map"
```

---

## Known Limitations (state these plainly; do not paper over them)

1. **No zones are seeded.** The real ward→zone mapping is not published machine-readably. Lucknow (8 zones) and Kanpur (6) are known to have them, but not which ward belongs to which. Add zones to `up-ulb.json` when the mapping is obtained; the Zone step then appears on its own.
2. **Wards are numbered, not named.** `Ward 1..110` is the official identifier; local names must be added to `up-ulb.json`.
3. **Nagar Panchayats (541) are not seeded** — no machine-readable list was found. The array exists in the data file, ready to be filled.
4. **Nagar Palika Parishads have no wards** — per-body ward counts are not centrally published, so only the bodies themselves are seeded.
5. **Source counts disagree slightly** between references (199/200/201 NPP, 541/544 NP). The dataset carries 201 rows as listed by the source used.
6. **Backfill assignment is synthetic.** Existing demo tenders are distributed across Lucknow and Kanpur wards by a hash of their id — deterministic and stable, but not real-world accurate. Production data should be assigned by hand.

## Deliberately Out of Scope

The original sketch continued `… → Ward → Ward Member → Department → Work Category → Tender`. Two of those links are **not** built here:

- **`WardMemberId` on Tender.** Ward Members exist as a master (Task 14) and are reachable from a ward, but a tender does not reference one. That would make seven cascading dropdowns mandatory before a tender can be filed, which is heavy for data entry, and the representative of a ward is derivable from the ward itself. Add it later if tenders genuinely need to name an individual.
- **Work Category.** No such master exists today — `TenderType` is the procurement mode (Open/Limited/GeM) and `VendorCategory` classifies vendors, so neither can be reused. It is an independent master with no dependency on this hierarchy and belongs in its own plan.

Both are additive: neither requires reworking anything built here.
