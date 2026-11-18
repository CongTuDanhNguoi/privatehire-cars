// Inbox table. Each row opens the enquiry; the subject is a real link, so keyboard users reach every row with
// Tab and open it with Enter, and the whole row is also clickable with the mouse.
import { useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EnquirySummary } from "../../types";
import { StatusBadge, TypeBadge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Icon } from "../../components/ui/Icon";
import { Skeleton } from "../../components/ui/Feedback";
import { formatDateTime, isoDateTime } from "../../lib/format";

const COLUMNS = [
  { label: "ID", width: "w-[124px]" },
  { label: "Type", width: "w-[96px]" },
  { label: "Subject", width: "" },
  { label: "Customer", width: "w-[190px]" },
  { label: "Trip", width: "w-[92px]" },
  { label: "Received", width: "w-[104px]" },
  { label: "Status", width: "w-[116px]" },
  { label: "Replies", width: "w-[72px]" },
];

const cell = "border-b border-muted px-3 py-3.5 align-middle";

interface InboxTableProps {
  items: EnquirySummary[] | null;
  loading: boolean;
  captionText: string;
}

export function InboxTable({ items, loading, captionText }: InboxTableProps) {
  const navigate = useNavigate();
  const captionId = useId();

  return (
    <div role="region" aria-labelledby={captionId} tabIndex={0} className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left" aria-busy={loading || undefined}>
        <caption id={captionId} className="visually-hidden">
          {captionText}
        </caption>
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c.label} className={c.width} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.label} scope="col" className="border-b border-muted bg-muted/40 px-3 py-3 text-helper font-semibold tracking-wide text-ink uppercase">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items === null
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c.label} className={cell}>
                      <Skeleton className="h-4 w-4/5" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((e) => (
                <tr
                  key={e.id}
                  onClick={(ev) => {
                    // Let the link handle its own clicks (incl. Ctrl/Cmd+click to open a new tab).
                    if ((ev.target as HTMLElement).closest("a")) return;
                    navigate(`/enquiries/${e.id}`);
                  }}
                  className="cursor-pointer transition-colors duration-150 hover:bg-muted/40"
                >
                  <td className={`${cell} text-label font-semibold tabular-nums`}>
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className={`size-2 shrink-0 rounded-full ${e.status === "AWAITING" ? "bg-primary-pressed" : "bg-transparent"}`}
                      />
                      {e.code}
                    </span>
                  </td>
                  <td className={cell}>
                    <TypeBadge type={e.type} />
                  </td>
                  <td className={cell}>
                    <Link
                      to={`/enquiries/${e.id}`}
                      className="block truncate rounded text-body font-semibold text-ink hover:underline"
                    >
                      {e.subject}
                    </Link>
                  </td>
                  <td className={cell}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={e.customer.fullName} />
                      <span className="min-w-0">
                        <span className="block truncate text-label font-semibold">{e.customer.fullName}</span>
                        <span className="block truncate text-helper">{e.customer.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className={`${cell} text-label tabular-nums`}>{e.bookingRef ?? "—"}</td>
                  <td className={`${cell} text-label tabular-nums`}>
                    <time dateTime={isoDateTime(e.createdAt)}>{formatDateTime(e.createdAt)}</time>
                  </td>
                  <td className={cell}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className={`${cell} text-label tabular-nums`}>
                    <span className="inline-flex items-center gap-1.5">
                      {e.responseCount}
                      {e.lastResponseStatus === "FAILED" && (
                        <Icon name="alert" size={16} className="text-error" label="Last reply failed to send" />
                      )}
                    </span>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
