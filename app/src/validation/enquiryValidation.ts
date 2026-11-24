// =============================================================
// enquiryValidation.ts — Kiểm tra form "Contact Support" (khách gửi câu hỏi).
// Dùng chung cho app Customer (màn /support) và backend/, nên câu báo lỗi luôn giống nhau.
// =============================================================

import { validateEmail, validateName } from "./rules";
import { validateNotifyPhone } from "./checkoutValidation";

export type EnquiryType = "GENERAL" | "TRIP";

// Trip the customer is planning (no saved booking yet), from the BookingContext.
export interface TripSnapshot {
  pickupLocation: string;
  destination: string;
  journeyDate: string; // YYYY-MM-DD
  journeyTime: string; // HH:mm
  passengerCount: number;
  vehicleSize: string;
}

export interface EnquiryForm {
  type: EnquiryType | "";
  bookingId: number | null;
  subject: string;
  message: string;
  // SCRUM-95 form. Optional so older clients keep working.
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  category?: string;
  tripSnapshot?: TripSnapshot | null;
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

export const ENQUIRY_CONTACT_MESSAGES = {
  fullNameRequired: "Full name is required",
  emailInvalid: "Please enter a valid email address (e.g. name@example.com)",
  categoryRequired: "Please select an enquiry category",
  bannerTitle: "SUBMISSION BLOCKED: ALL REQUIRED FIELDS REQUIRE ATTENTION",
} as const;

// Dropdown options of S95-02/03. The first option of each is the value shown in the design PNG.
export const ENQUIRY_CATEGORIES: Record<EnquiryType, readonly string[]> = {
  GENERAL: [
    "General Information / Pricing Inquiry",
    "Fleet & Vehicle Availability",
    "Corporate & Business Accounts",
    "Airport Transfer Policies",
    "Feedback & Complaints",
    "Other",
  ],
  TRIP: [
    "Route Planning & Waiting Time",
    "Pickup / Destination Change",
    "Passenger Count & Luggage",
    "Vehicle Class Request",
    "Existing Booking Question",
    "Other",
  ],
};

// A planned trip counts as the trip the enquiry is about, even without a saved booking.
export function hasPlannedTrip(form: EnquiryForm): boolean {
  return Boolean(form.tripSnapshot?.pickupLocation?.trim() && form.tripSnapshot?.destination?.trim());
}

// Contact details and category (S95 form). Only checked when the form sends these fields.
export function validateEnquiryContact(form: EnquiryForm): EnquiryErrors {
  const errors: EnquiryErrors = {};
  const name = (form.contactName ?? "").trim();
  if (!name) {
    errors.contactName = ENQUIRY_CONTACT_MESSAGES.fullNameRequired;
  } else {
    const nameError = validateName(name);
    if (nameError) errors.contactName = nameError;
  }
  if (!form.contactEmail?.trim() || validateEmail(form.contactEmail)) {
    errors.contactEmail = ENQUIRY_CONTACT_MESSAGES.emailInvalid;
  }
  if (form.contactPhone?.trim()) {
    const phoneError = validateNotifyPhone(form.contactPhone);
    if (phoneError) errors.contactPhone = phoneError;
  }
  const categories = form.type === "GENERAL" || form.type === "TRIP" ? ENQUIRY_CATEGORIES[form.type] : [];
  if (!form.category || !categories.includes(form.category)) errors.category = ENQUIRY_CONTACT_MESSAGES.categoryRequired;
  return errors;
}

export function validateEnquiry(form: EnquiryForm): EnquiryErrors {
  const errors: EnquiryErrors = {};
  if (form.type !== "GENERAL" && form.type !== "TRIP") errors.type = ENQUIRY_MESSAGES.typeRequired;
  if (form.type === "TRIP" && !hasPlannedTrip(form) && !(Number.isInteger(form.bookingId) && (form.bookingId ?? 0) > 0)) {
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
