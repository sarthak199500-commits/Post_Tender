# Software Requirements Specification
## Post Tender Management System (PTMS)

| | |
|---|---|
| **Document version** | 1.0 |
| **Date** | 30 July 2026 |
| **Status** | Reflects the system as currently implemented |
| **Applies to** | `E:\Projects\Innovador\Post trender_1.2\Post trender` |

---

### About this document

This SRS describes what the Post Tender Management System **actually does today**, derived by reading the source rather than from a prior design document. Where the code and the original intent differ, the code wins and the gap is noted.

Sections marked **⚠ Gap** describe things that are missing, incomplete, or behave differently than a reader would reasonably expect. They are included deliberately — a specification that hides its gaps is not useful for planning.

**How to read it:**
- §1–3 — what the system is, who uses it, how it is built
- §4 — the data model (what is stored)
- §5 — **the flows** (the core of this document)
- §6 — module-by-module requirements
- §7 — security rules
- §8 — cross-cutting behaviour
- §9 — known gaps, consolidated

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
                  ┌──────────────► Returned ──────┐
                  │  (query/reject)               │ (vendor resubmits
                  │                               │  as a NEW bill)
   Submitted ─────┼──────────────► Approved ──────┴──► [new Submitted bill]
                  │                    │
                  │                    ▼
                  └───────────────►  Paid  ────► retention released
                                    (TERMINAL)
