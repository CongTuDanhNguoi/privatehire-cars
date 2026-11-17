// "Reply to customer" card (plan §8.5 C + §9 + §10).
// - Validates like the server (shared rules), focuses the first invalid field.
// - Each send carries a clientRequestId; after a network failure the same id is reused, so the server never sends twice.
// - A failed send keeps the text and offers Retry (same saved record).
import { useRef, useState, type FormEvent } from "react";
import { ApiError, GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../../api/client";
import { enquiriesApi, failedResponseFrom } from "../../api/enquiries";
import type { EmailSettings, Enquiry, EnquiryDetail, EnquiryResponse } from "../../types";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TextArea, TextField } from "../../components/ui/Field";
import { announce } from "../../lib/announce";
import { REPLY_LIMITS, REPLY_MESSAGES, validateReply, type ReplyErrors } from "../../../../backend/src/validation/reply";
import type { Draft } from "./useDraft";

type Outcome =
  | { kind: "sent"; text: string }
  | { kind: "failed"; responseId: number }
  | { kind: "network" }
  | { kind: "blocked" }
  | { kind: "error"; text: string };

interface ReplyComposerProps {
  detail: EnquiryDetail;
  emailSettings: EmailSettings | null;
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  isDirty: boolean;
  onAskDiscard: () => void;
  onSaved: (response: EnquiryResponse, enquiry: Enquiry | null) => void;
  onSent: () => void; // clears the draft
  retry: (responseId: number) => Promise<"sent" | "failed" | "error">;
}

export const sentMessage = (r: EnquiryResponse) =>
  `Response sent to ${r.deliveredTo ?? r.intendedTo} and saved to history. Enquiry marked as Resolved.`;

export function ReplyComposer({ detail, emailSettings, draft, setDraft, isDirty, onAskDiscard, onSaved, onSent, retry }: ReplyComposerProps) {
  const { enquiry, customer } = detail;
  const [errors, setErrors] = useState<ReplyErrors>({});
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const pendingRequestId = useRef<string | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const deliveredTo = emailSettings?.testMode ? emailSettings.testRecipient : null;

  function change(field: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (outcome?.kind === "sent") setOutcome(null);
  }

  // Length errors after leaving a field the user typed in; "required" only on submit.
  function blur(field: keyof Draft) {
    if (!draft[field].trim()) return;
    const message = validateReply(draft)[field];
    if (message) {
      setErrors((e) => ({ ...e, [field]: message }));
      announce(`${field === "subject" ? "Subject" : "Message"}: ${message}`, "polite", 500);
    }
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (sending || outcome?.kind === "blocked") return;
    const found = validateReply(draft);
    setErrors(found);
    if (found.subject) return subjectRef.current?.focus();
    if (found.body) return bodyRef.current?.focus();

    // Reuse the id after a network failure: if the first request did reach the server, it is not sent again.
    const clientRequestId = pendingRequestId.current ?? crypto.randomUUID();
    pendingRequestId.current = clientRequestId;
    setSending(true);
    setOutcome(null);
    try {
      const { response, enquiry: updated } = await enquiriesApi.sendResponse(enquiry.id, {
        clientRequestId,
        subject: draft.subject,
        body: draft.body,
      });
      pendingRequestId.current = null;
      onSaved(response, updated);
      onSent();
      setOutcome({ kind: "sent", text: sentMessage(response) });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setOutcome({ kind: "error", text: GENERIC_ERROR_MESSAGE });
      } else if (err.code === "EMAIL_SEND_FAILED") {
        pendingRequestId.current = null; // the FAILED record exists; Retry re-uses it
        const failed = failedResponseFrom(err.body);
        if (failed) {
          onSaved(failed, null);
          setOutcome({ kind: "failed", responseId: failed.id });
        } else {
          setOutcome({ kind: "error", text: err.message });
        }
      } else if (err.status === 0) {
        setOutcome({ kind: "network" });
      } else if (err.code === "VALIDATION_ERROR" && err.message === REPLY_MESSAGES.invalidCustomerEmail) {
        pendingRequestId.current = null;
        setOutcome({ kind: "blocked" });
      } else if (err.code === "VALIDATION_ERROR" && Object.keys(err.fields).length > 0) {
        pendingRequestId.current = null;
        setErrors({ subject: err.fields.subject, body: err.fields.body });
      } else {
        pendingRequestId.current = null;
        setOutcome({ kind: "error", text: err.message });
      }
    } finally {
      setSending(false);
    }
  }

  async function retryFailed(responseId: number) {
    setRetrying(true);
    const result = await retry(responseId);
    setRetrying(false);
    if (result === "sent") {
      onSent();
      const sent = detail.responses.find((r) => r.id === responseId);
      setOutcome({ kind: "sent", text: sent ? sentMessage({ ...sent, sendStatus: "SENT" }) : "Response sent and saved to history." });
    }
  }

  return (
    <Card title="Reply to customer">
      <form noValidate onSubmit={send} className="flex flex-col gap-5">
        <div className="text-label text-ink">
          <p>
            <span className="font-semibold">To:</span> {customer.fullName} &lt;{customer.email}&gt;
          </p>
          {deliveredTo && (
            <p className="mt-1">
              <span className="font-semibold">Delivered to (test mode):</span> {deliveredTo}
            </p>
          )}
        </div>

        {outcome?.kind === "sent" && <Alert variant="success" title="Response sent">{outcome.text}</Alert>}
        {outcome?.kind === "failed" && (
          <Alert
            variant="error"
            title="Email could not be sent."
            action={{ label: "Retry", onClick: () => retryFailed(outcome.responseId), loading: retrying }}
          >
            Your response was saved as Failed — you can retry.
          </Alert>
        )}
        {outcome?.kind === "network" && (
          <Alert variant="error" title={NETWORK_ERROR_MESSAGE} action={{ label: "Try again", onClick: () => void send(), loading: sending }}>
            Your message has not been lost.
          </Alert>
        )}
        {outcome?.kind === "blocked" && <Alert variant="error" title={REPLY_MESSAGES.invalidCustomerEmail} />}
        {outcome?.kind === "error" && <Alert variant="error" title={outcome.text} />}

        <TextField
          ref={subjectRef}
          id="reply-subject"
          name="subject"
          label="Subject"
          required
          maxLength={REPLY_LIMITS.subjectMax + 50}
          value={draft.subject}
          onChange={(e) => change("subject", e.target.value)}
          onBlur={() => blur("subject")}
          error={errors.subject}
          autoComplete="off"
        />
        <TextArea
          ref={bodyRef}
          id="reply-body"
          name="body"
          label="Message"
          required
          rows={10}
          maxChars={REPLY_LIMITS.bodyMax}
          value={draft.body}
          onChange={(e) => change("body", e.target.value)}
          onBlur={() => blur("body")}
          error={errors.body}
          placeholder={`Hi ${customer.fullName.split(" ")[0]},`}
        />
        <div className="flex items-center gap-4">
          <Button type="submit" loading={sending} loadingText="Sending…" disabled={outcome?.kind === "blocked"}>
            Send response
          </Button>
          <Button variant="text" onClick={onAskDiscard} disabled={!isDirty || sending}>
            Discard draft
          </Button>
        </div>
      </form>
    </Card>
  );
}
