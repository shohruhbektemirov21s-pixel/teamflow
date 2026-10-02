import { AlertTriangle, Check, CheckCircle2, Download, Eye, FileText, Inbox, Info, Loader2, Paperclip, X } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { fileSize, initials, relativeDue } from "../format";
import { useMeta } from "../meta";
import { avatarColor, ORDER_TONE, PRIORITY_TONE, STAGE_TONE, TASK_TONE, type Tone } from "../status";
import { T } from "../text";
import type { FileInfo, OrderStatus, Priority, ProjectStage, TaskStatus, UserBrief } from "../types";

export { Modal, useDialogBehavior } from "./Modal";

/** Vazifa kodi (tasodifiy 9 xonali raqam) yoki loyiha raqami (qo'lda kiritilgan) — hamma joyda bir xil
 * ko'rinish; qidiruvda shu kod/raqam yoziladi. */
export function CodeTag({ code }: { code: string }) {
  return <span className="code-tag">{code}</span>;
}

// ─── Tugma ───────────────────────────────────────────────────────────────────
type Variant = "primary" | "danger" | "success" | "ghost" | "default";

export function Button({
  variant = "default",
  size,
  loading,
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "lg"; loading?: boolean; icon?: ReactNode }) {
  const cls = ["btn", variant !== "default" && `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(" ");
  return (
    // `disabled` — `rest` dan keyin: yuklanayotganda tugma baribir o'chiq bo'lsin (ikki marta yuborilmasin)
    <button type="button" className={cls} {...rest} disabled={loading || rest.disabled}>
      {loading ? <Loader2 className="spin" /> : icon}
      {children}
    </button>
  );
}

/** Ikki bosqichli o'chirish tugmasi: brauzer dialogi o'rniga (modal ustida modal yo'q). */
export function ConfirmButton({ onConfirm, children, loading, confirmText }: { onConfirm: () => void; children: ReactNode; loading?: boolean; confirmText?: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <Button variant="ghost" onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  return (
    <span className="row">
      <span className="small muted">{confirmText ?? T.common.confirmDelete}</span>
      <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
        {T.common.yes}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
        {T.common.cancel}
      </Button>
    </span>
  );
}

// ─── Belgilar ────────────────────────────────────────────────────────────────
export function Badge({ tone = "slate", dot = true, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={`badge tone-${tone}`} title={title}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// Nomlar serverdan (useMeta), ranglar — frontend tokenlari
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = useMeta();
  return (
    <Badge tone={TASK_TONE[status]} title={T.taskStatusHint[status]}>
      {meta.label("task_statuses", status)}
    </Badge>
  );
}
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{useMeta().label("order_statuses", status)}</Badge>;
}
export function StageBadge({ stage }: { stage: ProjectStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{useMeta().label("project_stages", stage)}</Badge>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority]} dot={false}>
      {useMeta().label("priorities", priority)}
    </Badge>
  );
}

/** Muddat: sana + "2 kun qoldi"/"1 kun kechikdi" (rang bilan birga matn — faqat rangga tayanilmaydi). */
export function Due({ value, done, format }: { value: string | null; done?: boolean; format: (v: string) => string }) {
  if (!value) return <span className="muted">{T.common.notSet}</span>;
  const rel = relativeDue(value, done);
  return (
    <span className="stack-sm" style={{ gap: 0 }}>
      <span className="nowrap">{format(value)}</span>
      {rel && (
        <span className="small nowrap" style={{ color: rel.tone === "muted" ? "var(--muted)" : `var(--${rel.tone})`, fontWeight: 600 }}>
          {rel.tone === "danger" && "⚠ "}
          {rel.text}
        </span>
      )}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
type AvatarUser = Pick<UserBrief, "id" | "full_name"> & Partial<Pick<UserBrief, "avatar" | "role" | "department_name">>;

/**
 * Avatar: rasm bo'lsa rasm, bo'lmasa bosh harflar. Sichqoncha ustiga kelsa — kichik profil kartochkasi
 * (rasm, ism familiya, rol). Kartochka `body` ga chiqariladi — jadval va modal chegarasida kesilmaydi.
 */
export function Avatar({ user, size, card = size !== "lg" }: { user: AvatarUser; size?: "sm" | "lg" | "xl"; card?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAnchor(ref.current?.getBoundingClientRect() ?? null), 250);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  };

  return (
    <>
      <span
        ref={ref}
        className={`avatar ${size ?? ""}`}
        style={{ background: avatarColor(user.id) }}
        title={card ? undefined : user.full_name}
        aria-hidden
        onMouseEnter={card ? show : undefined}
        onMouseLeave={card ? hide : undefined}
      >
        {user.avatar ? <img src={user.avatar} alt="" loading="lazy" /> : initials(user.full_name)}
      </span>
      {anchor && createPortal(<AvatarCard user={user} anchor={anchor} />, document.body)}
    </>
  );
}

function AvatarCard({ user, anchor }: { user: AvatarUser; anchor: DOMRect }) {
  const meta = useMeta();
  const below = anchor.bottom + 160 < window.innerHeight;
  const left = Math.min(Math.max(anchor.left + anchor.width / 2, 124), window.innerWidth - 124);
  const subtitle = [user.role ? meta.label("roles", user.role) : "", user.department_name].filter(Boolean).join(" · ");
  return (
    <div
      className="avatar-card"
      role="tooltip"
      style={{ left, top: below ? anchor.bottom + 8 : anchor.top - 8, transform: below ? "translateX(-50%)" : "translate(-50%, -100%)" }}
    >
      <Avatar user={user} size="xl" card={false} />
      <b>{user.full_name}</b>
      {subtitle && <span className="small muted">{subtitle}</span>}
    </div>
  );
}

export function People({ users, max = 4 }: { users: UserBrief[]; max?: number }) {
  if (!users.length) return <span className="muted">{T.common.notSet}</span>;
  if (users.length === 1)
    return (
      <span className="row">
        <Avatar user={users[0]!} size="sm" />
        <span className="ellipsis">{users[0]!.full_name}</span>
      </span>
    );
  return (
    <span className="row" title={users.map((u) => u.full_name).join(", ")}>
      <span className="avatar-stack">
        {users.slice(0, max).map((u) => (
          <Avatar key={u.id} user={u} size="sm" />
        ))}
      </span>
      <span className="small muted">{T.common.count(users.length)}</span>
    </span>
  );
}

// ─── Forma maydoni ───────────────────────────────────────────────────────────
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (id: string, invalid: boolean) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children(id, Boolean(error))}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Bo'sh holat, yuklanish, xato ────────────────────────────────────────────
export function Empty({ title, hint, icon, action }: { title: string; hint?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox />}</div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", style }: { h?: number; w?: number | string; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" style={{ padding: 16 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={40} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : T.common.errorGeneric;
  return (
    <div className="callout tone-danger">
      <AlertTriangle />
      <div className="grow">{message}</div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {T.common.retry}
        </Button>
      )}
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`callout tone-${tone}`}>
      {tone === "danger" || tone === "warning" ? <AlertTriangle /> : <Info />}
      <div>{children}</div>
    </div>
  );
}

// ─── Ma'lumot bandi (modalning o'ng ustuni) ──────────────────────────────────
export function Meta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="meta-item">
      <span className="meta-label">
        {icon}
        {label}
      </span>
      <div className="meta-value">{children}</div>
    </div>
  );
}

// ─── Tablar va holat qadamlari ───────────────────────────────────────────────
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: ReactNode }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" className="tab" aria-selected={t.key === value} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Jarayon qaysi bosqichda — bir qarashda. `bad` — rad etilgan/qaytarilgan bosqich. */
export function Stepper({ steps, current, bad }: { steps: readonly string[]; current: number; bad?: boolean }) {
  return (
    <div className="stepper" aria-label={steps[current]}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? (bad ? "bad" : "current") : "";
        const finished = i === current && current === steps.length - 1 && !bad;
        return (
          <span key={s} className="row" style={{ gap: 6 }}>
            {i > 0 && <span className={`step-line ${i <= current ? "done" : ""}`} />}
            <span className={`step ${finished ? "done" : state}`}>
              <span className="step-dot">{state === "done" || finished ? <Check /> : state === "bad" ? <X /> : i + 1}</span>
              {s}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ─── Fayllar ─────────────────────────────────────────────────────────────────
export function FileRow({ file, onOpen }: { file: FileInfo; onOpen?: (f: FileInfo) => void }) {
  return (
    <div className="file">
      <span className="file-icon">
        <FileText />
      </span>
      <div className="grow">
        <div className="ellipsis" style={{ fontWeight: 600 }} title={file.name}>
          {file.name}
        </div>
        <div className="small muted">{fileSize(file.size)}</div>
      </div>
      {onOpen && (
        <button className="icon-btn" onClick={() => onOpen(file)} title={T.common.open} aria-label={`${T.common.open}: ${file.name}`}>
          <Eye />
        </button>
      )}
      <a className="icon-btn" href={`${file.url}?download=1`} title={T.common.download} aria-label={`${T.common.download}: ${file.name}`}>
        <Download />
      </a>
    </div>
  );
}

export function FileList({ files, onOpen }: { files: FileInfo[]; onOpen?: (f: FileInfo) => void }) {
  if (!files.length) return <p className="muted small">{T.common.noFiles}</p>;
  return (
    <div className="stack-sm">
      {files.map((f) => (
        <FileRow key={f.id} file={f} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Fayl tanlash: bosish yoki sudrab tashlash. */
export function FilePicker({
  files,
  onChange,
  multiple = true,
  accept = ".docx,.pdf,.png,.jpg,.jpeg",
  label = T.common.attach,
  hint = T.common.attachHint,
  invalid,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  hint?: string;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    onChange(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
  };
  return (
    <div className="stack-sm">
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        role="button"
        tabIndex={0}
        style={invalid ? { borderColor: "var(--danger)" } : undefined}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
      >
        <span className="file-icon">
          <Paperclip />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 600, color: "var(--text)" }}>{label}</div>
          <div className="small">{hint}</div>
        </div>
        <input ref={input} type="file" hidden multiple={multiple} accept={accept} onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      </div>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="file">
          <span className="file-icon">
            <FileText />
          </span>
          <div className="grow ellipsis">{f.name}</div>
          <span className="small muted">{fileSize(f.size)}</span>
          <button className="icon-btn" aria-label={T.common.delete} onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <X />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "error";
}
const ToastCtx = createContext<(text: string, kind?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""}`}>
            {t.kind === "error" ? <AlertTriangle /> : <CheckCircle2 />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
