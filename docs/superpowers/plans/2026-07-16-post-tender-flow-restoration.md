# Post Tender Flow Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore every broken end-to-end flow so each of the six roles can complete a real business transaction, from tender creation through vendor execution to payment.

**Architecture:** The frontend was written against an older monolith API and never re-pointed when the backend split into seven services; reads mostly survived the port, writes did not. The fix is therefore a porting job with a known shape, not twenty unrelated bugs. Everything blocks on one missing primitive: the backend cannot tell which vendor is calling. We add a `vendorId` claim to the JWT, minted at login from a new `User.VendorId` column that is populated at vendor-provisioning time. Once the caller's vendor identity is known server-side, every vendor write path and every tenant-scoping filter becomes mechanical.

**Tech Stack:** .NET 8, ASP.NET Core, EF Core, YARP (gateway), xUnit, React 19 + Vite, Redux Toolkit, Vitest, Playwright.

---

## Decisions locked

These were confirmed with the product owner on 2026-07-16. Do not re-litigate them during execution.

| # | Decision | Choice |
|---|----------|--------|
| 1 | Vendor identity | `vendorId` embedded as a JWT claim at login |
| 2 | Progress review chain | Inspector reviews → Department approves |
| 3 | PMU | Admin-equivalent, shares the Admin UI, no new pages |
| 4 | Frontend API layer | Normalize each file onto `axiosInstance` as it is touched |
| 5 | Bill chain | Vendor submits → Department verifies → Finance pays |

### Source-of-truth note

`REF/Post_Tender_Mgt.docx` (older, five roles) and `Doc/PTMS_Product_Design_Document.docx` (newer, "strict six-role access model") disagree. **The newer PTMS design doc wins.** Where the older doc says `Vendor Submission → PMU Review`, we implement `Inspector reviews → Department approves`, matching the newer doc and `system_map.md:107-109`. PMU is Admin-equivalent per *"Only Admin / PMU users can create and manage tenders"*.

### Assumption requiring sign-off

Neither document defines a **Cancelled** work-order state, but `WorkOrderDetails.tsx:96` has a Cancel button. Phase 9 allows `Cancelled` only from pre-acceptance states (`Draft`, `Authority Approval`, `Pending Vendor Acceptance`). Once a vendor has accepted, a contract exists and cancellation is a commercial matter, not a status flip. **Flag this to the product owner before shipping Phase 9.**

---

## Root cause and what it means for scope

Verified by matching every frontend call site against all 23 controllers and the gateway route table:

- **Four endpoint families have no gateway route at all** (`/api/admindashboard/*`, `/api/financialdashboard`, `/api/vendordashboard/summary`, `/api/milestonesubmissions/*`). They 404 at the proxy, before reaching any service.
- **Three controllers are GET-only** but the UI posts to them: `QueriesController`, `DocumentsController`, `InspectionsController`.
- **Some "dead endpoints" need no backend work at all.** `AdminBilling.tsx` calls `/api/admindashboard/bills` while `GET /api/bills` already exists with identical approve/reject semantics. These are pure frontend rewiring — see Phase 8. Do Phase 8 early; it is the cheapest win in the plan.
- **`MilestoneSubmission` and `MilestoneDocument` entities, DbSets and migrated tables already exist.** Phase 5 only writes a controller and a gateway route. It is far smaller than "build milestone submissions" implies.
- **Not every read survived the port.** `GET /api/queries` omits `.Include(q => q.Messages)` and so returns every query with an empty thread — a broken read that no dead-endpoint scan would catch, found only by reading the entity mapping (Task 7.1). Treat "the GET exists" as weaker evidence than it looks; when a task touches an endpoint with a navigation property, check the `Include`.

### The load-bearing leak

`VendorWorkOrderView.tsx:21` resolves the current vendor by fetching **every** vendor and filtering client-side (`vendors.find(v => v.userId === user?.id)`). The cross-tenant read leak is therefore *load-bearing*: closing it without first providing server-side identity will break the vendor UI. Phase 1 must land before Phase 2.

---

## Test harness gap — read before starting

**There is currently no usable test infrastructure. TDD is not possible until Phase 0 completes.**

- `PostTenderSystem.Tests` contains only the default `UnitTest1.cs` template stub. It has xUnit but **no `Microsoft.AspNetCore.Mvc.Testing`, no EF in-memory provider, and no `ProjectReference` to any of the seven services.**
- `PostTenderSystem.sln` does not include the seven services, so `dotnet build` on the solution reports success without compiling any of them. Build service projects directly: `dotnet build Services/<Svc>/<Svc>.csproj`.
- The frontend has `vitest` and `@testing-library/react` installed and a `setupTests.ts`, but **no `test` script** in `package.json`.
- `e2e-functional-tests.cjs` asserts only login and page-load per role. It is green today against a product where no role can complete a transaction. **Do not treat it as evidence of anything.** Phase 10 replaces it.

---

## Gotchas verified against the codebase

**Nothing runs without `ASPNETCORE_ENVIRONMENT=Development`.** Both `run-all.ps1` and `start-all.ps1` pass `--no-launch-profile`, which ignores `launchSettings.json` and lets the environment default to Production. The services read their dev `Jwt:Key` from `appsettings.Development.json` and fail fast without it, so all seven exit on startup and only the Gateway stays up. Fixed in both scripts on 2026-07-16; if you start a service by hand, set the variable first.

**`GET /api/bills` returns raw `Bill` rows.** It has `workOrderId` but no `workOrderNo` and no `vendorName` — those live in TenderService and VendorService. Any page showing those columns must join client-side (`workOrderId` → `WorkOrder.workOrderNo` + `vendorId` → `Vendor.name`), which is the pattern `dashboardService.ts` already uses. The same applies to `Bill.VendorId` after Phase 4.1: it identifies the tenant, it does not give you a name.

**DbContext names are inconsistent.** Five services follow `<Svc>ServiceDbContext`, but Identity and Vendor do not. Use exactly these:

| Service | Context type |
|---|---|
| IdentityService | `IdentityDbContext` |
| VendorService | `VendorDbContext` |
| TenderService | `TenderServiceDbContext` |
| ExecutionService | `ExecutionServiceDbContext` |
| InspectionService | `InspectionServiceDbContext` |
| FinancialService | `FinancialServiceDbContext` |
| CommonService | `CommonServiceDbContext` |

**Controllers take an `AuditLogger` as a second constructor argument** — `ProgressReportsController`, `BillsController` and `WorkOrdersController`. It is a concrete class with a non-virtual `LogAsync`, so Moq cannot mock it; use `TestAudit` from Task 0.2 instead. There are three distinct `AuditLogger` types (Execution, Financial, Tender), not one shared type.

**JWT signing uses `Encoding.ASCII`** in `AuthController` and in all seven services' validation config. Never switch it to UTF8 — see the note in Task 1.2.

**Tokens last seven days** (`AddDays(7)`). Preserve this; do not shorten sessions as a refactor side effect.

**The login response nests the user**: `{ token, user: { id, email, name, role, vendorId } }`. Frontend reads `res.data.user.*`.

**`UpdateVendorStatus` is `[HttpPatch("{id}/status")]`, not PUT.** Only its `[Authorize]` changes in Phase 2.1 — leave the verb alone; the frontend already sends PATCH.

**Route ordering matters.** In `ProgressReportsController`, any literal route (`my`, `pending-review`) must be declared before `[HttpGet("{id}")]`. `pending-review` already sits above it; keep `my` there too, or the literal binds to the `Guid id` parameter and returns 400 rather than 404.

**YARP paths are matched case-insensitively**, which is why `axiosInstance.get('/InspectionVisits')` in `InspectorVisits.tsx:51` works despite the lowercase gateway route. Do not "fix" the casing expecting a bug.

## File structure

**New files:**

| File | Responsibility |
|------|----------------|
| `src/Backend/PostTenderSystem.Tests/Helpers/TestDb.cs` | EF in-memory context factory, one per service |
| `src/Backend/PostTenderSystem.Tests/Helpers/FakeUser.cs` | Builds a `ClaimsPrincipal` with role + `vendorId` |
| `src/Backend/PostTenderSystem.Tests/Identity/AuthControllerTests.cs` | Login claim minting, register endpoint |
| `src/Backend/PostTenderSystem.Tests/Vendor/VendorProvisioningTests.cs` | Vendor + user creation, rollback |
| `src/Backend/PostTenderSystem.Tests/Execution/ProgressReportsTests.cs` | Progress write path + scoping |
| `src/Backend/PostTenderSystem.Tests/Financial/BillsTests.cs` | Bill submission + scoping |
| `src/Backend/PostTenderSystem.Tests/Execution/MilestoneSubmissionsTests.cs` | Milestone submission lifecycle |
| `src/Backend/Services/IdentityService/Contracts/RegisterRequest.cs` | Internal registration DTO |
| `src/Backend/Services/VendorService/Clients/IIdentityClient.cs` | Typed client abstraction (mockable) |
| `src/Backend/Services/VendorService/Clients/IdentityClient.cs` | HTTP impl calling IdentityService |
| `src/Backend/Services/ExecutionService/Controllers/MilestoneSubmissionsController.cs` | Milestone submission CRUD + submit |
| `src/Frontend/src/api/currentVendor.ts` | Reads `vendorId` from auth state |

**Modified (key ones):**

| File | Change |
|------|--------|
| `src/Backend/Services/IdentityService/Entities/User.cs` | Add `Guid? VendorId` |
| `src/Backend/Services/IdentityService/Controllers/AuthController.cs:50-70` | Add `vendorId` claim + register endpoint |
| `src/Backend/Services/VendorService/Controllers/VendorsController.cs:52-82` | Real provisioning; stop fabricating `UserId` |
| `src/Backend/Services/FinancialService/Entities/Bill.cs` | Add `Guid VendorId` |
| `src/Backend/Services/ExecutionService/Entities/ProgressReport.cs` | Add inspector review fields |
| `src/Backend/PostTenderSystem.Gateway/appsettings.json:105` | Add `milestonesubmissions` route |

---

