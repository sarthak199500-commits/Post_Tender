import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
    const raw = localStorage.getItem('user');
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
  token: localStorage.getItem('token'),
  user: parseStoredUser(),
  isAuthenticated: !!localStorage.getItem('token'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) => {
      const { user, token } = action.payload;
      const normalizedUser = { ...user, role: normalizeRole(user.role) };
      state.user = normalizedUser;
      state.token = token;
      state.isAuthenticated = true;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
