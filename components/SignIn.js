"use client";
import { useEffect, useState } from "react";

// Sign-in is only for Post Market Publishing staff. Customers never see this —
// they land straight on the price list.
export default function SignIn({ onClose }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function submit(e) {
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
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="si" onSubmit={submit}>
        <h3 id="si">Staff sign in</h3>
        <p className="modal-field">
          Price changes are made by the Post Market Publishing team. Sign in with your
          work email to request one.
        </p>
        <label className="modal-label" htmlFor="signin-email">Work email</label>
        <input
          id="signin-email" type="email" className="modal-input signin-input"
          value={email} autoFocus required autoComplete="email"
          placeholder="you@postmarketpublishing.com" disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className="modal-err">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn go" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      </form>
    </div>
  );
}
