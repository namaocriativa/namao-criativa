export type WebsiteHealthStatus = "ok" | "warn" | "down" | "idle";

export type WebsiteHealthItem = {
  id: string;
  label: string;
  status: WebsiteHealthStatus;
  url?: string;
  detail: string;
};

export type WebsiteHealth = {
  overall: WebsiteHealthStatus;
  summary: string;
  pagesDev: string | null;
  domain: string | null;
  items: WebsiteHealthItem[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortDetail(detail: string): string {
  const http = detail.match(/HTTP\s+(\d{3})/i);
  if (http) return http[1];
  return detail;
}

export function websiteHealthHostsHtml(items: WebsiteHealthItem[]): string {
  return items
    .map((item) => {
      const label = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`
        : escapeHtml(item.label);
      return `<li data-status="${escapeHtml(item.status)}">
        <span class="lead-website-health__dot" aria-hidden="true"></span>
        ${label}
        <span>${escapeHtml(shortDetail(item.detail))}</span>
      </li>`;
    })
    .join("");
}
