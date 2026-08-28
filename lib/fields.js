// Field names exactly as they appear in Master Data Hub → Websites.
// Change here if a field is ever renamed in Airtable.

export const F = {
  website: "Website",
  siteName: "Site Name",
  dr: "DR",
  niche: "Primary Niche/s (From Sales Pricing Sheet)",
  status: "Site Status",
  brand: "Designator Brand",
  project: "Project",
  agency: "Agency",
  vip: "VIP Sales Sheet",
  allocation: "PMP Agency Allocation Sales List",
  fullUrl: "Full URL",
  totalArticles: "Total Articles Per Website (Customer + internal)",
  lastManual: "Date Last Manual Update",
  sellable: "Sellable",
};

// The only fields this app is ever allowed to write to a Website record.
// Anything not in this list is rejected server-side.
export const PRICE_FIELDS = [
  { key: "gp",       name: "Guest Post Price (USD)",                                                     label: "Guest Post",     short: "GP" },
  { key: "gpS",      name: "Guest Post Price - Sensitive (CBD, Cannabis, Casino, Crypto etc) (USD)",      label: "Guest Post — Sensitive", short: "GP-S" },
  { key: "li",       name: "Link Insertion Price (USD)",                                                  label: "Link Insertion", short: "LI" },
  { key: "liS",      name: "Link Insertion Price - Sensitive (CBD, Cannabis, Loans, Casino etc.) (USD)",  label: "Link Insertion — Sensitive", short: "LI-S" },
  { key: "banner",   name: "Banner Price Per Month (Discounts available for 12-Month Placements)",        label: "Banner / month", short: "Banner" },
  { key: "listicle", name: "Listicles **Launch Pricing",                                                  label: "Listicles",      short: "List" },
  { key: "brandM",   name: "Brand Mentions ** Launch Pricing",                                            label: "Brand Mentions", short: "BrandM" },
];

export const PRICE_FIELD_NAMES = PRICE_FIELDS.map((f) => f.name);

// Fields we ask Airtable for. Keeping this tight keeps the payload small.
export const READ_FIELDS = [
  F.website, F.siteName, F.dr, F.niche, F.status, F.brand,
  F.project, F.agency, F.vip, F.allocation, F.fullUrl, F.totalArticles, F.sellable,
  ...PRICE_FIELD_NAMES,
];
