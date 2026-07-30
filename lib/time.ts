export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** current time as fractional minutes since midnight */
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function fmtDur(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

export function fmtDateHuman(iso: string): string {
  const dt = new Date(iso + "T12:00:00");
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
