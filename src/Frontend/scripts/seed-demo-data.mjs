/**
 * Seeds a realistic demo dataset through the real API gateway.
 *
 * The only project data in the system today comes from tests/e2e-vendor-chain.spec.ts,
 * which creates the bare minimum a transaction needs — one nameless milestone, no LD
 * terms, no inspector, no documents. That is fine for an assertion and useless for a
 * walkthrough: every detail page renders "Not specified" / "Unassigned" / empty tabs.
 *
 * This script drives the same lifecycle as that test but fills every field a reviewer
 * actually reads, and leaves records spread across their real states (a paid bill, an
 * approved-but-unpaid bill, one still awaiting approval; approved milestone packages
 * and one still under review; an overdue work order that trips the LD alert).
 *
 * Everything is created through the gateway as the role that is allowed to do it — no
 * direct database writes — so the data obeys the same workflow rules as production.
 *
 * Run with all backend services + the gateway up (see run-all.ps1):
 *
 *   npm run seed:demo
 *
 * Override the gateway with PTMS_GATEWAY if it is not on :5249. Re-running creates a
 * fresh set of projects with new numbers; it never edits or deletes existing records.
 */

const GATEWAY = process.env.PTMS_GATEWAY ?? 'http://localhost:5249';

const CREDS = {
  admin: { email: 'admin@posttender.local', password: 'Admin@123' },
  vendor: { email: 'vendor@posttender.local', password: 'Vendor@123' },
  inspector: { email: 'inspector@posttender.local', password: 'Inspector@123' },
  department: { email: 'department@posttender.local', password: 'Department@123' },
  finance: { email: 'finance@posttender.local', password: 'Finance@123' },
};

/** The demo vendor from IdentityService's seeder — the only vendor we can log in as. */
const VENDOR_ID = 'a0000000-0000-0000-0000-000000000001';

const tokens = {};

/* ── plumbing ──────────────────────────────────────────────────────────── */

const fail = (label, status, body) => {
  throw new Error(`${label} failed (HTTP ${status}): ${String(body).slice(0, 400)}`);
};

async function call(method, path, { as = 'admin', body, form } = {}) {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${tokens[as]}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  const text = await res.text();
  if (!res.ok) fail(`${method} ${path}`, res.status, text);
  return text ? JSON.parse(text) : null;
}

const get = (path, as) => call('GET', path, { as });
const post = (path, body, as) => call('POST', path, { body, as });
const put = (path, body, as) => call('PUT', path, { body, as });

