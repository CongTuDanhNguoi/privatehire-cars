// Types shared with the API (backend/). Dates arrive as ISO strings.

export interface Staff {
  id: number;
  fullName: string;
  email: string;
}

export interface EmailSettings {
  provider: "EMAILJS" | "MOCK";
  testMode: boolean;
  testRecipient: string | null;
}

export type EnquiryType = "GENERAL" | "TRIP";
export type EnquiryStatus = "AWAITING" | "RESOLVED";
export type SendStatus = "PENDING" | "SENT" | "FAILED";

export interface EnquirySummary {
  id: number;
  code: string;
  type: EnquiryType;
  subject: string;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
  customer: { fullName: string; email: string };
  bookingRef: string | null;
  responseCount: number;
  lastResponseStatus: "SENT" | "FAILED" | null;
}

export interface EnquiryList {
  items: EnquirySummary[];
  page: number;
  pageSize: number;
  total: number;
  counts: { awaiting: number; resolved: number; general: number; trip: number };
}

export interface Enquiry {
  id: number;
  code: string;
  type: EnquiryType;
  subject: string;
  message: string;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: number;
  bookingRef: string;
  serviceName: string;
  pickupLocation: string;
  destination: string;
  journeyDateTime: string;
  passengerCount: number;
  vehicleSize: string;
}

export interface EnquiryResponse {
  id: number;
  enquiryId: number;
  clientRequestId: string;
  subject: string;
  body: string;
  intendedTo: string;
  deliveredTo: string | null;
  provider: "EMAILJS" | "MOCK";
  testMode: boolean;
  sendStatus: SendStatus;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  staff: { id: number; fullName: string };
}

export interface StatusChange {
  id: number;
  fromStatus: EnquiryStatus;
  toStatus: EnquiryStatus;
  reason: "MANUAL" | "AUTO_AFTER_RESPONSE";
  changedAt: string;
  changedBy: { id: number; fullName: string } | null;
}

export interface EnquiryDetail {
  enquiry: Enquiry;
  customer: { id: number; fullName: string; email: string; phone: string | null };
  booking: Booking | null;
  responses: EnquiryResponse[];
  statusHistory: StatusChange[];
}
