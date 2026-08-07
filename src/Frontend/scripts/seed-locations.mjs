/**
 * Seeds UP urban local bodies, zones and wards through the gateway API.
 *
 * The three tiers do not share a shape. A Nagar Nigam is a metropolitan corporation divided
 * into zones, and its wards sit under those zones (Ulb -> Zone -> Ward). A Nagar Palika
 * Parishad (city) and a Nagar Panchayat (town) have no zones and hold their wards directly.
 * LocationsController enforces this, so a ward hung off a corporation is now rejected.
 *
 * Keyed by Code and convergent, not merely idempotent: an existing row whose parent no
 * longer matches the declared shape is moved rather than skipped. That is what migrates the
 * 1370 wards this script originally created directly under their corporation.
 *
 * Zone names are used where published; otherwise a published or derived count seeds
 * "Zone 1..N". The real ward->zone boundary is not published anywhere machine-readable, so
 * wards are distributed in contiguous numeric blocks — stable, but synthetic. See
 * data/up-ulb.json for which corporations carry real zone data and which are assumed.
 *
 * Run: npm run seed:locations
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
  let reparented = 0;

  // Converges rather than merely inserting: a row that already exists but sits under the
  // wrong parent is moved. Needed because the first version of this seed hung every ward
  // straight off its corporation, which the Ulb -> Zone -> Ward rule now rejects.
  const ensure = async (row) => {
    const hit = byCode.get(row.code);
    if (!hit) {
      const saved = await api('POST', '/masters/locations', row);
      byCode.set(saved.code, saved);
      created++;
      return saved;
    }
    if (row.parentLocationId && hit.parentLocationId !== row.parentLocationId) {
      const moved = await api('PUT', `/masters/locations/${hit.id}`, { ...row });
      byCode.set(moved.code, moved);
      reparented++;
      return moved;
    }
    return hit;
  };

  // --- Nagar Nigams: Ulb -> Zone -> Ward -----------------------------------
  for (const nn of data.nagarNigams) {
    const ulb = await ensure({
      name: nn.name, code: nn.code, locationType: 'Ulb',
      ulbType: 'NagarNigam', isActive: true,
    });

    // Published zone names win; otherwise a published/derived count seeds "Zone 1..N",
    // which is how Lucknow and Kanpur officially designate theirs anyway.
    const declared = nn.zones ?? Array.from(
      { length: nn.zoneCount ?? 0 },
      (_, i) => ({ no: i + 1, name: `Zone ${i + 1}` }),
    );

    const zones = [];
    for (const z of declared) {
      zones.push(await ensure({
        name: z.name, code: `${nn.code}-Z${String(z.no).padStart(2, '0')}`,
        locationType: 'Zone', parentLocationId: ulb.id, isActive: true,
      }));
    }

    // Explicit ward list wins; otherwise generate 1..wardCount. UP wards are officially
    // numbered, so a numbered ward is real data awaiting its local name.
    const wards = nn.wards ?? Array.from({ length: nn.wardCount }, (_, i) => ({ no: i + 1 }));

    // Real ward->zone boundaries are not published. Wards go into contiguous numeric blocks,
    // one block per zone — deterministic and stable across re-runs, but synthetic. An
    // explicit `zone` on a ward always wins, so real data can be dropped in per ward.
    const blockOf = (i) => Math.min(zones.length - 1, Math.floor((i * zones.length) / wards.length));

    for (const [i, w] of wards.entries()) {
      const explicit = w.zone != null ? zones.find((z) => z.code.endsWith(`-Z${String(w.zone).padStart(2, '0')}`)) : null;
      const parent = explicit ?? (zones.length ? zones[blockOf(i)] : ulb);
      await ensure({
        name: w.name ? `Ward ${w.no} - ${w.name}` : `Ward ${w.no}`,
        code: `${nn.code}-W${String(w.no).padStart(3, '0')}`,
        locationType: 'Ward', parentLocationId: parent.id, isActive: true,
      });
    }
    console.log(`  ${nn.name}: ${zones.length} zones, ${wards.length} wards`);
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

  console.log(`\nDone. ${created} new location rows created, ${reparented} moved to the correct parent.`);
};

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  if (e.cause) console.error(`   cause: ${e.cause.message ?? e.cause}`);
  process.exitCode = 1;
});
