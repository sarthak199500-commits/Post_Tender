import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { clearSession, getStoredUser, getToken, setSession } from '../api/authStorage';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  // Present only for Vendor logins. Minted into the JWT as the vendorId claim and
  // returned nested under `user` by /api/auth/login, so it arrives via the spread below.
  vendorId?: string | null;
}

// Maps numeric role enum values (from old cached sessions) to string names
const normalizeRole = (role: string | number): string => {
  const roleMap: Record<number, string> = { 0: 'Admin', 1: 'PMU', 2: 'Vendor', 3: 'Finance', 4: 'Inspector', 5: 'Department' };
  if (typeof role === 'number') return roleMap[role] ?? 'Unknown';
  if (typeof role === 'string' && !isNaN(Number(role))) return roleMap[Number(role)] ?? role;
  return role;
};

const parseStoredUser = (): User | null => {
  try {
    const raw = getStoredUser();
    if (!raw) return null;
    const u = JSON.parse(raw);
    return { ...u, role: normalizeRole(u.role) };
  } catch {
    return null;
  }
};

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: getToken(),
  user: parseStoredUser(),
  isAuthenticated: !!getToken(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string; remember?: boolean }>
    ) => {
      const { user, token, remember = true } = action.payload;
      const normalizedUser = { ...user, role: normalizeRole(user.role) };
      state.user = normalizedUser;
      state.token = token;
      state.isAuthenticated = true;
      setSession(token, normalizedUser, remember);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      clearSession();
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
