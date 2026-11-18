// Every reply saved for this enquiry (newest first), plus the small status history log.
import { useLayoutEffect, useRef, useState } from "react";
import type { EnquiryResponse, StatusChange } from "../../types";
import { SendBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { formatDateTime, isoDateTime } from "../../lib/format";

function ResponseBody({ id, body }: { id: number; body: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Only offer "Show more" when the 4-line clamp actually hides text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [body]);

  const bodyId = `response-body-${id}`;
  return (
    <div>
      <p id={bodyId} ref={ref} className={`text-body whitespace-pre-wrap break-words text-ink ${expanded ? "" : "line-clamp-4"}`}>
        {body}
      </p>
      {(overflows || expanded) && (
        <Button variant="text" className="mt-1 text-label" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}

interface ResponseHistoryProps {
  responses: EnquiryResponse[];
  retryingId: number | null;
  onRetry: (responseId: number) => void;
}

export function ResponseHistory({ responses, retryingId, onRetry }: ResponseHistoryProps) {
  return (
    <Card title="Response history">
      {responses.length === 0 ? (
        <p className="text-body text-ink">No responses yet</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {responses.map((r) => (
            <li
              key={r.id}
              className={`rounded-lg border border-l-4 border-muted p-4 ${
                r.sendStatus === "SENT" ? "border-l-success" : r.sendStatus === "FAILED" ? "border-l-error" : "border-l-line"
              }`}
            >
              <article aria-labelledby={`response-subject-${r.id}`} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 id={`response-subject-${r.id}`} className="text-body font-bold break-words text-ink">
                    {r.subject}
                  </h3>
                  <SendBadge status={r.sendStatus} />
                </div>
                <p className="text-helper text-ink">
                  {r.staff.fullName} · <time dateTime={isoDateTime(r.sentAt ?? r.createdAt)}>{formatDateTime(r.sentAt ?? r.createdAt)}</time>
                  {r.attemptCount > 1 && ` · ${r.attemptCount} attempts`}
                  {r.deliveredTo && (
                    <>
                      {" · "}Delivered to {r.deliveredTo}
                      {r.testMode && r.deliveredTo !== r.intendedTo && " (test mode)"}
                    </>
                  )}
                  {r.provider === "MOCK" && " · mock email (not really sent)"}
                </p>
                <ResponseBody id={r.id} body={r.body} />
                {r.sendStatus === "FAILED" && (
                  <div className="flex items-center justify-between gap-3 rounded-md border-l-4 border-error bg-error-fill px-3 py-2">
                    <p className="text-label text-error">{r.errorMessage ?? "The email could not be sent."}</p>
                    <Button variant="secondary" className="h-9" loading={retryingId === r.id} loadingText="Retrying…" onClick={() => onRetry(r.id)}>
                      Retry
                    </Button>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const STATUS_LABEL = { AWAITING: "Awaiting", RESOLVED: "Resolved" } as const;

export function StatusHistory({ items }: { items: StatusChange[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="status-history-title" className="rounded-xl border border-muted bg-surface p-6 shadow-sm">
      <h2 id="status-history-title" className="text-label font-semibold text-ink">
        Status history
      </h2>
      <ol className="mt-2 flex list-none flex-col gap-1 p-0">
        {items.map((h) => (
          <li key={h.id} className="text-helper text-ink">
            {STATUS_LABEL[h.fromStatus]} → {STATUS_LABEL[h.toStatus]} ·{" "}
            {h.reason === "AUTO_AFTER_RESPONSE" ? "auto after response" : `by ${h.changedBy?.fullName ?? "staff"}`} ·{" "}
            <time dateTime={isoDateTime(h.changedAt)}>{formatDateTime(h.changedAt)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
