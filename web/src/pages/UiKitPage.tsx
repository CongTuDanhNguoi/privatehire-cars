// /ui-kit — development only (import.meta.env.DEV). Shows every component in every state so the team can
// compare it with the PrivateHire Cars UI Kit.
import { useState } from "react";
import { Alert } from "../components/ui/Alert";
import { SendBadge, StatusBadge, TypeBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { Select, TextArea, TextField } from "../components/ui/Field";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { EmailModeBanner } from "../components/layout/EmailModeBanner";

const SWATCHES = [
  ["ink", "bg-ink", "#02284F — text"],
  ["surface", "bg-surface", "#FFFFFF — background"],
  ["line", "bg-line", "#8999A6 — borders"],
  ["error", "bg-error", "#FA0702 — error"],
  ["error-fill", "bg-error-fill", "error 5%"],
  ["success", "bg-success", "#05C1FA — success"],
  ["success-fill", "bg-success-fill", "#DEF7FF"],
  ["primary", "bg-primary", "#65B3FC — primary"],
  ["primary-stroke", "bg-primary-stroke", "#02284F 51%"],
  ["primary-pressed", "bg-primary-pressed", "#3F84C4 — pressed"],
  ["muted", "bg-muted", "#D5E2ED — muted"],
] as const;

export default function UiKitPage() {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogResult, setDialogResult] = useState("—");
  const [message, setMessage] = useState("Hello Alex,\nThanks for your message.");

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8 p-8">
      <header>
        <h1 className="text-page font-bold">UI Kit — Staff Portal</h1>
        <p className="text-body">Development only. Compare colours, type and components with the PrivateHire Cars UI Kit.</p>
      </header>

      <Card title="Colours">
        <ul className="grid grid-cols-4 gap-4">
          {SWATCHES.map(([name, cls, note]) => (
            <li key={name} className="flex items-center gap-3">
              <span className={`size-12 shrink-0 rounded-lg border border-muted ${cls}`} />
              <span>
                <span className="block text-label font-semibold">{name}</span>
                <span className="block text-helper">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Typography (Inter)">
        <div className="flex flex-col gap-2">
          <p className="text-page font-bold">Page title — 28px Bold</p>
          <p className="text-heading font-bold">Heading — 20px Bold</p>
          <p className="text-body">Body — 16px Regular. The quick brown fox jumps over the lazy dog.</p>
          <p className="text-label font-semibold">Label — 14px Semibold</p>
          <p className="text-helper">Helper — 12px Regular (notes, field errors, timestamps)</p>
        </div>
      </Card>

      <Card title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button disabled>Disabled</Button>
          <Button loading loadingText="Sending…">
            Send
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="secondary" disabled>
            Secondary disabled
          </Button>
          <Button variant="text">Text button</Button>
          <Button variant="icon" aria-label="Close">
            ✕
          </Button>
        </div>
        <p className="mt-3 text-helper">Press Tab to see the focus ring on each button.</p>
      </Card>

      <Card title="Form fields">
        <div className="grid grid-cols-2 gap-6">
          <TextField label="Email" required placeholder="name@example.com" />
          <TextField label="Email (error)" required defaultValue="sarah@" error="Enter a valid email address." />
          <Select label="Status" defaultValue="AWAITING">
            <option value="ALL">All</option>
            <option value="AWAITING">Awaiting</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          <TextField label="Disabled" disabled defaultValue="Read only value" />
          <TextArea label="Message" required rows={4} maxChars={5000} value={message} onChange={(e) => setMessage(e.target.value)} />
          <TextArea label="Message (error)" required rows={4} maxChars={5000} value="" onChange={() => {}} error="Message is required." />
        </div>
      </Card>

      <Card title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <TypeBadge type="GENERAL" />
          <TypeBadge type="TRIP" />
          <StatusBadge status="AWAITING" />
          <StatusBadge status="RESOLVED" />
          <SendBadge status="SENT" />
          <SendBadge status="FAILED" />
          <SendBadge status="PENDING" />
        </div>
      </Card>

      <Card title="Feedback messages">
        <div className="flex flex-col gap-4">
          <Alert variant="error" title="Email could not be sent." action={{ label: "Retry", onClick: () => toast("Retry clicked") }}>
            Your response was saved as Failed — you can retry.
          </Alert>
          <Alert variant="success" title="Response sent">
            Response sent to alex.morgan@example.com and saved to history. Enquiry marked as Resolved.
          </Alert>
          <Alert variant="info" title="Information">
            Neutral information message.
          </Alert>
          <EmailModeBanner settings={{ provider: "MOCK", testMode: false, testRecipient: null }} />
          <EmailModeBanner settings={{ provider: "EMAILJS", testMode: true, testRecipient: "team@example.com" }} />
        </div>
      </Card>

      <Card title="Toast, dialog, loading, empty">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={() => toast("Status updated")}>
            Show success toast
          </Button>
          <Button variant="secondary" onClick={() => toast("Could not update the status. Please try again.", "error")}>
            Show error toast
          </Button>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open confirm dialog
          </Button>
          <span className="text-label">Dialog result: {dialogResult}</span>
        </div>
        <div className="mt-6 grid grid-cols-3 items-start gap-6">
          <div className="flex items-center gap-3">
            <Spinner />
            <span className="text-label">Spinner</span>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <EmptyState title="No enquiries match your filters" action={<Button variant="secondary">Clear filters</Button>} />
        </div>
      </Card>

      <ConfirmDialog
        open={dialogOpen}
        title="Discard your unsent response?"
        description="The text you typed will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDialogOpen(false);
          setDialogResult("Discard");
        }}
        onCancel={() => {
          setDialogOpen(false);
          setDialogResult("Keep editing / Esc");
        }}
      />
    </div>
  );
}
