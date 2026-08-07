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
 * Scoped on the server via ?type= / ?parentId= rather than pulling all ~1,672 rows and
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
