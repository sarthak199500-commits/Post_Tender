import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * Real transaction-chain end-to-end test.
 *
 * The previous "E2E suite" (example.spec.ts / usability-compatibility.spec.ts) only asserted
 * page titles and accessibility — it reported all-green against a product where no role could
 * complete a single transaction, because it never exercised a transaction. This walks the
 * whole post-tender lifecycle through the real API gateway and asserts on DATA at every step:
 *
 *   Admin creates a tender
 *     -> issues a work order + milestone
 *     -> approves the work order
 *   Vendor accepts it (a Project is created)
 *     -> submits a progress report
 *   Inspector reviews the report            (approval is gated on this)
 *   Department approves the report
 *   Vendor submits the milestone package    -> Department approves it (milestone -> Completed)
 *   Vendor raises an RA bill
 *   Department approves the bill
 *   Finance pays it                          -> Paid + payment voucher
 *
 * This is API-level (uses Playwright's `request` fixture, no browser is launched), so run it
 * against the running gateway with a single project, e.g.:
 *
 *   npx playwright test tests/e2e-vendor-chain.spec.ts --project=chromium
 *
 * Prerequisite: all backend services + the gateway are up (see run-all.ps1). Override the
 * gateway with PTMS_GATEWAY if it isn't on :5249.
 */

const GATEWAY = process.env.PTMS_GATEWAY ?? 'http://localhost:5249';
const VENDOR_ID = 'a0000000-0000-0000-0000-000000000001';

const CREDS = {
  admin:      { email: 'admin@posttender.local',      password: 'Admin@123' },
  vendor:     { email: 'vendor@posttender.local',     password: 'Vendor@123' },
  inspector:  { email: 'inspector@posttender.local',  password: 'Inspector@123' },
  department: { email: 'department@posttender.local', password: 'Department@123' },
  finance:    { email: 'finance@posttender.local',    password: 'Finance@123' },
};

type Tokens = Record<keyof typeof CREDS, string>;

async function login(api: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await api.post(`${GATEWAY}/api/auth/login`, { data: { email, password } });
  expect(res.ok(), `login ${email} (${res.status()})`).toBeTruthy();
  return (await res.json()).token;
}

async function loginAll(api: APIRequestContext): Promise<Tokens> {
  const entries = await Promise.all(
    (Object.keys(CREDS) as (keyof typeof CREDS)[]).map(
      async (role) => [role, await login(api, CREDS[role].email, CREDS[role].password)] as const,
    ),
  );
  return Object.fromEntries(entries) as Tokens;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Drives the chain up to a submitted progress report and returns the ids the later steps need.
 * Shared by the happy-path test and the review-gate test.
 */
async function buildToSubmittedReport(api: APIRequestContext, t: Tokens, stamp: number) {
  // 1. Admin creates a tender (AddTender is [FromForm]).
  const tenderRes = await api.post(`${GATEWAY}/api/tenders`, {
    headers: bearer(t.admin),
    multipart: {
      TenderNo: `E2E-TEN-${stamp}`,
      Title: 'E2E Road Resurfacing',
      TenderType: 'Works',
      Budget: '5000000',
      EMDAmount: '50000',
    },
  });
  expect(tenderRes.ok(), `create tender (${tenderRes.status()})`).toBeTruthy();
  const tender = await tenderRes.json();
  expect(tender.id).toBeTruthy();

  // 2. Admin issues a work order on that tender.
  const woRes = await api.post(`${GATEWAY}/api/workorders`, {
    headers: bearer(t.admin),
    data: {
      vendorId: VENDOR_ID,
      tenderId: tender.id,
      workOrderNo: `E2E-WO-${stamp}`,
      totalValue: 1_000_000,
      scopeDescription: 'Full resurfacing',
      paymentTerms: 'Net 30',
      startDate: '2026-08-01T00:00:00Z',
      endDate: '2026-12-31T00:00:00Z',
      milestones: [],
    },
  });
  expect(woRes.ok(), `create work order (${woRes.status()})`).toBeTruthy();
  const wo = await woRes.json();
  expect(wo.status).toBe('Draft');

  // 2b. Milestones live in ExecutionService and are created separately.
  const msRes = await api.post(`${GATEWAY}/api/execution/milestones`, {
    headers: bearer(t.admin),
    data: {
      workOrderId: wo.id,
      milestones: [
        { title: 'Base course', weightage: 100, paymentPercentage: 40, targetDate: '2026-10-01T00:00:00Z' },
      ],
    },
  });
  expect(msRes.ok(), `create milestone (${msRes.status()})`).toBeTruthy();
  const milestone = (await msRes.json())[0];
  expect(milestone.id).toBeTruthy();

  // 3. Admin approves the work order -> Pending Vendor Acceptance.
  const approveWo = await api.put(`${GATEWAY}/api/workorders/${wo.id}/approve`, { headers: bearer(t.admin) });
  expect(approveWo.ok(), `approve work order (${approveWo.status()})`).toBeTruthy();

  // 4. Vendor accepts -> Accepted (creates a Project).
  const accept = await api.put(`${GATEWAY}/api/workorders/${wo.id}/status`, {
    headers: bearer(t.vendor),
    data: { newStatus: 'Accepted' },
  });
  expect(accept.ok(), `vendor accept (${accept.status()})`).toBeTruthy();

  const projects = await (await api.get(`${GATEWAY}/api/projects`, { headers: bearer(t.vendor) })).json();
  const project = projects.find((p: any) => p.workOrderId === wo.id);
  expect(project, 'a Project was created on acceptance').toBeTruthy();

  // 5. Vendor submits a progress report.
  const reportRes = await api.post(`${GATEWAY}/api/progressreports`, {
    headers: bearer(t.vendor),
    data: { projectId: project.id, physicalPercentage: 45, workDescription: 'Base course laid', milestoneId: milestone.id },
  });
  expect(reportRes.ok(), `submit progress (${reportRes.status()})`).toBeTruthy();
  const report = await reportRes.json();
  expect(report.status).toBe('Submitted');

  return { wo, milestone, project, report };
}

test.describe('post-tender vendor transaction chain', () => {
  test('completes tender → work order → progress → review → approval → milestone → bill → payment', async ({ request: api }) => {
    const t = await loginAll(api);
    const stamp = Date.now();

    const { wo, milestone, project, report } = await buildToSubmittedReport(api, t, stamp);

    // 6. Inspector reviews the report (must precede department approval).
    const review = await api.post(`${GATEWAY}/api/progressreports/${report.id}/review`, {
      headers: bearer(t.inspector),
      data: { recommendation: 'Accept', remarks: 'Verified on site' },
    });
    expect(review.ok(), `inspector review (${review.status()})`).toBeTruthy();
    expect((await review.json()).status).toBe('Reviewed');

    // 7. Department approves the reviewed report.
    const approveReport = await api.post(`${GATEWAY}/api/progressreports/${report.id}/approve`, { headers: bearer(t.department) });
    expect(approveReport.ok(), `department approve report (${approveReport.status()})`).toBeTruthy();

    // 8. Vendor assembles + submits the milestone package; Department approves it.
    const sub = await api.post(`${GATEWAY}/api/milestonesubmissions`, {
      headers: bearer(t.vendor),
      data: { milestoneId: milestone.id, projectId: project.id, notes: 'Base course complete', linkedReportIds: [report.id] },
    });
    expect(sub.ok(), `create milestone submission (${sub.status()})`).toBeTruthy();
    const submission = await sub.json();

    const submit = await api.post(`${GATEWAY}/api/milestonesubmissions/${submission.id}/submit`, { headers: bearer(t.vendor) });
    expect(submit.ok(), `submit milestone (${submit.status()})`).toBeTruthy();
    expect((await submit.json()).isImmutable).toBe(true);

    const approveMilestone = await api.post(`${GATEWAY}/api/execution/milestones/${milestone.id}/approve`, { headers: bearer(t.department) });
    expect(approveMilestone.ok(), `approve milestone (${approveMilestone.status()})`).toBeTruthy();

    // The milestone must now be Completed — this is the gate the RA-bill flow checks.
    const milestonesAfter = await (await api.get(`${GATEWAY}/api/execution/milestones?workOrderId=${wo.id}`, { headers: bearer(t.vendor) })).json();
    expect(milestonesAfter.find((m: any) => m.id === milestone.id).status).toBe('Completed');

    // 9. Vendor raises an RA bill for the completed milestone (40% of ₹1,000,000).
    const amount = 1_000_000 * 0.4;
    const billRes = await api.post(`${GATEWAY}/api/bills`, {
      headers: bearer(t.vendor),
      data: { workOrderId: wo.id, billNo: `E2E-BILL-${stamp}`, type: 'RA', amount, taxAmount: amount * 0.18, attachmentUrl: '/uploads/invoice.pdf', milestoneIds: [milestone.id] },
    });
    expect(billRes.ok(), `submit bill (${billRes.status()})`).toBeTruthy();
    const bill = await billRes.json();
    expect(bill.status).toBe('Submitted');
    expect(bill.vendorId).toBe(VENDOR_ID); // claim-stamped

    // 10. Department approves the bill.
    const approveBill = await api.post(`${GATEWAY}/api/bills/${bill.id}/approve`, { headers: bearer(t.department) });
    expect(approveBill.ok(), `department approve bill (${approveBill.status()})`).toBeTruthy();

    // 11. Finance pays it -> Paid + voucher.
    const pay = await api.post(`${GATEWAY}/api/bills/${bill.id}/pay`, { headers: bearer(t.finance) });
    expect(pay.ok(), `finance pay (${pay.status()})`).toBeTruthy();
    expect((await pay.json()).voucherNo).toBeTruthy();

    // Final data assertion: the bill is Paid with a voucher number.
    const finalBills = await (await api.get(`${GATEWAY}/api/bills`, { headers: bearer(t.finance) })).json();
    const paid = finalBills.find((b: any) => b.id === bill.id);
    expect(paid.status).toBe('Paid');
    expect(paid.paymentVoucherNo).toBeTruthy();
  });

  test('a progress report cannot be approved by the department before an inspector reviews it', async ({ request: api }) => {
    const t = await loginAll(api);
    const stamp = Date.now();

    const { report } = await buildToSubmittedReport(api, t, stamp);

    // Department approval must be refused while the report is still merely Submitted.
    const premature = await api.post(`${GATEWAY}/api/progressreports/${report.id}/approve`, { headers: bearer(t.department) });
    expect(premature.ok(), 'approval before review should be rejected').toBeFalsy();
    expect(premature.status()).toBe(400);
  });
});
