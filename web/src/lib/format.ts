// Dates come from the API in UTC (ISO strings) and are shown in the viewer's local time.

const pad = (n: number) => String(n).padStart(2, "0");

// dd/MM/yyyy HH:mm
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Machine-readable value for <time dateTime="…">
export const isoDateTime = (iso: string) => new Date(iso).toISOString();