async function login() {
  for (const [role, { email, password }] of Object.entries(CREDS)) {
    const res = await fetch(`${GATEWAY}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) fail(`login ${email}`, res.status, await res.text());
    tokens[role] = (await res.json()).token;
  }
}

/**
 * Uploads a small generated file so the download buttons on the detail pages resolve to
 * something real rather than a 404. Returns { url, name, size }.
 */
async function uploadFile(name, text, as = 'vendor') {
  const form = new FormData();
  form.append('file', new Blob([text], { type: 'text/plain' }), name);

  const data = await call('POST', '/api/files/upload', { as, form });
  const bytes = new TextEncoder().encode(text).length;
  // Report KB below a megabyte — these files are small, and "0.00 MB" reads as a bug.
  const size = bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return { url: data.url, name: data.name, size };
}

const iso = (d) => new Date(d).toISOString();
const inr = (n) => `₹${n.toLocaleString('en-IN')}`;

/* ── the demo dataset ──────────────────────────────────────────────────── */

const PROJECTS = [
  {
    key: 'arterial-road',
    tender: {
      no: 'DEMO-TEN-2601',
      title: 'Sector 14 Arterial Road Resurfacing (Phase II)',
      type: 'Works',
      budget: 90_000_000,
      emd: 900_000,
      portal: 'GeM',
      description:
        'Resurfacing of 6.4 km of arterial carriageway in Sector 14 including sub-grade ' +
        'correction, storm-water drainage repair, dense bituminous macadam and final wearing course.',
    },
    workOrder: {
      no: 'DEMO-WO-2601',
      totalValue: 82_500_000,
      start: '2026-03-02',
      end: '2026-11-30',
      scope: [
        'Milling of the existing bituminous surface across 6.4 km of the Sector 14 arterial carriageway.',
        'Sub-grade correction and reconstruction of the granular sub-base where CBR falls below 8%.',
        'Reconstruction of 1,850 m of kerb-side storm-water drain, including 42 gully gratings.',
        'Laying of 50 mm dense bituminous macadam followed by a 40 mm bituminous concrete wearing course.',
        'Thermoplastic road marking, cat-eye studs, and reinstatement of all signage to IRC:35 standards.',
      ].join('\n'),
      paymentTerms:
        'Running account bills against completed milestones. 90% released within 30 days of ' +
        'departmental certification; 10% retention released on expiry of the defect liability period. ' +
        'GST at 18% payable against a valid tax invoice.',
      ldTerms:
        'Liquidated damages at 0.5% of the contract value per completed week of delay, capped at ' +
        '10% of the contract value. Defect liability period of 24 months from the certified date of ' +
        'completion; rectification within 14 days of written notice, failing which the cost is ' +
        'recovered from the retention money.',
      overdue: false,
    },
    milestones: [
      { title: 'Site mobilisation & topographic survey', weightage: 15, paymentPercentage: 10, targetDate: '2026-04-15' },
      { title: 'Earthwork, sub-grade correction & drainage', weightage: 25, paymentPercentage: 25, targetDate: '2026-06-30' },
      { title: 'Dense bituminous macadam base course', weightage: 35, paymentPercentage: 35, targetDate: '2026-09-15' },
      { title: 'Wearing course, road marking & handover', weightage: 25, paymentPercentage: 30, targetDate: '2026-11-25' },
    ],
    reports: [
      {
        milestone: 0,
        physicalPercentage: 15,
        workDescription:
          'Site office and labour camp established at Ch. 0+250. Topographic survey completed for the ' +
          'full 6.4 km with levels recorded at 25 m intervals. Traffic diversion plan approved by the ' +
          'traffic police and barricading erected on the northbound carriageway.',
        review: { recommendation: 'Accept', remarks: 'Mobilisation verified on site. Barricading and signage conform to the approved traffic plan.' },
        approve: true,
      },
      {
        milestone: 1,
        physicalPercentage: 40,
        workDescription:
          'Sub-grade correction completed between Ch. 0+000 and Ch. 3+200. Granular sub-base laid and ' +
          'compacted to 98% MDD; field density tests recorded at 12 locations. Storm-water drain ' +
          'reconstructed for 940 m with 21 gully gratings reset.',
        review: { recommendation: 'Accept', remarks: 'Field density results within tolerance. Drain invert levels checked against drawing SD-14/07 and found correct.' },
        approve: true,
      },
      {
        milestone: 2,
        physicalPercentage: 62,
        workDescription:
          'DBM laying in progress from Ch. 0+000 to Ch. 2+400 on the northbound carriageway. Mix ' +
          'temperature at laying recorded between 145°C and 152°C. Core samples lifted at three ' +
          'chainages and sent to the approved laboratory.',
        review: { recommendation: 'Accept', remarks: 'Laying temperature and rolling pattern satisfactory. Core results awaited before recommending departmental approval.' },
        approve: false,
      },
    ],
    submissions: [
      {
        milestone: 0,
        notes:
          'Mobilisation milestone complete. Enclosing the survey report, the approved traffic ' +
          'diversion plan and photographs of the established site office and labour camp.',
        reports: [0],
        documents: [
          { name: 'Topographic-Survey-Report.txt', type: 'Test Report' },
          { name: 'Approved-Traffic-Diversion-Plan.txt', type: 'Other' },
        ],
        submit: true,
        approve: true,
      },
      {
        milestone: 1,
        notes:
          'Earthwork and drainage milestone complete for the northbound carriageway. Field density ' +
          'test results and the drainage completion certificate are attached.',
        reports: [1],
        documents: [
          { name: 'Field-Density-Test-Results.txt', type: 'Test Report' },
          { name: 'Drainage-Completion-Certificate.txt', type: 'Completion Certificate' },
          { name: 'Sub-Grade-CBR-Lab-Report.txt', type: 'Quality Certificate' },
        ],
        submit: true,
        approve: true,
      },
      {
        milestone: 2,
        notes:
          'Base course package submitted for inspection. Core sample results from the approved ' +
          'laboratory are attached; the remaining 4.0 km will be covered in the next package.',
        reports: [2],
        documents: [{ name: 'DBM-Core-Sample-Results.txt', type: 'Test Report' }],
        submit: true,
        approve: false,
      },
    ],
    bills: [
      { no: 'DEMO-BILL-2601-01', type: 'RA', percentage: 10, state: 'paid' },
      { no: 'DEMO-BILL-2601-02', type: 'RA', percentage: 25, state: 'approved' },
      { no: 'DEMO-BILL-2601-03', type: 'RA', percentage: 35, state: 'submitted' },
    ],
  },
  {
    key: 'storm-water-drain',
    tender: {
      no: 'DEMO-TEN-2602',
      title: 'Ward 7 Storm-Water Drain Rehabilitation',
      type: 'Works',
      budget: 25_000_000,
      emd: 250_000,
      portal: 'eProcurement',
      description:
        'Desilting, reconstruction and covering of 2.3 km of open storm-water drain across Ward 7, ' +
        'including 14 cross-drainage structures.',
    },
    workOrder: {
      no: 'DEMO-WO-2602',
      totalValue: 21_000_000,
      start: '2026-01-12',
      end: '2026-06-15',   // in the past — trips the LD alert on the monitoring page
      scope: [
        'Mechanical desilting and disposal of accumulated silt from 2.3 km of open drain in Ward 7.',
        'Reconstruction of collapsed drain walls in RCC M25 over a cumulative length of 620 m.',
        'Casting and placement of precast RCC covering slabs with lifting hooks at 3 m centres.',
        'Reconstruction of 14 cross-drainage structures at road crossings.',
      ].join('\n'),
      paymentTerms:
        'Running account bills on measured quantities certified by the site engineer. 95% released ' +
        'within 21 days of certification; 5% retention released after the monsoon performance test.',
      ldTerms:
        'Liquidated damages at 0.5% of the contract value per completed week of delay, capped at 10% ' +
        'of the contract value. The drain must remain functional throughout the monsoon; any blockage ' +
        'attributable to the works is rectified at the contractor\'s cost within 48 hours.',
      overdue: true,
    },
    milestones: [
      { title: 'Desilting & disposal', weightage: 30, paymentPercentage: 30, targetDate: '2026-03-01' },
      { title: 'Drain wall reconstruction', weightage: 45, paymentPercentage: 45, targetDate: '2026-05-10' },
      { title: 'Covering slabs & cross-drainage structures', weightage: 25, paymentPercentage: 25, targetDate: '2026-06-10' },
    ],
    reports: [
      {
        milestone: 0,
        physicalPercentage: 30,
        workDescription:
          'Desilting completed for the full 2.3 km. 1,240 cubic metres of silt removed and disposed ' +
          'at the designated municipal site; disposal challans enclosed with the milestone package.',
        review: { recommendation: 'Accept', remarks: 'Disposal challans tallied against measured quantities. Drain section clear along the full length.' },
        approve: true,
      },
      {
        milestone: 1,
        physicalPercentage: 48,
        workDescription:
          'Wall reconstruction in progress; 310 m of the 620 m completed. Progress slowed by ' +
          'unseasonal rainfall in the second week of May and by a utility conflict at Ch. 1+150 ' +
          'awaiting clearance from the water board.',
        review: null,      // still awaiting inspector review
        approve: false,
      },
    ],
    submissions: [
      {
        milestone: 0,
        notes:
          'Desilting milestone complete across the full length. Disposal challans and pre/post ' +
          'measurement sheets attached.',
        reports: [0],
        documents: [
          { name: 'Silt-Disposal-Challans.txt', type: 'Other' },
          { name: 'Desilting-Measurement-Sheet.txt', type: 'Completion Certificate' },
        ],
        submit: true,
        approve: true,
      },
    ],
    bills: [
      { no: 'DEMO-BILL-2602-01', type: 'RA', percentage: 30, state: 'paid' },
    ],
  },
];

/**
 * Tender, work-order and bill numbers must be unique — the API rejects duplicates — so a
 * run stamp is appended to the numbers declared above. Without it a second run fails on
 * "A tender numbered 'DEMO-TEN-2601' already exists."
 */
const RUN = Date.now().toString().slice(-6);
const stamped = (no) => `${no}-${RUN}`;

/** Vendor-repository documents — keyed to the vendor, not to any one project. */
const VENDOR_DOCUMENTS = [
  { name: 'GST-Registration-Certificate.txt', type: 'Compliance' },
  { name: 'Contractors-All-Risk-Insurance.txt', type: 'Financial' },
  { name: 'Site-Safety-Management-Plan.txt', type: 'Compliance' },
  { name: 'Labour-Licence-CLRA.txt', type: 'Compliance' },
  { name: 'ISO-9001-Quality-Certificate.txt', type: 'Compliance' },
];

const fileBody = (title, context) =>
  [
    `${title}`,
    '='.repeat(title.length),
    '',
    'DEMONSTRATION DOCUMENT — generated by scripts/seed-demo-data.mjs.',
    'This file exists so the download action on the portal resolves to real content.',
    '',
    context,
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n');

/* ── the lifecycle ─────────────────────────────────────────────────────── */

async function seedProject(spec, inspectorId) {
  const log = (msg) => console.log(`   ${msg}`);
  console.log(`\n▶ ${spec.tender.title}`);

  // Numbers carry the run stamp so a repeat run does not collide with existing records —
  // the API rejects duplicate tender, work-order and bill numbers.
  const tenderNo = stamped(spec.tender.no);
  const workOrderNo = stamped(spec.workOrder.no);

  // 1. Tender (multipart — AddTender is [FromForm]).
  const tenderForm = new FormData();
  tenderForm.append('TenderNo', tenderNo);
  tenderForm.append('Title', spec.tender.title);
  tenderForm.append('Description', spec.tender.description);
  tenderForm.append('TenderType', spec.tender.type);
  tenderForm.append('Budget', String(spec.tender.budget));
  tenderForm.append('EMDAmount', String(spec.tender.emd));
  tenderForm.append('Portal', spec.tender.portal);
  const tender = await call('POST', '/api/tenders', { as: 'admin', form: tenderForm });
  log(`tender ${tender.tenderNo} · ${inr(spec.tender.budget)}`);

  // 2. The signed agreement, so the Documents tab has a contract to open.
  const agreement = await uploadFile(
    `${workOrderNo}-Signed-Agreement.txt`,
    fileBody(`Work Order ${workOrderNo} — Signed Agreement`, spec.workOrder.scope),
    'admin',
  );

  // 3. Work order, with the terms and the inspector the detail page reads.
  const wo = await post('/api/workorders', {
    vendorId: VENDOR_ID,
    tenderId: tender.id,
    workOrderNo,
    totalValue: spec.workOrder.totalValue,
    scopeDescription: spec.workOrder.scope,
    paymentTerms: spec.workOrder.paymentTerms,
    liquidatedDamagesTerms: spec.workOrder.ldTerms,
    agreementDocumentUrl: agreement.url,
    inspectorId,
    startDate: iso(spec.workOrder.start),
    endDate: iso(spec.workOrder.end),
    milestones: [],
  }, 'admin');
  log(`work order ${wo.workOrderNo} · ${inr(spec.workOrder.totalValue)}${spec.workOrder.overdue ? ' (overdue — LD alert)' : ''}`);

  // 4. Milestones live in ExecutionService and are posted separately.
  const milestones = await post('/api/execution/milestones', {
    workOrderId: wo.id,
    milestones: spec.milestones.map(m => ({ ...m, targetDate: iso(m.targetDate) })),
  }, 'admin');
  log(`${milestones.length} milestones`);

  // 5. Approve, then the vendor accepts — which is what activates the Project.
  await put(`/api/workorders/${wo.id}/approve`, undefined, 'admin');
  await put(`/api/workorders/${wo.id}/status`, { newStatus: 'Accepted' }, 'vendor');

  const projects = await get('/api/projects', 'vendor');
  const project = projects.find(p => p.workOrderId === wo.id);
  if (!project) throw new Error(`no Project was activated for ${wo.workOrderNo}`);
  log(`project activated · ${project.id}`);

  // 6. Progress reports, each walked as far through the review chain as the spec says.
  const reports = [];
  for (const r of spec.reports) {
    const report = await post('/api/progressreports', {
      projectId: project.id,
      milestoneId: milestones[r.milestone].id,
      physicalPercentage: r.physicalPercentage,
      workDescription: r.workDescription,
    }, 'vendor');

    if (r.review) await post(`/api/progressreports/${report.id}/review`, r.review, 'inspector');
    if (r.approve) await post(`/api/progressreports/${report.id}/approve`, undefined, 'department');

    reports.push(report);
  }
  log(`${reports.length} progress reports (${spec.reports.filter(r => r.approve).length} approved)`);

  // 7. Milestone evidence packages, with real files attached.
  let approvedMilestones = 0;
  for (const s of spec.submissions) {
    const milestone = milestones[s.milestone];
    const submission = await post('/api/milestonesubmissions', {
      milestoneId: milestone.id,
      projectId: project.id,
      notes: s.notes,
      linkedReportIds: s.reports.map(i => reports[i].id),
    }, 'vendor');

    // Documents must be attached before submit — the package is immutable afterwards.
    for (const d of s.documents) {
      const file = await uploadFile(d.name, fileBody(d.name.replace(/\.txt$/, ''), `Milestone: ${milestone.title}\nWork order: ${spec.workOrder.no}`));
      await post(`/api/milestonesubmissions/${submission.id}/documents`, {
        name: d.name, type: d.type, url: file.url, size: file.size,
      }, 'vendor');
    }

    if (s.submit) await post(`/api/milestonesubmissions/${submission.id}/submit`, undefined, 'vendor');
    if (s.approve) {
      await post(`/api/execution/milestones/${milestone.id}/approve`, undefined, 'department');
      approvedMilestones++;
    }
  }
  log(`${spec.submissions.length} milestone packages (${approvedMilestones} approved)`);

  // 8. Bills, left spread across their real states.
  for (const b of spec.bills) {
    const amount = Math.round(spec.workOrder.totalValue * (b.percentage / 100));
    const invoice = await uploadFile(
      `${stamped(b.no)}-Tax-Invoice.txt`,
      fileBody(`Tax Invoice ${stamped(b.no)}`, `Work order: ${workOrderNo}\nAmount: ${inr(amount)}\nGST @ 18%: ${inr(Math.round(amount * 0.18))}`),
    );

    const bill = await post('/api/bills', {
      workOrderId: wo.id,
      billNo: stamped(b.no),
      type: b.type,
      amount,
      taxAmount: Math.round(amount * 0.18),
      attachmentUrl: invoice.url,
      milestoneIds: [],
    }, 'vendor');

    if (b.state === 'approved' || b.state === 'paid') {
      await post(`/api/bills/${bill.id}/approve`, undefined, 'department');
    }
    if (b.state === 'paid') {
      await post(`/api/bills/${bill.id}/pay`, undefined, 'finance');
    }
  }
  log(`${spec.bills.length} bills (${spec.bills.filter(b => b.state === 'paid').length} paid)`);

  return { project, wo };
}

async function seedVendorDocuments() {
  console.log('\n▶ Vendor document repository');
  for (const d of VENDOR_DOCUMENTS) {
    const file = await uploadFile(d.name, fileBody(d.name.replace(/\.txt$/, ''), `Vendor: Demo Construction Co.\nCategory: ${d.type}`));
    await post('/api/documents', { name: d.name, type: d.type, size: file.size, url: file.url }, 'vendor');
  }
  console.log(`   ${VENDOR_DOCUMENTS.length} documents uploaded`);
}

async function main() {
  console.log(`Seeding demo data via ${GATEWAY}`);
  await login();
  console.log('   logged in as admin, vendor, inspector, department, finance');

  const inspectors = await get('/api/inspectors', 'admin');
  const inspectorId = inspectors[0]?.id ?? null;
  if (!inspectorId) console.warn('   ! no inspector found — work orders will be left unassigned');

  const created = [];
  for (const spec of PROJECTS) created.push(await seedProject(spec, inspectorId));

  await seedVendorDocuments();

  console.log('\nDone. Open Execution & Progress and use "View Details" on:');
  for (const { project, wo } of created) console.log(`   • ${project.name}  (${wo.workOrderNo})`);
}

main().catch(err => {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
});