```

**Enforced:**
| Rule | Behaviour |
|---|---|
| Only `Submitted` can be approved | Approving a `Returned` bill → 400 |
| Only `Approved` can be paid | Paying a `Submitted` bill → 400 |
| `Paid` is terminal | Re-approve / re-pay / reject / query all → 400 |
| A `Returned` bill releases its milestones | Vendor can resubmit them on a new bill |

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

**Screens:** Dashboard, Work Orders, Bill Submission, Inspections & Defects, Progress Reporting, Progress History, Milestone Updates, Document Uploads, Queries & Clarifications.

| Requirement | Detail |
|---|---|
| VEN-01 | Vendor sees only their own data. All lists are scoped by the `vendorId` claim server-side. |
| VEN-02 | Vendor accepts a work order, which auto-creates the project. |
| VEN-03 | Vendor submits geo-tagged progress reports with photo evidence. |
| VEN-04 | Vendor assembles a milestone submission with documents, then submits it (becomes immutable). |
| VEN-05 | Vendor bills only against milestones that are `Completed` — enforced server-side. |
| VEN-06 | Vendor sees a live preview of retention and advance recovery before submitting a claim. |
| VEN-07 | Vendor requests a mobilisation advance, capped by policy. |
| VEN-08 | Vendor sees scheduled inspection visits, with past-due ones flagged "Awaiting Visit". |
| VEN-09 | Vendor rectifies defects by uploading evidence and notes. |
| VEN-10 | Vendor raises query threads with PMU. |

### 6.3 Inspector module

**Screens:** Dashboard, Work Orders, Audit Visits, Progress Review, Quality Defects.

| Requirement | Detail |
|---|---|
| INS-01 | Inspector sees only work orders assigned to them (`InspectorId` = their **profile** id). |
| INS-02 | Inspector schedules visits; must supply the vendorId so the vendor can see it. |
| INS-03 | Inspector logs an inspection with multiple defects in one submission. |
| INS-04 | Inspector reviews progress reports with an Accept/Reject recommendation — this **gates** department approval. |
| INS-05 | Inspector verifies or rejects defect rectifications. |
| INS-06 | Inspector can only close out visits they personally booked. |
| INS-07 | Inspector **cannot** approve milestones or touch anything financial. |

### 6.4 Department module

**Screen:** Department Dashboard (single consolidated screen).

| Requirement | Detail |
|---|---|
| DEP-01 | Approve or query progress reports — only after inspector review. |
| DEP-02 | Approve or return bills, with a reason on return. |
| DEP-03 | Add/remove deductions on a bill before payment. |
| DEP-04 | Approve milestone submissions. |
| DEP-05 | **Cannot** pay a bill (403). |

### 6.5 Finance module

**Screen:** Financial Dashboard.

| Requirement | Detail |
|---|---|
| FIN-01 | See KPIs: total budget, funds released, pending approval value, returned bills. |
| FIN-02 | Release funds only on department-approved bills. |
| FIN-03 | See the full breakdown — claimed, withheld, net payable — before paying. |
| FIN-04 | Reject an approved bill back to the vendor. |
| FIN-05 | Release retention on a paid bill, once. |
| FIN-06 | **Cannot** approve a bill (403). |

### 6.6 Admin / PMU module

**Screens:** Dashboard, Tenders, Awarded Tenders, Projects, Work Orders, Billing, Payments, Vendors, Inspectors, Users, Documents, Alerts, Queries, Reports, Audit Logs, Settings, and eight master-data screens.

| Requirement | Detail |
|---|---|
| ADM-01 | Full CRUD on all master data. |
| ADM-02 | Create users; there is no self-registration. |
| ADM-03 | Create tenders, work orders, milestones. |
| ADM-04 | Oversight on every module — Admin/PMU permissions are a superset of all others *except* they cannot create bills or inspections (those are Vendor/Inspector actions). |
| ADM-05 | Set the billing policy (retention %, advance cap, recovery %). |
| ADM-06 | View the full audit trail. |

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

The bell icon shows a **derived** feed, computed client-side per role:

| Role | Sees |
|---|---|
| Admin/PMU/Dept/Finance | Overdue work orders, bills awaiting approval, milestones pending, open defects, open queries |
| Vendor | Returned/rejected bills, overdue work orders, query replies |
| Inspector | Pending progress reviews, scheduled visits, open defects |

**⚠ Gap — there is no Alert entity.** Notifications are computed on every page load by fetching and filtering live data. Nothing is persisted, so there is no read/unread state, no notification history, and no push. The "Raise Alert" admin screen does not create a durable record.

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

| # | Gap | Impact |
|---|---|---|
| G-01 | **No Alert entity** — notifications are derived client-side | No read/unread, no history, no push |
| G-02 | **No Department field** on Tender/WorkOrder/Project | Cannot filter or report by department, despite a Departments master existing |
| G-03 | **No partial payments** — a bill is paid in full or not at all | Cannot split a payment across instalments |
| G-04 | **No defects-liability-period tracking** | Retention release is a manual judgement call with no date to gate it |
| G-05 | **No time-extension record** | The LD deduction can only flag lateness; someone must manually remove it if an extension was granted |
| G-06 | **No password reset** | Admin must reset manually |
| G-07 | **Severity is decorative** | Does not affect ordering, escalation, or deadlines |
| G-08 | **`"Under Review"` bill status is unreachable** | No code path sets it; it exists only in the entity comment |
| G-09 | **No delete endpoint for bills or inspections** | Test/erroneous records need direct DB edits |
| G-10 | **Tax master is empty by default** | Bill submission falls back to a hardcoded 18% |

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
| Inspector flow (API) | Verified — 35/35 automated checks |
| Billing flow (API) | Verified — 44/45 (1 environmental skip) |
| Retention / advance / deductions / LD (API) | Verified — 22/22 |
| Frontend build | `tsc -b` + `vite build` clean |
| Lint | ESLint clean on `src/` |
| **Billing UI screens** | **Not verified in a browser.** Code compiles; screens have not been rendered and clicked through. |

---

## 10. Appendix: Complete API Reference

All routes are behind the gateway at `http://localhost:5249`.

### Identity (5001)
| Method | Route | Roles |
|---|---|---|
| POST | `/api/auth/login` | **anonymous** |
| POST | `/api/auth/register` | Admin, PMU |
| GET | `/api/auth/users` | Admin, PMU |
| GET/POST/PUT/DELETE | `/api/masters/departments` | any / Admin, PMU |

### Vendor (5002)
| Method | Route | Roles |
|---|---|---|
| GET | `/api/vendors` | any authenticated |
| POST/PUT/DELETE | `/api/vendors` | Admin, PMU |
| GET/POST/DELETE | `/api/vendorcategories` | any / Admin, PMU |

### Tender (5003)
| Method | Route | Roles |
|---|---|---|
| GET | `/api/tenders` | Admin, PMU, Department, Inspector, Finance |
| GET | `/api/tenders/awarded` | Admin, PMU, Department |
| POST/PUT/DELETE | `/api/tenders` | Admin, PMU |
| GET | `/api/workorders`, `/api/workorders/{id}` | any authenticated |
| POST | `/api/workorders` | Admin, PMU |
| PUT | `/api/workorders/{id}/status` | role-checked per transition |
| PUT | `/api/workorders/{id}/approve` | Admin, PMU |
| GET | `/api/projects`, `/api/projects/{id}` | any authenticated |
| GET/POST | `/api/tenderallotments` | any / Admin, PMU |
| GET/POST/PUT/DELETE | `/api/tendertypes` | any / Admin, PMU |

