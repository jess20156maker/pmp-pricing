import { F, READ_FIELDS, PRICE_FIELDS } from "./fields";

const API = "https://api.airtable.com/v0";

function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function headers() {
  return {
    Authorization: `Bearer ${env("AIRTABLE_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

async function airtable(path, init) {
  const res = await fetch(`${API}/${path}`, { ...init, headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

// ---- site list, cached in memory -------------------------------------------

let cache = { at: 0, rows: null, loading: null };

function cacheMs() {
  return Number(process.env.CACHE_MINUTES || 5) * 60 * 1000;
}

function shape(rec) {
  const f = rec.fields || {};
  const prices = {};
  for (const p of PRICE_FIELDS) prices[p.key] = f[p.name] ?? null;
  return {
    id: rec.id,
    website: f[F.website] || "",
    siteName: f[F.siteName] || "",
    dr: f[F.dr] ?? null,
    niche: f[F.niche] || "",
    status: f[F.status] || "",
    brand: f[F.brand] || "",
    project: f[F.project] || "",
    agency: f[F.agency] || "",
    vip: f[F.vip] || "",
    allocation: !!f[F.allocation],
    fullUrl: f[F.fullUrl] || "",
    articles: f[F.totalArticles] ?? null,
    sellable: f[F.sellable] || "",
    prices,
  };
}

async function fetchAll() {
  const base = env("AIRTABLE_BASE_ID");
  const table = env("AIRTABLE_WEBSITES_TABLE");
  const view = process.env.AIRTABLE_VIEW;

  const rows = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    for (const f of READ_FIELDS) params.append("fields[]", f);
    if (view) params.set("view", view);
    if (offset) params.set("offset", offset);
    const page = await airtable(`${base}/${table}?${params}`);
    for (const rec of page.records) rows.push(shape(rec));
    offset = page.offset;
  } while (offset);

  // Once you've filled in Sellable, set SELLABLE_ONLY=true and the server stops
  // sending anything else to the browser at all — not merely hiding it.
  const gated = process.env.SELLABLE_ONLY === "true"
    ? rows.filter((r) => r.sellable === "Yes")
    : rows;

  gated.sort((a, b) => (b.dr ?? -1) - (a.dr ?? -1));
  return gated;
}

export async function getSites({ force = false } = {}) {
  const fresh = cache.rows && Date.now() - cache.at < cacheMs();
  if (fresh && !force) return cache.rows;
  if (cache.loading) return cache.loading; // collapse concurrent cold loads
  cache.loading = fetchAll()
    .then((rows) => {
      cache = { at: Date.now(), rows, loading: null };
      return rows;
    })
    .catch((err) => {
      cache.loading = null;
      throw err;
    });
  return cache.loading;
}

// Keep the in-memory copy honest after a write, so the salesperson sees their
// own change immediately instead of the pre-edit cached value.
function patchCache(recordId, fieldKey, value) {
  if (!cache.rows) return;
  const row = cache.rows.find((r) => r.id === recordId);
  if (row) row.prices[fieldKey] = value;
}

// ---- writes ----------------------------------------------------------------

export async function updatePrice({ recordId, field, value, user }) {
  const base = env("AIRTABLE_BASE_ID");
  const table = env("AIRTABLE_WEBSITES_TABLE");

  const rows = await getSites();
  const row = rows.find((r) => r.id === recordId);
  if (!row) throw new Error("Unknown website record");

  const oldValue = row.prices[field.key] ?? null;
  if (oldValue === value) return { unchanged: true, row };

  await airtable(`${base}/${table}/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        [field.name]: value,
        [F.lastManual]: new Date().toISOString(),
      },
      typecast: false,
    }),
  });

  patchCache(recordId, field.key, value);
  await writeLog({ row, field, oldValue, value, user });
  return { ok: true, oldValue };
}

async function writeLog({ row, field, oldValue, value, user }) {
  const logTable = process.env.AIRTABLE_LOG_TABLE;
  if (!logTable) return;
  const base = env("AIRTABLE_BASE_ID");
  const fmt = (v) => (v === null || v === undefined || v === "" ? "" : String(v));
  const fields = {
    Change: `${row.website} — ${field.name}: ${fmt(oldValue) || "∅"} → ${fmt(value) || "∅"}`,
    Website: [row.id],
    "Field Changed": field.name,
    "Old Value": fmt(oldValue),
    "New Value": fmt(value),
    "Changed By": user || "unknown",
    "Changed At": new Date().toISOString(),
  };
  // Source is a single-select in Airtable. Only send it if LOG_SOURCE is set to
  // an existing choice — an unknown choice makes every log write fail.
  if (process.env.LOG_SOURCE) fields.Source = process.env.LOG_SOURCE;

  try {
    await airtable(`${base}/${logTable}`, {
      method: "POST",
      body: JSON.stringify({ records: [{ fields }] }),
    });
  } catch (err) {
    // A failed audit write must never silently look like a successful edit.
    console.error("Pricing Change Log write failed:", err.message);
    throw new Error("Price saved, but the audit log write failed — tell Jess.");
  }
}
