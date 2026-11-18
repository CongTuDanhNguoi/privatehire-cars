// Four summary cards above the inbox table. Clicking a card applies that filter (the same as the toolbar).
// Counts come from the inbox response: status counts ignore the status filter, type counts ignore the type filter.
import type { InboxQuery } from "../../api/enquiries";
import { Icon, type IconName } from "../../components/ui/Icon";
import { cn } from "../../lib/cn";

interface Counts {
  awaiting: number;
  resolved: number;
  general: number;
  trip: number;
}

interface StatCardsProps {
  counts?: Counts;
  type: InboxQuery["type"];
  status: InboxQuery["status"];
  onPick: (changes: Partial<InboxQuery>) => void;
}

interface CardDef {
  key: keyof Counts;
  label: string;
  icon: IconName;
  tone: string; // icon circle colours
  change: Partial<InboxQuery>;
}

const CARDS: CardDef[] = [
  { key: "awaiting", label: "Awaiting reply", icon: "clock", tone: "bg-primary/15 text-primary-pressed", change: { status: "AWAITING" } },
  { key: "resolved", label: "Resolved", icon: "check", tone: "bg-success-fill text-success", change: { status: "RESOLVED" } },
  { key: "trip", label: "Trip-specific", icon: "car", tone: "bg-success-fill text-ink", change: { type: "TRIP" } },
  { key: "general", label: "General", icon: "mail", tone: "bg-muted/60 text-ink", change: { type: "GENERAL" } },
];

export function StatCards({ counts, type, status, onPick }: StatCardsProps) {
  return (
    <ul aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {CARDS.map((card) => {
        const active = card.change.status ? status === card.change.status : type === card.change.type;
        return (
          <li key={card.key} className="flex">
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onPick(card.change)}
              className={cn(
                "flex w-full cursor-pointer flex-col items-start gap-2 rounded-xl border bg-surface p-4 text-left shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5 transition-[border-color,box-shadow] duration-150 hover:shadow-md",
                active ? "border-primary-pressed" : "border-muted",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full sm:size-11", card.tone)}>
                <Icon name={card.icon} size={20} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-page font-bold tabular-nums text-ink">{counts ? counts[card.key] : "—"}</span>
                <span className="truncate text-label text-ink">{card.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
