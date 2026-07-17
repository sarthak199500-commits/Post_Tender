import type { RootState } from '../store';

/**
 * The logged-in user's vendor id, taken from the vendorId claim the backend mints at
 * login. Null for every non-vendor role.
 *
 * Prefer this over fetching /vendors and matching client-side: that pattern required
 * every vendor to be able to read every other vendor's record, which is exactly the
 * cross-tenant read the backend now scopes away.
 */
export const selectVendorId = (state: RootState): string | null =>
  state.auth.user?.vendorId ?? null;
