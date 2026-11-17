export interface EmailMessage {
  to: string;
  toName: string;
  subject: string;
  body: string;
  enquiryCode: string;
  replyTo: string;
}

// A provider throws when the email could not be delivered.
export interface EmailProvider {
  readonly name: "EMAILJS" | "MOCK";
  send(msg: EmailMessage): Promise<void>;
}
