const AUTH_KEY = "kanban-authenticated";

export const getAuth = () =>
    typeof window !== "undefined" &&
    window.localStorage.getItem(AUTH_KEY) === "true";

export const saveAuth = () =>
    typeof window !== "undefined" &&
    window.localStorage.setItem(AUTH_KEY, "true");

export const clearAuth = () =>
    typeof window !== "undefined" &&
    window.localStorage.removeItem(AUTH_KEY);