### Execution (5004)
| Method | Route | Roles |
|---|---|---|
| GET | `/api/execution/milestones` | any authenticated |
| POST | `/api/execution/milestones` | Admin, PMU |
| GET | `/api/execution/milestones/pending` | Admin, PMU, Department, Inspector |
| POST | `/api/execution/milestones/{id}/approve` | Admin, PMU, Department |
| POST | `/api/execution/milestones/{id}/return` | Admin, PMU, Department |
| GET | `/api/milestonesubmissions/milestone/{id}` | any authenticated |
| POST/PUT | `/api/milestonesubmissions` | Vendor |
| POST | `/api/milestonesubmissions/{id}/submit` | Vendor |
| POST/DELETE | `/api/milestonesubmissions/{id}/documents` | Vendor |
| GET | `/api/progressreports`, `/{id}`, `/project/{id}` | any authenticated |
| GET | `/api/progressreports/my` | Vendor |
| POST | `/api/progressreports` | Vendor |
| GET | `/api/progressreports/pending-review` | any authenticated |
| POST | `/api/progressreports/{id}/review` | **Inspector only** |
| POST | `/api/progressreports/{id}/approve` | Department, Admin, PMU |
| POST | `/api/progressreports/{id}/query` | Department, Admin, PMU |
| GET | `/api/queries` | any (vendor-scoped) |
| POST | `/api/queries` | Vendor |
| POST | `/api/queries/{id}/message` | any authenticated |
| GET/POST/PUT/DELETE | `/api/masters/milestonetemplates` | any / Admin, PMU |

### Inspection (5005)
| Method | Route | Roles |
|---|---|---|
| GET | `/api/inspections` | Admin, PMU, Department, Finance, Inspector |
| GET | `/api/inspections/vendor` | Vendor |
| GET | `/api/inspections/inspector` | Inspector, Admin, PMU |
| POST | `/api/inspections` | **Inspector only** |
| PUT | `/api/inspections/defect/{id}/verify` | Inspector, Admin, PMU |
| PUT | `/api/inspections/defect/{id}/rectify` | **Vendor only** |
| GET | `/api/inspectionvisits` | Inspector, Admin, PMU |
| GET | `/api/inspectionvisits/vendor` | Vendor |
| POST | `/api/inspectionvisits` | Inspector |
| PUT | `/api/inspectionvisits/{id}/status` | Inspector (own), Admin, PMU |
| POST | `/api/inspectionvisits/backfill-vendor` | Admin, PMU |
| GET/POST | `/api/inspectors` | any / Admin, PMU |
| GET/POST/PUT/DELETE | `/api/masters/defectcategories` | any / Admin, PMU |

### Financial (5006)
| Method | Route | Roles |
|---|---|---|
| GET | `/api/bills` | any (vendor-scoped) |
| POST | `/api/bills` | **Vendor only** |
| POST | `/api/bills/{id}/approve` | Department, Admin, PMU |
| POST | `/api/bills/{id}/query` | Department, Admin, PMU |
| POST | `/api/bills/{id}/pay` | **Finance, Admin, PMU** |
| POST | `/api/bills/{id}/reject` | Finance, Admin, PMU |
| POST | `/api/bills/{id}/deductions` | Department, Finance, Admin, PMU |
| DELETE | `/api/bills/{id}/deductions/{deductionId}` | Department, Finance, Admin, PMU |
| POST | `/api/bills/{id}/release-retention` | Finance, Admin, PMU |
| GET/PUT | `/api/masters/billingpolicy` | any / Admin, PMU |
| GET/POST/PUT/DELETE | `/api/masters/taxconfigurations` | any / Admin, PMU |

### Common (5007)
| Method | Route | Roles |
|---|---|---|
| GET/POST | `/api/auditlogs` | any authenticated |
| GET | `/api/documents` | any authenticated |
| POST/DELETE | `/api/documents` | Vendor |
| POST | `/api/files/upload` | any authenticated |
| GET | `/api/files/{name}` | any authenticated (**not public**) |
| GET/POST/PUT/DELETE | `/api/masters/locations` | any / Admin, PMU |

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
