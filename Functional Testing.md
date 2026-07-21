# Functional Testing

This document states **what is actually tested** in the Post Tender Management System, and
what is not. It exists because the prior test story was misleading: the only "E2E" specs
checked page titles and accessibility (one of them, `example.spec.ts`, tests `playwright.dev`
— not this application at all), so the suite reported green against a product in which no role
could complete a single transaction. The audit that followed found ~20 endpoints that the
frontend called but that did not exist. Do not treat a green run as proof the workflow works
unless the tests below are the ones that ran.

## 1. Backend tests (xUnit) — the primary safety net

**121 tests**, `src/Backend/PostTenderSystem.Tests`. Controller-level tests over each service's
real `DbContext` (EF in-memory), asserting behaviour and access control rather than HTTP
plumbing. Run:

```bash
cd src/Backend && dotnet test PostTenderSystem.Tests/PostTenderSystem.Tests.csproj
```

Coverage by area:

| Area | Files | What is asserted |
|---|---|---|
| Identity / auth | `Identity/*` | login issues the `vendorId` claim; `POST /register` is Admin/PMU-only |
| Vendor | `Vendor/*` | UI-created vendors get a real login; `GET /vendors` scopes to the caller's tenant |
| Tender / work order | `Tender/*` | PMU has Admin-equivalent rights; project scoping; **work-order cancellation rules** |
| Progress + review | `Execution/ProgressReport*` | claim-authoritative create; tenant scoping; **inspector review gates department approval** |
| Milestones | `Execution/Milestone*` | draft → submit immutability (409 on later edits); approval marks the milestone Completed |
| Queries | `Execution/QueriesTests` | threaded messaging; tenant scoping; the `GET` include-messages regression guard |
| Bills | `Financial/BillsTests` | claim-stamped submission; the Vendor → Department → Finance chain |
| Documents | `Common/DocumentsTests` | record path + scoped read/delete |
| Defects | `Inspection/InspectionsTests` | vendor defect worklist + rectification write |

## 2. End-to-end transaction chain (Playwright, API-level)

`src/Frontend/tests/e2e-vendor-chain.spec.ts` — the test that actually proves the product
works. It drives the whole lifecycle through the **real API gateway** and asserts on data at
every step:

> Admin creates a tender → issues a work order + milestone → approves it → Vendor accepts (a
> Project is created) → Vendor submits a progress report → **Inspector reviews** → Department
> approves → Vendor submits the milestone package → Department approves it (milestone →
> Completed) → Vendor raises an RA bill → Department approves → **Finance pays (Paid + voucher)**.

A second test asserts the negative path: a progress report **cannot** be approved by the
department before an inspector has reviewed it (returns 400). Together these prove the chain is
a real sequence, not a row of independent buttons.

It uses Playwright's `request` fixture, so **no browser is launched** — it is an API test.

**Prerequisites:** all backend services and the gateway must be running (`run-all.ps1`, which
sets `ASPNETCORE_ENVIRONMENT=Development`). Then:

```bash
cd src/Frontend
npx playwright test tests/e2e-vendor-chain.spec.ts --project=chromium
```

Override the gateway host with `PTMS_GATEWAY` if it is not on `http://localhost:5249`.

## 3. Legacy / cosmetic specs (not functional coverage)

These predate the restoration and assert nothing about the business workflow:

- `tests/example.spec.ts` — Playwright's starter template; it navigates to `playwright.dev`.
  It is not a test of this application and should be deleted or replaced.
- `tests/a11y-audit.spec.ts`, `tests/usability-compatibility.spec.ts` — page-load and
  accessibility checks against the running frontend. Useful, but they do not exercise any
  transaction.

## 4. Not yet covered

- **UI-driven E2E.** The chain above is asserted at the API level. The frontend wiring is
  verified manually / per-change but is not yet covered by an automated browser click-through.
- **Cross-service display composition.** A few reviewer screens (`AdminMilestoneApprovals`,
  `QualityDefects`) show blank project/vendor names because those names live in other services
  and are not yet joined on the client. Data and actions work; only the labels are missing.
- **Frontend unit tests (vitest)** are scoped to `src/**` and do not cover these pages.
