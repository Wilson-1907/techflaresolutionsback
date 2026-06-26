import { company } from "@/data/site";
import { getAppUrl } from "./env";

/** Public logo URL for HTML emails and documents (main site hosts logo.png). */
export function getBrandLogoUrl(): string {
  return `${getAppUrl()}/logo.png`;
}

export function brandedEmailHeader(subtitle?: string): string {
  const logo = getBrandLogoUrl();
  return `
    <div style="border-bottom:3px solid #c9a227;padding-bottom:16px;margin-bottom:20px;">
      <img src="${logo}" alt="${company.name} — ${company.tagline}" width="160" height="auto" style="max-width:160px;height:auto;display:block;margin-bottom:8px;background:transparent;" />
      <p style="margin:0;font-size:11px;letter-spacing:1px;color:#c9a227;text-transform:uppercase;">${company.tagline}</p>
      ${subtitle ? `<p style="margin:8px 0 0;font-size:13px;color:#666;">${subtitle}</p>` : ""}
    </div>
  `;
}

export function brandedEmailFooter(): string {
  const appUrl = getAppUrl();
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px" />
    <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;">
      <strong>${company.name}</strong><br/>
      <span style="color:#c9a227;font-size:11px;letter-spacing:1px;">${company.tagline}</span><br/>
      <a href="${appUrl}" style="color:#c9a227;text-decoration:none">${appUrl.replace(/^https?:\/\//, "")}</a>
    </p>
  `;
}

export function wrapBrandedEmail(bodyHtml: string, subtitle?: string): string {
  return `
    <div style="font-family:Segoe UI,system-ui,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
      ${brandedEmailHeader(subtitle)}
      ${bodyHtml}
      ${brandedEmailFooter()}
    </div>
  `;
}
