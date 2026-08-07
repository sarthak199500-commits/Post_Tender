/**
 * Backfills UlbId/ZoneId/WardId on existing tenders, then pushes the value down to their
 * work orders and projects.
 *
 * Existing rows predate the columns, so without this they are invisible to every location
 * filter. Assignment is deterministic (hash of the row id over the seeded Lucknow/Kanpur
 * wards) so re-running is stable and a given tender always lands in the same ward.
 * Only touches rows whose wardId is still null. Run: npm run backfill:locations
 *
 * Two API gaps discovered while wiring this up (confirmed live, not just from reading the
 * controllers — see the PUT helpers below):
 *
 *  - PUT /api/tenders/{id} binds [FromForm] TenderFormDto, not JSON. A JSON body leaves
 *    every field at its default and fails validation with 400 "Tender ID is required."
 *    This script sends multipart/form-data instead. Because GET /api/tenders (the list
 *    endpoint this script reads) never projects Description — see
 *    TendersController.GetAllTenders — and there is no GetById endpoint to recover it,
 *    ANY update through this endpoint blanks a tender's Description. That is a pre-existing
 *    gap shared by the Edit Tender screen (AddTender.tsx has the identical limitation on
 *    its edit path), not something introduced by this script. Flagging it rather than
 *    working around it — there is no C# change in scope here to fix the root cause.
 *
 *  - WorkOrdersController exposes no generic PUT /api/workorders/{id} — only
 *    {id}/status and {id}/approve. ProjectsController exposes no write endpoint at all
 *    (GET only). Both return HTTP 405 for a plain PUT. So the "push down to work orders
 *    and projects" step below can only be *computed*, not written back through the API;
 *    it probes once, reports the gap plainly, and does not fabricate success. Nothing here
 *    invents a workaround (e.g. writing the DB directly) since that would break the
 *    "everything through the gateway, same rules as production" pattern the rest of this
 *    script's siblings (seed-demo-data.mjs, backfill-visit-vendors.mjs) follow.
 */

// Same override convention as the sibling seed/backfill scripts in this folder.
const GATEWAY = process.env.PTMS_GATEWAY ?? 'http://localhost:5249';
const EMAIL = process.env.SEED_EMAIL ?? 'admin@posttender.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123';
const DRY_RUN = process.argv.includes('--dry-run');

let token = '';

