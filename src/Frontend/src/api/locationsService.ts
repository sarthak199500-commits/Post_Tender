import axiosInstance from './axiosInstance';

export type UlbTypeKey = 'NagarNigam' | 'NagarPalikaParishad' | 'NagarPanchayat';

export interface LocationRow {
  id: string;
  name: string;
  code: string;
  locationType: string;
  ulbType?: string | null;
  parentLocationId?: string | null;
  isActive: boolean;
}

export interface WardMemberRow {
  id: string;
  wardId: string;
  name: string;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

/** UP has exactly three statutory tiers. UP-only build. */
export const ULB_TYPES: { key: UlbTypeKey; label: string }[] = [
  { key: 'NagarNigam', label: 'Nagar Nigam (Municipal Corporation)' },
  { key: 'NagarPalikaParishad', label: 'Nagar Palika Parishad (Municipal Council)' },
  { key: 'NagarPanchayat', label: 'Nagar Panchayat' },
];

// Locations are static master data and the cascade remounts on every route change, so a
// module-level cache keeps this to one request per level per session. Same rationale as
// notificationsService's cache.
const cache = new Map<string, LocationRow[]>();

const get = async (params: Record<string, string>): Promise<LocationRow[]> => {
  const key = JSON.stringify(params);
  if (cache.has(key)) return cache.get(key)!;
  const { data } = await axiosInstance.get<LocationRow[]>('/masters/locations', { params });
  const rows = (data ?? []).filter((r) => r.isActive);
  cache.set(key, rows);
  return rows;
};

export const fetchUlbs = (ulbType: UlbTypeKey) => get({ type: 'Ulb', ulbType });

export const fetchChildren = (parentId: string) => get({ parentId });

/**
 * Recovers a ULB by id so an existing record can be rendered without knowing its type
 * up front. Reuses the same cache as fetchUlbs, so this costs at most one extra request.
 */
export const fetchUlbById = async (id: string): Promise<LocationRow | null> =>
  (await get({ type: 'Ulb' })).find((u) => u.id === id) ?? null;

/**
 * Whether the Zone step applies is read from the data, never from the ULB type or a flag.
 * "Maintains zones" literally means "has Zone children". A flag could disagree with reality
 * and strand the user on an empty dropdown; this cannot.
 */
export const splitChildren = (children: LocationRow[]) => ({
  zones: children.filter((c) => c.locationType === 'Zone'),
  wards: children.filter((c) => c.locationType === 'Ward'),
});

export const fetchWardMembers = async (wardId: string): Promise<WardMemberRow[]> => {
  const { data } = await axiosInstance.get<WardMemberRow[]>('/masters/wardmembers', { params: { wardId } });
  return data ?? [];
};

export const clearLocationCache = () => cache.clear();
