/**
 * Modallar URL ga bog'langan (CLAUDE.md, 4-bo'lim): `?task=12`, `?order=5`, `?project=3`, `?new=task`.
 * Havolani yuborsa bo'ladi, "Orqaga" modalni yopadi, bildirishnoma bosilganda kerakli modal ochiladi.
 * Modallar reestri: docs/FLOWS_MODALS.md
 */
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

const TaskModal = lazy(() => import("@/features/tasks/TaskModal"));
const TaskFormModal = lazy(() => import("@/features/tasks/TaskFormModal"));
const OrderModal = lazy(() => import("@/features/orders/OrderModal"));
const OrderCreateModal = lazy(() => import("@/features/orders/OrderCreateModal"));
const ProjectModal = lazy(() => import("@/features/projects/ProjectModal"));
const ProjectWizard = lazy(() => import("@/features/projects/ProjectWizard"));

export type ModalTarget =
  | { task: number; submit?: boolean }
  | { order: number }
  | { project: number }
  | { new: "task"; project?: number; edit?: number }
  | { new: "order" }
  | { new: "project"; order?: number };

const KEYS = ["task", "order", "project", "new", "edit", "submit"];

export function useModal() {
  const [params, setParams] = useSearchParams();

  const open = (target: ModalTarget, replace = false) => {
    const next = new URLSearchParams(params);
    KEYS.forEach((k) => next.delete(k));
    for (const [k, v] of Object.entries(target)) {
      if (v !== undefined && v !== false) next.set(k, v === true ? "1" : String(v));
    }
    // "new=project&order=5" — `order` bu yerda oldindan to'ldirish uchun
    setParams(next, { replace });
  };

  const close = () => {
    const next = new URLSearchParams(params);
    KEYS.forEach((k) => next.delete(k));
    if (params.get("new")) next.delete("order"), next.delete("project");
    setParams(next);
  };

  return { params, open, close };
}

export function ModalHost() {
  const { params } = useModal();
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const kind = params.get("new");

  let node = null;
  if (kind === "task") node = <TaskFormModal projectId={num("project")} editId={num("edit")} />;
  else if (kind === "order") node = <OrderCreateModal />;
  else if (kind === "project") node = <ProjectWizard orderId={num("order")} />;
  else if (params.get("task")) node = <TaskModal id={num("task")!} submitMode={params.get("submit") === "1"} />;
  else if (params.get("order")) node = <OrderModal id={num("order")!} />;
  else if (params.get("project")) node = <ProjectModal id={num("project")!} />;

  return <Suspense fallback={null}>{node}</Suspense>;
}