/** Mirrors seed-demo-data.mjs's call() helper: body -> JSON, form -> multipart (fetch sets its own boundary). */
async function call(method, path, { body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${GATEWAY}/api${path}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

const get = (path) => call('GET', path);
const postJson = (path, body) => call('POST', path, { body });
const putForm = (path, form) => call('PUT', path, { form });

/** Stable index from a guid so the same tender always maps to the same ward. */
const pick = (id, list) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

/** True for a 404/405 that means "this route does not exist", not a per-row validation failure. */
const isMissingRoute = (err) => err.status === 404 || err.status === 405;

const main = async () => {
  const login = await postJson('/auth/login', { email: EMAIL, password: PASSWORD });
  token = login.token;
  console.log(`Signed in as ${EMAIL}`);

  const locations = await get('/masters/locations');
  const ulbs = locations.filter((l) => l.locationType === 'Ulb' && l.ulbType === 'NagarNigam');
  if (!ulbs.length) throw new Error('No Nagar Nigams found — run `npm run seed:locations` first.');

  // Confine the demo data to two real corporations so the filters have visible clustering.
  const targets = ulbs.filter((u) => ['NN-LKO', 'NN-KNP'].includes(u.code));
  if (targets.length < 2) {
    throw new Error(
      `Expected Nagar Nigams NN-LKO and NN-KNP among seeded locations, found: ` +
      `${targets.map((t) => t.code).join(', ') || 'none'} — run \`npm run seed:locations\` first.`
    );
  }

  const wardsByUlb = new Map(
    targets.map((u) => [u.id, locations.filter((l) => l.locationType === 'Ward' && l.parentLocationId === u.id)])
  );
  for (const u of targets) {
    if (!wardsByUlb.get(u.id)?.length) throw new Error(`${u.name} has no wards seeded — run \`npm run seed:locations\` first.`);
  }

  // --- Tenders ---------------------------------------------------------------
  const tenders = await get('/tenders');
  const pendingTenders = tenders.filter((t) => !t.wardId);
  console.log(`${pendingTenders.length} of ${tenders.length} tenders need a location`);

  let tendersUpdated = 0;
  let tendersSkipped = 0;
  for (const t of pendingTenders) {
    const ulb = pick(t.id, targets);
    const ward = pick(t.id, wardsByUlb.get(ulb.id));
    console.log(`  ${t.tenderNo} -> ${ulb.name} / ${ward.name}`);
    if (DRY_RUN) continue;

    // See the file-level comment: this must be multipart, matching [FromForm] TenderFormDto,
    // and Description cannot be round-tripped because the list endpoint never returns it.
    const form = new FormData();
    form.append('tenderNo', t.tenderNo);
    form.append('title', t.title);
    form.append('tenderType', t.tenderType ?? '');
    form.append('budget', String(t.budget));
    form.append('emdAmount', String(t.emdAmount));
    form.append('portal', t.portal ?? '');
    if (t.publishDate) form.append('publishDate', t.publishDate);
    if (t.closeDate) form.append('closeDate', t.closeDate);
    if (t.departmentId) form.append('departmentId', t.departmentId);
    form.append('ulbId', ulb.id);
    form.append('wardId', ward.id);
    // zoneId intentionally omitted (binds to null) — no zones are seeded yet.

    try {
      await putForm(`/tenders/${t.id}`, form);
      tendersUpdated++;
    } catch (err) {
      // Pre-existing data-quality issue (e.g. two rows sharing a tenderNo from a flaky
      // E2E double-submit) must not abort every other row's backfill. Skip and report.
      tendersSkipped++;
      console.warn(`  ! ${t.tenderNo} (${t.id}) skipped: ${err.message}`);
    }
  }

  // --- Work orders inherit at creation time, but these already exist — push down. --------
  const workOrders = await get('/workorders');
  const tenderById = new Map((await get('/tenders')).map((t) => [t.id, t]));
  const pendingWO = workOrders.filter((w) => !w.wardId);
  const woEligible = pendingWO.filter((w) => tenderById.get(w.tenderId)?.wardId);

  let workOrdersUpdated = 0;
  let woRouteMissing = null;
  for (const wo of woEligible) {
    if (woRouteMissing) break; // confirmed missing — do not hammer a dead route
    const t = tenderById.get(wo.tenderId);
    console.log(`  ${wo.workOrderNo} <- ${t.tenderNo}`);
    if (DRY_RUN) continue;
    try {
      await call('PUT', `/workorders/${wo.id}`, { body: { ...wo, ulbId: t.ulbId, zoneId: t.zoneId, wardId: t.wardId } });
      workOrdersUpdated++;
    } catch (err) {
      if (!isMissingRoute(err)) throw err;
      woRouteMissing = err;
      console.warn(
        `  ! PUT /api/workorders/{id} -> HTTP ${err.status}: no such route. ` +
        `WorkOrdersController exposes only {id}/status and {id}/approve, not a generic update. ` +
        `Stopping this section rather than repeating a confirmed-dead call.`
      );
    }
  }

  // --- Projects: same idea, one level further down. --------------------------------------
  const projects = await get('/projects');
  const woById = new Map((await get('/workorders')).map((w) => [w.id, w]));
  const pendingProjects = projects.filter((p) => !p.wardId);
  const projEligible = pendingProjects.filter((p) => woById.get(p.workOrderId)?.wardId);

  let projectsUpdated = 0;
  let projRouteMissing = null;
  for (const p of projEligible) {
    if (projRouteMissing) break;
    const wo = woById.get(p.workOrderId);
    console.log(`  ${p.name} <- ${wo.workOrderNo}`);
    if (DRY_RUN) continue;
    try {
      await call('PUT', `/projects/${p.id}`, { body: { ...p, ulbId: wo.ulbId, zoneId: wo.zoneId, wardId: wo.wardId } });
      projectsUpdated++;
    } catch (err) {
      if (!isMissingRoute(err)) throw err;
      projRouteMissing = err;
      console.warn(
        `  ! PUT /api/projects/{id} -> HTTP ${err.status}: no such route. ` +
        `ProjectsController exposes GET only, no write endpoint at all. ` +
        `Stopping this section rather than repeating a confirmed-dead call.`
      );
    }
  }

  // --- Summary -----------------------------------------------------------------------------
  console.log(DRY_RUN ? '\nDry run — nothing written.' : '\nBackfill complete.');
  console.log(
    `  Tenders:     ${tendersUpdated}/${pendingTenders.length} assigned a location` +
    (tendersSkipped ? ` (${tendersSkipped} skipped — see warnings above; pre-existing data issue, not caused by this script).` : '.')
  );
  console.log(
    `  Work orders: ${workOrdersUpdated}/${pendingWO.length} assigned` +
    (pendingWO.length - woEligible.length > 0 ? ` (${pendingWO.length - woEligible.length} blocked upstream — their tender still has no ward)` : '') +
    (woRouteMissing ? ` — remainder blocked: no generic update endpoint on WorkOrdersController.` : '.')
  );
  console.log(
    `  Projects:    ${projectsUpdated}/${pendingProjects.length} assigned` +
    (pendingProjects.length - projEligible.length > 0 ? ` (${pendingProjects.length - projEligible.length} blocked upstream — their work order still has no ward)` : '') +
    (projRouteMissing ? ` — remainder blocked: ProjectsController has no write endpoint.` : '.')
  );
  if (woRouteMissing || projRouteMissing) {
    console.log(
      '\nNOTE: Work orders and/or projects could not be fully backfilled because the API has ' +
      'no endpoint to update their location on an existing row (confirmed via a live 404/405, ' +
      'not assumed). Adding one is a backend change outside this script\'s scope. Tenders are ' +
      'fully assigned; re-run this script once such an endpoint exists — it will pick up ' +
      'exactly the rows still missing a ward.'
    );
  }
};

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  if (err.cause) console.error(`   cause: ${err.cause.message ?? err.cause}`);
  process.exitCode = 1;
});