## Phase 0: Test harness

### Task 0.1: Wire the test project to the services

**Files:**
- Modify: `src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj`
- Delete: `src/Backend/PostTenderSystem.Tests/UnitTest1.cs`

- [ ] **Step 1: Add packages and project references**

Replace the `ItemGroup` blocks in `PostTenderSystem.Tests.csproj`:

```xml
  <ItemGroup>
    <PackageReference Include="coverlet.collector" Version="6.0.0" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Moq" Version="4.20.70" />
    <PackageReference Include="xunit" Version="2.5.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.3" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\Services\IdentityService\IdentityService.csproj" />
    <ProjectReference Include="..\Services\VendorService\VendorService.csproj" />
    <ProjectReference Include="..\Services\TenderService\TenderService.csproj" />
    <ProjectReference Include="..\Services\ExecutionService\ExecutionService.csproj" />
    <ProjectReference Include="..\Services\InspectionService\InspectionService.csproj" />
    <ProjectReference Include="..\Services\FinancialService\FinancialService.csproj" />
    <ProjectReference Include="..\Services\CommonService\CommonService.csproj" />
  </ItemGroup>

  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>
```

- [ ] **Step 2: Delete the template stub**

```bash
rm "src/Backend/PostTenderSystem.Tests/UnitTest1.cs"
```

- [ ] **Step 3: Verify it restores and builds**

Run: `dotnet build src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/Backend/PostTenderSystem.Tests/
git commit -m "test: wire test project to all seven services with in-memory EF"
```

### Task 0.2: Test helpers

**Files:**
- Create: `src/Backend/PostTenderSystem.Tests/Helpers/TestDb.cs`
- Create: `src/Backend/PostTenderSystem.Tests/Helpers/FakeUser.cs`

- [ ] **Step 1: Write `TestDb.cs`**

```csharp
using System;
using Microsoft.EntityFrameworkCore;

namespace PostTenderSystem.Tests.Helpers;

public static class TestDb
{
    public static TContext Create<TContext>() where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = (TContext)Activator.CreateInstance(typeof(TContext), options)!;
        context.Database.EnsureCreated();
        return context;
    }
}
```

- [ ] **Step 2: Write `FakeUser.cs`**

```csharp
using System;
using System.Collections.Generic;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace PostTenderSystem.Tests.Helpers;

public static class FakeUser
{
    public static ClaimsPrincipal With(string role, Guid? userId = null, Guid? vendorId = null)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Role, role),
            new Claim(ClaimTypes.NameIdentifier, (userId ?? Guid.NewGuid()).ToString())
        };

        if (vendorId.HasValue)
            claims.Add(new Claim("vendorId", vendorId.Value.ToString()));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    public static void Attach(ControllerBase controller, ClaimsPrincipal principal)
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = principal }
        };
    }
}
```

- [ ] **Step 3: Write `TestAudit.cs`**

`ProgressReportsController`, `BillsController` and `WorkOrdersController` all take an `AuditLogger` as their **second constructor argument**. `AuditLogger` is a concrete class whose `LogAsync` is **not virtual**, so `Mock.Of<AuditLogger>()` will not compile-and-work — Moq cannot intercept it.

It does not need mocking. `LogAsync` wraps its whole body in `try { ... } catch { }` and swallows every failure by design ("never fail the caller because the audit sink is unavailable"), so a real instance pointed at a dead address is inert and safe in tests.

There are **three separate `AuditLogger` types** — `ExecutionService.Services.AuditLogger`, `FinancialService.Services.AuditLogger` and `TenderService.Services.AuditLogger`. They are structurally identical but are distinct types in distinct namespaces, so the helper needs one factory per service:

Create `src/Backend/PostTenderSystem.Tests/Helpers/TestAudit.cs`:

```csharp
using System;
using System.Net.Http;
using Microsoft.AspNetCore.Http;

namespace PostTenderSystem.Tests.Helpers;

public static class TestAudit
{
    private static HttpClient DeadClient() =>
        new HttpClient { BaseAddress = new Uri("http://localhost:1") };

    public static ExecutionService.Services.AuditLogger ForExecution() =>
        new ExecutionService.Services.AuditLogger(DeadClient(), new HttpContextAccessor());

    public static FinancialService.Services.AuditLogger ForFinancial() =>
        new FinancialService.Services.AuditLogger(DeadClient(), new HttpContextAccessor());

    public static TenderService.Services.AuditLogger ForTender() =>
        new TenderService.Services.AuditLogger(DeadClient(), new HttpContextAccessor());
}
```

- [ ] **Step 4: Verify it builds**

Run: `dotnet build src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj`
Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/Backend/PostTenderSystem.Tests/Helpers/
git commit -m "test: add in-memory db, claims-principal and audit-logger test helpers"
```

### Task 0.3: Frontend test script

**Files:**
- Modify: `src/Frontend/package.json`

- [ ] **Step 1: Add the `test` script**

In the `scripts` block, after `"lint": "eslint ."`, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Verify vitest runs**

Run: `cd src/Frontend && npm test`
Expected: Vitest starts and reports "No test files found" (there are none yet). Exit code 1 with no test files is acceptable here; the point is that the runner resolves.

- [ ] **Step 3: Commit**

```bash
git add src/Frontend/package.json
git commit -m "test: add vitest test scripts"
```

---

## Phase 1: Identity foundation

**This is the keystone. Nothing downstream works until it lands.**

Design note: the `vendorId` claim is minted from IdentityService's **own** `User.VendorId` column, so login performs no cross-service call. The coupling to VendorService happens once, at provisioning time, not on every login. This is why we add a column rather than having `AuthController` call VendorService.

### Task 1.1: Add `VendorId` to the User entity

**Files:**
- Modify: `src/Backend/Services/IdentityService/Entities/User.cs`
- Test: `src/Backend/PostTenderSystem.Tests/Identity/AuthControllerTests.cs`

- [ ] **Step 1: Write the failing test**

Create `src/Backend/PostTenderSystem.Tests/Identity/AuthControllerTests.cs`:

```csharp
using System;
using IdentityService.Entities;
using Xunit;

namespace PostTenderSystem.Tests.Identity;

public class UserEntityTests
{
    [Fact]
    public void User_CanCarryVendorId()
    {
        var vendorId = Guid.NewGuid();
        var user = new User { Email = "v@x.local", Role = Role.Vendor, VendorId = vendorId };

        Assert.Equal(vendorId, user.VendorId);
    }

