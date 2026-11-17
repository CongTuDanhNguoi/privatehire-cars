import type { Enquiry, EnquiryDetail, EnquiryList, EnquiryResponse } from "../types";
import { api } from "./client";

export interface InboxQuery {
  type: "ALL" | "GENERAL" | "TRIP";
  status: "ALL" | "AWAITING" | "RESOLVED";
  q: string;
  sort: "newest" | "oldest";
  page: number;
}

export const PAGE_SIZE = 20;

export const enquiriesApi = {
  list: (query: InboxQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({
      type: query.type,
      status: query.status,
      sort: query.sort,
      page: String(query.page),
      pageSize: String(PAGE_SIZE),
    });
    if (query.q) params.set("q", query.q);
    return api<EnquiryList>(`/staff/enquiries?${params}`, { signal });
  },
  detail: (id: number, signal?: AbortSignal) => api<EnquiryDetail>(`/staff/enquiries/${id}`, { signal }),
  setStatus: (id: number, status: Enquiry["status"]) =>
    api<{ enquiry: Enquiry }>(`/staff/enquiries/${id}/status`, { method: "PATCH", body: { status } }),
  sendResponse: (id: number, body: { clientRequestId: string; subject: string; body: string }) =>
    api<{ response: EnquiryResponse; enquiry: Enquiry }>(`/staff/enquiries/${id}/responses`, { method: "POST", body }),
  retry: (responseId: number) =>
    api<{ response: EnquiryResponse; enquiry: Enquiry }>(`/staff/responses/${responseId}/retry`, { method: "POST" }),
};

// The saved FAILED record that comes back with a 502 EMAIL_SEND_FAILED.
export function failedResponseFrom(body: Record<string, unknown>): EnquiryResponse | null {
  const r = body.response as EnquiryResponse | undefined;
  return r && typeof r.id === "number" ? r : null;
}
