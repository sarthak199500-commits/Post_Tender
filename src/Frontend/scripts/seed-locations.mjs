/**
 * Seeds UP urban local bodies + wards through the gateway API.
 *
 * Idempotent by Code: an existing code is skipped, so re-running after enriching
 * scripts/data/up-ulb.json only adds what is new. Zones are seeded only where the data
 * file declares them — no zone is invented, because the real ward->zone mapping is not
 * published. Run: npm run seed:locations
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Same override convention as the sibling seed/backfill scripts in this folder.
const GATEWAY = process.env.PTMS_GATEWAY ?? 'http://localhost:5249';
const EMAIL = process.env.SEED_EMAIL ?? 'admin@posttender.local';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@123';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, 'data', 'up-ulb.json'), 'utf8'));

let token = '';
const api = async (method, path, body) => {
  const res = await fetch(`${GATEWAY}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const login = async () => {
  const r = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  token = r.token;
  console.log(`Signed in as ${EMAIL}`);
};

const main = async () => {
  await login();

  const existing = await api('GET', '/masters/locations');
  const byCode = new Map(existing.map((l) => [l.code, l]));
  console.log(`${existing.length} locations already present`);

  let created = 0;
  const ensure = async (row) => {
    const hit = byCode.get(row.code);
    if (hit) return hit;
    const saved = await api('POST', '/masters/locations', row);
    byCode.set(saved.code, saved);
    created++;
    return saved;
  };

  // --- Nagar Nigams + their wards -----------------------------------------
  for (const nn of data.nagarNigams) {
    const ulb = await ensure({
      name: nn.name, code: nn.code, locationType: 'Ulb',
      ulbType: 'NagarNigam', isActive: true,
    });

    // Zones only where the data file declares them.
    const zoneByNo = new Map();
    for (const z of nn.zones ?? []) {
      const zone = await ensure({
        name: z.name, code: `${nn.code}-Z${String(z.no).padStart(2, '0')}`,
        locationType: 'Zone', parentLocationId: ulb.id, isActive: true,
      });
      zoneByNo.set(z.no, zone);
    }

    // Explicit ward list wins; otherwise generate 1..wardCount. UP wards are officially
    // numbered, so a numbered ward is real data awaiting its local name.
    const wards = nn.wards ?? Array.from({ length: nn.wardCount }, (_, i) => ({ no: i + 1 }));
    for (const w of wards) {
      const parent = w.zone != null && zoneByNo.has(w.zone) ? zoneByNo.get(w.zone) : ulb;
      await ensure({
        name: w.name ? `Ward ${w.no} - ${w.name}` : `Ward ${w.no}`,
        code: `${nn.code}-W${String(w.no).padStart(3, '0')}`,
        locationType: 'Ward', parentLocationId: parent.id, isActive: true,
      });
    }
    console.log(`  ${nn.name}: ${wards.length} wards`);
  }

  // --- Nagar Palika Parishads / Nagar Panchayats ---------------------------
  // LocationDto.Code has a 30-char column limit (see LocationsController). The slug is
  // capped at 26 (= 30 - "NPP-".length, the longer of the two prefixes used here) rather
  // than a short fixed width: several NPP names differ only in a parenthesised district
  // suffix used to disambiguate same-named towns (e.g. "Nawabganj (Bareilly)" vs
  // "Nawabganj (Barabanki)" vs "Nawabganj (Gonda)") — a short truncation collapsed the
  // first two to the same code and made the second POST fail with a duplicate-code 400.
  // Verified against the full 201-name list: longest slug is 25 chars, zero collisions.
  const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 26);
  for (const [list, ulbType, prefix] of [
    [data.nagarPalikaParishads, 'NagarPalikaParishad', 'NPP'],
    [data.nagarPanchayats, 'NagarPanchayat', 'NP'],
  ]) {
    for (const b of list) {
      const ulb = await ensure({
        name: b.name, code: b.code ?? `${prefix}-${slug(b.name)}`,
        locationType: 'Ulb', ulbType, isActive: true,
      });
      for (const w of b.wards ?? Array.from({ length: b.wardCount ?? 0 }, (_, i) => ({ no: i + 1 }))) {
        await ensure({
          name: w.name ? `Ward ${w.no} - ${w.name}` : `Ward ${w.no}`,
          code: `${ulb.code}-W${String(w.no).padStart(3, '0')}`,
          locationType: 'Ward', parentLocationId: ulb.id, isActive: true,
        });
      }
    }
    console.log(`  ${list.length} ${ulbType} bodies`);
  }

  console.log(`\nDone. ${created} new location rows created.`);
};

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  if (e.cause) console.error(`   cause: ${e.cause.message ?? e.cause}`);
  process.exitCode = 1;
});