    [Fact]
    public void User_VendorId_IsNullForNonVendorRoles()
    {
        var user = new User { Email = "a@x.local", Role = Role.Admin };

        Assert.Null(user.VendorId);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter UserEntityTests`
Expected: FAIL — compile error, `User` has no property `VendorId`.

- [ ] **Step 3: Add the property**

In `src/Backend/Services/IdentityService/Entities/User.cs`, after the `Role` property:

```csharp
    /// Set only for Role.Vendor accounts. Links this login to its VendorService
    /// Vendor record so the login can mint a vendorId claim without a cross-service call.
    public Guid? VendorId { get; set; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter UserEntityTests`
Expected: PASS, 2 tests.

- [ ] **Step 5: Create the migration**

```bash
cd "src/Backend/Services/IdentityService"
dotnet ef migrations add AddVendorIdToUser
dotnet ef database update
```

Expected: migration created, `Users` table gains a nullable `VendorId` column.

- [ ] **Step 6: Commit**

```bash
git add src/Backend/Services/IdentityService/ src/Backend/PostTenderSystem.Tests/Identity/
git commit -m "feat(identity): link user accounts to vendor records via User.VendorId"
```

### Task 1.2: Mint the `vendorId` claim at login

**Files:**
- Modify: `src/Backend/Services/IdentityService/Controllers/AuthController.cs:50-70`
- Test: `src/Backend/PostTenderSystem.Tests/Identity/AuthControllerTests.cs`

- [ ] **Step 1: Write the failing test**

Append to `AuthControllerTests.cs`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Linq;

public class LoginClaimTests
{
    [Fact]
    public void Login_VendorUser_TokenCarriesVendorIdClaim()
    {
        var vendorId = Guid.NewGuid();
        var token = TokenProbe.Issue(new User
        {
            Id = Guid.NewGuid(),
            Name = "Demo Vendor",
            Email = "vendor@posttender.local",
            Role = Role.Vendor,
            VendorId = vendorId
        });

        var claim = new JwtSecurityTokenHandler()
            .ReadJwtToken(token)
            .Claims.FirstOrDefault(c => c.Type == "vendorId");

        Assert.NotNull(claim);
        Assert.Equal(vendorId.ToString(), claim!.Value);
    }

    [Fact]
    public void Login_AdminUser_TokenHasNoVendorIdClaim()
    {
        var token = TokenProbe.Issue(new User
        {
            Id = Guid.NewGuid(),
            Name = "System Admin",
            Email = "admin@posttender.local",
            Role = Role.Admin
        });

        var claim = new JwtSecurityTokenHandler()
            .ReadJwtToken(token)
            .Claims.FirstOrDefault(c => c.Type == "vendorId");

        Assert.Null(claim);
    }
}
```

**Note for the implementer:** `TokenProbe` does not exist yet. `AuthController` currently builds the token inline inside `Login`. Step 3 extracts that logic into a testable seam.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter LoginClaimTests`
Expected: FAIL — compile error, `TokenProbe` not defined.

- [ ] **Step 3: Extract token generation and add the claim**

Create `src/Backend/Services/IdentityService/Security/TokenIssuer.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using IdentityService.Entities;
using Microsoft.IdentityModel.Tokens;

namespace IdentityService.Security;

public static class TokenIssuer
{
    public static string Issue(User user, string signingKey)
    {
        // This message is load-bearing for the fail-fast behaviour added during the
        // earlier security work. Keep the wording.
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
            throw new InvalidOperationException(
                "Jwt:Key is missing or shorter than 32 characters. Configure it via the Jwt__Key " +
                "environment variable (production) or appsettings.Development.json (local); never commit a production key.");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("Name", user.Name)
        };

        if (user.VendorId.HasValue)
            claims.Add(new Claim("vendorId", user.VendorId.Value.ToString()));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.ASCII.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
```

**Two details here are not stylistic — getting either wrong breaks authentication silently:**

1. **`Encoding.ASCII`, not `Encoding.UTF8`.** All seven services validate with `IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(jwtKey))`. The two encodings agree for a pure-ASCII key, so a UTF8 issuer would pass every local test and then reject every token the moment someone sets a production `Jwt__Key` containing a non-ASCII character.
2. **`AddDays(7)`, not hours.** The current `AuthController` issues seven-day tokens. Do not shorten sessions as a side effect of a refactor; if you want shorter sessions, raise it as its own change.
```

Create `src/Backend/PostTenderSystem.Tests/Identity/TokenProbe.cs`:

```csharp
using IdentityService.Entities;
using IdentityService.Security;

namespace PostTenderSystem.Tests.Identity;

internal static class TokenProbe
{
    private const string TestKey = "test-signing-key-at-least-32-chars-long!!";

    public static string Issue(User user) => TokenIssuer.Issue(user, TestKey);
}
```

Then in `AuthController.cs`, replace everything from `var tokenHandler = new JwtSecurityTokenHandler();` through `var token = tokenHandler.CreateToken(tokenDescriptor);` with a single call, and extend the response. The field is `_configuration`, not `_config`:

```csharp
        var token = TokenIssuer.Issue(user, _configuration["Jwt:Key"]!);

        return Ok(new
        {
            token,
            user = new
            {
                id = user.Id,
                email = user.Email,
                name = user.Name,
                role = user.Role.ToString(),
                vendorId = user.VendorId
            }
        });
```

**The response shape is nested — `vendorId` goes inside the `user` object, not at the top level.** The existing frontend reads `res.data.user.role`, so Task 1.7 must read `res.data.user.vendorId` to match. Getting this wrong yields a silently `undefined` vendorId and an empty work-order list rather than an error.

After the extraction, `AuthController.cs` no longer needs `using Microsoft.IdentityModel.Tokens;`, `using System.IdentityModel.Tokens.Jwt;`, `using System.Text;` or `using System.Security.Claims;`. Remove them so the build does not warn.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter LoginClaimTests`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify the real login still works end to end**

```bash
cd "src/Backend/Services/IdentityService" && dotnet run &
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vendor@posttender.local","password":"Vendor@123"}'
```

Expected: HTTP 200 with a `token` field. Paste the token into jwt.io and confirm the `vendorId` claim is **absent** — the seeded vendor has no `VendorId` yet. Task 1.4 fixes that.

- [ ] **Step 6: Commit**

```bash
git add src/Backend/Services/IdentityService/ src/Backend/PostTenderSystem.Tests/Identity/
git commit -m "feat(identity): mint vendorId claim into JWT for vendor accounts"
```

### Task 1.3: Vendor registration endpoint

**Files:**
- Create: `src/Backend/Services/IdentityService/Contracts/RegisterRequest.cs`
- Modify: `src/Backend/Services/IdentityService/Controllers/AuthController.cs`

- [ ] **Step 1: Write the failing test**

Create `src/Backend/PostTenderSystem.Tests/Identity/RegisterEndpointTests.cs`:

```csharp
using System;
using System.Threading.Tasks;
using IdentityService.Contracts;
using IdentityService.Controllers;
using IdentityService.Entities;
using IdentityService.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Identity;

public class RegisterEndpointTests
{
    private static AuthController Build(IdentityDbContext ctx)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new System.Collections.Generic.Dictionary<string, string?>
            {
                ["Jwt:Key"] = "test-signing-key-at-least-32-chars-long!!"
            }).Build();

        var controller = new AuthController(ctx, config);
        FakeUser.Attach(controller, FakeUser.With("Admin"));
        return controller;
    }

    [Fact]
    public async Task Register_CreatesVendorUser_LinkedToVendorId()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        var controller = Build(ctx);
        var vendorId = Guid.NewGuid();

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Acme Contracting",
            Email = "acme@vendor.local",
            Password = "Acme@12345",
            Role = "Vendor",
            VendorId = vendorId
        });

        Assert.IsType<OkObjectResult>(result);
        var user = Assert.Single(ctx.Users);
        Assert.Equal(Role.Vendor, user.Role);
        Assert.Equal(vendorId, user.VendorId);
        Assert.NotEqual("Acme@12345", user.PasswordHash);
    }

    [Fact]
    public async Task Register_RejectsDuplicateEmail()
    {
        using var ctx = TestDb.Create<IdentityDbContext>();
        ctx.Users.Add(new User { Email = "dupe@vendor.local", Role = Role.Vendor });
        await ctx.SaveChangesAsync();

        var controller = Build(ctx);

        var result = await controller.Register(new RegisterRequest
        {
            Name = "Dupe", Email = "dupe@vendor.local", Password = "Xx@123456", Role = "Vendor"
        });

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Single(ctx.Users);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter RegisterEndpointTests`
Expected: FAIL — `RegisterRequest` and `AuthController.Register` do not exist.

- [ ] **Step 3: Write the DTO and endpoint**

Create `src/Backend/Services/IdentityService/Contracts/RegisterRequest.cs`:

```csharp
using System;

namespace IdentityService.Contracts;

public class RegisterRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "Vendor";
    public Guid? VendorId { get; set; }
}
```

Add to `AuthController.cs`:

```csharp
    [HttpPost("register")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("Email and password are required.");

        if (request.Password.Length < 8)
            return BadRequest("Password must be at least 8 characters.");

        if (!Enum.TryParse<Role>(request.Role, out var role))
            return BadRequest($"Unknown role '{request.Role}'.");

        var email = request.Email.Trim().ToLowerInvariant();

        if (await _context.Users.AnyAsync(u => u.Email == email))
            return Conflict($"A user with email '{email}' already exists.");

        var user = new User
        {
            Name = request.Name,
            Email = email,
            Role = role,
            VendorId = role == Role.Vendor ? request.VendorId : null,
            PasswordHash = PasswordHasher.Hash(request.Password)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { userId = user.Id, email = user.Email, role = user.Role.ToString() });
    }
```

Add `using IdentityService.Contracts;`, `using Microsoft.AspNetCore.Authorization;` and `using Microsoft.EntityFrameworkCore;` to the file header.

**Do not add a class-level `[Authorize]` to `AuthController`.** It currently carries only `[ApiController]` and `[Route]`, which is why `Login` is anonymous without needing `[AllowAnonymous]`. Putting `[Authorize]` on the class would lock every user out of login. The method-level `[Authorize(Roles = "Admin,PMU")]` on `Register` is sufficient.

Note `Login` is synchronous (`public IActionResult Login(...)`), while `Register` is `async Task<IActionResult>`. That asymmetry is expected — `Register` hits the database.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter RegisterEndpointTests`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Backend/Services/IdentityService/ src/Backend/PostTenderSystem.Tests/Identity/
git commit -m "feat(identity): add admin-only vendor account registration endpoint"
```

### Task 1.4: Real vendor provisioning

Replaces the current behaviour where `VendorsController` fabricates a random `UserId` and discards the submitted password, making every UI-created vendor permanently unable to log in.

**Files:**
- Create: `src/Backend/Services/VendorService/Clients/IIdentityClient.cs`
- Create: `src/Backend/Services/VendorService/Clients/IdentityClient.cs`
- Modify: `src/Backend/Services/VendorService/Controllers/VendorsController.cs:52-82`
- Modify: `src/Backend/Services/VendorService/Program.cs`

- [ ] **Step 1: Write the failing test**

Create `src/Backend/PostTenderSystem.Tests/Vendor/VendorProvisioningTests.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Moq;
using PostTenderSystem.Tests.Helpers;
using VendorService.Clients;
using VendorService.Controllers;
using VendorService.Persistence;
using Xunit;

namespace PostTenderSystem.Tests.Vendor;

public class VendorProvisioningTests
{
    [Fact]
    public async Task AddVendor_RegistersLogin_AndLinksUserId()
    {
        using var ctx = TestDb.Create<VendorDbContext>();
        var userId = Guid.NewGuid();

        var identity = new Mock<IIdentityClient>();
        identity.Setup(c => c.RegisterVendorAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(userId);

        var controller = new VendorsController(ctx, identity.Object);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var result = await controller.AddVendor(new VendorDto
        {
            Name = "Acme Contracting",
            Email = "acme@vendor.local",
            Password = "Acme@12345"
        });

        Assert.IsType<OkObjectResult>(result);
        var vendor = Assert.Single(ctx.Vendors);
        Assert.Equal(userId, vendor.UserId);
    }

    [Fact]
    public async Task AddVendor_WhenRegistrationFails_SavesNoVendor()
    {
        using var ctx = TestDb.Create<VendorDbContext>();

        var identity = new Mock<IIdentityClient>();
        identity.Setup(c => c.RegisterVendorAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("duplicate email"));

        var controller = new VendorsController(ctx, identity.Object);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var result = await controller.AddVendor(new VendorDto
        {
            Name = "Acme", Email = "acme@vendor.local", Password = "Acme@12345"
        });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Vendors);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter VendorProvisioningTests`
Expected: FAIL — `IIdentityClient` does not exist and `VendorsController` has a one-argument constructor.

- [ ] **Step 3: Write the client and rewire the controller**

Create `src/Backend/Services/VendorService/Clients/IIdentityClient.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

namespace VendorService.Clients;

public interface IIdentityClient
{
    Task<Guid> RegisterVendorAsync(string name, string email, string password,
                                   Guid vendorId, CancellationToken ct = default);
}
```

Create `src/Backend/Services/VendorService/Clients/IdentityClient.cs`:

```csharp
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace VendorService.Clients;

public class IdentityClient : IIdentityClient
{
    private readonly HttpClient _http;
    private readonly IHttpContextAccessor _accessor;

    public IdentityClient(HttpClient http, IHttpContextAccessor accessor)
    {
        _http = http;
        _accessor = accessor;
    }

    public async Task<Guid> RegisterVendorAsync(string name, string email, string password,
                                                Guid vendorId, CancellationToken ct = default)
    {
        // Forward the caller's bearer token so IdentityService can enforce its own
        // [Authorize(Roles="Admin,PMU")] on the register endpoint.
        var auth = _accessor.HttpContext?.Request.Headers["Authorization"].ToString();
        if (!string.IsNullOrWhiteSpace(auth))
            _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", auth);

        var response = await _http.PostAsJsonAsync("/api/auth/register", new
        {
            name, email, password, role = "Vendor", vendorId
        }, ct);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException(
                $"Identity registration failed ({(int)response.StatusCode}): {body}");
        }

        var payload = await response.Content.ReadFromJsonAsync<RegisterResponse>(cancellationToken: ct);
        return payload?.UserId ?? throw new InvalidOperationException("Identity returned no userId.");
    }

    private class RegisterResponse
    {
        public Guid UserId { get; set; }
    }
}
```

In `src/Backend/Services/VendorService/Program.cs`, register the typed client before `builder.Build()`:

```csharp
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient<IIdentityClient, IdentityClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Services:Identity"] ?? "http://localhost:5001");
});
```

Add to `src/Backend/Services/VendorService/appsettings.json`:

```json
  "Services": {
    "Identity": "http://localhost:5001"
  }
