"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PRICE_FIELDS } from "@/lib/fields";

const PAGE = 100;
const money = (v) => (v === null || v === undefined || v === "" ? "" : String(v));

function uniq(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();
}

export default function Console({ email }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // {row, field}

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Live Site");
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
  }, [rows, q, status, sellable, brand, agency, project, drMin, drMax, gpMin, gpMax, vipOnly, allocOnly, sort]);

  useEffect(() => { setShown(PAGE); }, [q, status, sellable, brand, agency, project, drMin, drMax, gpMin, gpMax, vipOnly, allocOnly, sort]);

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

  const openEditor = useCallback((row, field) => setEditing({ row, field }), []);

  // The saved value lives in rows state, so the grid re-renders from one source
  // of truth instead of each cell holding its own copy.
  const savePrice = useCallback(async (row, field, next) => {
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
  }, []);

  function clearAll() {
    setQ(""); setStatus(""); setSellable(""); setBrand(""); setAgency(""); setProject("");
    setDrMin(""); setDrMax(""); setGpMin(""); setGpMax("");
    setVipOnly(false); setAllocOnly(false);
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "website" || key === "siteName" ? 1 : -1 }));
  }

  const visible = filtered.slice(0, shown);

  if (rows === null) {
    return (
      <>
        <Header email={email} onRefresh={() => load(true)} count="" />
        <div className="sentinel">Loading sites from Airtable…</div>
      </>
    );
  }

  return (
    <>
      <Header
        email={email}
        onRefresh={() => { setRows(null); load(true); }}
        count={`${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} sites`}
      >
        <div className="filters">
          <input type="search" placeholder="Search domain or site name…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onChange={setStatus} options={statuses} label="Any status" />
          <Select value={sellable} onChange={setSellable} options={["Yes", "Paused", "No"]} label="Any sellable" />
          <Select value={brand} onChange={setBrand} options={brands} label="Any brand" />
          <Select value={agency} onChange={setAgency} options={agencies} label="Any agency" />
          <Select value={project} onChange={setProject} options={projects} label="Any project" />
          <input className="num" placeholder="DR ≥" value={drMin} onChange={(e) => setDrMin(e.target.value)} />
          <input className="num" placeholder="DR ≤" value={drMax} onChange={(e) => setDrMax(e.target.value)} />
          <input className="num" placeholder="GP ≥" value={gpMin} onChange={(e) => setGpMin(e.target.value)} />
          <input className="num" placeholder="GP ≤" value={gpMax} onChange={(e) => setGpMax(e.target.value)} />
          <label className="chip"><input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} /> VIP</label>
          <label className="chip"><input type="checkbox" checked={allocOnly} onChange={(e) => setAllocOnly(e.target.checked)} /> Allocation</label>
          <button className="linkbtn" onClick={clearAll}>Clear</button>
        </div>
      </Header>

      {error && <div className="err-banner">{error}</div>}

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort("website")}>Website</th>
              <th onClick={() => toggleSort("siteName")}>Site Name</th>
              <th className="num" onClick={() => toggleSort("dr")}>DR</th>
              <th>Niche</th>
              <th>Status</th>
              {PRICE_FIELDS.map((f) => (
                <th key={f.key} className="num" onClick={() => toggleSort(f.key)} title={f.name}>{f.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <Row key={r.id} row={r} onEdit={openEditor} />
            ))}
          </tbody>
        </table>
        {shown < filtered.length && <div className="sentinel" ref={sentinel}>Loading more…</div>}
        {filtered.length === 0 && <div className="sentinel">No sites match those filters.</div>}
      </div>

      {editing && (
        <PriceEditor
          row={editing.row}
          field={editing.field}
          email={email}
          onSave={savePrice}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function PriceEditor({ row, field, email, onSave, onClose }) {
  const current = money(row.prices[field.key]);
  const [value, setValue] = useState(current);
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
  const changed = next !== current;
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
        <h3 id="ct">Edit price</h3>
        <div className="modal-site">{row.website}</div>
        <div className="modal-field">{field.label}</div>

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
          This writes straight to the master database. The new price is what everyone
          sees — the sales sheet, quotes, and anywhere else this site is listed.
        </p>
        <p className="modal-by">Recorded against <b>{email}</b></p>
        {error && <p className="modal-err">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn go" disabled={!changed || busy}>
            {busy ? "Saving…" : "Update price"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Header({ email, onRefresh, count, children }) {
  return (
    <div className="top">
      <div className="top-row">
        <span className="brand">PMP Sales Pricing</span>
        <span className="count">{count}</span>
        <span className="who" title="Every price you change is recorded against this address">{email}</span>
        <button className="linkbtn" onClick={onRefresh}>Refresh</button>
        <button className="linkbtn" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.reload(); }}>Sign out</button>
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

function Row({ row, onEdit }) {
  return (
    <tr>
      <td className="site" data-label="Site">
        {row.fullUrl ? <a href={row.fullUrl} target="_blank" rel="noreferrer">{row.website}</a> : row.website}
      </td>
      <td className="name" data-label="Name">{row.siteName}</td>
      <td className="num" data-label="DR">{row.dr ?? ""}</td>
      <td className="niche muted" data-label="Niche">{row.niche}</td>
      <td className="muted" data-label="Status">{row.status}</td>
      {PRICE_FIELDS.map((f) => (
        <td key={f.key} className="num" data-label={f.short}>
          <PriceCell row={row} field={f} onEdit={onEdit} />
        </td>
      ))}
    </tr>
  );
}

function PriceCell({ row, field, onEdit }) {
  const value = money(row.prices[field.key]);
  return (
    <button
      type="button"
      className="price"
      onClick={() => onEdit(row, field)}
      title={`Edit ${field.label} for ${row.website}`}
    >
      {value === "" ? "—" : value}
    </button>
  );
}
