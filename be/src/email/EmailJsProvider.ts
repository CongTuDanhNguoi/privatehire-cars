// Real email through the EmailJS REST API, called from the server so the private key never reaches a browser.
// The EmailJS account must allow API calls from non-browser environments (Account → Security).
import type { EmailMessage, EmailProvider } from "./EmailProvider.js";

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export interface EmailJsSettings {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
}

export class EmailJsProvider implements EmailProvider {
  readonly name = "EMAILJS" as const;

  constructor(
    private readonly settings: EmailJsSettings,
    private readonly timeoutMs: number,
  ) {}

  async send(msg: EmailMessage): Promise<void> {
    let res: Response;
    try {
      res = await fetch(EMAILJS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          service_id: this.settings.serviceId,
          template_id: this.settings.templateId,
          user_id: this.settings.publicKey,
          accessToken: this.settings.privateKey,
          template_params: {
            to_email: msg.to,
            to_name: msg.toName,
            subject: msg.subject,
            message: msg.body,
            enquiry_code: msg.enquiryCode,
            reply_to: msg.replyTo,
          },
        }),
      });
    } catch (err) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new Error(`EmailJS did not respond within ${Math.round(this.timeoutMs / 1000)} seconds.`);
      }
      throw new Error("Could not reach the EmailJS service. Check the internet connection.");
    }
    if (res.status !== 200) {
      const text = (await res.text().catch(() => "")).trim();
      throw new Error(`EmailJS rejected the email (HTTP ${res.status})${text ? `: ${text}` : "."}`);
    }
  }
}
