import { T } from "./text";

/** Server xatosi: `detail` — foydalanuvchiga ko'rsatiladigan matn, `fields` — maydon xatolari. */
export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  code?: string;

  constructor(status: number, detail: string, fields: Record<string, string[]> = {}, code?: string) {
    super(detail);
    this.status = status;
    this.fields = fields;
    this.code = code;
  }

  field(name: string): string | undefined {
    const value = this.fields[name];
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
    return String(value);
  }
}

function cookie(name: string): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

type Body = FormData | object | undefined;

export const UNAUTHORIZED_EVENT = "teamflow:unauthorized";

export async function request<R>(method: string, path: string, body?: Body): Promise<R> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["X-CSRFToken"] = cookie("csrftoken");
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, T.common.errorGeneric);
  }

  if (res.status === 204) return undefined as R;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const fallback =
      res.status === 403 ? T.common.forbidden : res.status === 404 ? T.common.notFound : T.common.errorGeneric;
    throw new ApiError(res.status, data.detail || fallback, data.fields || {}, data.code);
  }
  return data as R;
}

export const api = {
  get: <R>(path: string) => request<R>("GET", path),
  post: <R>(path: string, body?: Body) => request<R>("POST", path, body),
  put: <R>(path: string, body?: Body) => request<R>("PUT", path, body),
  patch: <R>(path: string, body?: Body) => request<R>("PATCH", path, body),
  del: <R>(path: string) => request<R>("DELETE", path),
};

/** Faylni blob sifatida olish (hujjatni modal ichida ko'rsatish uchun). */
export async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, T.docs.failed);
  return res.blob();
}

/** Query string: bo'sh qiymatlar tashlab yuboriladi. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** FormData yig'ish: massivlar JSON matn sifatida, fayllar alohida. */
export function formData(fields: Record<string, unknown>, files: File[] = [], fileKey = "files"): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  for (const f of files) fd.append(fileKey, f);
  return fd;
}
