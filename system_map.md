# Post-Tender Management System — Full System Map

## 🌐 Live App URL
**http://localhost:5173** (React app — your real system)

> The `admin-dashboard.html` at `/admin-dashboard.html` is a separate standalone visual mock, **NOT** your real app.

---

## 🔐 Login & Roles
**Login URL:** http://localhost:5173/login

| Role | Redirects To | Description |
|---|---|---|
| `Admin` / `PMU` | `/admin/dashboard` | Full admin access |
| `Vendor` | `/vendor/dashboard` | Vendor-only access |
| `Inspector` | `/inspector/dashboard` | Inspector-only access |

---

## ✅ Admin / PMU Flow — All Existing Pages

### Main Dashboard
| Page | URL | File |
|---|---|---|
| Admin Dashboard | `/admin/dashboard` | [AdminDashboard.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AdminDashboard.tsx) |

### Masters (Data Entry Forms — your "previous flow")
| Step | Page | URL | File |
|---|---|---|---|
| 1 | **Add Tender** | `/admin/masters/tenders/add` | [AddTender.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AddTender.tsx) |
| 2 | **Add Vendor** | `/admin/masters/vendors/add` | [AddVendor.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AddVendor.tsx) |
| 3 | **Allotted Tenders** (L1/L2/L3 selection) | `/admin/masters/allotted-tenders` | [AllottedTenders.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AllottedTenders.tsx) |
| 4 | **Issue Work Order** | `/admin/work-orders` → Issue | [IssueWorkOrder.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/IssueWorkOrder.tsx) |
| 5 | **Add Inspector** | `/admin/masters/inspectors/add` | [AddInspector.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AddInspector.tsx) |

### Management & Monitoring
| Page | URL | File |
|---|---|---|
| Tender Directory | `/admin/masters/tenders` | [TenderList.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/TenderList.tsx) |
| Tender Types Master | `/admin/masters/tender-types` | [TenderTypeMaster.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/TenderTypeMaster.tsx) |
| Vendor Categories | `/admin/masters/vendor-categories` | [AddVendorCategory.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AddVendorCategory.tsx) |
| Inspector List | `/admin/masters/inspectors` | [InspectorList.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/InspectorList.tsx) |
| Work Order Management | `/admin/work-orders` | [WorkOrderManagement.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/WorkOrderManagement.tsx) |
| Work Order Details | `/admin/work-orders/:id` | [WorkOrderDetails.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/WorkOrderDetails.tsx) |
| Awarded Tenders | `/admin/tenders/awarded` | [AwardedTenders.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AwardedTenders.tsx) |
| Project Monitoring | `/admin/projects` | [GlobalProjects.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/GlobalProjects.tsx) |
| Vendor Directory | `/vendors` | [VendorDirectory.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendors/VendorDirectory.tsx) |
| Reports & MIS | `/admin/reports` | [ReportsMIS.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/ReportsMIS.tsx) |
| Audit Logs | `/admin/audit-logs` | [AuditLogs.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Admin/AuditLogs.tsx) |

---

## ✅ Vendor Dashboard Flow — All Existing Pages

| Step | Page | URL | File |
|---|---|---|---|
| — | Vendor Dashboard | `/vendor/dashboard` | [VendorDashboard.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/VendorDashboard.tsx) |
| — | Assigned Work Orders | `/vendor/work-orders` | [VendorWorkOrderView.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/WorkOrders/VendorWorkOrderView.tsx) |
| 1 | Document Uploads | `/vendor/documents` | [DocumentUploads.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/DocumentUploads.tsx) |
| 2 | Progress Reporting | `/vendor/progress` | [ProgressReporting.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/ProgressReporting.tsx) |
| 3 | Milestone Updates | `/vendor/milestones` | [MilestoneUpdates.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/MilestoneUpdates.tsx) |
| 4 | Bill Submission | `/vendor/bills` | [BillingClaims.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/BillingClaims.tsx) |
| — | Queries & Clarifications | `/vendor/queries` | [QueriesClarifications.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/QueriesClarifications.tsx) |
| — | Inspection Observations | `/vendor/defects` | [QualityDefects.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Vendor/QualityDefects.tsx) |

---

## ✅ Inspector Dashboard Flow — All Existing Pages

