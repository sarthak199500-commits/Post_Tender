import React, { useEffect, useState } from 'react';
import {
  ULB_TYPES, fetchUlbs, fetchChildren, fetchUlbById, splitChildren,
  type LocationRow, type UlbTypeKey,
} from '../api/locationsService';

export interface LocationValue {
  ulbId: string;
  zoneId: string;
  wardId: string;
}

interface Props {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Renders compactly on one row for filter bars. */
  inline?: boolean;
  disabled?: boolean;
}

const selectCls =
  'w-full border border-slate-300 rounded-control px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400';

/**
 * Urban Local Body Type -> ULB -> (Zone) -> Ward.
 *
 * The Zone step appears only when the selected ULB actually has Zone children. Nothing here
 * keys off the ULB type: a Nagar Nigam without zone data correctly skips the step, and a
 * Palika Parishad that later gains zones gains the step, with no code change.
 */
export const LocationCascade: React.FC<Props> = ({ value, onChange, inline = false, disabled = false }) => {
  const [ulbType, setUlbType] = useState<UlbTypeKey | ''>('');
  const [ulbs, setUlbs] = useState<LocationRow[]>([]);
  const [zones, setZones] = useState<LocationRow[]>([]);
  const [wards, setWards] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Editing an existing record: value.ulbId arrives before the user has picked a type, so
  // the type has to be recovered from the data — otherwise the first two dropdowns render
  // blank even though a real location is set.
  useEffect(() => {
    if (!value.ulbId || ulbType) return;
    fetchUlbById(value.ulbId)
      .then((u) => { if (u?.ulbType) setUlbType(u.ulbType as UlbTypeKey); })
      .catch(() => { /* leave the type unset; the user can still pick one manually */ });
  }, [value.ulbId, ulbType]);

  useEffect(() => {
    if (!ulbType) { setUlbs([]); return; }
    setLoading(true);
    fetchUlbs(ulbType)
      .then(setUlbs)
      .catch(() => setUlbs([]))
      .finally(() => setLoading(false));
  }, [ulbType]);

  // Children of the ULB decide whether Zone applies.
  useEffect(() => {
    if (!value.ulbId) { setZones([]); setWards([]); return; }
    setLoading(true);
    fetchChildren(value.ulbId)
      .then((children) => {
        const { zones: z, wards: w } = splitChildren(children);
        setZones(z);
        setWards(w);
      })
      .catch(() => { setZones([]); setWards([]); })
      .finally(() => setLoading(false));
  }, [value.ulbId]);

  // When a zone is chosen the wards come from under it instead.
  useEffect(() => {
    if (!value.zoneId) return;
    setLoading(true);
    fetchChildren(value.zoneId)
      .then((children) => setWards(splitChildren(children).wards))
      .catch(() => setWards([]))
      .finally(() => setLoading(false));
  }, [value.zoneId]);

  const hasZones = zones.length > 0;
  const wrap = inline ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4';
  const field = inline ? 'min-w-[180px] flex-1' : '';

  return (
    <div className={wrap}>
      <div className={field}>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Urban Local Body Type</label>
        <select
          aria-label="Urban Local Body Type"
          className={selectCls}
          disabled={disabled}
          value={ulbType}
          onChange={(e) => {
            setUlbType(e.target.value as UlbTypeKey | '');
            onChange({ ulbId: '', zoneId: '', wardId: '' });
          }}
        >
          <option value="">Select Urban Local Body</option>
          {ULB_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      <div className={field}>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Municipality</label>
        <select
          aria-label="Municipality"
          className={selectCls}
          disabled={disabled || !ulbType || loading}
          value={value.ulbId}
          onChange={(e) => onChange({ ulbId: e.target.value, zoneId: '', wardId: '' })}
        >
          <option value="">{ulbType ? 'Select Municipality' : 'Select a type first'}</option>
          {ulbs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {hasZones && (
        <div className={field}>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Zone</label>
          <select
            aria-label="Zone"
            className={selectCls}
            disabled={disabled || !value.ulbId}
            value={value.zoneId}
            onChange={(e) => onChange({ ...value, zoneId: e.target.value, wardId: '' })}
          >
            <option value="">Select Zone</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
      )}

      <div className={field}>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Ward</label>
        <select
          aria-label="Ward"
          className={selectCls}
          disabled={disabled || !value.ulbId || (hasZones && !value.zoneId)}
          value={value.wardId}
          onChange={(e) => onChange({ ...value, wardId: e.target.value })}
        >
          <option value="">
            {hasZones && !value.zoneId ? 'Select a zone first' : 'Select Ward'}
          </option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
    </div>
  );
};