```

In `VendorsController.cs`, inject `IIdentityClient` and replace the body of `AddVendor` (lines ~54-82). The vendor entity is built in memory first so its `Id` can be sent to Identity; nothing is persisted unless registration succeeds:

```csharp
    [HttpPost]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> AddVendor([FromBody] VendorDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest("Email and password are required to provision a vendor login.");

        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            VendorCode = $"VEND-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}",
            GSTNo = dto.GSTNo ?? string.Empty,
            YearOfIncorporation = dto.YearOfIncorporation,
            AuthPersonName = dto.AuthPersonName ?? string.Empty,
            Mobile = dto.Mobile ?? string.Empty,
            AlternativeNumber = dto.AlternativeNumber ?? string.Empty,
            ContactEmail = dto.Email,
            CategoryId = dto.CategoryId,
            Status = "Active"
        };

        Guid userId;
        try
        {
            userId = await _identity.RegisterVendorAsync(dto.Name, dto.Email, dto.Password, vendor.Id);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest($"Could not provision vendor login: {ex.Message}");
        }

        vendor.UserId = userId;
        _context.Vendors.Add(vendor);
        await _context.SaveChangesAsync();

        return Ok(vendor);
    }
```

**Field names verified against `Vendor.cs` — do not guess these.** The entity uses `ContactEmail` (not `Email`), `AuthPersonName` (not `ContactPerson`) and `Mobile` (not `Phone`). The `VendorCode` generation is preserved verbatim from the current implementation; dropping it would leave every new vendor with a blank code.

`VendorDto` **already has `Password`** (`VendorsController.cs:125`) and `AddVendor.tsx:22` already sends it — the password has always arrived and simply been thrown away. No DTO change is needed.

The `[Authorize]` widens from `Admin` to `Admin,PMU` per decision 3.

The two lines this replaces are the bug in its purest form:

```csharp
        var generatedUserId = Guid.NewGuid(); // Mocking identity creation for now
```

Delete that and the three-line comment above it.

**Known gap, accept for now:** if `SaveChangesAsync` fails after registration succeeds, an orphaned User exists with a `VendorId` pointing at no Vendor. That user cannot log into anything meaningful. A compensating delete needs a `DELETE /api/auth/users/{id}` that does not yet exist. Log the orphan and move on; track as follow-up.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter VendorProvisioningTests`
Expected: PASS, 2 tests.

- [ ] **Step 5: Verify end to end against running services**

Start IdentityService (5001), VendorService (5002) and the Gateway (5249). Then:

```bash
TOKEN=$(curl -s -X POST http://localhost:5249/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@posttender.local","password":"Admin@123"}' | jq -r .token)

curl -s -X POST http://localhost:5249/api/vendors -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Contracting","email":"acme@vendor.local","password":"Acme@12345"}'

curl -s -X POST http://localhost:5249/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"acme@vendor.local","password":"Acme@12345"}'
```

Expected: the third call returns HTTP 200 with a token whose `vendorId` claim equals the `id` from the second call. **This is the first time in the product's history that a UI-created vendor can log in.**

- [ ] **Step 6: Commit**

```bash
git add src/Backend/Services/VendorService/ src/Backend/PostTenderSystem.Tests/Vendor/
git commit -m "fix(vendor): provision a real login on vendor creation instead of fabricating a UserId"
```

### Task 1.5: Backfill the seeded demo vendor

**Files:**
- Modify: `src/Backend/Services/IdentityService/Persistence/DbSeeder.cs:36-43`

- [ ] **Step 1: Set VendorId on the seeded vendor user**

**Do not invent a new GUID here.** The fixed demo vendor id already exists as `VendorService.Persistence.DbSeeder.DemoVendorId = a0000000-0000-0000-0000-000000000001`, and its own comment records why it is fixed: *"so other services (e.g. the seeded TenderAllotment in TenderService) can reference this vendor deterministically without a shared database."* Minting a different id would silently detach the seeded work-order chain from the demo vendor and make the demo data untraceable.

Reuse the existing value. In `IdentityService.Persistence.DbSeeder.DemoIds`:

```csharp
        // Must equal VendorService.Persistence.DbSeeder.DemoVendorId. The two services
        // do not share a database, so this pair is kept in sync by hand.
        public static readonly Guid VendorRecordId = Guid.Parse("a0000000-0000-0000-0000-000000000001");
```

On the Demo Vendor user, add:

```csharp
                VendorId = DemoIds.VendorRecordId,
```

VendorService's seeder already sets `Id = DemoVendorId` and `UserId = 22222222-2222-2222-2222-222222222222`, so **it needs no change** — this task only teaches IdentityService the id that VendorService already uses. The existing comments at `IdentityService/Persistence/DbSeeder.cs:11-13` and `VendorService/Persistence/DbSeeder.cs:8-12` both warn about keeping these in sync; extend the first to mention `VendorRecordId`.

- [ ] **Step 2: Reset and verify**

```bash
cd "src/Backend/Services/IdentityService" && dotnet ef database drop -f && dotnet ef database update
```

Then log in as `vendor@posttender.local / Vendor@123` and confirm the token now carries `vendorId = a0000000-0000-0000-0000-000000000001`, matching the seeded Vendor record.

- [ ] **Step 3: Commit**

```bash
git add src/Backend/Services/IdentityService/Persistence/DbSeeder.cs src/Backend/Services/VendorService/
git commit -m "fix(seed): link demo vendor login to its vendor record"
```

### Task 1.6: Seed the PMU user

**Files:**
- Modify: `src/Backend/Services/IdentityService/Persistence/DbSeeder.cs`

- [ ] **Step 1: Add the PMU account**

In the `AddRange` block:

```csharp
            new User
            {
                Name = "Demo PMU Officer",
                Email = "pmu@posttender.local",
                Role = Role.PMU,
                PasswordHash = PasswordHasher.Hash("Pmu@123456")
            },
```

- [ ] **Step 2: Verify**

Drop and re-seed, then log in as `pmu@posttender.local / Pmu@123456`. Expected: HTTP 200, token with `role: PMU`. The frontend should route to `/admin/dashboard` (App.tsx:76 already handles PMU).

- [ ] **Step 3: Commit**

```bash
git add src/Backend/Services/IdentityService/Persistence/DbSeeder.cs
git commit -m "feat(seed): add PMU demo account"
```

### Task 1.7: Frontend reads vendorId from auth state

**Files:**
- Modify: `src/Frontend/src/store/authSlice.ts`
- Create: `src/Frontend/src/api/currentVendor.ts`
- Modify: `src/Frontend/src/pages/WorkOrders/VendorWorkOrderView.tsx:13-36`

- [ ] **Step 1: Store `vendorId` in auth state**

In `authSlice.ts`, add `vendorId?: string | null` to the user type. The login response nests it inside `user`, so read it from **`res.data.user.vendorId`** — the same object the existing code already reads `role` from. Reading `res.data.vendorId` yields `undefined` with no error, which surfaces later as an empty work-order list rather than a failure, so verify this in Step 4 rather than assuming.

- [ ] **Step 2: Add the accessor**

Create `src/Frontend/src/api/currentVendor.ts`:

```typescript
import type { RootState } from '../store';

export const selectVendorId = (state: RootState): string | null =>
  state.auth.user?.vendorId ?? null;
```

- [ ] **Step 3: Remove the all-vendors fetch**

Rewrite `VendorWorkOrderView.fetchWorkOrders` to use `axiosInstance` (decision 4) and the claim, deleting the `GET /api/vendors` + client-side `find`:

```typescript
  const fetchWorkOrders = async () => {
    if (!vendorId) { setWorkOrders([]); return; }
    try {
      const [woRes, msRes] = await Promise.all([
        axiosInstance.get('/workorders', { params: { vendorId } }),
        axiosInstance.get('/execution/milestones').catch(() => ({ data: [] })),
      ]);
      const milestones: any[] = msRes.data ?? [];
      setWorkOrders((woRes.data ?? []).map((w: any) => ({
        ...w,
        milestones: milestones.filter((m: any) => m.workOrderId === w.id),
      })));
    } catch (e) { console.error(e); }
  };
```

where `const vendorId = useSelector(selectVendorId);`.

- [ ] **Step 4: Verify in the browser**

Start the gateway, all services and `npm run dev`. Log in as `vendor@posttender.local`, open `/vendor/work-orders`, and confirm in DevTools Network that **no request to `/api/vendors` is made** and work orders still render.

- [ ] **Step 5: Commit**

```bash
git add src/Frontend/src/
git commit -m "refactor(frontend): resolve vendor identity from JWT claim, not an all-vendors fetch"
```

---

## Phase 2: PMU permissions and tenant scoping

Only safe once Phase 1 lands — closing the leak before the claim exists breaks the vendor UI.