| Step | Page | URL | File |
|---|---|---|---|
| — | Inspector Dashboard | `/inspector/dashboard` | [InspectorDashboard.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Inspector/InspectorDashboard.tsx) |
| — | Assigned Work Orders | `/inspector/work-orders` | [InspectorWorkOrders.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Inspector/InspectorWorkOrders.tsx) |
| — | Work Order Details | `/inspector/work-orders/:id` | [InspectorWorkOrderDetails.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Inspector/InspectorWorkOrderDetails.tsx) |
| 1 | Review Progress Reports | `/inspector/progress-review` | [ProgressReview.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Inspector/ProgressReview.tsx) |
| 2 | Review Report Detail | `/inspector/progress-review/:id` | [ReviewReportDetail.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Inspector/ReviewReportDetail.tsx) |
| 3 | Schedule Audit Visits | `/inspector/visits` | [InspectorVisits.tsx](file:///E:/Post%20tender%20cshtml/src/Frontend/src/pages/Inspector/InspectorVisits.tsx) |

---

## 🏛️ Urban Local Body Location Hierarchy (UP)

Locations are a self-referencing tree in CommonService (`Location.ParentLocationId` +
`LocationType` ∈ `Ulb` | `Zone` | `Ward`). The three UP tiers **do not share a shape**:

| Tier (`Location.UlbType`) | Scope | Shape |
|---|---|---|
| `NagarNigam` | metropolitan city (Mahanagar) | Ulb → **Zone** → Ward |
| `NagarPalikaParishad` | city | Ulb → Ward |
| `NagarPanchayat` | small town | Ulb → Ward |

Zones exist **only** under a Nagar Nigam, and a Nagar Nigam's wards must hang off a Zone —
never off the corporation. `LocationsController.Validate` enforces this; the Locations master
mirrors the same rules in its Parent dropdown so the UI cannot offer a rejected combination.

**Derive from data, not from type.** `LocationCascade` shows the Zone step only when the
selected ULB actually *has* Zone children, rather than branching on `UlbType`. A corporation
whose zone data has not been loaded yet correctly skips the step, and gains it the moment
zones exist — no code change. Same rule drives the Ward step.

| Page | URL | File |
|---|---|---|
| Locations Master (hierarchy-aware, level + search filter) | `/admin/masters/locations` | `src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx` |
| Ward Members Master (Sabhasad — reference data, no login) | `/admin/masters/ward-members` | `src/Frontend/src/pages/Admin/Masters/WardMemberMaster.tsx` |
| Cascading selector (reused by forms and filter bars) | — | `src/Frontend/src/components/LocationCascade.tsx` |

`UlbId` / `ZoneId` / `WardId` are denormalised onto **Tender, WorkOrder and Project** (like
`DepartmentId`) so list filters stay a single-table query. They cascade down the chain at
creation (`dto.X ?? parent.X`), and `PATCH /api/{tenders|workorders|projects}/{id}/location`
updates them on existing rows. All three list endpoints accept `ulbId`/`zoneId`/`wardId`.

### Seed scripts
- `npm run seed:locations` — 17 Nagar Nigams (83 zones, 1,370 wards) + 201 Nagar Palika
  Parishads, from `scripts/data/up-ulb.json`. **Convergent**, not merely idempotent: a row
  under the wrong parent is moved, which is how the wards were migrated under zones.
- `npm run backfill:locations` — assigns location to pre-existing tenders/work orders/
  projects and reconciles `ZoneId` from each row's ward. Supports `--dry-run`.

### Known data gaps
- Zone data is **published for 6 of 17** corporations (Agra, Ghaziabad, Varanasi by name;
  Lucknow 8, Kanpur 6, Prayagraj 8 by count). The other 11 are `zonesSource: "assumed"` at
  ~18 wards/zone.
- The **real ward→zone boundary is not published** machine-readably. Wards are assigned to
  zones in contiguous numeric blocks — deterministic and stable, but **synthetic**.
- Wards are numbered, not named; Nagar Palika Parishads have no wards seeded; the 541 Nagar
  Panchayats are not seeded at all.
- Backfill assignment onto demo tenders is a hash of the row id — not real-world accurate.

---

## ❌ Missing from Your Requirements (Not Yet Built)

| Module | Description |
|---|---|
| **Department Dashboard** | Receive reports from Inspector, Approve/Raise query, Proceed to release funds |
| **Financial Dashboard** | Generate bill, Release funds after approval, Payment records per tender |
| **Work Order Email** | Auto-send work order copy to vendor on assignment |
| **Department Role** | No `Department` user role defined in the auth system |
| **Financial Role** | No `Finance` user role defined in the auth system |

---

## 🔄 Full Workflow (End-to-End)

```
1. Admin: Add Tender        → /admin/masters/tenders/add
2. Admin: Add Vendor        → /admin/masters/vendors/add
3. Admin: Allot Tender      → /admin/masters/allotted-tenders  (L1/L2/L3)
4. Admin: Issue Work Order  → IssueWorkOrder (milestone, inspector assigned)
5. Vendor: Receives WO on Dashboard → /vendor/dashboard
6. Vendor: Upload Documents → /vendor/documents
7. Vendor: Submit Progress  → /vendor/progress
8. Vendor: Submit Invoice   → /vendor/bills
9. Inspector: Reviews Progress → /inspector/progress-review
10. Inspector: Schedules Visit → /inspector/visits
11. Inspector: Submits Remarks → /inspector/progress-review/:id
12. [MISSING] Department: Approves & requests fund release
13. [MISSING] Finance: Releases payment, records transaction
```
