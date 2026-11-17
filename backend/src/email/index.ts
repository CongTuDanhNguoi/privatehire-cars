// Picks the email provider from .env and applies test mode on top of it.
// Test mode (plan D5): every email goes to EMAIL_TEST_RECIPIENT and the subject is prefixed with
// "[TEST → <customer email>]", so real customers never receive demo emails.
import { config } from "../config.js";
import { EmailJsProvider } from "./EmailJsProvider.js";
import type { EmailMessage, EmailProvider } from "./EmailProvider.js";
import { MockEmailProvider } from "./MockEmailProvider.js";

export const SEND_TIMEOUT_MS = 10_000;

const provider: EmailProvider =
  config.email.provider === "EMAILJS"
    ? new EmailJsProvider(config.email.emailjs, SEND_TIMEOUT_MS)
    : new MockEmailProvider(config.email.mockFail);

export const emailSettings = {
  provider: provider.name,
  testMode: config.email.testMode,
  testRecipient: config.email.testRecipient,
} as const;

// Where an email for this customer will actually be delivered.
export const deliveryAddressFor = (customerEmail: string) =>
  emailSettings.testMode && emailSettings.testRecipient ? emailSettings.testRecipient : customerEmail;

const SECRETS = [config.email.emailjs.privateKey, config.email.emailjs.publicKey].filter((s) => s.length >= 4);

// Short, safe error text for the database / UI: never contains a key, max 500 chars.
function describeError(err: unknown): string {
  let text = err instanceof Error ? err.message : "Unknown email error.";
  for (const secret of SECRETS) text = text.split(secret).join("***");
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

export interface OutgoingEmail {
  customerEmail: string;
  customerName: string;
  subject: string;
  body: string;
  enquiryCode: string;
}

// Sends one email (with a hard timeout). Resolves with an error message on failure instead of throwing.
export async function sendEmail(email: OutgoingEmail): Promise<{ ok: true } | { ok: false; error: string }> {
  const msg: EmailMessage = {
    to: deliveryAddressFor(email.customerEmail),
    toName: email.customerName,
    subject: emailSettings.testMode ? `[TEST → ${email.customerEmail}] ${email.subject}` : email.subject,
    body: email.body,
    enquiryCode: email.enquiryCode,
    replyTo: config.email.replyTo,
  };
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`The email service did not respond within ${SEND_TIMEOUT_MS / 1000} seconds.`)),
      SEND_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([provider.send(msg), timeout]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  } finally {
    clearTimeout(timer);
  }
}
