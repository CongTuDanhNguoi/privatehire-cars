// Left column of the enquiry detail: customer, the question itself, and the trip (TRIP enquiries only).
import type { ReactNode } from "react";
import type { Booking, Enquiry, EnquiryDetail } from "../../types";
import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { CopyButton } from "../../components/ui/CopyButton";
import { formatDateTime, isoDateTime, UK_TIME_ZONE } from "../../lib/format";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-muted/60 py-2.5 last:border-b-0">
      <dt className="text-helper font-semibold text-ink/70 uppercase">{term}</dt>
      <dd className="m-0 min-w-0 text-body break-words text-ink">{children}</dd>
    </div>
  );
}

export function CustomerCard({ customer }: { customer: EnquiryDetail["customer"] }) {
  return (
    <Card title="Customer">
      <dl className="m-0">
        <Row term="Name">
          <span className="inline-flex items-center gap-2">
            <Avatar name={customer.fullName} />
            {customer.fullName}
          </span>
        </Row>
        <Row term="Email">
          <span className="inline-flex flex-wrap items-center gap-1">
            <a href={`mailto:${customer.email}`} className="break-all underline underline-offset-4">
              {customer.email}
            </a>
            <CopyButton value={customer.email} label="Copy email address" />
          </span>
        </Row>
        <Row term="Phone">{customer.phone ?? "—"}</Row>
      </dl>
    </Card>
  );
}

// The customer's question, shown as the first "message" of the conversation.
export function EnquiryCard({ message, createdAt, customerName }: { message: string; createdAt: string; customerName?: string }) {
  return (
    <Card title="Enquiry">
      <div className="flex items-start gap-3">
        {customerName && <Avatar name={customerName} size="md" />}
        <div className="min-w-0 flex-1">
          <p className="rounded-2xl rounded-tl-sm bg-muted/40 p-4 text-body whitespace-pre-wrap break-words text-ink">{message}</p>
          <p className="mt-2 text-helper text-ink">
            {customerName && `${customerName} · `}Sent <time dateTime={isoDateTime(createdAt)}>{formatDateTime(createdAt)}</time>
          </p>
        </div>
      </div>
    </Card>
  );
}

// Contact details and category from the SCRUM-95 form. Renders nothing for older enquiries.
export function EnquiryDetailsCard({ enquiry }: { enquiry: Enquiry }) {
  if (!enquiry.category && !enquiry.contactName && !enquiry.contactEmail && !enquiry.contactPhone) return null;
  return (
    <Card title="Enquiry details">
      <dl className="m-0">
        {enquiry.category && <Row term="Category">{enquiry.category}</Row>}
        {enquiry.contactName && <Row term="Contact name">{enquiry.contactName}</Row>}
        {enquiry.contactEmail && <Row term="Contact email">{enquiry.contactEmail}</Row>}
        {enquiry.contactPhone && <Row term="Contact phone">{enquiry.contactPhone}</Row>}
      </dl>
    </Card>
  );
}

// Enquiries sent before the fix stored the app's vehicle key; show the name for those too.
const VEHICLE_NAMES: Record<string, string> = { standard: "Standard Car", "seven-seater": "Seven-Seater" };

// Trip the customer planned without a saved booking (SCRUM-95 "Journey Planning").
export function PlannedTripCard({ trip }: { trip: NonNullable<Enquiry["tripSnapshot"]> }) {
  return (
    <Card title="Planned trip">
      <dl className="m-0">
        <Row term="Pickup">{trip.pickupLocation}</Row>
        <Row term="Destination">{trip.destination}</Row>
        <Row term="Date & time">
          {trip.journeyDate} {trip.journeyTime} <span className="text-helper">(UK time)</span>
        </Row>
        <Row term="Passengers">{trip.passengerCount}</Row>
        <Row term="Vehicle">{VEHICLE_NAMES[trip.vehicleSize] ?? trip.vehicleSize}</Row>
      </dl>
    </Card>
  );
}

export function TripCard({ booking }: { booking: Booking }) {
  return (
    <Card title="Trip details">
      <dl className="m-0">
        <Row term="Booking ref">
          <span className="font-semibold tabular-nums">{booking.bookingRef}</span>
        </Row>
        <Row term="Service">{booking.serviceName}</Row>
        <Row term="Pickup">{booking.pickupLocation}</Row>
        <Row term="Destination">{booking.destination}</Row>
        <Row term="Date & time">
          <time dateTime={isoDateTime(booking.journeyDateTime)}>{formatDateTime(booking.journeyDateTime, UK_TIME_ZONE)}</time>{" "}
          <span className="text-helper">(UK time)</span>
        </Row>
        <Row term="Passengers">{booking.passengerCount}</Row>
        <Row term="Vehicle">{booking.vehicleSize}</Row>
        {booking.status && (
          <Row term="Payment">
            {booking.status === "PAID" && booking.farePence != null ? (
              <span className="font-semibold text-[#166534]">Paid · £{(booking.farePence / 100).toFixed(2)}</span>
            ) : (
              <span className="text-[#64748b]">Not paid</span>
            )}
          </Row>
        )}
      </dl>
    </Card>
  );
}
