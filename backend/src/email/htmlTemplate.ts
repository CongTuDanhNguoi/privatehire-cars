// Branded HTML version of every outgoing email (sent to EmailJS as {{{message_html}}}).
// Table layout + inline styles only, so Gmail / Outlook render it the same. Colours from the UI Kit.
// Everything the customer or staff typed is HTML-escaped.

const NAVY = "#02284F";
const BLUE = "#65B3FC";
const PALE = "#DEF7FF";
const MUTED = "#D5E2ED";
const GREY = "#5B6B78";
const FONT = "font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

// "NGUYEN THUC" / "alex morgan" → "Nguyen Thuc" / "Alex Morgan" (only for the greeting).
export const displayName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

// Plain text → paragraphs (blank line = new paragraph, single newline = <br>).
function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;${FONT}font-size:15px;line-height:24px;color:${NAVY};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function codeBox(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr><td style="background:${PALE};border:1px solid ${BLUE};border-radius:12px;padding:16px 28px;${FONT}font-size:32px;line-height:40px;font-weight:700;letter-spacing:10px;color:${NAVY};">${escapeHtml(code)}</td></tr>
</table>`;
}

export interface EmailHtmlInput {
  customerName: string;
  body: string; // plain text (staff reply, or the verification explanation)
  enquiryCode?: string; // shown in the footer when it is a real enquiry reference
  verificationCode?: string; // shown in a large box (email verification)
  expiresInMinutes?: number;
}

export function renderEmailHtml(input: EmailHtmlInput): string {
  const name = escapeHtml(displayName(input.customerName));
  const content = input.verificationCode
    ? `<p style="margin:0 0 16px;${FONT}font-size:15px;line-height:24px;color:${NAVY};">Hi ${name},</p>
<p style="margin:0 0 8px;${FONT}font-size:15px;line-height:24px;color:${NAVY};">Use this code to verify your email address in the PrivateHire Cars app:</p>
${codeBox(input.verificationCode)}
<p style="margin:0 0 16px;${FONT}font-size:15px;line-height:24px;color:${NAVY};">The code expires in ${input.expiresInMinutes ?? 10} minutes.</p>
<p style="margin:0;${FONT}font-size:13px;line-height:20px;color:${GREY};">If you did not create an account, you can safely ignore this email.</p>`
    : paragraphs(input.body);

  const reference = input.enquiryCode?.startsWith("ENQ-")
    ? `<br>Reference: <strong style="color:${NAVY};">${escapeHtml(input.enquiryCode)}</strong>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F7FA;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${MUTED};border-radius:12px;overflow:hidden;">
  <tr><td style="background:${NAVY};padding:20px 28px;${FONT}font-size:18px;line-height:24px;font-weight:700;color:#FFFFFF;">PrivateHire Cars</td></tr>
  <tr><td style="padding:28px 28px 12px;">${content}</td></tr>
  <tr><td style="border-top:1px solid ${MUTED};padding:16px 28px;${FONT}font-size:12px;line-height:18px;color:${GREY};">PrivateHire Cars Customer Support${reference}</td></tr>
</table>
</td></tr>
</table>`;
}
