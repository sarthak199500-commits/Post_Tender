# Software Requirements Specification
## Post Tender Management System (PTMS)

| | |
|---|---|
| **Document version** | 2.0 |
| **Date** | 31 July 2026 |
| **Status** | Reflects the system as currently implemented |
| **Applies to** | `E:\Projects\Innovador\Post trender_1.2\Post trender` |
| **Database** | SQL Server 2022 (migrated from SQLite — see `tools/db-migration/README.md`) |

---

### About this document

This SRS describes what the Post Tender Management System **actually does today**, derived by reading the source rather than from a prior design document. Where the code and the original intent differ, the code wins and the gap is noted.

Sections marked **⚠ Gap** describe things that are missing, incomplete, or behave differently than a reader would reasonably expect. They are included deliberately — a specification that hides its gaps is not useful for planning.

**How to read it:**
- §1–3 — what the system is, who uses it, how it is built
- §4 — the data model (what is stored)
- §5 — **the flows** (the core of this document)
- §6 — **module-by-module: every screen, action and rule, in plain English**
- §7 — security rules
- §8 — cross-cutting behaviour
- §9 — known gaps, consolidated
- §10 — every endpoint, generated from the controllers

**What changed in version 2.0**

| Area | Change |
|---|---|
| §4 | Added `BillPayment`, `BillDeduction`, `TimeExtension`, `Alert`/`AlertRead` |
| §6 | Rewritten. Each module now lists **every action** — what it does in plain terms, which endpoint, what it changes, and what it is forbidden from doing |
| §8.2 | Notifications are now persisted alerts merged with derived signals, not derived-only |
| §9.1 | Six gaps closed (alerts, department field, partial payments, time extensions, password reset, "Under Review"); four new ones recorded |
| §9.3 | Verification status expanded with actual test counts |
| §10 | Regenerated **from the controllers themselves** — 114 endpoints, no longer collapsed rows |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Users and Roles](#2-users-and-roles)
3. [System Architecture](#3-system-architecture)
4. [Data Model](#4-data-model)
5. [End-to-End Flows](#5-end-to-end-flows)
6. [Module Requirements](#6-module-requirements)
7. [Security Requirements](#7-security-requirements)
8. [Cross-Cutting Behaviour](#8-cross-cutting-behaviour)
9. [Known Gaps and Limitations](#9-known-gaps-and-limitations)
10. [Appendix: Complete API Reference](#10-appendix-complete-api-reference)

---

## 1. Introduction

### 1.1 Purpose

PTMS manages the **post-tender lifecycle** of a government/public-sector works contract — everything that happens *after* a tender has been awarded:

- Issuing a work order to the winning vendor
- Tracking physical progress on site
- Inspecting quality and forcing rectification of defects
- Approving milestones as they complete
- Paying the vendor, with the correct money withheld

It does **not** run the tender process itself (bid publication, bid opening, evaluation). Tenders enter the system already awarded, with the winner recorded.

### 1.2 Scope in one sentence

> A tender is awarded → a work order is issued and accepted → a project starts → the vendor reports progress and completes milestones → inspectors verify quality → the vendor bills for completed milestones → the department approves and finance pays, net of retention, advance recovery, and deductions.

### 1.3 The one-line lifecycle

```
Tender (Awarded)
   └─► Work Order (Draft → Approval → Vendor Acceptance → Accepted)
          └─► Project (auto-created on acceptance)
                 ├─► Milestones ──► Milestone Submissions ──► Approval
                 ├─► Progress Reports ──► Inspector Review ──► Dept Approval
                 ├─► Inspections ──► Defects ──► Rectification ──► Verification
                 └─► Bills ──► Dept Approval ──► Finance Payment ──► Retention Release
```

### 1.4 Definitions

| Term | Meaning |
|---|---|
| **Tender** | An awarded procurement notice. The starting point. |
| **Work Order (WO)** | The contract issued to the winning vendor. Carries value, dates, scope, and LD terms. |
| **Project** | The execution container. Created automatically when a vendor accepts a WO. |
| **Milestone** | A payable chunk of work. Has a weightage (% of work) and a payment percentage (% of money). |
| **Milestone Submission** | The evidence package a vendor assembles to claim a milestone is done. |
| **Progress Report** | A periodic site update with photos and GPS coordinates. Separate from milestones. |
| **Inspection** | A visit record listing defects found. |
| **Defect** | A single quality problem, with a severity, that the vendor must rectify. |
| **RA Bill** | Running Account bill — a payment claim against completed milestones. |
| **Retention** | Money withheld from every bill, released only after the defects liability period. |
| **Advance** | Mobilisation money paid *before* work starts, recovered from later bills. |
| **LD** | Liquidated Damages — a penalty for running past the scheduled end date. |
| **PMU** | Project Management Unit — administrative role, equivalent to Admin in nearly all permissions. |

---

## 2. Users and Roles

Six roles exist (`IdentityService/Entities/Role.cs`). Every API call is authorised against the role in the caller's JWT.

| Role | Who they are | What they do |
|---|---|---|
| **Admin** | System owner | Everything. Full master data control, user creation, all oversight. |
| **PMU** | Project Management Unit | Effectively identical to Admin throughout the codebase. Every `[Authorize]` that names Admin also names PMU. |
| **Vendor** | The contractor doing the work | The only role that *creates* work: progress reports, milestone submissions, bills, queries, defect rectifications. |
| **Inspector** | Quality/site inspector | Schedules visits, logs inspections and defects, verifies rectifications, reviews progress reports. |
| **Department** | The client department | Approves milestones, approves progress reports, approves bills, manages deductions. |
| **Finance** | Treasury/accounts | Releases payment, rejects bills, releases retention. |

### 2.1 The separation-of-duties principle

The system deliberately splits **who verifies** from **who approves** from **who pays**:

```
Vendor claims  →  Inspector verifies quality  →  Department approves  →  Finance pays
```

No single role can move a claim from submission to payment. This is enforced at the API layer, not just in the UI:

- Finance **cannot** approve a bill (403)
- Department **cannot** pay a bill (403)
- Vendor **cannot** approve, pay, reject, or query their own bill (403)
- Inspector **cannot** approve or pay anything financial (403)

### 2.2 The vendor identity link

A `Vendor` (company record) and a `User` (login) are separate entities. They are linked by `User.VendorId`. On login, the JWT carries a `vendorId` claim, which is how every vendor-scoped query filters data without a cross-service lookup.

**⚠ Gap — the inspector ID convention is inconsistent and is a live trap.** `InspectionVisit.InspectorId` and `WorkOrder.InspectorId` hold the *Inspector profile id*, but `Inspection.InspectorId` holds the *login user id*. These are different values. Mixing them causes foreign-key crashes. Any new code touching inspector IDs must check which convention the target entity uses.

---

## 3. System Architecture

### 3.1 Shape

A **.NET 8 microservices backend** behind a YARP reverse-proxy gateway, with a **React + TypeScript + Vite** single-page frontend.

```
                    ┌──────────────────────────┐
                    │  React SPA (Vite)  :5174 │
                    └────────────┬─────────────┘
                                 │ all calls via /api/*
                    ┌────────────▼─────────────┐
                    │   YARP Gateway    :5249  │
                    └────────────┬─────────────┘
        ┌──────────┬─────────────┼─────────────┬──────────┬──────────┐
        ▼          ▼             ▼             ▼          ▼          ▼
   Identity    Vendor        Tender       Execution  Inspection  Financial   Common
    :5001      :5002         :5003          :5004      :5005       :5006      :5007
```

### 3.2 Services

| Service | Port | Owns |
|---|---|---|
| **IdentityService** | 5001 | Users, login, JWT issuance, Departments master |
| **VendorService** | 5002 | Vendor companies, Vendor categories |
| **TenderService** | 5003 | Tenders, Work Orders, Projects, Tender Types, Allotments |
| **ExecutionService** | 5004 | Milestones, Milestone Submissions, Progress Reports, Queries, Milestone Templates |
| **InspectionService** | 5005 | Inspections, Defects, Inspection Visits, Inspectors, Defect Categories |
| **FinancialService** | 5006 | Bills, Deductions, Billing Policy, Tax Configurations |
| **CommonService** | 5007 | Audit Logs, File uploads, Contract Documents, Locations master |
| **Gateway** | 5249 | Routing only — **performs no authentication of its own** |

### 3.3 Key architectural decisions

**Each service owns its own SQL Server database.** There are no cross-database joins. (Originally SQLite; migrated per `tools/db-migration/README.md`. The database-per-service boundary was preserved exactly — only the engine changed.)

**Cross-service data is denormalized, not joined.** When FinancialService needs to know which vendor a bill belongs to, it stores `Bill.VendorId` directly rather than calling TenderService. The same pattern applies to `Inspection.VendorId` and `InspectionVisit.VendorId`. This is why those fields exist and why they must be stamped correctly at creation.

**Display names are joined on the client.** The API returns raw entities with IDs. The React app fetches `/projects`, `/vendors`, `/workorders` separately and joins by ID in JavaScript to show names. This is why pages fetch several endpoints at once.

**Two services make outbound HTTP calls**, both via typed `HttpClient`:
- `AuditLogger` (all services → CommonService) — **fails open**. If the audit sink is down, the operation still succeeds. Losing a log entry must never block a payment.
- `WorkOrderVerifier` (FinancialService → Gateway → TenderService/ExecutionService) — **fails closed**. If ownership cannot be verified, the bill is refused. A security check that cannot be answered must not be assumed to pass.

### 3.4 Running the system

```
run-all.ps1
```

Each service must be started with `--no-launch-profile --urls http://localhost:<port>`. **Without `--no-launch-profile`, `dotnet run` reads `launchSettings.json` and binds the wrong port**, and the gateway will have nothing to route to.

Each service applies its own EF Core migrations at startup via `db.Database.Migrate()`. A new migration therefore takes effect only after that service restarts.

**⚠ Gap — the solution file is misleading.** `PostTenderSystem.sln` references only the Gateway and the test project. It does **not** include the seven services. Building the solution reports success without compiling any service. Build each `.csproj` individually to verify a change.

---

## 4. Data Model

### 4.1 Entity relationship overview

```
Tender ──1:N──► WorkOrder ──1:N──► Project
                    │                  │
                    │                  ├──1:N──► Milestone ──1:N──► MilestoneSubmission ──1:N──► MilestoneDocument
                    │                  │
                    │                  ├──1:N──► ProgressReport
                    │                  │
                    │                  └──1:N──► Inspection ──1:N──► InspectionDefect
                    │
                    ├──1:N──► Bill ──1:N──► BillDeduction
                    │
                    └──1:N──► InspectionVisit

Vendor ──1:1──► User (login)
Inspector ──1:1──► User (login)
```

### 4.2 Core entities

#### Tender (TenderService)
| Field | Notes |
|---|---|
| TenderNo, Title, Description | Identification |
| TenderType | Open / Limited / GeM — from the Tender Types master |
| Budget, EMDAmount | Money |
| Portal | GeM Portal, CPPP, etc. |
| PublishDate, CloseDate | Dates |
| DocumentUrl | Uploaded tender copy |
| Status | `Open` → `Closed` → `Awarded` |

#### WorkOrder (TenderService)
| Field | Notes |
|---|---|
| TenderId, VendorId, InspectorId | Links. InspectorId = **Inspector profile id** |
| WorkOrderNo, TotalValue | The contract value — the basis for all percentage math |
| StartDate, EndDate | EndDate drives Liquidated Damages |
| ScopeDescription, PaymentTerms, LiquidatedDamagesTerms | Contract text |
| AgreementDocumentUrl | Signed agreement |
| Status | See §5.2 state machine |

#### Project (TenderService)
Created **automatically** when a work order is accepted. Never created manually.

| Field | Notes |
|---|---|
| WorkOrderId | One project per work order (enforced idempotently) |
| Name | Auto-generated as `"Project for WO {WorkOrderNo}"` |
| Budget | Copied from `WorkOrder.TotalValue` |
| Progress | 0–100 |
| Latitude, Longitude | Site location |

#### Milestone (ExecutionService)
| Field | Notes |
|---|---|
| ProjectId, WorkOrderId | Either may be set; queries usually go by WorkOrderId |
| Title | |
| **Weightage** | % of *work* this represents |
| **PaymentPercentage** | % of *contract value* payable — this is what the bill amount is computed from |
| TargetDate, CompletionDate | |
| Status | `Pending` → `Completed` (only a `Completed` milestone is billable) |

#### Bill (FinancialService)
| Field | Notes |
|---|---|
| WorkOrderId, VendorId | VendorId stamped from the token, never the request body |
| BillNo | Vendor's own invoice reference. **Unique per vendor** |
| Type | `RA` \| `Final` \| `Advance` |
| Amount, TaxAmount | `TotalAmount` = Amount + Tax (computed) |
| MilestoneIds | Which milestones this claims |
| Status | `Submitted` → `Approved` → `Paid`, or → `Returned` |
| RetentionPercentage, RetainedAmount | Snapshotted at creation from Billing Policy |
| RetentionReleased, RetentionReleasedAt | |
| AdvanceRecovered | How much of an outstanding advance this bill repays |
| Deductions | Line items (LD, TDS, cess…) |
| PaymentVoucherNo, PaidAt | Issued on payment |

**The money formula:**
```
NetPayable = (Amount + TaxAmount) − RetainedAmount − AdvanceRecovered − Σ(Deductions)
```

**Why values are snapshotted:** `RetentionPercentage` and `AdvanceRecovered` are copied onto the bill at creation rather than looked up at payment time. If an admin later changes the retention policy from 5% to 8%, bills already in flight keep the terms they were submitted under.

#### BillPayment (FinancialService)

One row per instalment. A bill paid in three parts has three of these.

| Field | Notes |
|---|---|
| BillId | Parent bill; cascade delete |
| Amount | This instalment only |
| VoucherNo | **Unique system-wide**, including across instalments |
| Reference | Cheque number / UTR, optional |
| PaidByUserId, PaidAt | Who released it and when |

Two computed properties live on `Bill` rather than in the database:

```
AmountPaid   = Σ(Payments)          — or, for a legacy bill with no payment rows
                                      that is already "Paid", the full NetPayable
BalanceAmount = NetPayable − AmountPaid   (floored at zero)
```

**Why the legacy fallback:** bills paid before instalments existed have no `BillPayment` rows. Rather than backfill synthetic payment records — inventing a voucher and a timestamp that never happened — `AmountPaid` falls back to the net payable when the bill is already `Paid`. Historical rows read correctly without fabricating history.

`Bill.PaymentVoucherNo` and `PaidAt` retain the **final** instalment, so anything written against the old single-payment shape still behaves.

#### BillDeduction (FinancialService)

| Field | Notes |
|---|---|
| BillId | Parent bill; cascade delete |
| Type | `LD` \| `TDS` \| `Cess` \| free text |
| Description | Why it was applied — shown to the vendor |
| Amount | Subtracted from net payable |
| IsSystemGenerated | True for the automatic liquidated-damages suggestion |

Deductions are **locked once any payment has been made** against the bill — a late deduction would move the net payable after funds had already gone out.

#### TimeExtension (TenderService)

| Field | Notes |
|---|---|
| WorkOrderId | Which contract |
| RequestedEndDate | The new date being asked for |
| Reason | Vendor's justification |
| Status | `Pending` → `Approved` \| `Rejected` |
| DecidedByUserId, DecidedAt | |

Approving one **moves `WorkOrder.EndDate`**, which is what stops liquidated damages accruing. Without this the LD calculator has no way to know a delay was authorised.

#### Alert / AlertRead (CommonService)

| Alert field | Notes |
|---|---|
| Type | `critical` \| `warning` \| `info` \| `success` — validated against a whitelist |
| Title, Message | |
| TargetRole, TargetUserId, TargetVendorId | All null = broadcast to everyone |
| EntityName, RecordId, Link | Lets the UI navigate to the thing the alert is about |
| RaisedByUserId, CreatedAt | |

| AlertRead field | Notes |
|---|---|
| AlertId, UserId | Unique together |
| ReadAt | |

**Why read state is a separate table:** a broadcast alert goes to many people. A single `IsRead` flag on the alert itself could only record that *somebody* read it. A join row per user is what allows the same alert to be read by Finance and still unread for a vendor. `AlertRead` deliberately has **no** navigation property back to `Alert` — that back-reference is what causes `System.Text.Json` to fail on a serialisation cycle.

### 4.3 Master data

| Master | Service | Endpoint | Managed by |
|---|---|---|---|
| Departments | Identity | `/api/masters/departments` | Admin, PMU |
| Locations | Common | `/api/masters/locations` | Admin, PMU |
| Defect Categories | Inspection | `/api/masters/defectcategories` | Admin, PMU |
| Milestone Templates | Execution | `/api/masters/milestonetemplates` | Admin, PMU |
| Tax Configurations | Financial | `/api/masters/taxconfigurations` | Admin, PMU |
| **Billing Policy** | Financial | `/api/masters/billingpolicy` | Admin, PMU |
| Tender Types | Tender | `/api/tendertypes` | Admin, PMU |
| Vendor Categories | Vendor | `/api/vendorcategories` | Admin, PMU |

**Billing Policy** is a single row, not a list — one organisation-wide policy:
| Setting | Default | Controls |
|---|---|---|
| RetentionPercentage | 5% | Withheld from every RA/Final bill |
| AdvanceRecoveryPercentage | 10% | Deducted from each later bill to repay an advance |
| MaxAdvancePercentage | 10% | Cap on an advance request, as % of contract value |

**⚠ Gap — gateway routes are individually listed.** The gateway matches `/api/masters/departments`, `/api/masters/locations`, etc. as *separate explicit routes*. There is no `/api/masters/{**catch-all}` wildcard. **Any new master endpoint must have a route added to `Gateway/appsettings.json` or it will 404 through the gateway while working perfectly when called directly.**

---

## 5. End-to-End Flows

This is the heart of the document. Each flow shows: who does what, in what order, what the system checks, and what can go wrong.

---

### 5.1 Flow — Login and Session

```
User enters email + password
        │
        ▼
POST /api/auth/login   (the only unauthenticated endpoint)
        │
        ├─ credentials wrong ──► 401 Unauthorized
        │
        ▼
JWT issued, containing: userId, email, name, role, vendorId (vendors only)
        │
        ▼
Token stored — localStorage if "Remember Me" ticked, else sessionStorage
        │
        ▼
Every subsequent call sends: Authorization: Bearer <token>
        │
        ▼
Frontend routes to the role's home dashboard
```

**Rules:**
- There is **no self-registration**. `POST /api/auth/register` requires an Admin/PMU token.
- There is **no password reset flow**. An admin must reset it. The login page says so.
- The gateway does **not** validate tokens — each service validates independently using a shared `Jwt:Key`.
- `Jwt:Key` must be ≥32 characters or the service refuses to start. Dev key lives in `appsettings.Development.json`; production must supply `Jwt__Key` as an environment variable.

---

### 5.2 Flow — Tender to Work Order to Project

This is the flow that starts everything.

```
   ADMIN / PMU                                          VENDOR
        │                                                  │
   1. Create Tender (already awarded)                       │
      POST /api/tenders                                     │
      Status: Open                                          │
        │                                                   │
   2. Record allotment (L1/L2/L3 bidders)                    │
      POST /api/tenderallotments                             │
        │                                                    │
   3. Create Work Order against the tender                    │
      POST /api/workorders                                    │
      ├─ validates TotalValue > 0                             │
      ├─ validates TotalValue ≤ Tender.Budget  ◄── key rule   │
      └─ Status: Draft                                        │
        │                                                     │
   4. Approve → sends to vendor                               │
      PUT /api/workorders/{id}/approve                        │
      Status: Pending Vendor Acceptance ──────────────────────►│
                                                              │
                                              5. Vendor accepts
                                                 PUT /api/workorders/{id}/status
                                                 { newStatus: "Accepted" }
                                                              │
                                    ┌─────────────────────────┘
                                    ▼
                          SYSTEM AUTO-CREATES PROJECT
                          - Name: "Project for WO {number}"
                          - Budget = WorkOrder.TotalValue
                          - Idempotent: one project per WO
```

#### Work Order state machine (strictly enforced)

```
   Draft ──────────────► Authority Approval ──────► Pending Vendor Acceptance
     │                          │                            │
     │                          │                            ▼
     │                          │                        Accepted ────► Project Activated
     │                          │                            │                │
     ▼                          ▼                            ▼                ▼
  Cancelled ◄───────────── Cancelled                     Completed ◄──── Completed
```

**Transition rules the API enforces:**

| From | Allowed to | Who |
|---|---|---|
| Draft | Authority Approval, Pending Vendor Acceptance, Cancelled | Admin/PMU |
| Authority Approval | Pending Vendor Acceptance, Cancelled | Admin/PMU |
| Pending Vendor Acceptance | **Accepted** (Vendor only), Cancelled (Admin/PMU only) | see note |
| Accepted | Project Activated, Completed | |
| Project Activated | Completed | |

- Any other transition returns **400 Illegal status transition**. A client cannot skip the workflow (e.g. `Draft → Completed`).
- Only a **Vendor** may set `Accepted`.
- Only **Admin/PMU** may set `Cancelled`.
- **Cancellation is impossible after acceptance** — once work is in flight, closing it out is a different process. `Cancelled` is deliberately absent from `Accepted`, `Project Activated`, and `Completed`.

---

### 5.3 Flow — Milestones and Approval

Milestones define what gets paid, and when.

```
   ADMIN / PMU                     VENDOR                    DEPT / ADMIN / PMU
        │                             │                              │
   1. Define milestones                │                              │
      POST /api/execution/milestones    │                             │
      (Title, Weightage %,              │                             │
       PaymentPercentage %,             │                             │
       TargetDate)                      │                             │
      Status: Pending                   │                             │
        │                               │                             │
        └──────────────────────────────►│                             │
                                        │                             │
                          2. Create submission (Draft)                 │
                             POST /api/milestonesubmissions            │
                                        │                              │
                          3. Attach evidence documents                 │
                             POST /api/milestonesubmissions/{id}/documents
                             (Completion Certificate, Test Report…)    │
                                        │                              │
                          4. Link existing progress reports            │
                                        │                              │
                          5. Submit — becomes IMMUTABLE                │
                             POST /api/milestonesubmissions/{id}/submit│
                             Status: Draft → Submitted                 │
                                        └─────────────────────────────►│
                                                                       │
                                            6. Review the package
                                               GET /api/execution/milestones/pending
                                                                       │
                                          ┌────────────────────────────┤
                                          ▼                            ▼
                                    APPROVE                        RETURN
                              POST .../{id}/approve          POST .../{id}/return
                              Milestone → Completed          Submission → Rejected
                              Submission → Approved          (vendor corrects, resubmits)
                                          │
                                          ▼
                              ★ MILESTONE IS NOW BILLABLE ★
```

**Key rules:**
- A submission becomes **immutable** on submit (`IsImmutable = true`). The vendor cannot edit it afterwards.
- Only **Admin, PMU, Department** can approve a milestone. **Inspectors cannot** — their role is to review the progress reports and inspect quality, not to release money.
- Approving a milestone sets `Milestone.Status = "Completed"`, which is the gate the billing flow checks.

---

### 5.4 Flow — Progress Reporting

Separate from milestones. This is routine site reporting, and it has a **two-stage** approval.

```
   VENDOR                    INSPECTOR                    DEPARTMENT
      │                          │                             │
  1. Submit report                │                            │
     POST /api/progressreports    │                            │
     - PhysicalPercentage         │                            │
     - WorkDescription            │                            │
     - Latitude / Longitude  ◄─── geo-tagged                   │
     - MediaUrls (photos)         │                            │
     Status: Submitted            │                            │
      └───────────────────────────►│                           │
                                   │                           │
                    2. Review (Inspector only)                 │
                       GET /api/progressreports/pending-review │
                       POST /api/progressreports/{id}/review   │
                       { recommendation: Accept | Reject,      │
                         remarks }                             │
                       Status: Submitted → Reviewed            │
                       Records: ReviewedByInspectorId,         │
                                InspectorReviewedAt            │
                                   └──────────────────────────►│
                                                               │
                                               3. Approve or Query
                                                  POST .../{id}/approve
                                                  Status: Reviewed → Approved
                                                        or
                                                  POST .../{id}/query
                                                  Status: → QueryRaised
```

**Critical gating rule:** `POST /{id}/approve` **rejects any report that is not already `Reviewed`**. The department cannot approve a report the inspector has not seen. This is the enforced separation of duties.

Likewise `POST /{id}/review` rejects anything not in `Submitted` — an inspector cannot re-review an approved report.

**Report lifecycle:**
```
Submitted ──► Reviewed ──► Approved
    │             │
    └─────────────┴──► QueryRaised (sent back to vendor)
```

---

### 5.5 Flow — Inspections and Defect Rectification

This is the quality loop. It is the only flow with a **bounce-back cycle** that can repeat indefinitely.

```
   INSPECTOR                              VENDOR                     INSPECTOR
        │                                    │                            │
  1. Schedule a visit                        │                            │
     POST /api/inspectionvisits              │                            │
     { workOrderId, vendorId,                │                            │
       scheduledDate, purpose }              │                            │
     Status: Scheduled                       │                            │
        │                                    │                            │
        └── visible to vendor ──────────────►│                            │
            GET /api/inspectionvisits/vendor │                            │
                                             │                            │
  2. Conduct visit, log inspection           │                            │
     POST /api/inspections                   │                            │
     - remarks, evidenceUrl                  │                            │
     - defects[]: { description, severity }  │                            │
     Inspection Status: Follow-up Required   │                            │
     Each Defect Status: Open                │                            │
        └───────────────────────────────────►│                            │
                                             │                            │
                          3. Rectify each defect                          │
                             PUT /api/inspections/defect/{id}/rectify     │
                             - reworkReportUrl  (required)                │
                             - rectificationNotes (optional)              │
                             Defect: Open → Rectified                     │
                                             └───────────────────────────►│
                                                                          │
                                                       4. Verify
                                                          PUT .../verify
                                                          { isVerified }
                                    ┌─────────────────────────┴──────────┐
                                    ▼                                    ▼
                              ACCEPT (true)                        REJECT (false)
                              Defect → Verified                    Defect → Open
                                    │                              Evidence CLEARED
                                    │                              (url + notes wiped)
                                    │                                    │
                                    │                                    └──► back to step 3
                                    ▼
                       When ALL defects are Verified:
                       Inspection Status → Resolved
```

**Rules:**
- A defect can only be verified from `Rectified`. Verifying an `Open` defect returns **400** — it would skip the vendor entirely.
- **Rejection wipes the evidence.** `ReworkReportUrl`, `RectificationNotes` and `RectifiedAt` are all set to null, so a rejected defect cannot appear to have proof attached.
- `Inspection.Status` is a **roll-up**, recomputed on every verify: `Resolved` if every defect is `Verified`, otherwise `Follow-up Required`.
- An Inspector sees only inspections and visits they personally created. Admin/PMU see all.

**Defect severity:** `Low` | `Medium` | `High` | `Critical`, validated server-side. Severity is **display-only** — it does not affect sort order, deadlines, escalation, or any calculation.

**Visit lifecycle:** `Scheduled` → `Completed` (stamps ActualVisitDate) or `Cancelled`. Only the owning inspector, or Admin/PMU, may change it.

---

### 5.6 Flow — Billing and Payment ★

The most complex flow. Money moves here, so every step is gated.

#### 5.6.1 The claim path

```
   VENDOR                      DEPARTMENT                    FINANCE
      │                             │                           │
  1. Raise a claim                   │                          │
     - select Work Order             │                          │
     - tick COMPLETED milestones     │                          │
     - amount auto-computed:         │                          │
       Σ(PaymentPercentage) × WO.TotalValue                     │
     - tax from Tax Master (fallback 18%)                       │
     - enter own invoice number      │                          │
     - upload invoice PDF            │                          │
      │                              │                          │
      ▼                              │                          │
  POST /api/bills                    │                          │
      │                              │                          │
      ├─ SERVER-SIDE CHECKS ─────────┴──────────────────────────┤
      │  ✓ amount > 0, tax ≥ 0, type valid                      │
      │  ✓ billNo non-empty and unique for this vendor          │
      │  ✓ milestones not already claimed on a live bill        │
      │  ✓ work order BELONGS to this vendor      ← cross-service│
      │  ✓ every milestone belongs to that WO     ← cross-service│
      │  ✓ every milestone is status=Completed    ← cross-service│
      │                                                          │
      ├─ SERVER-SIDE CALCULATIONS ─────────────────────────────  │
      │  • RetainedAmount = Amount × RetentionPercentage         │
      │  • AdvanceRecovered = min(Amount × recovery%, outstanding)│
      │  • If WO is overdue → auto-add LD deduction              │
      │                                                          │
      ▼                                                          │
  Status: Submitted ─────────────────►│                          │
                                      │                          │
                       2. Review the claim                       │
                          - see full breakdown                   │
                          - add/remove deductions                │
                            POST /api/bills/{id}/deductions      │
                            DELETE /api/bills/{id}/deductions/{d}│
                          ┌───────────┴──────────┐               │
                          ▼                      ▼               │
                     APPROVE                  RETURN             │
                POST .../approve          POST .../query         │
                Status: Approved          Status: Returned       │
                          │               + RejectionReason      │
                          │                      │               │
                          │                      └──► vendor corrects
                          │                           and RESUBMITS
                          │                           (milestones released)
                          └──────────────────────────────────────►│
                                                                  │
                                                  3. Release funds
                                                     POST .../pay
                                                     ├ requires status=Approved
                                                     ├ Status → Paid
                                                     ├ PaidAt stamped
                                                     └ Voucher issued:
                                                       VOUCHER-YYYYMMDD-NNNN
                                                       (sequential, unique)
                                                                  │
                                                  4. Later: release retention
                                                     POST .../release-retention
                                                     - requires status=Paid
                                                     - requires retention > 0
                                                     - once only
```

#### 5.6.2 Bill state machine

```
                     ┌────────────► Returned ──────┐
                     │ (query/reject)              │ (vendor resubmits
                     │                             │  as a NEW bill)
   Submitted ──► Under Review ──► Approved ────────┴──► [new Submitted bill]
                     │                 │
                     │                 │  pay(amount < balance)
                     │                 ▼
                     │          Partially Paid ──┐
                     │                 │         │ pay() again
                     │                 │◄────────┘
                     │                 │  balance reaches zero
                     │                 ▼
                     └──────────────► Paid ────► retention released
                                    (TERMINAL)
```

`Under Review` is optional — a department can approve straight from `Submitted`. It exists so a claim being actively examined is visibly distinct from one nobody has picked up.

**Enforced:**
| Rule | Behaviour |
|---|---|
| Only `Submitted` / `Under Review` can be approved | Approving a `Returned` bill → 400 |
| Only `Approved` / `Partially Paid` can be paid | Paying a `Submitted` bill → 400 |
| Payment cannot exceed the outstanding balance | Over-payment, zero and negative all → 400 |
| Each instalment gets its own voucher | Voucher numbers are unique system-wide |
| Once money has moved, the bill locks | Re-approve, return, reject and **deduction edits** all → 400 |
| Retention needs full settlement | Releasing on a `Partially Paid` bill → 400 |
| `Paid` is terminal | Re-pay / re-approve / reject / query all → 400 |
| A `Returned` bill releases its milestones | Vendor can resubmit them on a new bill |

**A worked instalment sequence** (net payable ₹1,13,000):

```
pay(50,000)  → Partially Paid   VOUCHER-…-0001   balance ₹63,000
pay(30,000)  → Partially Paid   VOUCHER-…-0002   balance ₹33,000
pay()        → Paid             VOUCHER-…-0003   balance ₹0
```

Calling `pay` with no amount always settles the remaining balance, which is what preserves the original single-payment behaviour for any caller that predates instalments.

#### 5.6.3 The money, worked through

A vendor claims a milestone worth ₹1,00,000 on a work order that is 6 weeks overdue, with an outstanding advance of ₹10,000:

| Line | Amount | Source |
|---|---|---|
| Claim amount | ₹1,00,000 | Σ milestone PaymentPercentage × contract value |
| \+ Tax @18% | ₹18,000 | Tax master (or 18% fallback) |
| **Gross** | **₹1,18,000** | |
| − Retention @5% | −₹5,000 | Billing Policy, snapshotted |
| − Advance recovery @10% | −₹10,000 | capped at outstanding balance |
| − Liquidated damages | −₹X | auto: 0.5%/week × contract value, capped 10% |
| **= Net Payable** | **₹1,03,000 − X** | what Finance actually releases |

Retention is released separately, later, by Finance.

#### 5.6.4 Mobilisation advance

A separate bill type for money paid *before* work starts.

```
Vendor requests advance (Type = "Advance")
   ├─ no milestones required
   ├─ capped at MaxAdvancePercentage of WO.TotalValue  (default 10%)
   ├─ ZERO retention withheld (nothing has been executed yet)
   └─ only ONE outstanding advance per work order
        ├─ blocked if another advance is pending
        └─ blocked if a paid advance is not yet fully recovered
                    │
                    ▼
   Approved and paid like any other bill
                    │
                    ▼
   Every subsequent RA/Final bill automatically deducts
   AdvanceRecoveryPercentage (default 10%) of its claim,
   capped at the outstanding balance, until repaid.
```

#### 5.6.5 Liquidated damages

When a bill is submitted against an **overdue** work order, the server automatically attaches a deduction:

```
weeksLate = floor((today − WorkOrder.EndDate) / 7 days)
LD        = min(TotalValue × 0.005 × weeksLate,  TotalValue × 0.10)
```

- 0.5% of contract value per week late, **capped at 10%**
- Skipped entirely if the work order status is `Completed`
- Flagged `IsSystemGenerated = true`
- **Removable** by Department/Finance before payment — the system has no record of granted time extensions, so it can only flag lateness, not adjudicate the reason

---

### 5.7 Flow — Queries and Clarifications

A simple threaded conversation between vendor and PMU.

```
VENDOR                                          ADMIN / PMU
   │                                                 │
1. Raise a query                                     │
   POST /api/queries                                 │
   { subject, messages: [{ content }] }              │
   Status: Open                                      │
   └────────────────────────────────────────────────►│
                                                     │
                                       2. Reply
                                          POST /api/queries/{id}/message
                                          SenderRole recorded
                                                     │
   ◄─────────────────────────────────────────────────┘
3. Vendor replies — thread continues both ways
```

Vendors see only their own threads (scoped by `vendorId` claim). Only vendors can *create* a thread; both sides can post messages.

---

### 5.8 Flow — Documents

```
Vendor uploads → POST /api/files/upload  (multipart)
                       │
                       ▼
              returns { url, name, size }
                       │
                       ▼
Vendor registers → POST /api/documents  { name, type, url, size }
                   Type: Financial | Compliance | Technical | General
                   Status: Pending
                       │
                       ▼
              Admin/PMU review (Pending → Verified | Rejected)
```

File download (`GET /api/files/{name}`) **requires authentication** — these are confidential contract documents, not public assets.

---

## 6. Module Requirements

### 6.1 Module map by role

| Module | Admin/PMU | Vendor | Inspector | Department | Finance |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tenders | ✓ | | view | view | view |
| Work Orders | ✓ | ✓ own | ✓ assigned | view | view |
| Projects | ✓ | | | | |
| Milestones | ✓ define/approve | ✓ submit | | ✓ approve | |
| Progress Reports | ✓ | ✓ submit | ✓ review | ✓ approve | |
| Inspections & Defects | view | ✓ rectify | ✓ create/verify | view | view |
| Inspection Visits | ✓ | ✓ view own | ✓ schedule | | |
| Bills | ✓ approve | ✓ submit | | ✓ approve | ✓ pay |
| Deductions | ✓ | | | ✓ | ✓ |
| Retention release | ✓ | | | | ✓ |
| Queries | ✓ respond | ✓ raise | | | |
| Documents | ✓ verify | ✓ upload | | | |
| Vendors | ✓ | | | | |
| Masters | ✓ | | | | |
| Audit Logs | ✓ | | | ✓ | ✓ |

### 6.2 Vendor module

**Who this is for:** the contractor doing the work. They see their own jobs, report progress, fix defects, and ask for money.

**Screens:** Dashboard, Work Orders, Bill Submission, Inspections & Defects, Progress Reporting, Progress History, Milestone Updates, Document Uploads, Queries & Clarifications.

#### What a vendor can do

| # | Action | In plain terms | Endpoint | What it changes |
|---|---|---|---|---|
| V-1 | **Accept a work order** | Agree to do the job. This is the moment the job becomes real. | `PUT /workorders/{id}/status` | Status `Issued` → `Accepted`, and a **Project is auto-created** |
| V-2 | **Reject a work order** | Decline the job, with a reason. | `PUT /workorders/{id}/status` | Status → `Rejected`. Terminal. |
| V-3 | **Request a time extension** | Ask for the deadline to move, because of rain, late site handover, etc. | `POST /timeextensions` | Creates a `Pending` request. Does **not** move the date yet. |
| V-4 | **Start a milestone package** | Begin assembling proof that a chunk of work is done. | `POST /milestonesubmissions` | Creates a `Draft` package |
| V-5 | **Attach / remove documents** | Add test reports, photos, certificates. | `POST` / `DELETE .../documents` | Only while still `Draft` |
| V-6 | **Submit the package** | Hand it in for approval. | `POST /milestonesubmissions/{id}/submit` | Becomes **immutable** — no further edits |
| V-7 | **File a progress report** | Say what was built this period, with photos and GPS. | `POST /progressreports` | Creates a report awaiting inspector review |
| V-8 | **Submit a bill (RA claim)** | Ask to be paid for completed milestones. | `POST /bills` | Creates a `Submitted` bill; retention and advance recovery are calculated and frozen onto it |
| V-9 | **Request a mobilisation advance** | Ask for money up front to get started. | `POST /bills` (type `Advance`) | Capped by policy; recovered from later bills |
| V-10 | **Rectify a defect** | Fix something an inspector flagged, and upload proof. | `PUT /inspections/defect/{id}/rectify` | Defect → `Rectified`, awaiting inspector verification |
| V-11 | **Raise a query** | Ask PMU a question and keep the thread. | `POST /queries`, `POST /queries/{id}/message` | Creates/extends a conversation |
| V-12 | **Upload contract documents** | Licences, registrations, insurance. | `POST /documents` | Vendor-scoped repository |
| V-13 | **Change own password** | | `POST /auth/change-password` | Requires the current password |
| V-14 | **View own alerts** | See what needs attention; mark as read. | `GET /alerts`, `POST /alerts/{id}/read` | Read state is **per user** |

#### Rules enforced against vendors

| ID | Rule |
|---|---|
| VEN-01 | A vendor sees **only their own data**. Every list is filtered by the `vendorId` **claim**, never a parameter the browser sends. |
| VEN-02 | Accepting a work order auto-creates the project — the vendor never creates a project directly. |
| VEN-03 | Progress reports are geo-tagged and carry photo evidence. |
| VEN-04 | A submitted milestone package is immutable. Mistakes require a fresh package, not an edit. |
| VEN-05 | A vendor can bill **only** against milestones that are `Completed`, verified server-side against ExecutionService. |
| VEN-06 | The claim form shows a live preview of retention and advance recovery **before** submitting, so the payable figure is never a surprise. |
| VEN-07 | Advance requests are capped by `MaxAdvancePercentage` in the billing policy. |
| VEN-08 | Scheduled inspection visits are visible, with past-due ones flagged "Awaiting Visit". |
| VEN-09 | A vendor **cannot** bill against another vendor's work order — checked cross-service, and refused if the check cannot be completed. |
| VEN-10 | A vendor cannot approve, pay, or inspect anything. |

---

### 6.3 Inspector module

**Who this is for:** the field engineer who physically visits sites and judges quality. They are the independent check between "the vendor says it's done" and "the department pays for it".

**Screens:** Dashboard, Work Orders, Audit Visits, Progress Review, Quality Defects.

#### What an inspector can do

| # | Action | In plain terms | Endpoint | What it changes |
|---|---|---|---|---|
| I-1 | **Schedule a site visit** | Book a date to go and look. | `POST /inspectionvisits` | Creates a `Scheduled` visit the vendor can see |
| I-2 | **Close out a visit** | Record that the visit happened. | `PUT /inspectionvisits/{id}/status` | Only for visits **they** booked |
| I-3 | **Log an inspection** | Record what was found, with any number of defects in one go. | `POST /inspections` | Creates an inspection plus its defect list |
| I-4 | **Verify a rectification** | Confirm a fix is genuine, or send it back. | `PUT /inspections/defect/{id}/verify` | Defect → `Closed` or back to `Open` |
| I-5 | **Review a progress report** | Recommend Accept or Reject. | `POST /progressreports/{id}/review` | **Gates** department approval — the department cannot approve until this exists |
| I-6 | **Raise an alert** | Flag something that needs attention. | `POST /alerts` | Persisted, targeted by role/vendor/user |

#### Rules enforced against inspectors

| ID | Rule |
|---|---|
| INS-01 | An inspector sees only work orders assigned to them. `InspectorId` here is their **profile** id, not their login id — see trap T-07. |
| INS-02 | Scheduling a visit requires the vendorId, otherwise the vendor cannot see their own visit. |
| INS-03 | An inspector can only close out visits they personally booked. |
| INS-04 | Inspector review is a **precondition** for department approval of a progress report, not an optional opinion. |
| INS-05 | An inspector **cannot** approve milestones. |
| INS-06 | An inspector **cannot** touch anything financial — no bills, no deductions, no payments. |

---

### 6.4 Department module

**Who this is for:** the government department that owns the work. They are the technical approver — they decide whether what was built is acceptable, and what should be deducted.

**Screen:** Department Dashboard (one consolidated screen).

#### What a department user can do

| # | Action | In plain terms | Endpoint | What it changes |
|---|---|---|---|---|
| D-1 | **Approve a progress report** | Agree the reported progress is real. | `POST /progressreports/{id}/approve` | Only **after** an inspector has reviewed it |
| D-2 | **Query a progress report** | Send it back with questions. | `POST /progressreports/{id}/query` | Returns to the vendor |
| D-3 | **Approve a milestone** | Confirm a chunk of work is complete. | `POST /execution/milestones/{id}/approve` | Milestone → `Completed`, which **unlocks billing** for it |
| D-4 | **Return a milestone** | Reject the submitted package. | `POST /execution/milestones/{id}/return` | Vendor must resubmit |
| D-5 | **Start reviewing a bill** | Pick up a claim so others can see it's being looked at. | `POST /bills/{id}/start-review` | `Submitted` → `Under Review` |
| D-6 | **Approve a bill** | Certify the claim as technically correct and pass it to Finance. | `POST /bills/{id}/approve` | → `Approved`. Department **cannot** then pay it. |
| D-7 | **Return a bill** | Send the claim back to the vendor with a reason. | `POST /bills/{id}/query` | → `Returned`; the claimed milestones are released |
| D-8 | **Add a deduction** | Withhold money for a specific reason (damages, recoveries, penalties). | `POST /bills/{id}/deductions` | Reduces net payable |
| D-9 | **Remove a deduction** | Reverse a deduction — e.g. an extension was granted, so the delay penalty no longer applies. | `DELETE /bills/{id}/deductions/{id}` | Locked once any payment has been made |
| D-10 | **Approve / reject a time extension** | Decide whether the deadline moves. | `POST /timeextensions/{id}/approve` \| `/reject` | Approval **moves `WorkOrder.EndDate`**, which stops liquidated damages accruing |

#### Rules enforced against the department

| ID | Rule |
|---|---|
| DEP-01 | Cannot approve a progress report that no inspector has reviewed. |
| DEP-02 | Returning a bill requires a reason. |
| DEP-03 | Deductions can only be edited **before** money moves. |
| DEP-04 | **Cannot pay a bill** — 403. This is the core separation of duties. |

---

### 6.5 Finance module

**Who this is for:** the treasury function. They release money. They deliberately cannot decide *whether* work was acceptable — only the department can do that.

**Screen:** Financial Dashboard.

#### What a finance user can do

| # | Action | In plain terms | Endpoint | What it changes |
|---|---|---|---|---|
| F-1 | **Release full payment** | Pay the whole outstanding balance. | `POST /bills/{id}/pay` (no amount) | → `Paid`, voucher issued |
| F-2 | **Release a part payment** | Pay an instalment now, the rest later. | `POST /bills/{id}/pay` with `amount` | → `Partially Paid`; each instalment gets its **own voucher** |
| F-3 | **Reject an approved bill** | Send it back to the vendor even after departmental approval. | `POST /bills/{id}/reject` | → `Returned` |
| F-4 | **Release retention** | Pay back the money withheld as a quality guarantee. | `POST /bills/{id}/release-retention` | Only on a **fully** paid bill, and only once |
| F-5 | **Add / remove a deduction** | Same as the department. | `POST` / `DELETE .../deductions` | Locked once money has moved |

#### Rules enforced against finance

| ID | Rule |
|---|---|
| FIN-01 | Can only pay a bill that is `Approved` or `Partially Paid`. A `Submitted` bill is invisible to payment. |
| FIN-02 | **Cannot approve a bill** — 403. Approver ≠ payer. |
| FIN-03 | Cannot pay more than the outstanding balance; cannot pay zero or a negative amount. |
| FIN-04 | Retention releases only after full settlement — a part-paid bill cannot release retention. |
| FIN-05 | Every voucher number is unique across the whole system, including across instalments. |
| FIN-06 | The full breakdown — claimed, withheld, net payable, already paid, balance — is visible before paying. |

---

### 6.6 Admin / PMU module

**Who this is for:** the programme management unit. They set the system up and oversee everything, but deliberately do not *originate* vendor or inspector work.

**Screens:** Dashboard, Tenders, Awarded Tenders, Projects, Work Orders, Billing, Payments, Vendors, Inspectors, Users, Documents, Alerts, Queries, Reports, Audit Logs, Settings, plus eight master-data screens.

#### What an admin can do

| # | Action | In plain terms | Endpoint |
|---|---|---|---|
| A-1 | **Create a tender** | Publish an opportunity. | `POST /tenders` |
| A-2 | **Record the allotment** | Capture who came L1/L2/L3. | `POST /tenderallotments` |
| A-3 | **Issue a work order** | Award the job to the winner, with milestones. | `POST /workorders` |
| A-4 | **Define milestones** | Break the job into billable chunks; weightages must total 100. | `POST /execution/milestones` |
| A-5 | **Register a vendor** | Onboard a contractor and create their login. | `POST /vendors` |
| A-6 | **Register an inspector** | Create an inspector profile. | `POST /inspectors` |
| A-7 | **Create an internal user** | Admin/PMU/Finance/Department staff. There is **no self-registration**. | `POST /auth/register` |
| A-8 | **Reset a user's password** | Issue a one-time temporary password. | `POST /auth/users/{id}/reset-password` |
| A-9 | **Set the billing policy** | Retention %, advance cap, recovery %. | `PUT /api/masters/billingpolicy` |
| A-10 | **Manage master data** | Tender types, vendor categories, taxes, locations, departments, defect categories, milestone templates. | `/api/masters/*` |
| A-11 | **Broadcast an alert** | Notify everyone, a role, a vendor, or one person. | `POST /alerts` |
| A-12 | **Read the audit trail** | Every state change, who did it, when. | `GET /auditlogs` |

#### Rules enforced against admins

| ID | Rule |
|---|---|
| ADM-01 | Admin/PMU permissions are a **superset of all others, with two deliberate exceptions**: they cannot submit a bill (that is a Vendor action) and cannot create an inspection (that is an Inspector action). Oversight must not be able to manufacture the evidence it oversees. |
| ADM-02 | Milestone weightages must total 100 at work-order creation — validated, not assumed. |
| ADM-03 | Admins can pay and approve bills, so a single admin account *can* bypass separation of duties. This is intentional for a break-glass path and is why the audit log matters. |

---

### 6.7 Shared behaviour (all roles)

| Action | Endpoint | Notes |
|---|---|---|
| Log in | `POST /auth/login` | The **only** anonymous endpoint in the system |
| Change own password | `POST /auth/change-password` | Requires the current password, so a borrowed session cannot lock the owner out |
| Upload a file | `POST /files/upload` | Returns a URL; extension and size validated |
| Download a file | `GET /files/{name}` | **Requires authentication** — these are confidential contract documents |
| List alerts | `GET /alerts` | Scoped to the caller's role, vendor and user id |
| Mark alert read / read-all | `POST /alerts/{id}/read`, `POST /alerts/read-all` | Read state is per-user, so a broadcast can be read by one recipient and unread for another |

---

## 7. Security Requirements

### 7.1 Authentication

| ID | Requirement |
|---|---|
| SEC-01 | JWT bearer tokens, HMAC-SHA256, shared `Jwt:Key` across services. |
| SEC-02 | Signing key must be ≥32 chars; services **fail to start** otherwise. |
| SEC-03 | Production key supplied via `Jwt__Key` env var; base `appsettings.json` is intentionally blank. |
| SEC-04 | Passwords hashed, never stored plain. |
| SEC-05 | Every endpoint requires authentication except `POST /api/auth/login`. |

### 7.2 Authorisation

| ID | Requirement |
|---|---|
| SEC-06 | Role checks are enforced at the **service**, not the gateway. The gateway is routing only. |
| SEC-07 | Vendor-scoped endpoints filter by the `vendorId` **claim**, never a client-supplied parameter. |
| SEC-08 | Missing claim = **fail closed** (403), never "show everything". |
| SEC-09 | A vendor cannot bill against another vendor's work order — verified cross-service. |
| SEC-10 | An inspector can only modify visits and inspections they created. |
| SEC-11 | Separation of duties: approver ≠ payer ≠ claimant, enforced by role attributes. |

### 7.3 Data integrity

| ID | Requirement |
|---|---|
| SEC-12 | Submitted milestone packages and bills are immutable. |
| SEC-13 | State transitions are whitelisted; illegal jumps rejected with 400. |
| SEC-14 | A milestone can be claimed by only one live bill at a time. |
| SEC-15 | Bill numbers unique per vendor; payment vouchers unique globally. |
| SEC-16 | Ownership checks fail **closed** — if verification is impossible, the operation is refused. |
| SEC-17 | All state changes written to the central audit log (best-effort, non-blocking). |

---

## 8. Cross-Cutting Behaviour

### 8.1 Audit logging

Every significant state change posts to CommonService's audit sink: entity name, record id, action, change description, acting user (from the forwarded JWT), timestamp.

Audit logging is **best-effort and never blocks** the primary operation. If CommonService is down, the payment still goes through and the log entry is lost. This is deliberate.

### 8.2 Notifications

The bell icon shows **two kinds of notification merged into one feed**. The distinction is deliberate, because they answer different questions.

**Persisted alerts** — durable records in CommonService (`Alert` + `AlertRead`). These are *events*: something happened at a point in time and it still matters after the underlying record has moved on ("your bill was returned on the 12th"). They have real read/unread state.

**Derived signals** — computed client-side from live data on each load. These are *state*: always-current counts that have no meaningful "read" mark ("3 bills awaiting approval"). Marking that read would be nonsense; it is true until it isn't.

| Role | Derived signals |
|---|---|
| Admin/PMU/Dept/Finance | Overdue work orders, bills awaiting approval, milestones pending, open defects, open queries |
| Vendor | Returned/rejected bills, overdue work orders, query replies |
| Inspector | Pending progress reviews, scheduled visits, open defects |

Alerts are targeted four ways: **broadcast** (everyone), **by role**, **by vendor**, or **to one named user**. Read state lives in a separate `AlertRead` join row per user, so the same broadcast can be read by one recipient and still unread for another — a flag on the alert itself could not express that.

`POST /alerts` is open to Admin, PMU, Department, Finance and Inspector. Vendors can read alerts but cannot raise them.

### 8.3 Error handling

- API errors return plain-text messages that the UI surfaces directly.
- Cross-service joins **degrade gracefully** — a failed `/vendors` fetch shows "Unknown Vendor" rather than blanking the page.
- Every list endpoint returns `[]` rather than 404 when empty.

### 8.4 Responsive UI

Sidebar collapses to a drawer below 1024px; tables get horizontal scroll wrappers; the topbar title is route-driven.

---

## 9. Known Gaps and Limitations

Consolidated. These are real, verified, and worth knowing before planning further work.

### 9.1 Functional gaps

#### Closed since the first revision

| # | Was | Now |
|---|---|---|
| G-01 | No Alert entity | **Closed.** `Alert` + `AlertRead` in CommonService, `/api/alerts`, per-user read state. See 8.2. |
| G-02 | No Department field | **Closed — but unpopulated.** `DepartmentId` exists on Tender/WorkOrder/Project and cascades Tender → WorkOrder → Project. Every existing row is still `NULL`, so department filtering shows nothing until data is backfilled or new records are created through the UI. |
| G-03 | No partial payments | **Closed.** `BillPayment` rows, `Partially Paid` status, one voucher per instalment. See 5.6. |
| G-05 | No time-extension record | **Closed.** `TimeExtension` entity; approval moves `WorkOrder.EndDate`, which stops liquidated damages accruing. |
| G-06 | No password reset | **Closed.** Admin-initiated reset issues a one-time temporary password; self-service change requires the current password. |
| G-08 | `"Under Review"` unreachable | **Closed.** `POST /bills/{id}/start-review` sets it. |

#### Still open

| # | Gap | Impact |
|---|---|---|
| G-04 | **No defects-liability-period tracking** | Retention release is a manual judgement call with no date to gate it |
| G-07 | **Severity is decorative** | Does not affect ordering, escalation, or deadlines |
| G-09 | **No delete endpoint for bills or inspections** | Test/erroneous records need direct DB edits |
| G-10 | **Tax master is empty by default** | Bill submission falls back to a hardcoded 18% |
| G-11 | **`Project.Progress` has no writer** | The column exists but nothing assigns it, so it is 0 forever. The UI derives physical completion from the weighted sum of completed milestones instead. |
| G-12 | **`ContractDocument` is vendor-scoped only** | It carries a `VendorId` and nothing else, so a per-project document view can only show the vendor's whole repository, not that project's papers |
| G-13 | **No user edit/delete endpoints** | Internal users can be created and password-reset, but not amended or removed |
| G-14 | **One pre-existing dangling reference** | Bill `RA-2026-001` (₹500,000, Paid) points at a work order that does not exist. Predates the SQL Server migration; carried across unchanged rather than silently deleted. Separate databases mean no FK catches it. |

### 9.2 Technical traps

| # | Trap | Why it matters |
|---|---|---|
| T-01 | **`.sln` excludes all 7 services** | `dotnet build` on the solution reports success without compiling any service. Build each `.csproj`. |
| T-02 | **`npx tsc --noEmit` checks nothing** | Root `tsconfig.json` is `{"files": [], "references": [...]}`. Use `npx tsc -b` or `npm run build`. |
| T-03 | **`dotnet run` without `--no-launch-profile` binds the wrong port** | Service starts but the gateway can't reach it |
| T-04 | **Gateway needs an explicit route per master endpoint** | New `/api/masters/*` endpoints 404 through the gateway until a route is added |
| T-05 | ~~**SQLite cannot `SUM()` a decimal column**~~ | Resolved by the SQL Server migration — `SumAsync` now translates. The existing materialise-then-sum code is still correct, just no longer required. |
| T-06 | **EF navigation back-references cause JSON cycles** | Any child entity pointing back at its parent needs `[JsonIgnore]` |
| T-07 | **InspectorId means different things** | Profile id in Visits/WorkOrders, login user id in Inspections. Mixing them = FK crash. |
| T-08 | **Test suite uses the InMemory provider** | It ignores foreign keys, so FK-violating writes "pass". FK-sensitive tests use a real in-memory SQLite engine instead — which is why `PostTenderSystem.Tests` still references the Sqlite package even though no service does. |
| T-09 | **Services hold a lock on their own .exe** | Stop the service before rebuilding, or the build fails with MSB3021 |

### 9.3 Verification status

| Area | Status |
|---|---|
| Backend unit/integration tests | Verified — **136/136** passing |
| Inspector flow (API) | Verified — 35/35 automated checks |
| Billing flow (API) | Verified — 44/45 (1 environmental skip) |
| Retention / advance / deductions / LD (API) | Verified — 22/22 |
| Alerts, incl. per-user read state (API) | Verified — 24/24 |
| Partial payments (API) | Verified — 30/30 |
| Gateway route coverage | Verified by a reflection test that fails if any controller lacks a gateway route |
| Frontend build | `tsc -b` + `vite build` clean |
| Lint | ESLint clean on `src/` |
| SQL Server migration script | Executed end-to-end against a real SQL Server 2022 instance: 121 batches, 0 errors, 374 rows, idempotent on re-run |
| **Live staging deployment** | **Not done.** The migration has not been applied to `PostTender_Staging`; services are stopped and pointed at it but have not been started. |
| **Billing UI screens** | **Not verified in a browser.** Code compiles and the APIs are proven; the screens themselves have not been rendered and clicked through. |

---

## 10. Appendix: Complete API Reference

All routes are behind the gateway at `http://localhost:5249`.

> Generated from the controllers themselves, not written by hand — every row below
> corresponds to a real `[Http*]` attribute. **114 endpoints across 27 controllers.**
> `POST /api/auth/login` is the only anonymous endpoint in the system.

### Identity (5001) — 9 endpoints

| Method | Route | Roles |
|---|---|---|
| POST | `/api/auth/login` | **anonymous** (the only one) |
| POST | `/api/auth/register` | Admin, PMU |
| GET | `/api/auth/users` | Admin, PMU |
| POST | `/api/auth/change-password` | any authenticated |
| POST | `/api/auth/users/{id}/reset-password` | Admin, PMU |
| GET | `/api/masters/departments` | any authenticated |
| POST | `/api/masters/departments` | Admin, PMU |
| PUT | `/api/masters/departments/{id}` | Admin, PMU |
| DELETE | `/api/masters/departments/{id}` | Admin, PMU |

### Vendor (5002) — 7 endpoints

| Method | Route | Roles |
|---|---|---|
| GET | `/api/vendorcategories` | any authenticated |
| POST | `/api/vendorcategories` | Admin, PMU |
| DELETE | `/api/vendorcategories/{id}` | Admin, PMU |
| GET | `/api/vendors` | any authenticated |
| POST | `/api/vendors` | Admin, PMU |
| PATCH | `/api/vendors/{id}/status` | Admin, PMU |
| DELETE | `/api/vendors/{id}` | Admin, PMU |

### Tender (5003) — 22 endpoints

| Method | Route | Roles |
|---|---|---|
| GET | `/api/projects` | any authenticated |
| GET | `/api/projects/{id}` | any authenticated |
| GET | `/api/tenderallotments` | any authenticated |
| POST | `/api/tenderallotments` | Admin, PMU |
| GET | `/api/tendertypes` | any authenticated |
| POST | `/api/tendertypes` | Admin, PMU |
| PUT | `/api/tendertypes/{id}` | Admin, PMU |
| DELETE | `/api/tendertypes/{id}` | Admin, PMU |
| GET | `/api/tenders/awarded` | Admin, PMU, Department |
| GET | `/api/tenders` | Admin, PMU, Department, Inspector, Finance |
| POST | `/api/tenders` | Admin, PMU |
| PUT | `/api/tenders/{id}` | Admin, PMU |
| DELETE | `/api/tenders/{id}` | Admin, PMU |
| GET | `/api/timeextensions` | any authenticated |
| POST | `/api/timeextensions` | **Vendor only** |
| POST | `/api/timeextensions/{id}/approve` | Admin, PMU, Department |
| POST | `/api/timeextensions/{id}/reject` | Admin, PMU, Department |
| GET | `/api/workorders` | any authenticated |
| GET | `/api/workorders/{id}` | any authenticated |
| POST | `/api/workorders` | Admin, PMU |
| PUT | `/api/workorders/{id}/status` | any authenticated |
| PUT | `/api/workorders/{id}/approve` | Admin, PMU |

### Execution (5004) — 27 endpoints

| Method | Route | Roles |
|---|---|---|
| GET | `/api/execution/milestones` | any authenticated |
| POST | `/api/execution/milestones` | Admin, PMU |
| GET | `/api/execution/milestones/pending` | Admin, PMU, Department, Inspector |
| POST | `/api/execution/milestones/{id}/approve` | Admin, PMU, Department |
| POST | `/api/execution/milestones/{id}/return` | Admin, PMU, Department |
| GET | `/api/milestonesubmissions/milestone/{milestoneId}` | any authenticated |
| POST | `/api/milestonesubmissions` | **Vendor only** |
| PUT | `/api/milestonesubmissions/{id}` | **Vendor only** |
| POST | `/api/milestonesubmissions/{id}/submit` | **Vendor only** |
| POST | `/api/milestonesubmissions/{id}/documents` | **Vendor only** |
| DELETE | `/api/milestonesubmissions/{id}/documents/{docId}` | **Vendor only** |
| GET | `/api/masters/milestonetemplates` | any authenticated |
| POST | `/api/masters/milestonetemplates` | Admin, PMU |
| PUT | `/api/masters/milestonetemplates/{id}` | Admin, PMU |
| DELETE | `/api/masters/milestonetemplates/{id}` | Admin, PMU |
| GET | `/api/progressreports` | any authenticated |
| POST | `/api/progressreports` | **Vendor only** |
| GET | `/api/progressreports/pending-review` | any authenticated |
| GET | `/api/progressreports/my` | **Vendor only** |
| GET | `/api/progressreports/project/{projectId}` | any authenticated |
| GET | `/api/progressreports/{id}` | any authenticated |
| POST | `/api/progressreports/{id}/review` | **Inspector only** |
| POST | `/api/progressreports/{id}/approve` | Department, Admin, PMU |
| POST | `/api/progressreports/{id}/query` | Department, Admin, PMU |
| GET | `/api/queries` | any authenticated |
| POST | `/api/queries` | **Vendor only** |
| POST | `/api/queries/{id}/message` | any authenticated |

### Inspection (5005) — 17 endpoints

| Method | Route | Roles |
|---|---|---|
| GET | `/api/masters/defectcategories` | any authenticated |
| POST | `/api/masters/defectcategories` | Admin, PMU |
| PUT | `/api/masters/defectcategories/{id}` | Admin, PMU |
| DELETE | `/api/masters/defectcategories/{id}` | Admin, PMU |
| GET | `/api/inspectionvisits` | Inspector, Admin, PMU |
| GET | `/api/inspectionvisits/vendor` | **Vendor only** |
| POST | `/api/inspectionvisits/backfill-vendor` | Admin, PMU |
| POST | `/api/inspectionvisits` | **Inspector only** |
| PUT | `/api/inspectionvisits/{id}/status` | Inspector, Admin, PMU |
| GET | `/api/inspections` | Admin, PMU, Department, Finance, Inspector |
| GET | `/api/inspections/vendor` | **Vendor only** |
| GET | `/api/inspections/inspector` | Inspector, Admin, PMU |
| POST | `/api/inspections` | **Inspector only** |
| PUT | `/api/inspections/defect/{defectId}/verify` | Inspector, Admin, PMU |
| PUT | `/api/inspections/defect/{defectId}/rectify` | **Vendor only** |
| GET | `/api/inspectors` | any authenticated |
| POST | `/api/inspectors` | Admin, PMU |

### Financial (5006) — 16 endpoints

| Method | Route | Roles |
|---|---|---|
| GET | `/api/masters/billingpolicy` | any authenticated |
| PUT | `/api/masters/billingpolicy` | Admin, PMU |
| GET | `/api/bills` | any authenticated |
| POST | `/api/bills` | **Vendor only** |
| POST | `/api/bills/{id}/start-review` | Department, Admin, PMU |
| POST | `/api/bills/{id}/approve` | Department, Admin, PMU |
| POST | `/api/bills/{id}/query` | Department, Admin, PMU |
| POST | `/api/bills/{id}/pay` | Finance, Admin, PMU |
| POST | `/api/bills/{id}/reject` | Finance, Admin, PMU |
| POST | `/api/bills/{id}/deductions` | Department, Finance, Admin, PMU |
| DELETE | `/api/bills/{id}/deductions/{deductionId}` | Department, Finance, Admin, PMU |
| POST | `/api/bills/{id}/release-retention` | Finance, Admin, PMU |
| GET | `/api/masters/taxconfigurations` | any authenticated |
| POST | `/api/masters/taxconfigurations` | Admin, PMU |
| PUT | `/api/masters/taxconfigurations/{id}` | Admin, PMU |
| DELETE | `/api/masters/taxconfigurations/{id}` | Admin, PMU |

### Common (5007) — 16 endpoints

| Method | Route | Roles |
|---|---|---|
| GET | `/api/alerts` | any authenticated |
| POST | `/api/alerts` | Admin, PMU, Department, Finance, Inspector |
| POST | `/api/alerts/{id}/read` | any authenticated |
| POST | `/api/alerts/read-all` | any authenticated |
| GET | `/api/auditlogs` | any authenticated |
| POST | `/api/auditlogs` | any authenticated |
| GET | `/api/documents` | any authenticated |
| POST | `/api/documents` | **Vendor only** |
| DELETE | `/api/documents/{id}` | **Vendor only** |
| POST | `/api/files/upload` | any authenticated |
| GET | `/api/files/{name}` | any authenticated |
| DELETE | `/api/files` | any authenticated |
| GET | `/api/masters/locations` | any authenticated |
| POST | `/api/masters/locations` | Admin, PMU |
| PUT | `/api/masters/locations/{id}` | Admin, PMU |
| DELETE | `/api/masters/locations/{id}` | Admin, PMU |

---

### Seeded accounts (development only)

| Role | Email | Password |
|---|---|---|
| Admin | admin@posttender.local | Admin@123 |
| Vendor | vendor@posttender.local | Vendor@123 |
| Inspector | inspector@posttender.local | Inspector@123 |
| Department | department@posttender.local | Department@123 |
| Finance | finance@posttender.local | Finance@123 |

*These are development credentials committed to the repository. They must not exist in a production deployment.*

---

*End of document.*
