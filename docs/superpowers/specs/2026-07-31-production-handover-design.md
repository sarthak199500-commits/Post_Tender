# Production handover version — design

**Date:** 2026-07-31
**Goal:** Hand the Post Tender codebase to an incoming development team as a clean,
self-contained, production-ready copy at `Post trender\Production\`.

## Context

The working tree carries 178 uncommitted files on branch `Changes` — the entire
SQLite→SQL Server migration, three new domain features, and a frontend design-system
pass. Nothing of that is recorded in git. The repo also carries ~580 MB of build
output, dependency trees, obsolete SQLite databases and test-run upload residue.

The handover therefore has two parts, in order: record the pending work, then cut a
clean copy from that recorded state.

## Scope

In scope: committing pending work, producing the cleaned copy, and code optimisation
(removing dead code and files, fixing what is outright wrong for a production run).

Out of scope, by decision: containerisation, CI pipelines, observability work, TLS,
and deployment to any environment. Anything found in these areas is left as-is.

## Part 1 — Commit the pending work

Six batches on branch `Changes`, in dependency order. Each must leave the tree
buildable.

| # | Batch | Files |
|---|-------|-------|
| 1 | SQLite → SQL Server migration: providers in 7 `.csproj`, `UseSqlServer` in 7 `Program.cs`, connection strings, 7 `InitialSqlServer` migrations replacing 20 SQLite ones, explicit `HavePrecision(18,2)` on the 4 DbContexts owning decimals | 86 |
| 2 | Test suite: `GatewayRouteCoverageTests`, `TestVerifier`, real-SQLite FK tests, explicit Sqlite package reference | 7 |
| 3 | New domain features: `Alert` + `AlertsController`, `TimeExtension` + `TimeExtensionsController`, `BillPayment` | 5 |
| 4 | Backend entity and controller changes: Bills, Auth, Tenders, WorkOrders, Project, User, CallerContext | 12 |
| 5 | Frontend: `ChangePassword`, `statusTone` design system, responsive pass | 66 |
| 6 | DB migration tooling and `docs/SRS.md` | 2 |

## Part 2 — The `Production\` copy

A plain folder. **No git repository** — the receiving team initialises their own.
`Production/` is added to the parent repo's `.gitignore` so the source tree is never
duplicated in git.

### Contents

```
Production/
  src/Backend/          7 services + Gateway + Tests
  src/Frontend/         React/Vite application source
  tools/db-migration/   provisioning scripts only (see below)
  run-all.ps1
  start-all.ps1
  docker-compose.yml
  .gitignore
  README.md             build, run and configuration steps
```

### Excluded, with reasons

Every entry below was verified against the tree, not assumed.

| Item | Size | Reason |
|------|------|--------|
| `src/Frontend/node_modules` | 259 MB, 21,975 files | restored by `npm ci` |
| 20 × `bin/` and `obj/` | ~300 MB | build output |
| 21 × `*.sqlite`, `-shm`, `-wal` | 750 KB | obsolete; the system runs on SQL Server |
| `CommonService/UploadedFiles/*` (66 files) | 1.9 MB | test-run upload residue; directory kept with `.gitkeep` |
| `identity_err.log`, `identity_out.log` | 0 KB | empty stray logs |
| `src/docker-compose.yml` | — | stale: builds Dockerfiles that do not exist, references a `monolith-core` service that no longer exists |
| `src/Frontend/dummy_agreement.pdf` | — | test fixture |
| `REF/` | 0.3 MB | `Post_Tender_Mgt.docx` is byte-identical to the copy in `Doc/` (hash-verified) |
| `Doc/`, `Test Cases/`, `docs/` | 4.9 MB | reference material; excluded by decision |
| `system_map.md`, `Functional Testing.md` | — | excluded by decision |
| `tools/db-migration/sqlite-export*.json`, `backup/` | 15 MB | one-time migration data dumps containing real row data; the migration has already been executed |
| `.git` | 6.4 MB | the copy is not a repository |

Net effect: roughly 580 MB reduced to about 12 MB of source.

`tools/db-migration` keeps `README.md`, the provisioning SQL, the schema SQL and the
`DbImport` tool — the team needs these to provision a database — and drops the data
dumps.

## Part 3 — Code optimisation

1. **Gate database seeding to Development.** `DbSeeder.Seed(db)` runs unconditionally
   at startup in IdentityService, VendorService, TenderService and InspectionService.
   A production launch therefore writes demo accounts, including
   `admin@posttender.local / Admin@123`, into the production database. Each call is
   wrapped in an environment check so seeding happens only in Development.

2. **Repair the solution file.** `PostTenderSystem.sln` references only
   `PostTenderSystem.Gateway` and `PostTenderSystem.Tests`. `dotnet build` on the
   solution reports success without compiling any of the seven services — a new team
   would believe the build is clean when nothing was checked. All seven service
   projects are added.

3. **Correct stale comments.** All seven `Program.cs` files carry
   `// Configure Entity Framework Core with SQLite` directly above a `UseSqlServer`
   call.

4. **Configuration hygiene.** Add `src/Frontend/.env.example` documenting
   `VITE_API_URL`. Harden `.gitignore` to cover `node_modules`, `bin`, `obj`,
   `*.sqlite*`, `UploadedFiles` and logs, so the cruft removed here cannot return.

5. **Dead code.** Remove unused usings and unreachable code encountered during the
   pass. The frontend was checked for unreferenced modules and is already clean:
   all 78 TypeScript modules are reachable from `main.tsx`.

### Deliberately not changed

`CallerContext.cs` is duplicated across six services (16–22 lines each). Consolidating
it requires introducing a shared project and changing the build topology — a
structural change beyond "optimise and remove". It is recorded here as a known point
of duplication rather than altered.

## Part 4 — Verification

The copy is not finished until it builds and passes on its own, independently of the
source tree:

- `dotnet build` on the repaired solution — all 8 projects compile
- `dotnet test` — 136 tests expected green
- `npm ci` in `src/Frontend`
- `npx tsc --noEmit` — clean
- `npx eslint .` — 0 problems
- `npm run build` — Vite production bundle succeeds

A failure at any step is fixed in the copy before handover, not documented around.

## Risks

- **Build locks.** Running services lock their `bin\Debug` assemblies and fail builds
  with MSB3021. Services must be stopped by the PID owning ports 5001–5007 and 5249
  before the verification step.
- **Connection strings.** Each service's `appsettings.json` points at the staging
  server. These are carried across unchanged; the README documents overriding them
  with `ConnectionStrings__DefaultConnection`.
- **Seeding gate.** Wrapping `DbSeeder.Seed` changes local developer experience: a
  fresh Development run still seeds, but a Production-environment run against an
  empty database will have no users. The README states this explicitly.
