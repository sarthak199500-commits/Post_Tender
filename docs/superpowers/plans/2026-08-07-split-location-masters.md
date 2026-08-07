# Split Location Masters into City / Zone / Ward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single Locations Master (which crams three different entities behind a "Level" switcher) with three focused masters — City, Zone and Ward — each structurally incapable of producing an invalid hierarchy.

**Architecture:** Pure frontend reorganisation over the existing `Location` table and `/api/masters/locations` endpoints — no schema change, no migration. Each page fetches only its own level via the existing `?type=` / `?parentId=` filters instead of pulling all 1,588 rows. Zone and Ward pages use a **scope selector** (pick a city, then a zone) that doubles as the parent for new rows, which removes the ambiguous flat parent dropdown entirely. One backend change: block deleting a location that still has children.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind, axios; .NET 8 + EF Core + xUnit for the single backend task.

---

## Domain rules this plan encodes

| UI term | Stored `ulbType` | Native name | Has zones? |
|---|---|---|---|
| Metropolitan City | `NagarNigam` | Nagar Nigam | **Yes** — City → Zone → Ward |
| City | `NagarPalikaParishad` | Nagar Palika Parishad | No — City → Ward |
| Town | `NagarPanchayat` | Nagar Panchayat | No — City → Ward |

`LocationsController.Validate` already enforces this server-side (a Zone's parent must be a
`NagarNigam` Ulb; a Ward's parent must be a Zone or a non-`NagarNigam` Ulb; a Ulb needs a
`ulbType`). The three pages mirror those rules so the UI cannot offer a rejected combination.

**Two different questions, do not conflate them:**
- *"May this city have zones?"* — a **type** question (only a Metropolitan City may). Used to
  decide whether the Zone Master lists a city at all, and whether the Ward Master demands a zone.
- *"Does this city have zones right now?"* — a **data** question. Used only to show a helpful
  "add a zone first" message. Never used to relax the rule above.

## Existing state (verified 2026-08-07)

- Live data: 218 cities (17 Metropolitan, 201 City, 0 Town), 83 zones, 1,370 wards, 1 legacy `District` row.
- `GET /api/masters/locations` accepts optional `type`, `ulbType`, `parentId`; they compose. Wards come back ordered by `Code`, everything else by `Name`.
- `POST` / `PUT` / `DELETE /api/masters/locations/{id}` are `Admin,PMU`.
- **There are no frontend unit tests in this repo** (`find src -name "*.test.ts*"` returns nothing) and no test runner wired for components. Frontend tasks are therefore verified by `npx tsc --noEmit`, `npx eslint`, and explicit browser checks — not by unit tests. Do not invent a test harness; that is out of scope.
- Backend tests: `src/Backend/PostTenderSystem.Tests`, currently **161 passing**.

## File Structure

| File | Responsibility |
|---|---|
| `src/Backend/Services/CommonService/Controllers/LocationsController.cs` *(modify)* | Add child-guard to `Delete`. |
| `src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs` *(modify)* | Cover the delete guard. |
| `src/Frontend/src/api/locationsService.ts` *(modify)* | Add `CITY_TYPES` + label helpers and scoped fetch helpers. Single source of truth for tier vocabulary. |
| `src/Frontend/src/pages/Admin/Masters/useLocationMaster.ts` *(create)* | Shared data + mutation hook for all three pages (fetch scoped rows, save, delete, error state, cache invalidation). |
| `src/Frontend/src/pages/Admin/Masters/CityMaster.tsx` *(create)* | CRUD for `locationType: 'Ulb'`. Filter by city type + search. |
| `src/Frontend/src/pages/Admin/Masters/ZoneMaster.tsx` *(create)* | CRUD for `locationType: 'Zone'`, scoped to one Metropolitan City. |
| `src/Frontend/src/pages/Admin/Masters/WardMaster.tsx` *(create)* | CRUD for `locationType: 'Ward'`, scoped to a city and (for Metropolitan) a zone. |
| `src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx` *(delete)* | Superseded by the three above. |
| `src/Frontend/src/App.tsx` *(modify)* | 3 imports, 3 `PAGE_META` entries, 3 nav items, 3 routes, 1 redirect; drop the old ones. |
| `system_map.md` *(modify)* | Record the three masters. |

Each page keeps its own table markup (columns genuinely differ), matching how
`DepartmentMaster` / `WardMemberMaster` are written. Only the data/mutation logic is shared,
because that is what is actually identical.

**Deliberately NOT touched:** `LocationCascade.tsx`. It is used by Add Tender and the three
list filter bars; the scope selectors here need different depths and their selection doubles
as the parent, so purpose-built selects over the same `locationsService` helpers are simpler
and carry zero regression risk to those five existing usages.

---

## Task 1: Block deleting a location that still has children

Today `Delete` removes the row unconditionally. With a dedicated City Master whose primary
destructive action sits next to every corporation, deleting Lucknow would silently orphan its
8 zones and 110 wards. This is an addition beyond the pure UI split, included because the
split makes the failure reachable in one click.

