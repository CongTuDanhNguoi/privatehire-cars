// /enquiries/:id — Enquiry Detail (plan §8.5 C).
import { useCallback, useEffect, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { enquiriesApi, failedResponseFrom } from "../api/enquiries";
import type { EmailSettings, Enquiry, EnquiryDetail, EnquiryResponse, EnquiryStatus } from "../types";
import { useEmailSettingsContext } from "../components/layout/AppShell";
import { Alert } from "../components/ui/Alert";
import { TypeBadge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Skeleton } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";
import { Segmented } from "../components/ui/Segmented";
import { useToast } from "../components/ui/Toast";
import { CustomerCard, EnquiryCard, EnquiryDetailsCard, PlannedTripCard, TripCard } from "../features/enquiries/InfoCards";
import { ReplyComposer } from "../features/enquiries/ReplyComposer";
import { ResponseHistory, StatusHistory } from "../features/enquiries/ResponseHistory";
import { useDraft } from "../features/enquiries/useDraft";
import { formatDateTime, isoDateTime } from "../lib/format";
import { inboxHref } from "../lib/storage";
import { useAsync } from "../lib/useAsync";
import NotFoundPage from "./NotFoundPage";

export default function EnquiryDetailPage() {
  const { id: rawId } = useParams();
  const id = /^\d+$/.test(rawId ?? "") ? Number(rawId) : null;
  const emailSettings = useEmailSettingsContext();
  const state = useAsync((signal) => (id ? enquiriesApi.detail(id, signal) : Promise.reject(new ApiError(404, "NOT_FOUND", "Enquiry not found."))), [id]);

  if (state.error?.status === 404 || id === null) {
    return <NotFoundPage title="Enquiry not found" description="This enquiry does not exist or has been removed." />;
  }
  if (state.error && !state.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <Alert variant="error" title="The enquiry could not be loaded." action={{ label: "Try again", onClick: state.reload }}>
          {state.error.message}
        </Alert>
      </div>
    );
  }
  if (!state.data) return <DetailSkeleton />;
  // Keyed by enquiry so the draft and messages reset when moving to another enquiry.
  return <DetailView key={state.data.enquiry.id} detail={state.data} emailSettings={emailSettings} setDetail={state.setData} reload={state.reload} />;
}

