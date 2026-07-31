# SQLite → SQL Server migration

One-time migration of all seven service databases from SQLite to SQL Server.
Each service keeps its own database — the microservice boundary is unchanged, and
there are still no cross-database joins.

| Service           | SQLite file (before)        | SQL Server database (after) |
| ----------------- | --------------------------- | --------------------------- |
| IdentityService   | `IdentityDb.sqlite`         | `PostTender_Identity`       |
| VendorService     | `VendorDb.sqlite`           | `PostTender_Vendor`         |
| TenderService     | `TenderServiceDb.sqlite`    | `PostTender_Tender`         |
| ExecutionService  | `ExecutionServiceDb.sqlite` | `PostTender_Execution`      |
| InspectionService | `InspectionServiceDb.sqlite`| `PostTender_Inspection`     |
| FinancialService  | `FinancialServiceDb.sqlite` | `PostTender_Financial`      |
| CommonService     | `CommonServiceDb.sqlite`    | `PostTender_Common`         |

## What changed in the code

* `Microsoft.EntityFrameworkCore.Sqlite` → `.SqlServer` in all seven `.csproj` files.
* `options.UseSqlite(...)` → `options.UseSqlServer(...)` in all seven `Program.cs`.
* Connection strings in each `appsettings.json` now point at SQL Server. The server
  name lives **only** there — override per environment with the standard
  `ConnectionStrings__DefaultConnection` environment variable rather than editing files.
* All 20 SQLite migrations were deleted and replaced by one clean
  `InitialSqlServer` migration per service. They generate `uniqueidentifier`,
  `nvarchar`, `datetime2` and `decimal(18,2)` instead of SQLite's `TEXT`.
* Decimal precision is now stated explicitly (`HavePrecision(18, 2)`) in the four
  DbContexts that own decimal columns. Left unstated, EF quietly falls back to the
  same `decimal(18,2)` while warning about every property; stating it makes the
  money semantics deliberate. Verified lossless: nothing in the exported data
  exceeded two decimal places or 11 integer digits.
* `PostTenderSystem.Tests` now references `Microsoft.EntityFrameworkCore.Sqlite`
  explicitly. `InspectionVisitsTests` deliberately runs against a real in-memory
  SQLite engine because the InMemory provider ignores foreign keys and would report
  an FK-violating insert as a success. That package used to arrive transitively via
  the service projects; once they moved to SqlServer it had to become explicit.

## Running it

### Option A — one SQL script (no .NET tooling needed on the server)

`complete-migration.sql` is a single self-contained file: login + 7 databases +
permissions, then schema and data for each. Hand it to a DBA, or run:

```bash
sqlcmd -S <server>[,<port>] -i tools/db-migration/complete-migration.sql
```

Change `@AppPassword` at the top first. It is safe to re-run — every INSERT is
guarded by an `IF NOT EXISTS` on the row's primary key, and the schema half is
EF's own `--idempotent` output.

To regenerate it after any model change:

```bash
python tools/db-migration/export_sqlite.py        # read-only; safe while services run
python tools/db-migration/filter_export.py        # strip test residue, cascade orphans
python tools/db-migration/generate_complete_script.py
```

`filter_export.py` derives its foreign-key graph by parsing `sql-raw/*.schema.sql`
rather than from a hand-written list. That is deliberate: the hand-written version
was wrong three separate ways — it missed `TenderAllotments → Tenders` (which
failed on import), missed four other edges, and contained a `Projects.TenderId`
rule that silently did nothing because `Projects` has no such column. It now fails
loudly if a real FK would be violated, instead of producing a script that breaks
partway through.

### Option B — let EF build the schema, then load data via the importer

```powershell
python tools/db-migration/export_sqlite.py
python tools/db-migration/filter_export.py
./start-all.ps1                                    # EF's Database.Migrate() creates the schema
dotnet run --project tools/db-migration/DbImport
```

The importer clears each table before loading, so a failed run can be repeated. It
disables foreign keys for the load and re-enables them `WITH CHECK` afterwards, so
a broken reference fails loudly rather than being discovered later.

## Verification actually performed

`complete-migration.sql` was executed end-to-end against a real SQL Server 2022
instance, not just inspected:

| Check | Result |
| --- | --- |
| Full script, from scratch | 120/120 batches, 0 errors |
| Rows loaded | 374, matching the filter's count exactly |
| Immediate re-run | 119 batches, **0 errors**, 374 → 374 unchanged |
| Decimal fidelity | `decimal(18,2)`, amounts exact (28875000.00 etc.), no rounding |
| GUID / datetime / unicode | `uniqueidentifier`, `datetime2`, `nvarchar` all round-tripped |
| Foreign keys | all active, `is_not_trusted = False` — validated, not left disabled |
| App login permissions | `db_ddladmin` + reader + writer, `db_owner` correctly **not** granted |

Three real defects were found and fixed only because the script was executed:
a `QUOTENAME` call inside `EXEC()` (not legal in T-SQL), the missing
`TenderAllotments → Tenders` cascade, and unguarded INSERTs that threw 24
primary-key violations on re-run.

**One caveat that will apply to a fresh server:** SQL Server Express defaults to
Windows-Authentication-only, in which case the `posttender_app` SQL login is
created successfully but cannot connect — surfacing only as a bare
"Login failed for user". The script now detects this and prints the fix
(enable Mixed Mode + restart, or switch the connection strings to
`Trusted_Connection=True`).

## Rollback

The SQLite files are **not** deleted by any of this — they are left untouched on
disk beside each service. To go back: restore the `.csproj`, `Program.cs`,
`appsettings.json` and `Migrations/` changes from version control. The data is
still sitting in the `.sqlite` files exactly as it was.

`sqlite-export.json` is the verbatim pre-migration snapshot (521 rows) and
`sqlite-export.filtered.json` is what was actually loaded (375 rows).

## What was dropped, and why

`filter_export.py` removed 146 of 521 rows. Two rules: an explicit test marker, or
being a child of something dropped by that first rule (applied to a fixed point).

* 10 `E2E-*` tenders, 13 `E2E-*`/`VAL-TEST-*`/`WO-CANCEL-TEST*` work orders, 10 `E2E` projects
* `VAL-TEST-B1` — a bill for ₹99,999,999,999 that existed only to prove the amount validator rejects it
* `ZZ TEST USER - safe to delete`, `browser-test.txt`, 81 E2E audit entries
* cascade: 10 milestones, 10 progress reports, 5 milestone submissions, 1 inspection + its defect

Deliberately **not** dropped:

* **Duplicate demo data.** `seed:demo` was run three times, so `DEMO-BILL-2601-01`
  exists in triplicate and several `DEMO-*` work orders/tenders/projects in
  duplicate. Choosing which copy survives is a judgement call for a human.
* **The `Public Works (PWD)` department.** Its *description* said `E2E`, but the
  department itself is real and is the only one in the system. The row was kept and
  the description cleared.
* **`RA-2026-001`** (₹500,000, Paid). Its `WorkOrderId` points at a work order that
  does not exist in the SQLite data either — this reference was **already broken
  before the migration** and is carried across unchanged rather than silently
  deleted. Worth a look, but it is pre-existing state, not migration damage.