**Files:**
- Modify: `src/Backend/Services/CommonService/Controllers/LocationsController.cs`
- Test: `src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs`

- [ ] **Step 1: Write the failing tests**

Append inside the `LocationHierarchyTests` class, just before its closing `}`:

```csharp
    [Fact]
    public async Task Delete_IsRejected_WhileChildrenExist()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var city = Row("Lucknow Nagar Nigam", "NN-LKO", "Ulb", ulbType: "NagarNigam");
        ctx.Locations.Add(city);
        await ctx.SaveChangesAsync();
        ctx.Locations.Add(Row("Zone 1", "NN-LKO-Z01", "Zone", city.Id));
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Delete(city.Id);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("still has", bad.Value!.ToString());
        Assert.Equal(2, ctx.Locations.Count());   // nothing removed
    }

    [Fact]
    public async Task Delete_Succeeds_WhenNoChildrenRemain()
    {
        using var ctx = TestDb.Create<CommonServiceDbContext>();
        var city = Row("Sitapur", "NPP-SITAPUR", "Ulb", ulbType: "NagarPalikaParishad");
        ctx.Locations.Add(city);
        await ctx.SaveChangesAsync();

        var result = await Build(ctx).Delete(city.Id);

        Assert.IsType<OkResult>(result);
        Assert.Empty(ctx.Locations);
    }
```

- [ ] **Step 2: Run them and confirm the first fails**

```bash
cd "src/Backend" && dotnet test PostTenderSystem.Tests/PostTenderSystem.Tests.csproj -c TestRun --nologo -v q --filter "FullyQualifiedName~LocationHierarchyTests"
```

Expected: `Delete_IsRejected_WhileChildrenExist` FAILS (it currently returns `OkResult` and
deletes the row). `Delete_Succeeds_WhenNoChildrenRemain` already passes — it is the regression
guard for the change you are about to make. (If you asserted `OkObjectResult` instead of
`OkResult` here, both tests fail: the current success path returns a bare `Ok()`, not
`Ok(entity)`, and the planned fix below does not change that — only `OkResult` is correct.)

> **Build note:** the running services lock their own `bin/Debug`, which is why every command
> here uses the throwaway `-c TestRun` configuration and targets the `.csproj` directly (the
> `.sln` has no `TestRun` config). Delete stray `bin/TestRun` and `obj/TestRun` directories
> when you are done: `find . -type d -name TestRun \( -path "*/bin/*" -o -path "*/obj/*" \) -prune -exec rm -rf {} +`

- [ ] **Step 3: Add the guard**

Replace the whole existing `Delete` method:

```csharp
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,PMU")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var e = await _context.Locations.FindAsync(id);
        if (e is null) return Ok();

        // Nothing enforced this before, so deleting a corporation silently orphaned its zones
        // and every ward beneath them — 118 rows for Lucknow — leaving tenders pointing at ids
        // that no longer resolve. Cheaper to refuse than to repair.
        var children = await _context.Locations.CountAsync(l => l.ParentLocationId == id);
        if (children > 0)
            return BadRequest($"'{e.Name}' still has {children} location(s) under it. Delete or move those first.");

        _context.Locations.Remove(e);
        await _context.SaveChangesAsync();
        return Ok();
    }
```

- [ ] **Step 4: Run the full suite**

```bash
cd "src/Backend" && dotnet test PostTenderSystem.Tests/PostTenderSystem.Tests.csproj -c TestRun --nologo -v q
```

Expected: `Passed! - Failed: 0, Passed: 163, Skipped: 0, Total: 163`

- [ ] **Step 5: Sabotage-verify the guard is load-bearing**

Temporarily change `if (children > 0)` to `if (false)`, re-run the filtered command from Step 2,
and confirm **only** `Delete_IsRejected_WhileChildrenExist` fails. Revert, re-run, confirm green,
and confirm `git diff` shows only the intended change.

- [ ] **Step 6: Restart CommonService so the guard is live**

The Locations pages you build next will call this endpoint. CommonService's SQLite path is
**relative**, so it must be launched with its working directory set to the project folder —
starting it from `bin/Debug/net8.0` silently creates a second, empty database.

```bash
powershell -NoProfile -Command "$c = Get-NetTCPConnection -State Listen -LocalPort 5007 | Select-Object -First 1; $p = Get-CimInstance Win32_Process -Filter \"ProcessId = $($c.OwningProcess)\"; if ($p.Name -ne 'CommonService.exe') { throw 'Unexpected process on 5007' }; Stop-Process -Id $p.ProcessId -Force"
```

```bash
cd "src/Backend/Services/CommonService" && dotnet build -c Debug --nologo -v q
```

```bash
powershell -NoProfile -Command "$proj = (Resolve-Path 'src/Backend/Services/CommonService').Path; Start-Process -FilePath \"$proj\bin\Debug\net8.0\CommonService.exe\" -ArgumentList '--environment','Development','--urls','http://localhost:5007' -WorkingDirectory $proj -WindowStyle Hidden"
```

