import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";

export default function NotFoundPage({ title = "Page not found", description = "The page you are looking for does not exist." }: { title?: string; description?: string }) {
  return (
    <Card>
      <EmptyState
        icon="search"
        title={title}
        description={description}
        action={
          <Link
            to="/enquiries"
            className="inline-flex h-11 items-center rounded-lg border border-ink px-5 text-body font-semibold text-ink hover:bg-muted"
          >
            Back to inbox
          </Link>
        }
      />
    </Card>
  );
}
