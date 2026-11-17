// =============================================================
// enquiryValidation.ts — Kiểm tra form "Contact Support" (khách gửi câu hỏi).
// Dùng chung cho app Customer (màn /support) và backend/, nên câu báo lỗi luôn giống nhau.
// =============================================================

export type EnquiryType = "GENERAL" | "TRIP";

export interface EnquiryForm {
  type: EnquiryType | "";
  bookingId: number | null;
  subject: string;
  message: string;
}
export type EnquiryErrors = Partial<Record<keyof EnquiryForm, string>>;

export const ENQUIRY_LIMITS = {
  subjectMin: 5,
  subjectMax: 120,
  messageMin: 20,
  messageMax: 2000,
} as const;

export const ENQUIRY_MESSAGES = {
  typeRequired: "Choose an enquiry type.",
  bookingRequired: "Choose the trip this enquiry is about.",
  subjectRequired: "Subject is required.",
  subjectLength: `Subject must be between ${ENQUIRY_LIMITS.subjectMin} and ${ENQUIRY_LIMITS.subjectMax} characters.`,
  messageRequired: "Message is required.",
  messageTooShort: `Please describe your enquiry in at least ${ENQUIRY_LIMITS.messageMin} characters.`,
  messageTooLong: `Message must be ${ENQUIRY_LIMITS.messageMax} characters or fewer.`,
} as const;

export function validateEnquiry(form: EnquiryForm): EnquiryErrors {
  const errors: EnquiryErrors = {};
  if (form.type !== "GENERAL" && form.type !== "TRIP") errors.type = ENQUIRY_MESSAGES.typeRequired;
  if (form.type === "TRIP" && !(Number.isInteger(form.bookingId) && (form.bookingId ?? 0) > 0)) {
    errors.bookingId = ENQUIRY_MESSAGES.bookingRequired;
  }

  const subject = form.subject.trim();
  if (!subject) errors.subject = ENQUIRY_MESSAGES.subjectRequired;
  else if (subject.length < ENQUIRY_LIMITS.subjectMin || subject.length > ENQUIRY_LIMITS.subjectMax) {
    errors.subject = ENQUIRY_MESSAGES.subjectLength;
  }

  const message = form.message.trim();
  if (!message) errors.message = ENQUIRY_MESSAGES.messageRequired;
  else if (message.length < ENQUIRY_LIMITS.messageMin) errors.message = ENQUIRY_MESSAGES.messageTooShort;
  else if (message.length > ENQUIRY_LIMITS.messageMax) errors.message = ENQUIRY_MESSAGES.messageTooLong;

  return errors;
}