Verify it came back with data intact (expect `1589`):

```bash
cd "src/Frontend" && node -e "fetch('http://localhost:5249/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@posttender.local',password:'Admin@123'})}).then(r=>r.json()).then(({token})=>fetch('http://localhost:5249/api/masters/locations',{headers:{Authorization:'Bearer '+token}})).then(r=>r.json()).then(l=>console.log('locations:',l.length))"
```

- [ ] **Step 7: Commit**

```bash
git add src/Backend/Services/CommonService/Controllers/LocationsController.cs src/Backend/PostTenderSystem.Tests/Common/LocationHierarchyTests.cs
git commit -m "fix(location): refuse to delete a location that still has children"
```

---

## Task 2: City-type vocabulary and scoped fetch helpers

**Files:**
- Modify: `src/Frontend/src/api/locationsService.ts`

- [ ] **Step 1: Add the vocabulary**

Insert directly **below** the existing `ULB_TYPES` constant (keep `ULB_TYPES` — `LocationCascade`
imports it and must not change):

```typescript
/**
 * The same three tiers as ULB_TYPES, in the words the client actually uses. `ULB_TYPES` stays
 * for LocationCascade's "Urban Local Body Type" step; these labels front the masters.
 *
 * `hasZones` answers "MAY this tier have zones?" — a rule, fixed by statute and enforced by
 * LocationsController. It is NOT the same question as "does this city have zones right now",
 * which is read from the data (see splitChildren). Never use one to answer the other.
 */
export const CITY_TYPES: { key: UlbTypeKey; label: string; native: string; hasZones: boolean }[] = [
  { key: 'NagarNigam', label: 'Metropolitan City', native: 'Nagar Nigam', hasZones: true },
  { key: 'NagarPalikaParishad', label: 'City', native: 'Nagar Palika Parishad', hasZones: false },
  { key: 'NagarPanchayat', label: 'Town', native: 'Nagar Panchayat', hasZones: false },
];

/** "Metropolitan City (Nagar Nigam)" — both names, because officials use the native one. */
export const cityTypeLabel = (key?: string | null): string => {
  const t = CITY_TYPES.find((c) => c.key === key);
  return t ? `${t.label} (${t.native})` : '—';
};

/** Whether this tier is divided into zones. Falls back to false for legacy/unknown rows. */
export const tierHasZones = (key?: string | null): boolean =>
  CITY_TYPES.find((c) => c.key === key)?.hasZones ?? false;
```

- [ ] **Step 2: Add the scoped fetch helpers**

Insert directly **below** the existing `fetchUlbById` function:

```typescript
/** Every city of every tier, for the Zone/Ward master scope pickers. */
export const fetchAllUlbs = () => get({ type: 'Ulb' });

/** The zones of one city. Empty for a city or town, which have none by rule. */
export const fetchZonesOf = (cityId: string) =>
  get({ type: 'Zone', parentId: cityId });
```

- [ ] **Step 3: Typecheck**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/api/locationsService.ts
```

Expected: no output from either.

- [ ] **Step 4: Commit**

```bash
git add src/Frontend/src/api/locationsService.ts
git commit -m "feat(location): add city-tier vocabulary and scoped location fetches"
```

---

## Task 3: Shared data + mutation hook

All three pages do exactly the same fetch/save/delete/error dance against the same endpoint;
only the query and the form fields differ. That logic is shared here. Table markup is not —
the columns genuinely differ per page, and every other master in this codebase writes its own.

**Files:**
- Create: `src/Frontend/src/pages/Admin/Masters/useLocationMaster.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../../../api/axiosInstance';
import { describeApiError } from '../../../api/apiError';
import { clearLocationCache, type LocationRow } from '../../../api/locationsService';

/** Exactly the shape LocationsController.LocationDto binds. */
export interface LocationDraft {
  name: string;
  code: string;
  locationType: string;
  ulbType?: string | null;
  parentLocationId?: string | null;
  isActive: boolean;
}

interface Query {
  /** 'Ulb' | 'Zone' | 'Ward' */
  type: string;
  /** Scope to one parent. Zone and Ward masters always pass this. */
  parentId?: string;
  /** False while the scope picker is still empty — skips the fetch instead of loading everything. */
  enabled?: boolean;
}

/**
 * Fetches one level of the location tree and writes back to it.
 *
 * Scoped on the server via ?type= / ?parentId= rather than pulling all ~1,588 rows and
 * filtering in the page, which is what the old single Locations Master did.
 */
