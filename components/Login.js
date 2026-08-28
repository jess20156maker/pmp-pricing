"use client";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
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
        <p>Enter your email to see current pricing.</p>
        <input
          type="email" value={email} autoFocus required
          autoComplete="email" placeholder="you@company.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Signing in…" : "View pricing"}</button>
        {error && <div className="login-err">{error}</div>}
        <p className="login-note">
          Post Market Publishing staff are recognised automatically and can request price changes.
        </p>
      </form>
    </div>
  );
}
