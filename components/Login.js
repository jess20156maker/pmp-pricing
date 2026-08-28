"use client";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { window.location.reload(); return; }
    const d = await res.json().catch(() => ({}));
    setError(d.error || "Could not sign in");
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={signIn}>
        <h1>PMP Sales Pricing</h1>
        <p>Sign in with your work email and the team password.</p>
        <input
          type="email" value={email} autoFocus required
          autoComplete="email" placeholder="you@postmarketpublishing.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password" value={password} required
          autoComplete="current-password" placeholder="Team password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {error && <div className="login-err">{error}</div>}
      </form>
    </div>
  );
}
