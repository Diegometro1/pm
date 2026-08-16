"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { clearAuth, getAuth, saveAuth } from "@/lib/auth";
import type { FormEvent } from "react";
const VALID_USERNAME = "user";
const VALID_PASSWORD = "password";

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAuthenticated(getAuth());
    setLoading(false);
  }, []);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      saveAuth();
      setAuthenticated(true);
      setError("");
      return;
    }
    setError("Invalid username or password");
  };

  const handleLogout = () => {
    clearAuth();
    setAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-semibold mb-6">Sign in</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded-2xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white"
            >
              Sign in
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <KanbanBoard onLogout={handleLogout} />;
}