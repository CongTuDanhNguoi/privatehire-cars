// sessionStorage helpers that never throw (storage can be blocked or full).

export function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// The last inbox filters (?type=…&status=…), so "Back to inbox" returns to the same view.
export const INBOX_QUERY_KEY = "phc_staff_inbox_query";
export const inboxHref = () => `/enquiries${readSession<string>(INBOX_QUERY_KEY) ?? ""}`;