### Task 2.1: Grant PMU its documented permissions

**Files:**
- Modify: `src/Backend/Services/TenderService/Controllers/TendersController.cs:50,66,106,138`
- Modify: `src/Backend/Services/VendorService/Controllers/VendorsController.cs:84,101`
- Modify: `src/Backend/Services/VendorService/Controllers/VendorCategoriesController.cs:29,41`

- [ ] **Step 1: Write the failing test**

Assert that a PMU principal can create a tender. Use `TestDb.Create<TenderServiceDbContext>()` and `FakeUser.With("PMU")`, calling `TendersController.AddTender`. Because `[Authorize]` is not evaluated in a direct unit call, this test must assert on the **attribute metadata** instead:

```csharp
using System.Linq;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using TenderService.Controllers;
using Xunit;

namespace PostTenderSystem.Tests.Tender;

public class TenderRbacTests
{
    [Theory]
    [InlineData(nameof(TendersController.GetAllTenders))]
    [InlineData(nameof(TendersController.AddTender))]
    [InlineData(nameof(TendersController.UpdateTender))]
    [InlineData(nameof(TendersController.DeleteTender))]
    public void TenderWrites_AllowPmu(string methodName)
    {
        var attr = typeof(TendersController)
            .GetMethod(methodName)!
            .GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(attr);
        Assert.Contains("PMU", attr!.Roles!.Split(','));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter TenderRbacTests`
Expected: FAIL on all four — roles are currently `"Admin"`.

- [ ] **Step 3: Widen the attributes**

Change `[Authorize(Roles = "Admin")]` to `[Authorize(Roles = "Admin,PMU")]` on: `TendersController.GetAllTenders`, `AddTender`, `UpdateTender`, `DeleteTender`; `VendorsController.UpdateVendorStatus`, `DeleteVendor`; `VendorCategoriesController.AddCategory`, `DeleteCategory`.

Also change `TendersController.GetAwardedTenders` from `"Admin,Department"` to `"Admin,PMU,Department"` — PMU is currently excluded from awarded tenders while its own nav links there.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter TenderRbacTests`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Backend/Services/TenderService/ src/Backend/Services/VendorService/
git commit -m "fix(rbac): grant PMU the tender and vendor permissions its UI already assumes"
```

### Task 2.2: Scope vendor-facing reads by claim

**Files:**
- Modify: `src/Backend/Services/VendorService/Controllers/VendorsController.cs:22`
- Modify: `src/Backend/Services/ExecutionService/Controllers/ProgressReportsController.cs:27`

- [ ] **Step 1: Write the failing test**

```csharp
[Fact]
public async Task GetVendors_AsVendor_ReturnsOnlyOwnRecord()
{
    using var ctx = TestDb.Create<VendorDbContext>();
    var mine = Guid.NewGuid();
    ctx.Vendors.AddRange(
        new Entities.Vendor { Id = mine, Name = "Mine" },
        new Entities.Vendor { Id = Guid.NewGuid(), Name = "Theirs" });
    await ctx.SaveChangesAsync();

    var controller = new VendorsController(ctx, Mock.Of<IIdentityClient>());
    FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: mine));

    var result = Assert.IsType<OkObjectResult>(await controller.GetVendors(null, null));
    var vendors = Assert.IsAssignableFrom<IEnumerable<object>>(result.Value);
    Assert.Single(vendors);
}
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — returns 2 vendors.

- [ ] **Step 3: Add the scoping helper and filter**

Create `src/Backend/Services/VendorService/Security/CallerContext.cs` (repeat this file per service that needs it, adjusting the namespace — it is three lines and cross-service sharing would require a new shared package, which YAGNI forbids here):

```csharp
using System;
using System.Security.Claims;

namespace VendorService.Security;

public static class CallerContext
{
    public static Guid? VendorId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("vendorId"), out var id) ? id : null;

    public static bool IsVendor(ClaimsPrincipal user) =>
        user.IsInRole("Vendor");
}
```

In `GetVendors`, before projecting:

```csharp
        var query = _context.Vendors.AsQueryable();

        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(v => v.Id == me);
        }
```

Apply the same pattern to `ProgressReportsController.Get` using `ProgressReport.VendorId` (the column already exists).

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Backend/Services/VendorService/ src/Backend/Services/ExecutionService/ src/Backend/PostTenderSystem.Tests/
git commit -m "fix(security): scope vendor-facing reads to the caller's own vendor"
```

---

## Phase 3: Vendor progress write path

Unblocks: `ProgressReporting.tsx`, `ProgressSubmissionForm.tsx`, `ProgressHistory.tsx`, `WorkOrderDetails.tsx`, `MilestoneSubmissionPage.tsx`.

### Task 3.1: `POST /api/progressreports`

**Files:**
- Modify: `src/Backend/Services/ExecutionService/Controllers/ProgressReportsController.cs`
- Test: `src/Backend/PostTenderSystem.Tests/Execution/ProgressReportsTests.cs`

- [ ] **Step 1: Write the failing test**

```csharp
[Fact]
public async Task Create_StampsVendorIdFromClaim_IgnoringBody()
{
    using var ctx = TestDb.Create<ExecutionServiceDbContext>();
    var myVendor = Guid.NewGuid();
    var controller = new ProgressReportsController(ctx, TestAudit.ForExecution());
    FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: myVendor));

    var result = await controller.Create(new CreateProgressReportDto
    {
        ProjectId = Guid.NewGuid(),
        VendorId = Guid.NewGuid(),          // hostile: a different vendor's id
        PhysicalPercentage = 40,
        WorkDescription = "Foundation poured"
    });

    Assert.IsType<OkObjectResult>(result);
    var saved = Assert.Single(ctx.ProgressReports);
    Assert.Equal(myVendor, saved.VendorId);  // claim wins, body ignored
    Assert.Equal("Submitted", saved.Status);
}

[Fact]
public async Task Create_AsNonVendor_IsRejected()
{
    using var ctx = TestDb.Create<ExecutionServiceDbContext>();
    var controller = new ProgressReportsController(ctx, TestAudit.ForExecution());
    FakeUser.Attach(controller, FakeUser.With("Admin"));

    var result = await controller.Create(new CreateProgressReportDto
    {
        ProjectId = Guid.NewGuid(), PhysicalPercentage = 10
    });

    Assert.IsType<ForbidResult>(result);
}

[Fact]
public async Task Create_RejectsPercentageOutOfRange()
{
    using var ctx = TestDb.Create<ExecutionServiceDbContext>();
    var controller = new ProgressReportsController(ctx, TestAudit.ForExecution());
    FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: Guid.NewGuid()));

    var result = await controller.Create(new CreateProgressReportDto
    {
        ProjectId = Guid.NewGuid(), PhysicalPercentage = 140
    });

    Assert.IsType<BadRequestObjectResult>(result);
}
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — no `Create` method, no `CreateProgressReportDto`.

- [ ] **Step 3: Implement**

Add to `ProgressReportsController.cs`:

```csharp
    public class CreateProgressReportDto
    {
        public Guid ProjectId { get; set; }
        public Guid VendorId { get; set; }   // accepted but ignored; claim is authoritative
        public decimal PhysicalPercentage { get; set; }
        public string WorkDescription { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public List<string> MediaUrls { get; set; } = new();
        public Guid? MilestoneId { get; set; }
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateProgressReportDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (dto.PhysicalPercentage < 0 || dto.PhysicalPercentage > 100)
            return BadRequest("PhysicalPercentage must be between 0 and 100.");

        if (dto.ProjectId == Guid.Empty)
            return BadRequest("ProjectId is required.");

        var report = new ProgressReport
        {
            ProjectId = dto.ProjectId,
            VendorId = vendorId.Value,
            PhysicalPercentage = dto.PhysicalPercentage,
            WorkDescription = dto.WorkDescription,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            MediaUrls = dto.MediaUrls,
            MilestoneId = dto.MilestoneId,
            Status = "Submitted"
        };

        _context.ProgressReports.Add(report);
        await _context.SaveChangesAsync();
        return Ok(report);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/Backend/Services/ExecutionService/ src/Backend/PostTenderSystem.Tests/Execution/
git commit -m "feat(execution): add vendor progress report submission"
```

### Task 3.2: The three missing progress reads

**Files:**
- Modify: `src/Backend/Services/ExecutionService/Controllers/ProgressReportsController.cs`

- [ ] **Step 1: Write the failing tests**

Cover: `GET /my` returns only the caller's reports; `GET /project/{id}` filters by project **and** scopes to the caller when the caller is a Vendor; `GET /workorder/{id}` resolves the project(s) for a work order. Note `ProgressReport` has `ProjectId`, not `WorkOrderId`, so `/workorder/{id}` must map work order → project. `Project.WorkOrderId` lives in **TenderService**, so ExecutionService cannot join. Implement `/workorder/{id}` by accepting the project id from the caller instead, and change `WorkOrderDetails.tsx:64` to call `/progressreports/project/{projectId}`. **Do not add a cross-service call for this.**

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement `/my` and `/project/{id}`**

```csharp
    [HttpGet("my")]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Mine()
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        return Ok(await _context.ProgressReports
            .Where(r => r.VendorId == vendorId)
            .OrderByDescending(r => r.ReportedAt)
            .ToListAsync());
    }

    [HttpGet("project/{projectId}")]
    public async Task<IActionResult> ByProject(Guid projectId)
    {
        var query = _context.ProgressReports.Where(r => r.ProjectId == projectId);

        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(r => r.VendorId == me);
        }

        return Ok(await query.OrderByDescending(r => r.ReportedAt).ToListAsync());
    }
```

Route-order note: `[HttpGet("my")]` must be declared **before** `[HttpGet("{id}")]`, otherwise `my` binds to the `Guid id` parameter and returns 400.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(execution): add progress report history and per-project reads"
```

### Task 3.3: Rewire the progress frontend

