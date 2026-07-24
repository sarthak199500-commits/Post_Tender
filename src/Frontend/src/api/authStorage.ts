/**
 * Where the session lives.
 *
 * "Remember Me" on the login form used to be an unbound checkbox — it rendered, it
 * toggled, and it changed nothing, because the token was always written to
 * localStorage. It now selects the backing store: localStorage survives the browser
 * closing, sessionStorage does not.
 *
 * Reads check both so an existing session keeps working whichever store holds it.
 */
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const getToken = (): string | null =>
    localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);

export const getStoredUser = (): string | null =>
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);

export const setSession = (token: string, user: unknown, remember: boolean): void => {
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    // Clear the other store first so a "remember me" login can't leave a stale
    // token behind that a later read would pick up.
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
    target.setItem(TOKEN_KEY, token);
    target.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = (): void => {
    for (const store of [localStorage, sessionStorage]) {
        store.removeItem(TOKEN_KEY);
        store.removeItem(USER_KEY);
    }
};
