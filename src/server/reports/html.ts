export type ReportCompany = {
  name: string;
  address: string;
  email: string;
  mobileNumber: string;
  tin: string;
};

export type PrintTable = {
  title?: string;
  columns: string[];
  rows: unknown[][];
  footer?: unknown[][];
};

export type PrintSummaryItem = {
  label: string;
  value: unknown;
};

export type PrintPage = {
  title: string;
  subtitle?: string;
  companies: ReportCompany[];
  meta?: PrintSummaryItem[];
  summaries?: {
    title: string;
    items: PrintSummaryItem[];
  }[];
  tables: PrintTable[];
};

export function printHtmlResponse(page: PrintPage, filename: string) {
  return new Response(renderPrintPage(page), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `inline; filename="${sanitizeFilename(filename)}"`,
    },
  });
}

export function renderPrintPage(page: PrintPage) {
  const companies = normalizeCompanies(page.companies);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --text: #1f2933;
      --muted: #596678;
      --line: #cbd5e1;
      --soft: #f3f6fa;
      --lighter: #fafbfc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #eef2f7;
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.35;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 24px auto;
      background: white;
      border: 1px solid var(--line);
      padding: 22px;
    }
    .company-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      border-bottom: 2px solid #64748b;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company {
      min-height: 68px;
      display: grid;
      align-content: center;
      text-align: center;
    }
    .company h2 {
      margin: 0 0 4px;
      font-size: 15px;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .company p {
      margin: 1px 0;
      color: var(--muted);
      font-size: 11px;
    }
    h1 {
      margin: 10px 0 2px;
      text-align: center;
      font-size: 18px;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .subtitle {
      text-align: center;
      color: var(--muted);
      margin: 0 0 16px;
      font-size: 12px;
    }
    .meta, .summaries {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px 14px;
      margin: 12px 0;
    }
    .summary {
      border: 1px solid var(--line);
      background: var(--lighter);
      padding: 10px;
    }
    .summary h3 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
    }
    .kv {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      border-bottom: 1px dotted #d7dee8;
      padding: 3px 0;
    }
    .kv span:first-child { color: var(--muted); }
    .kv span:last-child { font-weight: 600; text-align: right; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      page-break-inside: auto;
    }
    caption {
      text-align: left;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0 0 6px;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 6px 7px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th {
      background: var(--soft);
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
    }
    tr:nth-child(even) td { background: var(--lighter); }
    tfoot td {
      background: var(--soft);
      font-weight: 700;
    }
    .right { text-align: right; }
    .muted { color: var(--muted); }
    .section-row td {
      background: #e8edf5 !important;
      font-weight: 700;
      text-transform: uppercase;
    }
    @media print {
      body { background: white; }
      main {
        width: auto;
        margin: 0;
        border: 0;
        padding: 0;
      }
      .no-print { display: none; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <main>
    <div class="company-header">
      ${companies.map(renderCompany).join("")}
    </div>
    <h1>${escapeHtml(page.title)}</h1>
    ${page.subtitle ? `<p class="subtitle">${escapeHtml(page.subtitle)}</p>` : ""}
    ${page.meta?.length ? `<section class="meta">${renderSummaryItems(page.meta)}</section>` : ""}
    ${page.summaries?.length ? `<section class="summaries">${page.summaries.map(renderSummary).join("")}</section>` : ""}
    ${page.tables.map(renderTable).join("")}
  </main>
</body>
</html>`;
}

function renderCompany(company: ReportCompany) {
  return `<section class="company">
    <h2>${escapeHtml(company.name || "Company")}</h2>
    <p>${escapeHtml(company.address)}</p>
    <p>${escapeHtml([company.mobileNumber, company.email].filter(Boolean).join(" | "))}</p>
    <p>${escapeHtml(company.tin)}</p>
  </section>`;
}

function renderSummary(summary: { title: string; items: PrintSummaryItem[] }) {
  return `<section class="summary">
    <h3>${escapeHtml(summary.title)}</h3>
    ${renderSummaryItems(summary.items)}
  </section>`;
}

function renderSummaryItems(items: PrintSummaryItem[]) {
  return items
    .map(
      (item) =>
        `<div class="kv"><span>${escapeHtml(item.label)}</span><span>${formatValue(item.value)}</span></div>`,
    )
    .join("");
}

function renderTable(table: PrintTable) {
  const bodyRows =
    table.rows.length > 0
      ? table.rows.map((row) => renderRow(row, table.columns.length)).join("")
      : `<tr><td colspan="${table.columns.length}" class="muted">No records found.</td></tr>`;

  const footerRows = table.footer?.length
    ? `<tfoot>${table.footer.map((row) => renderRow(row, table.columns.length)).join("")}</tfoot>`
    : "";

  return `<table>
    ${table.title ? `<caption>${escapeHtml(table.title)}</caption>` : ""}
    <thead><tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
    <tbody>${bodyRows}</tbody>
    ${footerRows}
  </table>`;
}

function renderRow(row: unknown[], columnCount: number) {
  const isSection = row.length > 0 && row[0] === "__section";
  if (isSection) {
    return `<tr class="section-row"><td colspan="${columnCount}">${formatValue(row[1])}</td></tr>`;
  }

  return `<tr>${row.map((value) => `<td class="${isNumericLike(value) ? "right" : ""}">${formatValue(value)}</td>`).join("")}</tr>`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return escapeHtml(formatDate(value));
  if (typeof value === "number") return escapeHtml(formatNumber(value));
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && "toString" in value) {
    const numericValue = Number(value.toString());
    if (Number.isFinite(numericValue)) return escapeHtml(formatNumber(numericValue));
  }

  return escapeHtml(String(value));
}

function isNumericLike(value: unknown) {
  if (typeof value === "number") return true;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return Number.isFinite(Number(value.toString()));
  }
  return false;
}

function normalizeCompanies(companies: ReportCompany[]) {
  const normalized = companies.slice(0, 2);
  while (normalized.length < 2) {
    normalized.push({
      name: "",
      address: "",
      email: "",
      mobileNumber: "",
      tin: "",
    });
  }
  return normalized;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/["\r\n]/g, "");
}

function formatDate(value: Date) {
  return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