**Files:**
- Modify: `src/Frontend/src/pages/Vendor/ProgressReporting.tsx:118,126,138,167,217,447`
- Modify: `src/Frontend/src/pages/Vendor/ProgressSubmissionForm.tsx:48`
- Modify: `src/Frontend/src/pages/Vendor/ProgressHistory.tsx:78,101`
- Modify: `src/Frontend/src/pages/Admin/WorkOrderDetails.tsx:64`

- [ ] **Step 1: Replace `fetch` with `axiosInstance`**

Per decision 4, every call site touched moves to `axiosInstance` (drops the hardcoded `http://localhost:5249`, drops the manual `Authorization` header — the interceptor supplies it).

- [ ] **Step 2: Delete the dead dashboard call**

`ProgressReporting.tsx:118` calls `/api/vendordashboard/summary`, which has no route and no controller. Replace with `axiosInstance.get('/projects')` and derive the summary client-side, matching what `dashboardService.ts:141-145` already does.

- [ ] **Step 3: Verify in the browser**

Log in as the vendor, submit a progress report at `/vendor/progress`, then confirm it appears at `/vendor/progress/history`. Check Network for a 200 on `POST /api/progressreports`.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(frontend): point progress pages at real endpoints via axiosInstance"
```

---

## Phase 4: Bills

### Task 4.1: Add `VendorId` to Bill

**Files:**
- Modify: `src/Backend/Services/FinancialService/Entities/Bill.cs`

- [ ] **Step 1: Add the column**

`Bill` currently carries only `WorkOrderId`; `VendorId` lives on TenderService's `WorkOrder`, so scoping without denormalizing would need a cross-service call on every read. Because **no bill-creation path exists yet, there is no historical data to migrate** — this is the cheapest moment in the project's life to add it.

```csharp
    public Guid VendorId { get; set; }
```

- [ ] **Step 2: Migrate**

```bash
cd "src/Backend/Services/FinancialService"
dotnet ef migrations add AddVendorIdToBill
dotnet ef database update
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(financial): denormalize VendorId onto Bill for tenant scoping"
```

### Task 4.2: `POST /api/bills`

**Files:**
- Modify: `src/Backend/Services/FinancialService/Controllers/BillsController.cs`

- [ ] **Step 1: Write the failing test**

Mirror Task 3.1's shape: the claim is authoritative over the body; a non-Vendor caller gets `Forbid`; `Amount <= 0` is rejected; `Status` starts as `"Submitted"`; `GET /api/bills` as a Vendor returns only that vendor's bills.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement**

```csharp
    public class CreateBillDto
    {
        public Guid WorkOrderId { get; set; }
        public string BillNo { get; set; } = string.Empty;
        public string Type { get; set; } = "RA";
        public decimal Amount { get; set; }
        public decimal TaxAmount { get; set; }
        public string AttachmentUrl { get; set; } = string.Empty;
        public List<Guid> MilestoneIds { get; set; } = new();
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateBillDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (dto.Amount <= 0) return BadRequest("Amount must be greater than zero.");
        if (dto.WorkOrderId == Guid.Empty) return BadRequest("WorkOrderId is required.");
        if (dto.Type != "RA" && dto.Type != "Final") return BadRequest("Type must be 'RA' or 'Final'.");

        var bill = new Bill
        {
            WorkOrderId = dto.WorkOrderId,
            VendorId = vendorId.Value,
            BillNo = dto.BillNo,
            Type = dto.Type,
            Amount = dto.Amount,
            TaxAmount = dto.TaxAmount,
            AttachmentUrl = dto.AttachmentUrl,
            MilestoneIds = dto.MilestoneIds,
            Status = "Submitted"
        };

        _context.Bills.Add(bill);
        await _context.SaveChangesAsync();
        return Ok(bill);
    }
```

Then scope `Get()` with the same `CallerContext.IsVendor` pattern as Task 2.2.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(financial): add vendor bill submission with tenant scoping"
```

### Task 4.3: Rewire bill frontends

**Files:**
- Modify: `src/Frontend/src/pages/Vendor/SubmitBillModal.tsx:26,42,97`
- Modify: `src/Frontend/src/pages/Vendor/BillingClaims.tsx:36,69`

- [ ] **Step 1: Move to axiosInstance and confirm the chain**

`POST /api/bills` now exists. Verify the full chain in the browser: vendor submits → Department approves (`POST /api/bills/{id}/approve`, already exists) → Finance pays (`POST /api/bills/{id}/pay`, already exists). This is decision 5 and needs **no RBAC changes** — the existing attributes already encode it.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(frontend): point bill pages at real endpoints"
```

---

## Phase 5: Milestone submissions

**Smaller than it looks.** `MilestoneSubmission` and `MilestoneDocument` entities, DbSets and migrated tables all exist. Only a controller and a gateway route are missing.

### Task 5.1: `MilestoneSubmissionsController`

**Files:**
- Create: `src/Backend/Services/ExecutionService/Controllers/MilestoneSubmissionsController.cs`
- Modify: `src/Backend/PostTenderSystem.Gateway/appsettings.json`

- [ ] **Step 1: Write the failing tests**

Cover the six calls `MilestoneSubmissionPage.tsx` makes: `GET /milestone/{milestoneId}`, `POST`, `PUT /{id}`, `POST /{id}/submit`, `POST /{id}/documents`, `DELETE /{id}/documents/{docId}`. Key behaviours: `VendorId` comes from the claim; `Status` starts `"Draft"`; `submit` flips `Status` to `"Submitted"`, stamps `SubmittedAt` and sets `IsImmutable = true`; **any mutation of an `IsImmutable` submission returns 409 Conflict**.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement the controller**

Follow `ProgressReportsController` conventions: `[ApiController]`, `[Route("api/[controller]")]`, `[Authorize]` at class level, `[Authorize(Roles = "Vendor")]` on writes, `CallerContext.VendorId(User)` for scoping, `Forbid()` when the claim is absent, `Conflict()` when `IsImmutable`.

- [ ] **Step 4: Add the gateway route**

In `PostTenderSystem.Gateway/appsettings.json`, inside `ReverseProxy.Routes`, after `execution-misc-route`:

```json
      "milestonesubmissions-route": {
        "ClusterId": "execution-cluster",
        "Match": { "Path": "/api/milestonesubmissions/{**catch-all}" }
      },
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Verify through the gateway**

```bash
curl -s http://localhost:5249/api/milestonesubmissions/milestone/<id> -H "Authorization: Bearer $VENDOR_TOKEN"
```

