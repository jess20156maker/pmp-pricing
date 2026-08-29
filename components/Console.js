"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PRICE_FIELDS } from "@/lib/fields";
import SignIn from "@/components/SignIn";

const PAGE = 100;
const money = (v) => (v === null || v === undefined || v === "" ? "" : String(v));

// Always US Eastern, so a request reads the same for everyone regardless of
// where the person looking at it happens to be.
const whenET = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short",
    }) + " ET";
  } catch { return ""; }
};

function uniq(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
}

export default function Console({ email, role, signedIn }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {row, field}
  const [queue, setQueue] = useState(null);      // pending requests, approver/sales
  const [showQueue, setShowQueue] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const isCustomer = role === "customer";
  const isApprover = role === "approver";
  const canAsk = role === "sales" || role === "approver";

  const [q, setQ] = useState("");
  // Customers are never sent Site Status, so defaulting this filter to "Live Site"
  // would match nothing and show them an empty grid.
  const [status, setStatus] = useState(role === "customer" ? "" : "Live Site");
  const [sellable, setSellable] = useState("");
  const [brand, setBrand] = useState("");
  const [agency, setAgency] = useState("");
  const [project, setProject] = useState("");
  const [drMin, setDrMin] = useState("");
  const [drMax, setDrMax] = useState("");
  const [gpMin, setGpMin] = useState("");
  const [gpMax, setGpMax] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [allocOnly, setAllocOnly] = useState(false);

  const [pendingOnly, setPendingOnly] = useState(false);
  const [sort, setSort] = useState({ key: "dr", dir: -1 });
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async (refresh) => {
    setError("");
    const res = await fetch(`/api/sites${refresh ? "?refresh=1" : ""}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not load sites");
      return;
    }
    const data = await res.json();
    setRows(data.rows);
  }, []);

  useEffect(() => { load(false); }, [load]);


  const statuses = useMemo(() => (rows ? uniq(rows, "status") : []), [rows]);
  const brands = useMemo(() => (rows ? uniq(rows, "brand") : []), [rows]);
  const agencies = useMemo(() => (rows ? uniq(rows, "agency") : []), [rows]);
  const projects = useMemo(() => (rows ? uniq(rows, "project") : []), [rows]);

  // One pending request per price cell, keyed so a cell can show its own state.
  const pendingByCell = useMemo(() => {
    const m = new Map();
    for (const r of queue || []) m.set(`${r.recordId}:${r.fieldKey}`, r);
    return m;
  }, [queue]);

  const pendingIds = useMemo(() => new Set((queue || []).map((r) => r.recordId)), [queue]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    const nDrMin = drMin === "" ? null : Number(drMin);
    const nDrMax = drMax === "" ? null : Number(drMax);
    const nGpMin = gpMin === "" ? null : Number(gpMin);
    const nGpMax = gpMax === "" ? null : Number(gpMax);

    const out = rows.filter((r) => {
      if (needle && !(`${r.website} ${r.siteName}`.toLowerCase().includes(needle))) return false;
      if (status && r.status !== status) return false;
      if (sellable && r.sellable !== sellable) return false;
      if (brand && r.brand !== brand) return false;
      if (agency && r.agency !== agency) return false;
      if (project && r.project !== project) return false;
      if (nDrMin !== null && (r.dr ?? -1) < nDrMin) return false;
      if (nDrMax !== null && (r.dr ?? 1e9) > nDrMax) return false;
      const gp = r.prices.gp;
      if (nGpMin !== null && (gp ?? -1) < nGpMin) return false;
      if (nGpMax !== null && (gp ?? 1e9) > nGpMax) return false;
      if (vipOnly && !r.vip) return false;
      if (allocOnly && !r.allocation) return false;
      if (pendingOnly && !pendingIds.has(r.id)) return false;
      return true;
    });

    const { key, dir } = sort;
    const val = (r) =>
      key === "website" ? r.website
      : key === "siteName" ? r.siteName
      : key === "dr" ? (r.dr ?? -1)
      : r.prices[key] ?? -1;

    return out.sort((a, b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rows, q, status, sellable, brand, agency, project, drMin, drMax, gpMin, gpMax, vipOnly, allocOnly, pendingOnly, pendingIds, sort]);

  useEffect(() => { setShown(PAGE); }, [q, status, sellable, brand, agency, project, drMin, drMax, gpMin, gpMax, vipOnly, allocOnly, pendingOnly, sort]);

  const sentinel = useRef(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setShown((s) => s + PAGE);
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const openEditor = useCallback((row, field) => {
    if (!signedIn) {
      // Remember which cell, so signing in lands back on it rather than
      // dropping the person at the top of a 5,000 row table.
      try {
        sessionStorage.setItem("pmp_intent", JSON.stringify({ id: row.id, key: field.key }));
      } catch { /* private browsing */ }
      setShowSignIn(true);
      return;
    }
    setEditing({ row, field });
  }, [signedIn]);

  // The saved value lives in rows state, so the grid re-renders from one source
  // of truth instead of each cell holding its own copy.
  // Airtable can still report a just-decided request as Pending for a moment
  // after the write. Without this the cell flicks back to amber and looks as
  // though the approval did not take.
  const decided = useRef(new Set());

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/requests");
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    setQueue((d.requests || []).filter((r) => !decided.current.has(r.id)));
  }, []);

  useEffect(() => { if (canAsk) loadQueue(); }, [canAsk, loadQueue]);

  // Reopen whatever was clicked before signing in.
  useEffect(() => {
    if (!rows || !canAsk) return;
    let intent;
    try {
      const raw = sessionStorage.getItem("pmp_intent");
      if (!raw) return;
      sessionStorage.removeItem("pmp_intent");
      intent = JSON.parse(raw);
    } catch { return; }
    const row = rows.find((r) => r.id === intent?.id);
    const field = PRICE_FIELDS.find((f) => f.key === intent?.key);
    if (row && field) setEditing({ row, field });
  }, [rows, canAsk]);

  // Sales raise a request; an approver writes straight through. The server
  // enforces this too — this only decides which endpoint to call.
  const savePrice = useCallback(async (row, field, next) => {
    if (!isApprover) {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: row.id, fieldKey: field.key, value: next === "" ? null : next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send that request");
      await loadQueue();
      return { requested: true };
    }

    const res = await fetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: row.id, fieldKey: field.key, value: next === "" ? null : next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save that price");
    setRows((rs) => rs.map((r) =>
      r.id === row.id ? { ...r, prices: { ...r.prices, [field.key]: data.value } } : r
    ));
    return data;
  }, [isApprover, loadQueue]);

  const decide = useCallback(async (req, decision) => {
    const id = req.id;
    const res = await fetch("/api/requests/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not record that decision");

    // Drop it locally first, so the cell clears immediately either way.
    decided.current.add(id);
    setQueue((q) => (q || []).filter((r) => r.id !== id));

    // Apply the value the server confirmed, rather than refetching — a read
    // straight after the write can still come back with the old price.
    if (decision === "approve") {
      setRows((rs) => (rs || []).map((r) =>
        r.id === req.recordId
          ? { ...r, prices: { ...r.prices, [req.fieldKey]: data.value } }
          : r
      ));
    }

    await loadQueue();
    return data;
  }, [loadQueue]);

  function clearAll() {
    setQ(""); setStatus(role === "customer" ? "" : ""); setSellable(""); setBrand(""); setAgency(""); setProject("");
    setDrMin(""); setDrMax(""); setGpMin(""); setGpMax("");
    setVipOnly(false); setAllocOnly(false); setPendingOnly(false);
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "website" || key === "siteName" ? 1 : -1 }));
  }

  const visible = filtered.slice(0, shown);

  if (rows === null) {
    return (
      <>
        <Header email={email} role={role} signedIn={signedIn}
          onSignIn={() => setShowSignIn(true)} onRefresh={() => load(true)} count="" />
        <div className="sentinel">Loading…</div>
      </>
    );
  }

  return (
    <>
      <Header
        email={email}
        role={role}
        signedIn={signedIn}
        onSignIn={() => setShowSignIn(true)}
        onRefresh={() => { setRows(null); load(true); }}
        count={`${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} sites`}
      >
        <div className="filters">
          <input type="search" placeholder="Search domain or site name…" value={q} onChange={(e) => setQ(e.target.value)} />
          {!isCustomer && <Select value={status} onChange={setStatus} options={statuses} label="Any status" />}
          {!isCustomer && <Select value={sellable} onChange={setSellable} options={["Yes", "Paused", "No"]} label="Any sellable" />}
          {!isCustomer && <Select value={brand} onChange={setBrand} options={brands} label="Any brand" />}
          {!isCustomer && <Select value={agency} onChange={setAgency} options={agencies} label="Any agency" />}
          {!isCustomer && <Select value={project} onChange={setProject} options={projects} label="Any project" />}
          <input className="num" placeholder="DR ≥" value={drMin} onChange={(e) => setDrMin(e.target.value)} />
          <input className="num" placeholder="DR ≤" value={drMax} onChange={(e) => setDrMax(e.target.value)} />
          <input className="num" placeholder="GP ≥" value={gpMin} onChange={(e) => setGpMin(e.target.value)} />
          <input className="num" placeholder="GP ≤" value={gpMax} onChange={(e) => setGpMax(e.target.value)} />
          {!isCustomer && <label className="chip"><input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} /> VIP</label>}
          {isApprover && <label className="chip"><input type="checkbox" checked={allocOnly} onChange={(e) => setAllocOnly(e.target.checked)} /> Allocation</label>}
          {canAsk && queue !== null && queue.length > 0 && (
            <label className="chip chip-pending">
              <input type="checkbox" checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)} />
              {" "}Awaiting approval ({queue.length})
            </label>
          )}
          <button className="linkbtn" onClick={clearAll}>Clear</button>
        </div>
      </Header>

      {error && <div className="err-banner">{error}</div>}

      {canAsk && queue !== null && queue.length > 0 && (
        <div className="queue-bar">
          <b>{queue.length}</b> price {queue.length === 1 ? "change is" : "changes are"} waiting for approval
          <button className="linkbtn" onClick={() => setShowQueue((v) => !v)}>
            {showQueue ? "Hide" : "Review"}
          </button>
          <button className="linkbtn" onClick={() => setPendingOnly((v) => !v)}>
            {pendingOnly ? "Show all sites" : "Show only these"}
          </button>
        </div>
      )}

      {showQueue && canAsk && (
        <Queue
          items={queue || []}
          canApprove={isApprover}
          onDecide={decide}
          onClose={() => setShowQueue(false)}
        />
      )}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort("website")}>Website</th>
              <th onClick={() => toggleSort("siteName")}>Site Name</th>
              <th className="num" onClick={() => toggleSort("dr")}>DR</th>
              <th>Niche</th>
              {!isCustomer && <th>Status</th>}
              {PRICE_FIELDS.map((f) => (
                <th key={f.key} className="num" onClick={() => toggleSort(f.key)} title={f.name}>{f.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <Row key={r.id} row={r} onEdit={openEditor} readOnly={signedIn && isCustomer} isCustomer={isCustomer} pendingByCell={pendingByCell} />
            ))}
          </tbody>
        </table>
        {shown < filtered.length && <div className="sentinel" ref={sentinel}>Loading more…</div>}
        {filtered.length === 0 && <div className="sentinel">No sites match those filters.</div>}
      </div>

      {showSignIn && <SignIn onClose={() => setShowSignIn(false)} />}

      {editing && (
        <PriceEditor
          row={editing.row}
          field={editing.field}
          email={email}
          isApprover={isApprover}
          pending={pendingByCell.get(`${editing.row.id}:${editing.field.key}`)}
          onSave={savePrice}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function PriceEditor({ row, field, email, isApprover, pending, onSave, onClose }) {
  const current = money(row.prices[field.key]);
  // With a request in flight, you are editing the requested value, not the live one.
  const [value, setValue] = useState(pending ? money(pending.newValue) : current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const next = value.trim();
  // With a request pending you are revising it, so "changed" is measured against
  // what was asked for rather than the price on the record.
  const changed = pending ? next !== money(pending.newValue) : next !== current;
  const show = (v) => (v === "" || v === null ? "—" : `$${v}`);

  async function submit(e) {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true); setError("");
    try {
      await onSave(row, field, next);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ct" onSubmit={submit}>
        <h3 id="ct">
          {pending ? "Pending price approval" : isApprover ? "Edit price" : "Request a price change"}
        </h3>
        <div className="modal-site">{row.website}</div>
        <div className="modal-field">{field.label}</div>

        {pending && (
          <div className="pending-note">
            <b>Waiting for approval.</b>{" "}
            {pending.oldValue === "" ? "—" : `$${pending.oldValue}`} →{" "}
            {pending.newValue === "" ? "—" : `$${pending.newValue}`}, requested by{" "}
            {pending.requestedBy}
            {pending.requestedAt ? ` on ${whenET(pending.requestedAt)}` : ""}.
            {isApprover
              ? " Approve or reject it from the banner at the top."
              : " Change the figure below to revise it — the price moves only once an approver accepts."}
          </div>
        )}

        <label className="modal-label" htmlFor="price-input">New price (USD)</label>
        <input
          id="price-input"
          ref={inputRef}
          className="modal-input"
          value={value}
          placeholder="—"
          inputMode="decimal"
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="modal-hint">Leave empty to clear the price.</div>

        <div className="modal-change">
          <span className="from">{show(current)}</span>
          <span className="to-arrow">→</span>
          <span className="to">{show(next)}</span>
        </div>

        <p className="modal-warn">
          {isApprover
            ? "This writes straight to the master database. The new price is what everyone sees — the sales sheet, quotes, and anywhere else this site is listed."
            : "This does not change the price yet. It goes to an approver, and the price updates only once they approve it."}
        </p>
        <p className="modal-by">Recorded against <b>{email}</b></p>
        {error && <p className="modal-err">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn go" disabled={!changed || busy}>
            {busy
              ? (isApprover ? "Saving…" : "Sending…")
              : isApprover
                ? "Update price"
                : pending
                  ? "Update request"
                  : "Send for approval"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Queue({ items, canApprove, onDecide, onClose }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function act(req, decision) {
    setBusyId(req.id); setError("");
    try {
      await onDecide(req, decision);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const show = (v) => (v === "" || v === null ? "—" : `$${v}`);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="qt">
        <h3 id="qt">Pending price changes</h3>
        <p className="modal-field">
          {canApprove
            ? "Approving writes the price to the master database and records it in the change log."
            : "Waiting on an approver. You can see what has been asked for, but not decide it."}
        </p>

        {error && <p className="modal-err">{error}</p>}

        {items.length === 0 && <p className="modal-field">Nothing waiting.</p>}

        <ul className="queue">
          {items.map((r) => (
            <li key={r.id} className="queue-item">
              <div className="queue-main">
                <div className="queue-site">{r.website}</div>
                <div className="queue-field">{r.fieldName}</div>
                <div className="modal-change">
                  <span className="from">{show(r.oldValue)}</span>
                  <span className="to-arrow">→</span>
                  <span className="to">{show(r.newValue)}</span>
                </div>
                <div className="queue-by">
                  Requested by <b>{r.requestedBy}</b>
                  {r.requestedAt ? ` · ${whenET(r.requestedAt)}` : ""}
                </div>
              </div>
              {canApprove && (
                <div className="queue-actions">
                  <button className="btn ghost" disabled={busyId === r.id}
                    onClick={() => act(r, "reject")}>Reject</button>
                  <button className="btn go" disabled={busyId === r.id}
                    onClick={() => act(r, "approve")}>
                    {busyId === r.id ? "Working…" : "Approve"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const ROLE_LABEL = { customer: "Read only", sales: "Sales", approver: "Approver" };

function Header({ email, role, signedIn, onSignIn, onRefresh, count, children }) {
  return (
    <div className="top">
      <div className="top-row">
        <span className="brand">PMP Sales Pricing</span>
        <span className="count">{count}</span>
        {signedIn && (
          <span className="who" title="Every price you change is recorded against this address">{email}</span>
        )}
        {signedIn && role && <span className={`role role-${role}`}>{ROLE_LABEL[role] || role}</span>}
        <button className="linkbtn" onClick={onRefresh}>Refresh</button>
        {signedIn ? (
          <button className="linkbtn" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.reload(); }}>Sign out</button>
        ) : (
          <button className="linkbtn" onClick={onSignIn}>Sign in</button>
        )}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, label }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Row({ row, onEdit, isCustomer, readOnly, pendingByCell }) {
  return (
    <tr>
      <td className="site" data-label="Site">
        {row.fullUrl ? <a href={row.fullUrl} target="_blank" rel="noreferrer">{row.website}</a> : row.website}
      </td>
      <td className="name" data-label="Name">{row.siteName}</td>
      <td className="num" data-label="DR">{row.dr ?? ""}</td>
      <td className="niche muted" data-label="Niche">{row.niche}</td>
      {!isCustomer && <td className="muted" data-label="Status">{row.status}</td>}
      {PRICE_FIELDS.map((f) => (
        <td key={f.key} className="num" data-label={f.short}>
          <PriceCell row={row} field={f} onEdit={onEdit} readOnly={readOnly} pending={pendingByCell?.get(`${row.id}:${f.key}`)} />
        </td>
      ))}
    </tr>
  );
}

function PriceCell({ row, field, onEdit, readOnly, pending }) {
  const value = money(row.prices[field.key]);

  // A signed-in customer gets plain text. Someone not signed in keeps a
  // clickable cell, which is how staff reach the sign-in prompt.
  if (readOnly) return <span className="price-ro">{value === "" ? "—" : value}</span>;

  const cell = (
    <button
      type="button"
      className={`price ${pending ? "pending" : ""}`}
      onClick={() => onEdit(row, field)}
      title={pending ? undefined : `Edit ${field.label} for ${row.website}`}
    >
      {value === "" ? "—" : value}
      {pending && <span className="pending-dot" aria-hidden="true">•</span>}
      {pending && <span className="sr-only"> — waiting for approval</span>}
    </button>
  );

  if (!pending) return cell;

  return <PendingCell cell={cell} pending={pending} />;
}

// The tooltip sits inside a scrolling table, so it would be clipped by the
// viewport edge on the last rows. Measure on hover and flip it above instead.
function PendingCell({ cell, pending }) {
  const [up, setUp] = useState(false);
  const wrap = useRef(null);

  function place() {
    const r = wrap.current?.getBoundingClientRect();
    if (r) setUp(window.innerHeight - r.bottom < 120);
  }

  const show = (v) => (v === "" || v === null ? "—" : `$${v}`);

  // Our own tooltip rather than title=, so it shows at once instead of after
  // the browser's delay, and can carry the whole request rather than one line.
  return (
    <span
      className="tip-wrap"
      ref={wrap}
      onMouseEnter={place}
      onFocus={place}
    >
      {cell}
      <span className={`tip ${up ? "tip-up" : ""}`} role="tooltip">
        <b>Waiting for approval</b>
        <span className="tip-change">{show(pending.oldValue)} → {show(pending.newValue)}</span>
        <span className="tip-by">Requested by {pending.requestedBy}</span>
      </span>
    </span>
  );
}