export function useLocationMaster(query: Query) {
  const { type, parentId, enabled = true } = query;

  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axiosInstance.get<LocationRow[]>('/masters/locations', {
        params: { type, ...(parentId && { parentId }) },
      });
      setRows(data ?? []);
      setLoadError(null);
    } catch (err) {
      // Swallowing this made a stopped service look like an empty master.
      console.error(err);
      setRows([]);
      setLoadError(describeApiError(err, 'Could not load this master'));
    } finally {
      setLoading(false);
    }
  }, [enabled, type, parentId]);

  useEffect(() => { refresh(); }, [refresh]);

  /** Returns true on success so the caller can clear its form only when the write landed. */
  const save = async (draft: LocationDraft, editId: string): Promise<boolean> => {
    setSaveError(null);
    try {
      if (editId) await axiosInstance.put(`/masters/locations/${editId}`, draft);
      else await axiosInstance.post('/masters/locations', draft);
      // locationsService memoises location reads for the whole session, so without this a zone
      // added here would not appear in Add Tender's cascade until a full page reload.
      clearLocationCache();
      await refresh();
      return true;
    } catch (err) {
      setSaveError(describeApiError(err, 'Failed to save'));
      return false;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    setSaveError(null);
    try {
      await axiosInstance.delete(`/masters/locations/${id}`);
      clearLocationCache();
      await refresh();
      return true;
    } catch (err) {
      // The API refuses to delete a row that still has children; surface that verbatim.
      setSaveError(describeApiError(err, 'Failed to delete'));
      return false;
    }
  };

  return { rows, loading, loadError, saveError, refresh, save, remove };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/pages/Admin/Masters/useLocationMaster.ts
```

Expected: no output. (The hook is not imported anywhere yet — that is fine, it is not dead
code for long, and `tsc --noEmit` does not flag unused modules.)

- [ ] **Step 3: Commit**

```bash
git add src/Frontend/src/pages/Admin/Masters/useLocationMaster.ts
git commit -m "feat(location): add shared location master hook"
```

---

## Task 4: City Master

**Files:**
- Create: `src/Frontend/src/pages/Admin/Masters/CityMaster.tsx`

- [ ] **Step 1: Write the page**

```tsx
import React, { useState } from 'react';
import { CITY_TYPES, cityTypeLabel, type LocationRow } from '../../../api/locationsService';
import { useLocationMaster, type LocationDraft } from './useLocationMaster';

const inputCls = 'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1';

const empty: LocationDraft = {
  name: '', code: '', locationType: 'Ulb', ulbType: '', parentLocationId: null, isActive: true,
};

const CityMaster: React.FC = () => {
  const { rows, loading, loadError, saveError, refresh, save, remove } = useLocationMaster({ type: 'Ulb' });
  const [form, setForm] = useState<LocationDraft>(empty);
  const [editId, setEditId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await save(form, editId)) { setForm(empty); setEditId(''); }
  };

  const startEdit = (r: LocationRow) => {
    setForm({ name: r.name, code: r.code, locationType: 'Ulb', ulbType: r.ulbType ?? '', parentLocationId: null, isActive: r.isActive });
    setEditId(r.id);
  };

  const cancelEdit = () => { setForm(empty); setEditId(''); };

  const onDelete = async (r: LocationRow) => {
    if (!window.confirm(`Delete ${r.name}?`)) return;
    await remove(r.id);
  };

  const visible = rows.filter((r) => {
    if (typeFilter && r.ulbType !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Cities</h1>
      <p className="text-slate-600 mb-8">
        Metropolitan cities are divided into zones; cities and towns hold their wards directly.
      </p>

      <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
        <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} City</h2>
        <form onSubmit={submit} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className={labelCls}>Code</label>
            <input className={inputCls} value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className={labelCls}>City Type</label>
            <select aria-label="City Type" className={inputCls} value={form.ulbType ?? ''}
              onChange={(e) => setForm({ ...form, ulbType: e.target.value })} required>
              <option value="">Select city type</option>
              {CITY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label} ({t.native})</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
            {editId ? 'Update' : 'Save'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
              Cancel
            </button>
          )}
        </form>
      </div>

      {(loadError || saveError) && (
        <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 flex items-start justify-between gap-4">
          <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
          {loadError && (
            <button type="button" onClick={refresh} className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800">Retry</button>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-card shadow-sm border border-slate-200 mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <label className={labelCls}>City Type</label>
          <select aria-label="Filter by city type" className={inputCls} value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {CITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className={labelCls}>Search</label>
          <input className={inputCls} placeholder="Search by name or code" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-slate-600 pb-2">Showing {visible.length} of {rows.length}</p>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">City Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-800">{r.name}</td>
                <td className="px-6 py-4 text-slate-600">{r.code}</td>
                <td className="px-6 py-4 text-slate-600">{cityTypeLabel(r.ulbType)}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => startEdit(r)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                  <button onClick={() => onDelete(r)} className="text-red-700 font-bold underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!loading && !loadError && rows.length === 0 && <div className="p-10 text-center text-slate-600">No cities yet.</div>}
        {!loading && !loadError && rows.length > 0 && visible.length === 0 && <div className="p-10 text-center text-slate-600">No cities match the current filter.</div>}
      </div>
    </div>
  );
};

export default CityMaster;
```

- [ ] **Step 2: Typecheck and lint**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/pages/Admin/Masters/CityMaster.tsx
```

Expected: no output. (The page is not routed until Task 7; verify it in the browser there.)

- [ ] **Step 3: Commit**

```bash
git add src/Frontend/src/pages/Admin/Masters/CityMaster.tsx
git commit -m "feat(location): add City master"
```

---

## Task 5: Zone Master

Scoped to one Metropolitan City. The scope picker doubles as the parent for new zones, so
there is no flat parent dropdown and no way to attach a zone to a city or town.

**Files:**
- Create: `src/Frontend/src/pages/Admin/Masters/ZoneMaster.tsx`

- [ ] **Step 1: Write the page**

```tsx
import React, { useEffect, useState } from 'react';
import { fetchUlbs, type LocationRow } from '../../../api/locationsService';
import { useLocationMaster, type LocationDraft } from './useLocationMaster';

const inputCls = 'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1';

const ZoneMaster: React.FC = () => {
  // Only a metropolitan city may have zones — that is a rule, not a property of the data, so
  // the picker is narrowed by tier rather than by "which cities happen to have zones today".
  const [cities, setCities] = useState<LocationRow[]>([]);
  const [cityId, setCityId] = useState('');
  const [cityError, setCityError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editId, setEditId] = useState('');

  const { rows, loading, loadError, saveError, refresh, save, remove } =
    useLocationMaster({ type: 'Zone', parentId: cityId, enabled: !!cityId });

  useEffect(() => {
    fetchUlbs('NagarNigam')
      .then(setCities)
      .catch(() => setCityError('Could not load metropolitan cities.'));
  }, []);

  const reset = () => { setName(''); setCode(''); setEditId(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft: LocationDraft = {
      name, code, locationType: 'Zone', ulbType: null, parentLocationId: cityId, isActive: true,
    };
    if (await save(draft, editId)) reset();
  };

  const startEdit = (r: LocationRow) => { setName(r.name); setCode(r.code); setEditId(r.id); };

  const onDelete = async (r: LocationRow) => {
    if (!window.confirm(`Delete ${r.name}? Its wards must be moved or deleted first.`)) return;
    await remove(r.id);
  };

  const cityName = cities.find((c) => c.id === cityId)?.name ?? '';

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Zones</h1>
      <p className="text-slate-600 mb-8">
        Only metropolitan cities are divided into zones. Pick a city to see and manage its zones.
      </p>

      <div className="bg-white p-4 rounded-card shadow-sm border border-slate-200 mb-6">
        <div className="max-w-md">
          <label className={labelCls}>Metropolitan City</label>
          <select aria-label="Metropolitan City" className={inputCls} value={cityId}
            onChange={(e) => { setCityId(e.target.value); reset(); }}>
            <option value="">Select a city</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {cityError && <p className="text-sm text-red-700 font-medium mt-3">{cityError}</p>}
      </div>

      {!cityId ? (
        <div className="bg-white rounded-card border border-slate-200 p-10 text-center text-slate-600">
          Select a metropolitan city above to manage its zones.
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
            <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} Zone in {cityName}</h2>
            <form onSubmit={submit} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className={labelCls}>Name</label>
                <input className={inputCls} placeholder="e.g. Zone 1" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className={labelCls}>Code</label>
                <input className={inputCls} placeholder="e.g. NN-LKO-Z01" value={code}
                  onChange={(e) => setCode(e.target.value)} required />
              </div>
              <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
                {editId ? 'Update' : 'Save'}
              </button>
              {editId && (
                <button type="button" onClick={reset} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
                  Cancel
                </button>
              )}
            </form>
          </div>

          {(loadError || saveError) && (
            <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 flex items-start justify-between gap-4">
              <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
              {loadError && (
                <button type="button" onClick={refresh} className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800">Retry</button>
              )}
            </div>
          )}

          <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{r.name}</td>
                    <td className="px-6 py-4 text-slate-600">{r.code}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => startEdit(r)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                      <button onClick={() => onDelete(r)} className="text-red-700 font-bold underline text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {!loading && !loadError && rows.length === 0 && (
              <div className="p-10 text-center text-slate-600">{cityName} has no zones yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ZoneMaster;
```

- [ ] **Step 2: Typecheck and lint**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/pages/Admin/Masters/ZoneMaster.tsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/Frontend/src/pages/Admin/Masters/ZoneMaster.tsx
git commit -m "feat(location): add Zone master scoped to a metropolitan city"
```

---

## Task 6: Ward Master

Scoped to a city, and for a metropolitan city also to one of its zones. The scope selection is
the parent for new wards, so an invalid parent is unreachable.

**Files:**
- Create: `src/Frontend/src/pages/Admin/Masters/WardMaster.tsx`

- [ ] **Step 1: Write the page**

```tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllUlbs, fetchZonesOf, cityTypeLabel, tierHasZones, type LocationRow } from '../../../api/locationsService';
import { useLocationMaster, type LocationDraft } from './useLocationMaster';

const inputCls = 'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1';

const WardMaster: React.FC = () => {
  const [cities, setCities] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<LocationRow[]>([]);
  const [cityId, setCityId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [scopeError, setScopeError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editId, setEditId] = useState('');

  const city = cities.find((c) => c.id === cityId);
  // Rule, not data: a metropolitan city's wards must go through a zone, so the zone step is
  // required whenever the tier has zones — even if none have been added yet (see the notice).
  const needsZone = tierHasZones(city?.ulbType);
  // The parent is whatever the scope resolves to: the zone for a metropolitan city, else the city.
  const parentId = needsZone ? zoneId : cityId;

  const { rows, loading, loadError, saveError, refresh, save, remove } =
    useLocationMaster({ type: 'Ward', parentId, enabled: !!parentId });

  useEffect(() => {
    fetchAllUlbs().then(setCities).catch(() => setScopeError('Could not load cities.'));
  }, []);

  useEffect(() => {
    setZoneId('');
    if (!cityId || !needsZone) { setZones([]); return; }
    fetchZonesOf(cityId).then(setZones).catch(() => setZones([]));
  }, [cityId, needsZone]);

  const reset = () => { setName(''); setCode(''); setEditId(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft: LocationDraft = {
      name, code, locationType: 'Ward', ulbType: null, parentLocationId: parentId, isActive: true,
    };
    if (await save(draft, editId)) reset();
  };

  const startEdit = (r: LocationRow) => { setName(r.name); setCode(r.code); setEditId(r.id); };

  const onDelete = async (r: LocationRow) => {
    if (!window.confirm(`Delete ${r.name}?`)) return;
    await remove(r.id);
  };

  const scopeLabel = needsZone
    ? `${city?.name ?? ''} › ${zones.find((z) => z.id === zoneId)?.name ?? ''}`
    : city?.name ?? '';

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Wards</h1>
      <p className="text-slate-600 mb-8">
        A metropolitan city's wards belong to one of its zones. A city or town holds its wards directly.
      </p>

      <div className="bg-white p-4 rounded-card shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className={labelCls}>City</label>
            <select aria-label="City" className={inputCls} value={cityId}
              onChange={(e) => { setCityId(e.target.value); reset(); }}>
              <option value="">Select a city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {cityTypeLabel(c.ulbType)}</option>
              ))}
            </select>
          </div>
          {needsZone && (
            <div className="flex-1 min-w-[240px]">
              <label className={labelCls}>Zone</label>
              <select aria-label="Zone" className={inputCls} value={zoneId}
                onChange={(e) => { setZoneId(e.target.value); reset(); }} disabled={!zones.length}>
                <option value="">{zones.length ? 'Select a zone' : 'No zones yet'}</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          )}
        </div>
        {scopeError && <p className="text-sm text-red-700 font-medium mt-3">{scopeError}</p>}
      </div>

      {needsZone && cityId && !zones.length && (
        <div className="mb-6 p-4 rounded-card bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800 font-medium">
            {city?.name} is a metropolitan city, so its wards must belong to a zone — but it has none yet.{' '}
            <Link to="/admin/masters/zones" className="underline font-bold">Add a zone first</Link>.
          </p>
        </div>
      )}

      {!parentId ? (
        <div className="bg-white rounded-card border border-slate-200 p-10 text-center text-slate-600">
          Select a {needsZone ? 'zone' : 'city'} above to manage its wards.
        </div>
      ) : (
        <>
          <div className="bg-white p-6 rounded-card shadow-sm border border-slate-200 mb-8">
            <h2 className="text-xl font-bold mb-4">{editId ? 'Edit' : 'Add'} Ward in {scopeLabel}</h2>
            <form onSubmit={submit} className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className={labelCls}>Name</label>
                <input className={inputCls} placeholder="e.g. Ward 12" value={name}
                  onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className={labelCls}>Code</label>
                <input className={inputCls} placeholder="e.g. NN-LKO-W012" value={code}
                  onChange={(e) => setCode(e.target.value)} required />
              </div>
              <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-control font-bold">
                {editId ? 'Update' : 'Save'}
              </button>
              {editId && (
                <button type="button" onClick={reset} className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2.5 rounded-control font-bold">
                  Cancel
                </button>
              )}
            </form>
          </div>

          {(loadError || saveError) && (
            <div className="mb-6 p-4 rounded-card bg-red-50 border border-red-200 flex items-start justify-between gap-4">
              <p className="text-sm text-red-700 font-medium">{saveError || loadError}</p>
              {loadError && (
                <button type="button" onClick={refresh} className="text-sm font-bold text-red-700 underline shrink-0 hover:text-red-800">Retry</button>
              )}
            </div>
          )}

          <div className="bg-white rounded-card shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-800">{r.name}</td>
                    <td className="px-6 py-4 text-slate-600">{r.code}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => startEdit(r)} className="text-brand-600 hover:text-brand-800 font-bold underline text-sm">Edit</button>
                      <button onClick={() => onDelete(r)} className="text-red-700 font-bold underline text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {!loading && !loadError && rows.length === 0 && (
              <div className="p-10 text-center text-slate-600">{scopeLabel} has no wards yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WardMaster;
```

- [ ] **Step 2: Typecheck and lint**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src/pages/Admin/Masters/WardMaster.tsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/Frontend/src/pages/Admin/Masters/WardMaster.tsx
git commit -m "feat(location): add Ward master scoped to a city and zone"
```

---

## Task 7: Route the three masters and retire the old one

**Files:**
- Modify: `src/Frontend/src/App.tsx`
- Delete: `src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx`

Read `App.tsx` first and match the surrounding conventions exactly — the snippets below are
taken from the current file, but confirm before pasting.

- [ ] **Step 1: Swap the import**

Replace the line:

```typescript
import LocationMaster from './pages/Admin/Masters/LocationMaster';
```

with:

```typescript
import CityMaster from './pages/Admin/Masters/CityMaster';
import ZoneMaster from './pages/Admin/Masters/ZoneMaster';
import WardMaster from './pages/Admin/Masters/WardMaster';
```

- [ ] **Step 2: Swap the `PAGE_META` entry**

Replace:

```typescript
  '/admin/masters/locations': { title: 'Locations', subtitle: 'Manage location master' },
```

with:

```typescript
  '/admin/masters/cities': { title: 'Cities', subtitle: 'Metropolitan cities, cities and towns' },
  '/admin/masters/zones': { title: 'Zones', subtitle: 'Zones within a metropolitan city' },
  '/admin/masters/wards': { title: 'Wards', subtitle: 'Wards within a zone, city or town' },
```

- [ ] **Step 3: Swap the entry in the masters-group path array**

This array (around line 302) is what keeps the Masters nav group expanded. Replace:

```typescript
    '/admin/masters/locations',
```

with:

```typescript
    '/admin/masters/cities',
    '/admin/masters/zones',
    '/admin/masters/wards',
```

- [ ] **Step 4: Swap the nav item**

Replace the single `Locations` `NavItem` with three, keeping the existing pin icon for Cities
and reusing the same stroke conventions:

```tsx
                    <NavItem to="/admin/masters/cities" text="Cities" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>} />
                    <NavItem to="/admin/masters/zones" text="Zones" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>} />
                    <NavItem to="/admin/masters/wards" text="Wards" indent={true} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M10 21v-6h4v6" /></svg>} />
```

- [ ] **Step 5: Swap the route, and redirect the old path**

Replace:

```tsx
      <Route path="/admin/masters/locations" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><LocationMaster /></Layout></PrivateRoute>} />
```

with:

```tsx
      <Route path="/admin/masters/cities" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><CityMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/zones" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><ZoneMaster /></Layout></PrivateRoute>} />
      <Route path="/admin/masters/wards" element={<PrivateRoute roles={['Admin', 'PMU']}><Layout><WardMaster /></Layout></PrivateRoute>} />
      {/* The single Locations master was split into the three above; keep old links working. */}
      <Route path="/admin/masters/locations" element={<Navigate to="/admin/masters/cities" replace />} />
```

`Navigate` is already imported in this file from `react-router-dom` — confirm with
`grep -n "Navigate" src/Frontend/src/App.tsx`. If it is not, add it to that import.

- [ ] **Step 6: Delete the old page**

```bash
git rm src/Frontend/src/pages/Admin/Masters/LocationMaster.tsx
```

- [ ] **Step 7: Confirm nothing else referenced it**

```bash
cd "src/Frontend" && grep -rn "LocationMaster\|masters/locations" src/ tests/
```

Expected: only the redirect route in `App.tsx`. Anything else is a live reference you must fix.

- [ ] **Step 8: Typecheck, lint, build**

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src && npm run build
```

Expected: no output from the first two; a successful Vite build.

- [ ] **Step 9: Commit**

```bash
git add src/Frontend/src/App.tsx
git commit -m "feat(location): route City, Zone and Ward masters; retire Locations master"
```

---

## Task 8: Verify end to end and update the system map

Services must be running (gateway on 5249). Start the dev server if it is not up, sign in as
`admin@posttender.local` / `Admin@123`.

- [ ] **Step 1: City Master**

Open **Masters → Cities**. Confirm:
- 218 rows, and the City Type column reads e.g. "Metropolitan City (Nagar Nigam)".
- Filtering City Type to *Metropolitan City* shows exactly **17**; *City* shows **201**; *Town* shows **0**.
- Search for `Lucknow` narrows to 1 row.

- [ ] **Step 2: The delete guard is visible to the user**

Still on Cities, click **Delete** on *Lucknow Nagar Nigam* and confirm the dialog. Expect the
save-error banner to read: `'Lucknow Nagar Nigam' still has 8 location(s) under it. Delete or
move those first.` — and the row must still be there after the list refreshes.

- [ ] **Step 3: Zone Master**

Open **Masters → Zones**. Confirm:
- The city dropdown lists exactly **17** cities (metropolitan only — no Nagar Palika Parishads).
- Selecting *Lucknow Nagar Nigam* lists its **8** zones.
- Add a zone: name `Plan Verify Zone`, code `PLAN-VZ1`. It appears in the list.
- Delete that same zone. It disappears. (It has no wards, so the guard permits it.)

- [ ] **Step 4: Ward Master — metropolitan path**

Open **Masters → Wards**. Confirm:
- The city dropdown lists all **218** cities with their tier.
- Selecting *Lucknow Nagar Nigam* reveals a **Zone** dropdown with 8 options; the ward list stays
  empty until a zone is chosen.
- Selecting *Zone 6* lists **14** wards, ordered Ward 70, 71, 72 … (numeric, not Ward 1, 10, 100).

- [ ] **Step 5: Ward Master — city path and the no-zones notice**

- Select a Nagar Palika Parishad (e.g. *Achhnera*). Confirm **no Zone dropdown appears** and the
  ward list loads directly (it will be empty — no NPP wards are seeded, which is expected).
- Add a ward there: name `Plan Verify Ward`, code `PLAN-VW1`. Confirm it saves and appears.
- Delete it again.

To exercise the amber "add a zone first" notice deterministically (all 17 seeded metropolitan
cities already have zones, so it will not appear for any of them):
- In **City Master**, add a city: name `Plan Verify Metro`, code `PLAN-VM1`, type *Metropolitan City*.
- In **Ward Master**, select it. Expect the Zone dropdown to render **disabled** reading
  "No zones yet", and the amber notice to appear with a working link to the Zone master.
- Confirm no ward form is offered (the scope is incomplete, so `parentId` is empty).
- Clean up: delete `Plan Verify Metro` from City Master. It has no children, so the guard allows it.

- [ ] **Step 6: The cascade still works and sees new data**

Open **Tenders → Add Tender**. Confirm the Urban Local Body Type → Municipality → Zone → Ward
cascade still behaves: *Nagar Nigam* → 17 municipalities; *Lucknow Nagar Nigam* → Zone step with
8 zones; picking a zone → its wards. This proves the `clearLocationCache()` call in the hook and
that `LocationCascade` was genuinely left working.

- [ ] **Step 7: The old link still resolves**

Navigate directly to `/admin/masters/locations` and confirm it lands on **Cities**.

- [ ] **Step 8: Full gates**

```bash
cd "src/Backend" && dotnet test PostTenderSystem.Tests/PostTenderSystem.Tests.csproj -c TestRun --nologo -v q
```

Expected: `Failed: 0, Passed: 163`. Then clean up the throwaway build output:

```bash
cd "src/Backend" && find . -type d -name TestRun \( -path "*/bin/*" -o -path "*/obj/*" \) -prune -exec rm -rf {} +
```

```bash
cd "src/Frontend" && npx tsc --noEmit && npx eslint src && npm run build && npx playwright test tests/e2e-vendor-chain.spec.ts --project=chromium --reporter=line
```

Expected: no output from tsc/eslint, a successful build, and `2 passed`.

- [ ] **Step 9: Update the system map**

In `system_map.md`, inside the "Urban Local Body Location Hierarchy (UP)" section, replace the
row for the Locations Master in the page table with:

```markdown
| City Master (Metropolitan / City / Town) | `/admin/masters/cities` | `src/Frontend/src/pages/Admin/Masters/CityMaster.tsx` |
| Zone Master (scoped to one metropolitan city) | `/admin/masters/zones` | `src/Frontend/src/pages/Admin/Masters/ZoneMaster.tsx` |
| Ward Master (scoped to a city, and a zone when metropolitan) | `/admin/masters/wards` | `src/Frontend/src/pages/Admin/Masters/WardMaster.tsx` |
```

And add this sentence directly beneath that table:

```markdown
Each master owns one level and fetches only that level (`?type=` / `?parentId=`). Zone and Ward
use a scope selector whose selection is also the parent for new rows, so an invalid parent is
unreachable from the UI. A location that still has children cannot be deleted.
```

- [ ] **Step 10: Commit**

```bash
git add system_map.md
git commit -m "docs: record the City, Zone and Ward masters in the system map"
```

---

## Known Limitations (state these plainly; do not paper over them)

1. **No frontend unit tests.** This repo has no component test harness, so every frontend task
   is verified by typecheck, lint, build and explicit browser checks. Adding a harness is a
   separate piece of work.
2. **Deleting a ward still referenced by a tender is not blocked.** `Tender.WardId` lives in
   TenderService and `Location` in CommonService; there is no cross-service FK and this codebase
   makes no service-to-service calls. The new guard only protects the location tree's own
   integrity. A tender pointing at a deleted ward would render a blank ward name.
3. **Nagar Panchayats are not seeded** (0 rows), so the Town tier will be empty in the City
   Master filter. That is pre-existing.
4. **Nagar Palika Parishads have no wards seeded**, so the Ward Master will show an empty list
   for all 201 of them until wards are added. Also pre-existing.
5. **The legacy `District` row** (`UI Audit Zone 33259`) is not surfaced by any of the three
   masters, since none of them query `type=District`. It is inert and left alone deliberately.