Expected: HTTP 200 or 404 — **not** a gateway-level 404 with an empty body, which is what it returns today.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(execution): add milestone submissions controller and gateway route"
```

### Task 5.2: Milestone approvals

**Files:**
- Modify: `src/Backend/Services/ExecutionService/Controllers/ExecutionController.cs`
- Modify: `src/Frontend/src/pages/Admin/AdminMilestoneApprovals.tsx:54,73,93`
- Modify: `src/Frontend/src/pages/Admin/WorkOrderDetails.tsx:82`
- Modify: `src/Frontend/src/pages/Inspector/InspectorWorkOrderDetails.tsx:55`

- [ ] **Step 1: Note the routing bug**

The frontend calls `/api/projects/milestone/{id}/approve`, which the gateway routes to **tender-cluster** — but milestones live in **ExecutionService**. Adding milestone endpoints to `ProjectsController` would put milestone logic in the wrong service. Implement under `/api/execution/milestones/*` instead (the `execution-misc-route` gateway entry already covers it) and repoint the three frontend call sites.

- [ ] **Step 2: Write the failing tests**

`GET /api/execution/milestones/pending` returns submissions with `Status == "Submitted"`; `POST /api/execution/milestones/{id}/approve` requires `Admin,PMU,Department` and sets `"Approved"`; `POST /{id}/return` sets `"Rejected"` and requires a reason.

- [ ] **Step 3: Implement, then repoint the three call sites**

- [ ] **Step 4: Verify and commit**

```bash
git commit -m "feat(execution): add milestone approval endpoints on the owning service"
```

---

## Phase 6: Inspector review → Department approve

Implements decision 2. `system_map.md:107-109` already records this as the intended chain with steps 12 and 13 marked `[MISSING]`.

### Task 6.1: Add review fields to ProgressReport

**Files:**
- Modify: `src/Backend/Services/ExecutionService/Entities/ProgressReport.cs`

- [ ] **Step 1: Add the fields**

```csharp
    // Inspector review stage (precedes Department approval)
    public string? InspectorRemarks { get; set; }
    public Guid? ReviewedByInspectorId { get; set; }
    public DateTime? InspectorReviewedAt { get; set; }
    public string? InspectorRecommendation { get; set; }  // Accept, Reject
```

Extend the `Status` comment to the real lifecycle: `Submitted → Reviewed → Approved | Returned`.

- [ ] **Step 2: Migrate and commit**

```bash
cd "src/Backend/Services/ExecutionService" && dotnet ef migrations add AddInspectorReviewToProgressReport && dotnet ef database update
git commit -m "feat(execution): add inspector review fields to progress reports"
```

### Task 6.2: `POST /api/progressreports/{id}/review`

**Files:**
- Modify: `src/Backend/Services/ExecutionService/Controllers/ProgressReportsController.cs`
- Modify: `src/Frontend/src/pages/Inspector/ReviewReportDetail.tsx:50`

- [ ] **Step 1: Write the failing test**

Inspector-only; sets `Status = "Reviewed"`, stamps remarks and reviewer; rejects a report that is not `"Submitted"`; a Department caller gets `Forbid`.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement**

```csharp
    [HttpPost("{id}/review")]
    [Authorize(Roles = "Inspector")]
    public async Task<IActionResult> Review(Guid id, [FromBody] ReviewRequest request)
    {
        var report = await _context.ProgressReports.FirstOrDefaultAsync(r => r.Id == id);
        if (report is null) return NotFound();

        if (report.Status != "Submitted")
            return BadRequest($"Only a Submitted report can be reviewed (current: '{report.Status}').");

        if (request.Recommendation != "Accept" && request.Recommendation != "Reject")
            return BadRequest("Recommendation must be 'Accept' or 'Reject'.");

        report.InspectorRecommendation = request.Recommendation;
        report.InspectorRemarks = request.Remarks;
        report.ReviewedByInspectorId = Guid.TryParse(
            User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : null;
        report.InspectorReviewedAt = DateTime.UtcNow;
        report.Status = "Reviewed";

        await _context.SaveChangesAsync();
        return Ok(report);
    }

    public class ReviewRequest
    {
        public string Recommendation { get; set; } = string.Empty;
        public string? Remarks { get; set; }
    }
```

- [ ] **Step 4: Gate Department approval behind review**

In the existing `Approve` (line ~79), add:

```csharp
        if (report.Status != "Reviewed")
            return BadRequest("A report must be reviewed by an inspector before approval.");
```

This is what makes the chain real rather than two independent buttons.

- [ ] **Step 5: Repoint the frontend**

`ReviewReportDetail.tsx:50` currently posts `{ status, remarks }`; change to `{ recommendation, remarks }` and move to `axiosInstance`.

- [ ] **Step 6: Verify the full chain in the browser**

Vendor submits → Inspector reviews at `/inspector/progress-review/:id` → Department approves. Confirm the Department approve **fails** with a clear message if the inspector has not reviewed.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(execution): add inspector review stage gating department approval"
```

---

## Phase 7: Queries, documents, defects

### Task 7.1: Query write path

**Verified against the codebase — no entity work and no migration needed.**

`Query` and `QueryMessage` both already exist in `ExecutionService/Entities/Query.cs`, and `QueryMessage` is a **real table with a shadow `QueryId` foreign key** that EF inferred by convention from the `List<QueryMessage> Messages` navigation (`InitialCreate` migration creates `FK_QueryMessage_Queries_QueryId` and `IX_QueryMessage_QueryId`). This is controller-only work.

Three facts that will bite if missed:

1. **There is no `DbSet<QueryMessage>`.** Messages are reachable only through the parent, so every write goes via `_context.Queries.Include(q => q.Messages)`.
2. **`Query.CreatedAt` and `QueryMessage.Timestamp` have no default initializers**, unlike every other entity in this codebase (which use `= DateTime.UtcNow`). Set both explicitly or rows land at `DateTime.MinValue` and `OrderByDescending(q => q.CreatedAt)` silently returns garbage ordering.
3. **`QueriesController` takes only `(ExecutionServiceDbContext context)`** — no `AuditLogger`, unlike `ProgressReportsController`. Do not pass `TestAudit`.

**Files:**
- Modify: `src/Backend/Services/ExecutionService/Controllers/QueriesController.cs`
- Modify: `src/Frontend/src/pages/Vendor/QueriesClarifications.tsx:23,45,64`
- Modify: `src/Frontend/src/pages/Admin/AdminQueries.tsx:14,36`
- Test: `src/Backend/PostTenderSystem.Tests/Execution/QueriesTests.cs`

#### Bug found during planning: `GET /api/queries` never returns messages

`QueriesController.Get` reads `_context.Queries.OrderByDescending(q => q.CreatedAt).ToListAsync()` with **no `.Include(q => q.Messages)`**. EF returns every query with an empty `Messages` list, so both `QueriesClarifications.tsx` and `AdminQueries.tsx` render an empty thread even for queries that have messages. This is a live bug independent of the missing POST endpoints — the read path is broken too. Step 3 fixes it.

- [ ] **Step 1: Write the failing tests**

Create `src/Backend/PostTenderSystem.Tests/Execution/QueriesTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ExecutionService.Controllers;
using ExecutionService.Entities;
using ExecutionService.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PostTenderSystem.Tests.Helpers;
using Xunit;

namespace PostTenderSystem.Tests.Execution;

public class QueriesTests
{
    [Fact]
    public async Task Create_StampsVendorAndSenderFromClaims()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var myVendor = Guid.NewGuid();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: myVendor));

        var result = await controller.Create(new CreateQueryDto
        {
            Subject = "Site access blocked",
            Messages = new List<CreateMessageDto> { new() { Content = "Gate is locked." } }
        });

        Assert.IsType<OkObjectResult>(result);

        var saved = await ctx.Queries.Include(q => q.Messages).SingleAsync();
        Assert.Equal(myVendor, saved.VendorId);
        Assert.Equal("Open", saved.Status);
        Assert.NotEqual(default, saved.CreatedAt);

        var message = Assert.Single(saved.Messages);
        Assert.Equal("Gate is locked.", message.Content);
        Assert.Equal("Vendor", message.SenderRole);
        Assert.NotEqual(default, message.Timestamp);
    }

    [Fact]
    public async Task Create_RequiresSubject()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: Guid.NewGuid()));

        var result = await controller.Create(new CreateQueryDto { Subject = "  " });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(ctx.Queries);
    }

    [Fact]
    public async Task Get_AsVendor_ReturnsOnlyOwnQueries_WithMessages()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var mine = Guid.NewGuid();
        ctx.Queries.AddRange(
            new Query
            {
                VendorId = mine, Subject = "Mine", CreatedAt = DateTime.UtcNow,
                Messages = new List<QueryMessage>
                {
                    new() { Content = "hello", Timestamp = DateTime.UtcNow, SenderRole = "Vendor" }
                }
            },
            new Query { VendorId = Guid.NewGuid(), Subject = "Theirs", CreatedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: mine));

        var ok = Assert.IsType<OkObjectResult>(await controller.Get());
        var queries = Assert.IsAssignableFrom<IEnumerable<Query>>(ok.Value).ToList();

        var only = Assert.Single(queries);
        Assert.Equal("Mine", only.Subject);
        Assert.Single(only.Messages);   // regression guard: the missing .Include()
    }

    [Fact]
    public async Task Get_AsAdmin_ReturnsAllQueries()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        ctx.Queries.AddRange(
            new Query { VendorId = Guid.NewGuid(), Subject = "A", CreatedAt = DateTime.UtcNow },
            new Query { VendorId = Guid.NewGuid(), Subject = "B", CreatedAt = DateTime.UtcNow });
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var ok = Assert.IsType<OkObjectResult>(await controller.Get());
        Assert.Equal(2, Assert.IsAssignableFrom<IEnumerable<Query>>(ok.Value).Count());
    }

    [Fact]
    public async Task AddMessage_AsAdmin_AppendsWithAdminSenderRole()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var query = new Query { VendorId = Guid.NewGuid(), Subject = "Q", CreatedAt = DateTime.UtcNow };
        ctx.Queries.Add(query);
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var result = await controller.AddMessage(query.Id, new CreateMessageDto { Content = "Unlocking it." });

        Assert.IsType<OkObjectResult>(result);
        var saved = await ctx.Queries.Include(q => q.Messages).SingleAsync();
        var message = Assert.Single(saved.Messages);
        Assert.Equal("Admin", message.SenderRole);
    }

    [Fact]
    public async Task AddMessage_AsVendor_CannotPostToAnotherVendorsQuery()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var query = new Query { VendorId = Guid.NewGuid(), Subject = "Theirs", CreatedAt = DateTime.UtcNow };
        ctx.Queries.Add(query);
        await ctx.SaveChangesAsync();

        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Vendor", vendorId: Guid.NewGuid()));

        var result = await controller.AddMessage(query.Id, new CreateMessageDto { Content = "sneaky" });

        Assert.IsType<ForbidResult>(result);
        var saved = await ctx.Queries.Include(q => q.Messages).SingleAsync();
        Assert.Empty(saved.Messages);
    }

    [Fact]
    public async Task AddMessage_UnknownQuery_Returns404()
    {
        using var ctx = TestDb.Create<ExecutionServiceDbContext>();
        var controller = new QueriesController(ctx);
        FakeUser.Attach(controller, FakeUser.With("Admin"));

        var result = await controller.AddMessage(Guid.NewGuid(), new CreateMessageDto { Content = "x" });

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter QueriesTests`
Expected: FAIL — compile errors; `CreateQueryDto`, `CreateMessageDto`, `Create` and `AddMessage` do not exist.

- [ ] **Step 3: Implement**

Replace the body of `QueriesController.cs` (keep the existing class declaration, `[Route("api/[controller]")]` and `[Authorize]`):

```csharp
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        // .Include is required: without it every query returns an empty Messages list
        // and both the vendor and admin threads render blank.
        var query = _context.Queries.Include(q => q.Messages).AsQueryable();

        if (CallerContext.IsVendor(User))
        {
            var me = CallerContext.VendorId(User);
            if (me is null) return Forbid();
            query = query.Where(q => q.VendorId == me);
        }

        return Ok(await query.OrderByDescending(q => q.CreatedAt).ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Vendor")]
    public async Task<IActionResult> Create([FromBody] CreateQueryDto dto)
    {
        var vendorId = CallerContext.VendorId(User);
        if (vendorId is null) return Forbid();

        if (string.IsNullOrWhiteSpace(dto.Subject))
            return BadRequest("Subject is required.");

        var now = DateTime.UtcNow;
        var query = new Query
        {
            VendorId = vendorId.Value,
            Subject = dto.Subject.Trim(),
            Status = "Open",
            CreatedAt = now
        };

        foreach (var m in dto.Messages.Where(m => !string.IsNullOrWhiteSpace(m.Content)))
            query.Messages.Add(BuildMessage(m.Content, now));

        _context.Queries.Add(query);
        await _context.SaveChangesAsync();
        return Ok(query);
    }

    [HttpPost("{id}/message")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] CreateMessageDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest("Content is required.");

        var query = await _context.Queries.Include(q => q.Messages)
                                          .FirstOrDefaultAsync(q => q.Id == id);
        if (query is null) return NotFound("Query not found.");

        if (CallerContext.IsVendor(User) && CallerContext.VendorId(User) != query.VendorId)
            return Forbid();

        query.Messages.Add(BuildMessage(dto.Content, DateTime.UtcNow));

        if (query.Status == "Open")
            query.Status = "In Progress";

        await _context.SaveChangesAsync();
        return Ok(query);
    }

    private QueryMessage BuildMessage(string content, DateTime at) => new()
    {
        Content = content.Trim(),
        Timestamp = at,
        SenderRole = User.FindFirstValue(ClaimTypes.Role) ?? "Unknown",
        SenderName = User.FindFirstValue("Name") ?? string.Empty
    };

    public class CreateQueryDto
    {
        public string Subject { get; set; } = string.Empty;
        public List<CreateMessageDto> Messages { get; set; } = new();
    }

    public class CreateMessageDto
    {
        public string Content { get; set; } = string.Empty;
    }
```

Add `using System.Security.Claims;`, `using ExecutionService.Entities;` and `using ExecutionService.Security;` to the header. `CallerContext` is the per-service copy created in Task 2.2 — ExecutionService needs its own copy under `ExecutionService/Security/CallerContext.cs`.

`SenderName` reads the custom `"Name"` claim that `AuthController` mints (`new Claim("Name", user.Name)`) — **not** `ClaimTypes.Name`, which is never set and would yield an empty string.

The DTO shapes match what the frontend already sends, so no frontend payload change is needed: `POST /api/queries` receives `{ subject, messages: [{ content }] }` (`QueriesClarifications.tsx:70-73`) and `POST /api/queries/{id}/message` receives `{ content }` (line 51).

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test src/Backend/PostTenderSystem.Tests/PostTenderSystem.Tests.csproj --filter QueriesTests`
Expected: PASS, 7 tests.

- [ ] **Step 5: Repoint both frontends**

Per decision 4, move all four call sites to `axiosInstance`, dropping the hardcoded host and manual headers:

| File | Line | Change |
|---|---|---|
| `QueriesClarifications.tsx` | 23 | `axiosInstance.get('/queries')` |
| `QueriesClarifications.tsx` | 45 | `axiosInstance.post(\`/queries/${selectedQuery.id}/message\`, { content: newMessage })` |
| `QueriesClarifications.tsx` | 64 | `axiosInstance.post('/queries', { subject, messages: [{ content }] })` |
| `AdminQueries.tsx` | 14 | `axiosInstance.get('/queries')` |
| `AdminQueries.tsx` | 36 | `axiosInstance.post(\`/queries/${selectedQuery.id}/message\`, { content: newMessage })` |

- [ ] **Step 6: Verify the thread end to end in the browser**

Log in as the vendor, raise a query at `/vendor/queries`, then log in as admin and reply at `/admin/queries`. Confirm the vendor sees the reply with `senderRole: "Admin"`, and that a second vendor account cannot see the first vendor's query.

- [ ] **Step 7: Commit**

```bash
git add src/Backend/Services/ExecutionService/ src/Frontend/src/pages/ src/Backend/PostTenderSystem.Tests/Execution/
git commit -m "feat(execution): add query creation and threaded messaging with tenant scoping

Also fixes GET /api/queries never returning messages (missing .Include)."
```

### Task 7.2: Document write path

**Files:**
- Modify: `src/Backend/Services/CommonService/Controllers/DocumentsController.cs`
- Modify: `src/Backend/Services/CommonService/Controllers/FilesController.cs`
- Modify: `src/Frontend/src/pages/Vendor/DocumentUploads.tsx:24,45,61,82,88`

- [ ] **Step 1:** Note the current bug: `POST /api/files/upload` **succeeds** and writes the file to disk, then `POST /api/documents` 404s, so every uploaded file is orphaned on disk with no DB record. Fix the record path first.
- [ ] **Step 2:** Write failing tests for `POST /api/documents` and `DELETE /api/documents/{id}`.
- [ ] **Step 3:** Implement both, plus `DELETE /api/files` (currently `DocumentUploads.tsx:88` calls `DELETE /api/files?url=`, which does not exist). **Validate the `url` parameter against path traversal** — reject any value containing `..` or a rooted path, and resolve it against the upload directory before deleting.
- [ ] **Step 4:** Repoint the frontend. Recall from the earlier security work that `FilesController` no longer allows anonymous download, so downloads must use a token fetch + blob, **not** `<a target="_blank">`.
- [ ] **Step 5:** Commit.

### Task 7.3: Defect rectification

**Files:**
- Modify: `src/Backend/Services/InspectionService/Controllers/InspectionsController.cs`
- Modify: `src/Frontend/src/pages/Vendor/QualityDefects.tsx:41,62,82`

- [ ] **Step 1:** Read the `Inspection` and defect entities to learn the real shape before writing tests.
- [ ] **Step 2:** Write failing tests for `GET /api/inspections/vendor` (claim-scoped) and `PUT /api/inspections/defect/{id}/rectify`.
- [ ] **Step 3:** Implement. `InspectionsController` is GET-only today.
- [ ] **Step 4:** Repoint the frontend; commit.

---

## Phase 8: Frontend-only rewiring (do this early — cheapest win)

**No backend work required.** These pages call invented URLs while correct endpoints already exist.

### Task 8.1: AdminBilling

**Files:**
- Modify: `src/Frontend/src/pages/Admin/AdminBilling.tsx:29,52,70`

- [ ] **Step 1: Repoint three calls**

| Current (404) | Replace with (exists today) |
|---|---|
| `GET /api/admindashboard/bills` | `axiosInstance.get('/bills')` |
| `POST /api/admindashboard/bills/{id}/approve` | `axiosInstance.post('/bills/{id}/approve')` |
| `POST /api/admindashboard/bills/{id}/reject` | `axiosInstance.post('/bills/{id}/reject')` |

- [ ] **Step 2: Verify** the Admin Billing page loads real bills and approve/reject return 200.
- [ ] **Step 3: Commit**

```bash
git commit -m "fix(frontend): point admin billing at the real bills endpoints"
```

### Task 8.2: AdminPayments

**Files:**
- Modify: `src/Frontend/src/pages/Admin/AdminPayments.tsx:17`

- [ ] **Step 1:** Replace `GET /api/financialdashboard` with `axiosInstance.get('/bills')` and derive payment rows client-side (filter `Status === 'Paid'`), matching `dashboardService.ts:320-323`.
- [ ] **Step 2:** Verify and commit.

---

## Phase 9: Cancel work order

**Blocked on product sign-off — see "Assumption requiring sign-off" above.**

### Task 9.1: Allow the Cancelled transition

**Files:**
- Modify: `src/Backend/Services/TenderService/Controllers/WorkOrdersController.cs:134-141`
- Modify: `src/Backend/Services/TenderService/Entities/WorkOrder.cs:28`

- [ ] **Step 1: Write the failing test**

`Cancelled` is reachable from `Draft`, `Authority Approval` and `Pending Vendor Acceptance`; **not** from `Accepted`, `Project Activated` or `Completed`; only `Admin,PMU` may cancel.

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — every cancel currently returns 400, because `Cancelled` is in no `allowedTransitions` value.

- [ ] **Step 3: Extend the map**

```csharp
        var allowedTransitions = new Dictionary<string, string[]>
        {
            ["Draft"] = new[] { "Authority Approval", "Pending Vendor Acceptance", "Cancelled" },
            ["Authority Approval"] = new[] { "Pending Vendor Acceptance", "Cancelled" },
            ["Pending Vendor Acceptance"] = new[] { "Accepted", "Cancelled" },
            ["Accepted"] = new[] { "Project Activated", "Completed" },
            ["Project Activated"] = new[] { "Completed" }
        };
```

Add the role gate next to the existing vendor-accept gate:

```csharp
        if (request.NewStatus == "Cancelled" && userRole != "Admin" && userRole != "PMU")
            return Forbid();
```

Update the `WorkOrder.Status` comment to include `Cancelled`.

- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(tender): allow work order cancellation before vendor acceptance"
```

---

## Phase 10: Replace the E2E suite

The current `e2e-functional-tests.cjs` asserts only login and page-load, which is why it reports all-green against a product where no role can complete a transaction.

### Task 10.1: Transaction-level E2E

**Files:**
- Create: `src/Frontend/tests/e2e-vendor-chain.spec.ts`
- Modify: `Functional Testing.md`

- [ ] **Step 1: Write one Playwright test that walks the whole chain**

Admin creates a tender → issues a work order → approves it → Vendor logs in and accepts → Vendor submits a progress report → Inspector reviews it → Department approves → Vendor submits a bill → Department approves → Finance pays. **Assert on data, not page titles** — the whole failure of the current suite is that it asserts on chrome.

- [ ] **Step 2: Run it**

Run: `cd src/Frontend && npx playwright test tests/e2e-vendor-chain.spec.ts`
Expected: PASS once Phases 1-8 land. Before then it documents exactly where the chain breaks — which is useful, so land it early and let it fail loudly.

- [ ] **Step 3: Correct the record**

Rewrite `Functional Testing.md` to state what is actually covered. The current claim that "All structural QA tasks... have been fully satisfied" is false and has already masked ~20 broken endpoints.

- [ ] **Step 4: Commit**

```bash
git commit -m "test: replace page-load E2E with a real transaction-chain suite"
```

---

## Execution order

Phases 1 and 2 are strictly ordered (the leak is load-bearing). Everything else can move:

1. **Phase 0** — harness. Nothing is testable before this.
2. **Phase 8** — frontend-only rewiring. Cheapest win, no dependencies, do it while the harness lands.
3. **Phase 1** — identity foundation. The keystone.
4. **Phase 2** — PMU + scoping. Must follow Phase 1.
5. **Phase 3 → 4** — progress, then bills. This is the chain that turns Finance from decorative into functional.
6. **Phase 5, 6, 7** — parallelizable across workers once Phase 2 lands.
7. **Phase 9** — after product sign-off.
8. **Phase 10** — land the failing E2E early, keep it red until it goes green.

## Definition of done

Every role can complete its documented transaction:

- **Admin/PMU** — create tender → issue WO → approve → see it accepted, and cancel a pre-acceptance WO.
- **Vendor** — created via the UI, **can log in** (impossible today), accept a WO, submit progress, submit a milestone, upload a document that persists, raise a query, submit a bill.
- **Inspector** — review a progress report and have the review gate Department approval.
- **Department** — approve reviewed progress and verify bills.
- **Finance** — pay an approved bill.
- No role can read another tenant's data.
