// /enquiries — Enquiry Inbox. Placeholder for Phase 4; the full inbox is built in Phase 5.
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page font-bold text-ink">Enquiries</h1>
      <Card>
        <EmptyState title="Inbox coming in Phase 5" description="Signing in, signing out and the email mode banner are ready." />
      </Card>
    </div>
  );
}
