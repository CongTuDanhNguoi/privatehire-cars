// Left column of the enquiry detail: customer, the question itself, and the trip (TRIP enquiries only).
import type { ReactNode } from "react";
import type { Booking, EnquiryDetail } from "../../types";
import { Card } from "../../components/ui/Card";
import { CopyButton } from "../../components/ui/CopyButton";
import { formatDateTime, isoDateTime, UK_TIME_ZONE } from "../../lib/format";

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5">
      <dt className="text-label font-semibold text-ink">{term}</dt>
      <dd className="m-0 min-w-0 text-body break-words text-ink">{children}</dd>
    </div>
  );
}

export function CustomerCard({ customer }: { customer: EnquiryDetail["customer"] }) {
  return (
    <Card title="Customer">
      <dl className="m-0">
        <Row term="Name">{customer.fullName}</Row>
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

export function EnquiryCard({ message, createdAt }: { message: string; createdAt: string }) {
  return (
    <Card title="Enquiry">
      <p className="text-body whitespace-pre-wrap break-words text-ink">{message}</p>
      <p className="mt-3 text-helper text-ink">
        Sent <time dateTime={isoDateTime(createdAt)}>{formatDateTime(createdAt)}</time>
      </p>
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
      </dl>
    </Card>
  );
}
