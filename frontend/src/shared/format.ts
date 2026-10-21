import { T } from "./text";

const pad = (n: number) => String(n).padStart(2, "0");

/** dd.mm.yyyy */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return T.common.none;
  const d = typeof value === "string" ? parseDate(value) : value;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** dd.mm.yyyy HH:MM */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return T.common.none;
  const d = new Date(value);
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2026-09-28" ni mahalliy sana sifatida o'qiydi (UTC siljishisiz). */
export function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** <input type="date"> qiymati */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Muddat maydonlari uchun `min` (server qoidasi `core/dates.py` bilan bir xil): bugundan oldingi kun tanlanmaydi.
 * `saved` — tahrirlanayotgan yozuvning eski qiymati (o'tib ketgan bo'lsa ham o'zgartirmasdan saqlash mumkin),
 * `after` — undan oldin bo'lmasligi kerak bo'lgan qiymat (masalan boshlanish sanasi). Filtrlarda ishlatilmaydi. */
export function minDate(saved?: string | null, after?: string | null): string {
  const today = isoDate(new Date());
  const old = saved ? saved.slice(0, 10) : "";
  const min = old && old < today ? old : today;
  const from = after ? after.slice(0, 10) : "";
  return from > min ? from : min;
}

/** `<input type="datetime-local">` uchun `minDate` (bugun 00:00 dan). */
export function minDateTime(saved?: string | null, after?: string | null): string {
  const base = `${minDate(saved)}T00:00`;
  return after && after > base ? after : base;
}

/** ISO → <input type="datetime-local"> qiymati */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> → ISO (serverga) */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Muddatgacha necha kun: musbat — qoldi, manfiy — kechikdi. */
export function daysUntil(value: string, now = new Date()): number {
  const target = parseDate(value);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function relativeDue(value: string | null, done = false): { text: string; tone: "danger" | "warning" | "muted" } | null {
  if (!value || done) return null;
  const n = daysUntil(value);
  if (n < 0) return { text: T.common.daysLate(-n), tone: "danger" };
  if (n <= 2) return { text: T.common.daysLeft(n), tone: "warning" };
  return { text: T.common.daysLeft(n), tone: "muted" };
}

export function timeAgo(value: string, now = new Date()): string {
  const diff = Math.max(0, (now.getTime() - new Date(value).getTime()) / 1000);
  if (diff < 60) return T.time.now;
  if (diff < 3600) return T.time.minutes(Math.floor(diff / 60));
  if (diff < 86400) return T.time.hours(Math.floor(diff / 3600));
  if (diff < 86400 * 7) return T.time.days(Math.floor(diff / 86400));
  return fmtDate(value);
}

export function fileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