function BackLink() {
  return (
    <Link to={inboxHref()} className="inline-flex w-fit items-center gap-1.5 rounded-md text-label font-semibold text-ink hover:underline">
      <Icon name="arrowLeft" size={18} />
      Back to inbox
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <BackLink />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-5 flex flex-col gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
        </div>
        <div className="col-span-7 flex flex-col gap-4">
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}

interface DetailViewProps {
  detail: EnquiryDetail;
  emailSettings: EmailSettings | null;
  setDetail: (update: (prev: EnquiryDetail | null) => EnquiryDetail | null) => void;
  reload: () => void;
}

function DetailView({ detail, emailSettings, setDetail, reload }: DetailViewProps) {
  const { enquiry } = detail;
  const toast = useToast();
  const defaultSubject = `Re: [${enquiry.code}] ${enquiry.subject}`;
  const { draft, setDraft, isDirty, clear } = useDraft(enquiry.id, defaultSubject);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // ---- Leaving with an unsent reply asks first (in-app navigation + closing/reloading the tab). ----
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // ---- Merge server results into the page without a full reload. ----
  const saveResponse = useCallback(
    (response: EnquiryResponse, updated: Enquiry | null) => {
      setDetail((prev) => {
        if (!prev) return prev;
        const others = prev.responses.filter((r) => r.id !== response.id);
        return { ...prev, enquiry: updated ?? prev.enquiry, responses: [response, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id) };
      });
      // Status history may have gained an "auto after response" entry.
      if (updated && updated.status !== detail.enquiry.status) reload();
    },
    [setDetail, reload, detail.enquiry.status],
  );

  const retry = useCallback(
    async (responseId: number): Promise<"sent" | "failed" | "error"> => {
      setRetryingId(responseId);
      try {
        const { response, enquiry: updated } = await enquiriesApi.retry(responseId);
        saveResponse(response, updated);
        toast("Response sent");
        return "sent";
      } catch (err) {
        if (err instanceof ApiError && err.code === "EMAIL_SEND_FAILED") {
          const failed = failedResponseFrom(err.body);
          if (failed) saveResponse(failed, null);
          toast("Email could not be sent. Try again later.", "error");
          return "failed";
        }
        toast(err instanceof ApiError ? err.message : "Something went wrong. Please try again.", "error");
        if (err instanceof ApiError && err.status === 409) reload();
        return "error";
      } finally {
        setRetryingId(null);
      }
    },
    [saveResponse, toast, reload],
  );

  async function changeStatus(next: EnquiryStatus) {
    const previous = enquiry.status;
    if (next === previous) return;
    setDetail((prev) => (prev ? { ...prev, enquiry: { ...prev.enquiry, status: next } } : prev)); // optimistic
    setStatusSaving(true);
    try {
      await enquiriesApi.setStatus(enquiry.id, next);
      toast("Status updated");
      reload(); // picks up the new status history entry
    } catch (err) {
      setDetail((prev) => (prev ? { ...prev, enquiry: { ...prev.enquiry, status: previous } } : prev));
      toast(err instanceof ApiError ? `Status not updated: ${err.message}` : "Status not updated. Please try again.", "error");
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-4 md:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-label font-semibold tabular-nums text-ink">{enquiry.code}</span>
            <TypeBadge type={enquiry.type} />
          </div>
          <h1 className="text-page font-bold text-balance break-words text-ink">{enquiry.subject}</h1>
          <p className="text-helper text-ink">
            Received <time dateTime={isoDateTime(enquiry.createdAt)}>{formatDateTime(enquiry.createdAt)}</time>
          </p>
        </div>
        <Segmented
          legend="Status"
          value={enquiry.status}
          disabled={statusSaving}
          onChange={changeStatus}
          options={[
            { value: "AWAITING", label: "Awaiting" },
            {
              value: "RESOLVED",
              label: (
                <>
                  <Icon name="check" size={16} />
                  Resolved
                </>
              ),
            },
          ]}
        />
      </header>

      {/* Left (8/12): the conversation — question, replies, reply box. Right (4/12): reference info.
          The left column comes first in the DOM so the response list is the first <ol> on the page. */}
      <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-8">
          <EnquiryCard message={enquiry.message} createdAt={enquiry.createdAt} customerName={detail.customer.fullName} />
          <ResponseHistory responses={detail.responses} retryingId={retryingId} onRetry={(rid) => void retry(rid)} />
          <ReplyComposer
            detail={detail}
            emailSettings={emailSettings}
            draft={draft}
            setDraft={setDraft}
            isDirty={isDirty}
            onAskDiscard={() => setDiscardOpen(true)}
            onSaved={saveResponse}
            onSent={clear}
            retry={retry}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-4">
          <CustomerCard customer={detail.customer} />
          <EnquiryDetailsCard enquiry={enquiry} />
          {enquiry.type === "TRIP" && detail.booking && <TripCard booking={detail.booking} />}
          {enquiry.type === "TRIP" && !detail.booking && enquiry.tripSnapshot && <PlannedTripCard trip={enquiry.tripSnapshot} />}
          <StatusHistory items={detail.statusHistory} />
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen || blocker.state === "blocked"}
        title="Discard your unsent response?"
        description="The text you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          clear();
          setDiscardOpen(false);
          if (blocker.state === "blocked") blocker.proceed();
        }}
        onCancel={() => {
          setDiscardOpen(false);
          if (blocker.state === "blocked") blocker.reset();
        }}
      />
    </div>
  );
}
