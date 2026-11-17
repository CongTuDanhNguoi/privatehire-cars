// Dates come from the API in UTC (ISO strings).
// - Activity times (received, sent, status changes) are shown in the viewer's local time.
// - Journey times are shown in UK time: a pickup at 14:30 in Manchester is 14:30 wherever the staff member is.

export const UK_TIME_ZONE = "Europe/London";

// dd/MM/yyyy HH:mm
export function formatDateTime(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

// Machine-readable value for <time dateTime="…">
export const isoDateTime = (iso: string) => new Date(iso).toISOString();
