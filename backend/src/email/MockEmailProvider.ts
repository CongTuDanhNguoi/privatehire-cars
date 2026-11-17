// MOCK provider — for development and testing only. It does NOT send any real email.
// MOCK_EMAIL_FAIL forces failures to demo/test the retry flow:
//   never  = always succeed · always = always fail · next = fail only the next send, then succeed.
import type { EmailMessage, EmailProvider } from "./EmailProvider.js";

export type MockFailMode = "never" | "always" | "next";

export class MockEmailProvider implements EmailProvider {
  readonly name = "MOCK" as const;
  private failNext: boolean;

  constructor(private readonly failMode: MockFailMode) {
    this.failNext = failMode === "next";
  }

  async send(msg: EmailMessage): Promise<void> {
    const shouldFail = this.failMode === "always" || this.failNext;
    this.failNext = false;
    if (shouldFail) {
      console.log(`[MOCK EMAIL] simulated FAILURE to=${msg.to} subject="${msg.subject}"`);
      throw new Error("Mock email service: simulated delivery failure.");
    }
    console.log(`[MOCK EMAIL] (not really sent) to=${msg.to} subject="${msg.subject}" ref=${msg.enquiryCode}
${msg.body.slice(0, 300)}`);
  }
}
