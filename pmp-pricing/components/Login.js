"use client";
import { useState } from "react";

export default function Login() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupCode, setSetupCode] = useState("");

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not send the code");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.setupCode) setSetupCode(data.setupCode);
    setStep("code");
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (res.ok) { window.location.reload(); return; }
    const d = await res.json().catch(() => ({}));
    setError(d.error || "Could not sign in");
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      {step === "email" ? (
        <form className="login-card" onSubmit={requestCode}>
          <h1>PMP Sales Pricing</h1>
          <p>Sign in with your work email.</p>
          <input
            type="email" value={email} autoFocus required
            autoComplete="email" placeholder="you@postmarketpublishing.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
          {error && <div className="login-err">{error}</div>}
        </form>
      ) : (
        <form className="login-card" onSubmit={verify}>
          <h1>{setupCode ? "Setup mode" : "Check your email"}</h1>
          <p>
            {setupCode
              ? "No email was sent — SETUP_MODE is on."
              : `We sent a six-digit code to ${email}.`}
          </p>
          {setupCode && (
            <div className="setup-code">
              <code>{setupCode}</code>
              <span>Turn SETUP_MODE off before sales use this.</span>
            </div>
          )}
          <input
            inputMode="numeric" value={code} autoFocus required
            autoComplete="one-time-code" placeholder="000000" maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
          {error && <div className="login-err">{error}</div>}
          <button
            type="button" className="linkbtn" style={{ width: "100%", marginTop: 10 }}
            onClick={() => { setStep("email"); setCode(""); setError(""); }}
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
