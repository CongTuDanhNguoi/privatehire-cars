// /enquiries — Enquiry Inbox (plan §8.5 B). Filters live in the URL (?type=TRIP&status=AWAITING&q=…&page=2)
// so Back / Refresh keep them.
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { enquiriesApi, PAGE_SIZE, type InboxQuery } from "../api/enquiries";
import { InboxTable } from "../features/enquiries/InboxTable";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";
import { Select, TextField } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { Segmented } from "../components/ui/Segmented";
import { StatCards } from "../features/enquiries/StatCards";
import { announce } from "../lib/announce";
import { INBOX_QUERY_KEY, writeSession } from "../lib/storage";
import { useAsync } from "../lib/useAsync";

const TYPES = ["ALL", "GENERAL", "TRIP"] as const;
const STATUSES = ["ALL", "AWAITING", "RESOLVED"] as const;

function readQuery(params: URLSearchParams): InboxQuery {
  const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const page = Number(params.get("page"));
  return {
    type: pick(params.get("type"), TYPES, "ALL"),
    status: pick(params.get("status"), STATUSES, "AWAITING"), // default view: what still needs a reply
    q: (params.get("q") ?? "").trim().slice(0, 100),
    sort: pick(params.get("sort"), ["newest", "oldest"] as const, "newest"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export default function InboxPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const query = readQuery(params);
  const [search, setSearch] = useState(query.q);

  // Remember this view for "Back to inbox".
  useEffect(() => {
    writeSession(INBOX_QUERY_KEY, location.search);
  }, [location.search]);

  const { data, error, loading, reload } = useAsync(
    (signal) => enquiriesApi.list(query, signal),
    [query.type, query.status, query.q, query.sort, query.page],
  );

  // Builds the next URL from the browser's CURRENT address, not from the params of the render that created this
  // function: the debounced search can fire right after a filter click, and must not bring back the old filter.
  // (react-router's functional setSearchParams also hands back the params of that older render.)
  function update(changes: Partial<InboxQuery>, resetPage = true) {
    const current = readQuery(new URLSearchParams(window.location.search));
    const next = { ...current, ...changes, ...(resetPage ? { page: changes.page ?? 1 } : {}) };
    const p = new URLSearchParams();
    if (next.type !== "ALL") p.set("type", next.type);
    p.set("status", next.status);
    if (next.q) p.set("q", next.q);
    if (next.sort !== "newest") p.set("sort", next.sort);
    if (next.page > 1) p.set("page", String(next.page));
    setParams(p, { replace: changes.q !== undefined });
  }

  // Search as you type, 300 ms after the last keystroke.
  useEffect(() => {
    const value = search.trim();
    if (value === query.q) return;
    const t = setTimeout(() => update({ q: value }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Keep the box in sync when the URL changes from outside (Back button, Clear filters).
  useEffect(() => {
    setSearch((s) => (s.trim() === query.q ? s : query.q));
  }, [query.q]);

  // Tell screen-reader users how many results the filters produced.
  useEffect(() => {
    if (data && !loading) announce(`${data.total} ${data.total === 1 ? "enquiry" : "enquiries"} found`, "polite", 400);
  }, [data, loading]);

  const counts = data?.counts;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const firstItem = data && data.total > 0 ? (data.page - 1) * PAGE_SIZE + 1 : 0;
  const lastItem = data ? Math.min(data.page * PAGE_SIZE, data.total) : 0;
  const count = (n: number | undefined) => (n === undefined ? "" : ` (${n})`);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-page font-bold text-balance text-ink">Enquiries</h1>
          <p className="text-body text-ink">
            {counts ? `${counts.awaiting} awaiting · ${counts.resolved} resolved` : "Loading…"}
          </p>
        </div>
        <Button variant="secondary" onClick={reload} loading={loading && !!data} loadingText="Refreshing…">
          <Icon name="refresh" size={18} />
          Refresh
        </Button>
      </header>

      <StatCards counts={counts} type={query.type} status={query.status} onPick={(changes) => update(changes)} />

      <section aria-label="Enquiry list" className="overflow-hidden rounded-xl border border-muted bg-surface shadow-sm">
      <search className="flex flex-wrap items-end gap-4 border-b border-muted p-4">
        <Segmented
          legend="Type"
          value={query.type}
          onChange={(type) => update({ type })}
          options={[
            { value: "ALL", label: `All${count(counts && counts.general + counts.trip)}` },
            { value: "GENERAL", label: `General${count(counts?.general)}` },
            { value: "TRIP", label: `Trip-specific${count(counts?.trip)}` },
          ]}
        />
        <div className="w-44">
          <Select label="Status" value={query.status} onChange={(e) => update({ status: e.target.value as InboxQuery["status"] })}>
            <option value="ALL">All</option>
            <option value="AWAITING">Awaiting</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
        </div>
        <div className="min-w-60 flex-1">
          <TextField
            label="Search"
            type="search"
            placeholder="Search by ID, customer, email or subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={100}
          />
        </div>
        <div className="w-40">
          <Select label="Sort" value={query.sort} onChange={(e) => update({ sort: e.target.value as InboxQuery["sort"] })}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </div>
      </search>

      {error ? (
        <div className="p-4">
        <Alert variant="error" title="Enquiries could not be loaded." action={{ label: "Try again", onClick: reload }}>
          {error.message}
        </Alert>
        </div>
      ) : data && data.total === 0 && !loading ? (
        <div>
          <EmptyState
            title="No enquiries match your filters"
            description="Try another type or status, or clear the search."
            action={
              <Button variant="secondary" onClick={() => { setSearch(""); update({ type: "ALL", status: "ALL", q: "" }); }}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <InboxTable
            items={data && !(loading && !data) ? data.items : null}
            loading={loading}
            captionText={`Enquiries — ${query.status === "ALL" ? "all statuses" : query.status.toLowerCase()}, ${
              query.type === "ALL" ? "all types" : query.type === "TRIP" ? "trip-specific" : "general"
            }${data ? `, ${data.total} results` : ""}`}
          />
          {data && data.total > 0 && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-label text-ink">
                Showing {firstItem}–{lastItem} of {data.total}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="secondary" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 }, false)}>
                  <Icon name="chevronLeft" size={18} />
                  Previous
                </Button>
                <span className="text-label tabular-nums">
                  Page {data.page} of {totalPages}
                </span>
                <Button variant="secondary" disabled={data.page >= totalPages} onClick={() => update({ page: data.page + 1 }, false)}>
                  Next
                  <Icon name="chevronRight" size={18} />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
      </section>
    </div>
  );
}
