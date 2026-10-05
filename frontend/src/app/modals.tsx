/**
 * Modallar holati brauzer tarixining `state` qismida saqlanadi — manzil satri toza qoladi
 * (`/qilingan-ishlar`, `?task=4` emas; foydalanuvchi talabi, 2026-09-30).
 * "Orqaga" modalni yopadi, sahifa yangilansa modal qayta ochiladi, bildirishnoma bosilganda kerakli modal ochiladi.
 * Eski havolalar (`?task=12`) ham ishlaydi: modal ochiladi va manzil darrov tozalanadi.
 * Modallar reestri: docs/FLOWS_MODALS.md
 */
import { lazy, Suspense, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TaskModal = lazy(() => import("@/features/tasks/TaskModal"));
const TaskFormModal = lazy(() => import("@/features/tasks/TaskFormModal"));
const TaskBulkModal = lazy(() => import("@/features/tasks/TaskBulkModal"));
const OrderModal = lazy(() => import("@/features/orders/OrderModal"));
const OrderCreateModal = lazy(() => import("@/features/orders/OrderCreateModal"));
const ProjectModal = lazy(() => import("@/features/projects/ProjectModal"));
const ProjectWizard = lazy(() => import("@/features/projects/ProjectWizard"));
const SuggestionCreateModal = lazy(() => import("@/features/suggestions/SuggestionCreateModal"));
const SuggestionModal = lazy(() => import("@/features/suggestions/SuggestionModal"));
const PersonModal = lazy(() => import("@/features/people/PersonModal"));
const DayModal = lazy(() => import("@/features/calendar/DayModal"));
const PhotoModal = lazy(() => import("@/features/people/PhotoModal"));
const NotificationsModal = lazy(() => import("@/features/notifications/NotificationsModal"));

export type ModalTarget =
  | { task: number; submit?: boolean }
  | { order: number }
  | { project: number }
  | { suggestion: number }
  | { person: number }
  | { day: string }
  | { photo: number; name: string; src: string }
  | { notifications: true }
  | { new: "task"; project?: number; edit?: number; assignee?: number }
  | { bulk: "task"; project?: number }
  | { new: "order" }
  | { new: "project"; order?: number }
  | { new: "suggestion" };

/** Tarixdagi holat. `pushed` — modal ilova ichidan yangi tarix yozuvi bilan ochilgan (yopilganda orqaga qaytiladi). */
interface ModalState {
  modal?: ModalTarget;
  pushed?: boolean;
}

/**
 * Eski havolalardagi (`?task=12&submit=1`) modal kalitlari. Yordamchi kalitlar (`assignee`, `project`, `order`, `edit`,
 * `submit`) faqat asosiy kalit bilan birga modalniki: `?assignee=3` yolg'iz — Vazifalar sahifasining filtri.
 */
const LEGACY_GROUPS: [string, string[]][] = [
  ["new", ["project", "order", "edit", "assignee"]],
  ["bulk", ["project"]],
  ["task", ["submit"]],
  ["order", []],
  ["project", []],
  ["suggestion", []],
  ["person", []],
];

function toParams(target: ModalTarget | undefined): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(target ?? {})) {
    if (v !== undefined && v !== false) p.set(k, v === true ? "1" : String(v));
  }
  return p;
}

function legacyTarget(search: string): { target: ModalTarget; rest: string } | null {
  const p = new URLSearchParams(search);
  const group = LEGACY_GROUPS.find(([main]) => p.has(main));
  if (!group) return null;
  const [main, extras] = group;
  const t: Record<string, string | number | boolean> = {};
  for (const k of [main, ...extras]) {
    const v = p.get(k);
    if (v === null) continue;
    t[k] = k === "new" || k === "bulk" ? v : k === "submit" ? v === "1" : Number(v);
    p.delete(k);
  }
  const rest = p.toString();
  return { target: t as ModalTarget, rest: rest ? `?${rest}` : "" };
}

export function useModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as ModalState | null) ?? {};
  const here = { pathname: location.pathname, search: location.search };

  const open = (target: ModalTarget, replace = false) => {
    // replace: modal almashadi (masalan, yaratish → ko'rish), tarixda yangi yozuv qo'shilmaydi
    navigate(here, { state: { modal: target, pushed: replace ? state.pushed : true } satisfies ModalState, replace });
  };

  const close = () => {
    if (state.pushed) navigate(-1);
    else navigate(here, { state: null, replace: true });
  };

  return { params: toParams(state.modal), open, close };
}

/** Eski havola: `?task=4` → modal ochiladi, manzil tozalanadi (`/qilingan-ishlar`). */
export function useLegacyModalLinks() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const legacy = legacyTarget(location.search);
    if (legacy) navigate({ pathname: location.pathname, search: legacy.rest }, { state: { modal: legacy.target } satisfies ModalState, replace: true });
  }, [location.search, location.pathname, navigate]);
}

export function ModalHost() {
  const { params } = useModal();
  useLegacyModalLinks();

  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const kind = params.get("new");

  let node = null;
  if (kind === "task") node = <TaskFormModal projectId={num("project")} editId={num("edit")} assigneeId={num("assignee")} />;
  else if (params.get("bulk") === "task") node = <TaskBulkModal projectId={num("project")} />;
  else if (kind === "order") node = <OrderCreateModal />;
  else if (kind === "project") node = <ProjectWizard orderId={num("order")} />;
  else if (kind === "suggestion") node = <SuggestionCreateModal />;
  else if (params.get("task")) node = <TaskModal id={num("task")!} submitMode={params.get("submit") === "1"} />;
  else if (params.get("order")) node = <OrderModal id={num("order")!} />;
  else if (params.get("project")) node = <ProjectModal id={num("project")!} />;
  else if (params.get("suggestion")) node = <SuggestionModal id={num("suggestion")!} />;
  else if (params.get("person")) node = <PersonModal id={num("person")!} />;
  else if (params.get("day")) node = <DayModal date={params.get("day")!} />;
  else if (params.get("notifications")) node = <NotificationsModal />;
  else if (params.get("photo")) node = <PhotoModal src={params.get("src") ?? ""} name={params.get("name") ?? ""} />;

  return <Suspense fallback={null}>{node}</Suspense>;
}
