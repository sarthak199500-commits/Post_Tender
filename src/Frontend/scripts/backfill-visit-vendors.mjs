/**
 * Attributes pre-existing inspection visits to their vendor.
 *
 * InspectionVisit gained a VendorId so a vendor could see who is coming to site and when.
 * The migration had no vendor to recover for rows created before that, so it backfilled
 * them with Guid.Empty — those visits belong to nobody and never appear on any vendor's
 * schedule. Visits scheduled since the change carry a real vendor id and are left alone.
 *
 * The mapping lives across a service boundary: visits are in InspectionService, but the
 * workOrderId -> vendorId link is in TenderService. So this reads work orders through the
 * gateway as admin and hands the mapping to POST /api/inspectionvisits/backfill-vendor,
 * which only ever fills a blank VendorId and never reassigns an attributed visit.
 *
 * Run with all backend services + the gateway up (see run-all.ps1):
 *
 *   npm run backfill:visit-vendors
 *
 * Override the gateway with PTMS_GATEWAY if it is not on :5249. Safe to re-run — once a
 * visit has a vendor, later runs skip it.
 */

const GATEWAY = process.env.PTMS_GATEWAY ?? 'http://localhost:5249';

const ADMIN = { email: 'admin@posttender.local', password: 'Admin@123' };

const fail = (label, status, body) => {
  throw new Error(`${label} failed (HTTP ${status}): ${String(body).slice(0, 400)}`);
};

async function call(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) fail(`${method} ${path}`, res.status, text);
  return text ? JSON.parse(text) : null;
}

async function login() {
  const res = await fetch(`${GATEWAY}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN),
  });
  if (!res.ok) fail(`login ${ADMIN.email}`, res.status, await res.text());
  return (await res.json()).token;
}

async function main() {
  const token = await login();
  console.log('   logged in as admin');

  const workOrders = await call('GET', '/api/workorders', token);
  const mappings = (workOrders ?? [])
    .filter(w => w.id && w.vendorId)
    .map(w => ({ workOrderId: w.id, vendorId: w.vendorId }));

  if (mappings.length === 0) {
    console.log('\nNo work orders carry a vendor, so there is nothing to map.');
    return;
  }
  console.log(`   built ${mappings.length} workOrder -> vendor mapping(s)`);

  const result = await call('POST', '/api/inspectionvisits/backfill-vendor', token, mappings);

  console.log(`\nDone. ${result.matched} visit(s) attributed to a vendor.`);
  if (result.unresolved > 0) {
    console.warn(
      `   ! ${result.unresolved} visit(s) still have no vendor — their work order is missing ` +
      'or itself has no vendor assigned. They stay hidden from vendor schedules.'
    );
  }
}

main().catch(err => {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
});
