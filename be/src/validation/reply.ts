// Staff reply form rules (plan §9). Plain functions with no server-only imports,
// so the Staff Portal can reuse exactly the same rules and messages.

export const REPLY_LIMITS = {
  subjectMin: 3,
  subjectMax: 150,
  bodyMin: 10,
  bodyMax: 5000,
} as const;

export const REPLY_MESSAGES = {
  subjectRequired: "Subject is required.",
  subjectLength: `Subject must be between ${REPLY_LIMITS.subjectMin} and ${REPLY_LIMITS.subjectMax} characters.`,
  bodyRequired: "Message is required.",
  bodyTooShort: `Message must be at least ${REPLY_LIMITS.bodyMin} characters.`,
  bodyTooLong: `Message must be ${REPLY_LIMITS.bodyMax} characters or fewer.`,
  invalidCustomerEmail: "This customer has no valid email address, so a response cannot be sent.",
} as const;

export interface ReplyForm {
  subject: string;
  body: string;
}
export type ReplyErrors = Partial<Record<keyof ReplyForm, string>>;

export function validateReply({ subject, body }: ReplyForm): ReplyErrors {
  const errors: ReplyErrors = {};
  const s = subject.trim();
  if (!s) errors.subject = REPLY_MESSAGES.subjectRequired;
  else if (s.length < REPLY_LIMITS.subjectMin || s.length > REPLY_LIMITS.subjectMax) errors.subject = REPLY_MESSAGES.subjectLength;

  const b = body.trim();
  if (!b) errors.body = REPLY_MESSAGES.bodyRequired;
  else if (b.length < REPLY_LIMITS.bodyMin) errors.body = REPLY_MESSAGES.bodyTooShort;
  else if (b.length > REPLY_LIMITS.bodyMax) errors.body = REPLY_MESSAGES.bodyTooLong;
  return errors;
}

export const enquiryCode = (id: number) => `ENQ-${String(id).padStart(6, "0")}`;
