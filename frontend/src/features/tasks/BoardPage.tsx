import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, GripVertical, Lock, MoreHorizontal, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useModal } from "@/app/modals";
import { useProjects, useRefresh } from "@/app/queries";
import { api, qs } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { boardMove, TASK_TONE } from "@/shared/status";
import { T } from "@/shared/text";
import type { Task, TaskStatus } from "@/shared/types";
import { Button, CodeTag, Due, ErrorBox, PriorityBadge, Segmented, Skeleton, useToast } from "@/shared/ui";

type DueFilter = "" | "today" | "week";

/**
 * "Mening ishim" (dasturchi). Ustunlar — holatlar. Kartani sudrab keyingi ustunga o'tkazadi:
 * Nazoratda → Jarayonda (darhol), Jarayonda → Tekshiruvda ("Nima qildingiz?" paneli ochiladi).
 * Bajarildi ustuni qulflangan — uni faqat menejer tekshiruv orqali to'ldiradi.
 */
export default function BoardPage() {
  const { open } = useModal();
  const toast = useToast();
  const refresh = useRefresh();
  const qc = useQueryClient();
  const projects = useProjects();
  const meta = useMeta();
  const statuses = meta.values<TaskStatus>("task_statuses");
  const [project, setProject] = useState("");
  const [due, setDue] = useState<DueFilter>("");
  const [dragging, setDragging] = useState<Task | null>(null);

  const key = ["tasks", "board", project, due];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ mine: 1, all: 1, project, due })}`),
    placeholderData: keepPreviousData,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // oddiy bosish — modal ochadi
    // Klaviatura: Space — sudrashni boshlash/tugatish, Enter — vazifani ochish
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  // Optimistik: karta darhol yangi ustunga o'tadi, xato bo'lsa orqaga qaytadi.
  const start = useMutation({
    mutationFn: (id: number) => api.post(`/tasks/${id}/start/`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Task[]>(key);
      qc.setQueryData<Task[]>(key, (xs) => xs?.map((t) => (t.id === id ? { ...t, status: "in_progress" } : t)));
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      qc.setQueryData(key, ctx?.prev);
      toast(e.message, "error");
    },
    onSuccess: () => toast(T.tasks.startedToast),
    onSettled: () => refresh(),
  });

  const move = (task: Task, to: TaskStatus) => {
    const kind = boardMove(meta.task_moves, task.status, to);
    if (kind === "start") start.mutate(task.id);
    else if (kind === "submit") open({ task: task.id, submit: true });
    else if (task.status !== to) toast(to === "done" ? T.board.locked : T.board.cantMove, "error");
  };

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as { task: Task }).task);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!e.over) return;
    move((e.active.data.current as { task: Task }).task, e.over.id as TaskStatus);
  };

  const tasks = query.data ?? [];
  return (
    <>
      <div className="card card-pad row-wrap" style={{ gap: 16, alignItems: "flex-end" }}>
        <label className="field" style={{ minWidth: 220 }}>
          <span className="field-label">{T.filters.project}</span>
          <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">{T.filters.allProjects}</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">{T.filters.due}</span>
          <Segmented<DueFilter>
            value={due}
            onChange={setDue}
            label={T.filters.due}
            options={[
              { value: "", label: T.filters.dueAll },
              { value: "today", label: T.filters.dueToday },
              { value: "week", label: T.filters.dueWeek },
            ]}
          />
        </div>
        <div className="page-actions">
          <Button variant="default" icon={<Plus />} onClick={() => open({ bulk: "task", project: project ? Number(project) : undefined })}>
            {T.tasks.bulkNew}
          </Button>
          <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "task", project: project ? Number(project) : undefined })}>
            {T.tasks.new}
          </Button>
        </div>
      </div>

      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {query.isLoading ? (
        <div className="board">
          {statuses.map((s) => (
            <Skeleton key={s} h={240} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="board">
            {statuses.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={tasks.filter((t) => t.status === status)}
                dragging={dragging}
                onOpen={(t) => open({ task: t.id })}
                onMove={move}
              />
            ))}
          </div>
          <DragOverlay>{dragging && <Card task={dragging} overlay />}</DragOverlay>
        </DndContext>
      )}
    </>
  );
}

function Column({
  status,
  tasks,
  dragging,
  onOpen,
  onMove,
}: {
  status: TaskStatus;
  tasks: Task[];
  dragging: Task | null;
  onOpen: (t: Task) => void;
  onMove: (t: Task, to: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = useMeta();
  const label = meta.label("task_statuses", status);
  const allowed = dragging ? boardMove(meta.task_moves, dragging.status, status) !== null : true;
  const locked = status === "done";
  const cls = ["column", isOver && allowed && "over", dragging && !allowed && dragging.status !== status && "forbidden"].filter(Boolean).join(" ");
  return (
    <section ref={setNodeRef} className={cls} aria-label={label}>
      <div className="column-head">
        <span className={`badge tone-${TASK_TONE[status]}`} style={{ padding: 0, width: 10, height: 10 }} />
        <span className="grow">{label}</span>
        {locked && <Lock size={14} className="muted" aria-label={T.board.locked} />}
        <span className="count-pill soft">{tasks.length}</span>
      </div>
      <div className="column-body">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} onOpen={onOpen} onMove={onMove} />
        ))}
        {!tasks.length && <div className="column-empty">{locked ? T.board.emptyDone : T.board.emptyCol}</div>}
      </div>
    </section>
  );
}

function DraggableCard({ task, onOpen, onMove }: { task: Task; onOpen: (t: Task) => void; onMove: (t: Task, to: TaskStatus) => void }) {
  const draggable = task.status === "control" || task.status === "in_progress";
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: task.id, data: { task }, disabled: !draggable });
  const [menu, setMenu] = useState(false);
  const meta = useMeta();
  const targets = meta.values<TaskStatus>("task_statuses").filter((s) => boardMove(meta.task_moves, task.status, s));
  return (
    <div ref={setNodeRef} onPointerDown={(event) => listeners?.onPointerDown?.(event)} style={{ position: "relative" }}>
      <Card
        task={task}
        dragging={isDragging}
        onClick={() => onOpen(task)}
        menu={
          <>
          {draggable && <button ref={setActivatorNodeRef} type="button" className="icon-btn" {...attributes} {...listeners}
            aria-label={`${T.board.dragTask}: ${task.title}`} title={T.board.dragTask}
            onPointerDown={(event) => { event.stopPropagation(); listeners?.onPointerDown?.(event); }}
            onClick={(event) => event.stopPropagation()}>
            <GripVertical />
          </button>}
          {
          targets.length > 0 && (
            <>
              <button
                type="button"
                className="icon-btn"
                style={{ width: 28, height: 28 }}
                aria-label={T.board.actions}
                aria-expanded={menu}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => (e.stopPropagation(), setMenu((m) => !m))}
              >
                <MoreHorizontal />
              </button>
              {menu && (
                <div
                  className="card"
                  style={{ position: "absolute", right: 8, top: 40, zIndex: 5, padding: 6, minWidth: 180, boxShadow: "var(--shadow-lg)" }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {targets.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className="palette-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(false);
                        onMove(task, s);
                      }}
                    >
                      {T.board.moveTo}: <b>{meta.label("task_statuses", s)}</b>
                    </button>
                  ))}
                </div>
              )}
            </>
          )
          }
          </>
        }
      />
    </div>
  );
}

function Card({ task, overlay, dragging, onClick, menu }: { task: Task; overlay?: boolean; dragging?: boolean; onClick?: () => void; menu?: ReactNode }) {
  const done = task.status === "done";
  return (
    <article
      className={`tcard ${overlay ? "overlay" : ""} ${dragging ? "dragging" : ""}`}
      style={{ cursor: done ? "pointer" : undefined }}
      onClick={onClick}
    >
      <div className="row">
        <span className="tcard-project grow ellipsis">{task.project.name}</span>
        {menu}
      </div>
      {onClick ? <button type="button" className="tcard-title" onClick={(event) => { event.stopPropagation(); onClick(); }}>
        <CodeTag code={task.code} /> {task.title}
      </button> : <div style={{ fontWeight: 650 }}><CodeTag code={task.code} /> {task.title}</div>}
      {task.subtasks_progress.total > 0 && (
        <div className="stack-sm" style={{ gap: 4 }}>
          <div className="progress">
            <span style={{ width: `${(task.subtasks_progress.done / task.subtasks_progress.total) * 100}%` }} />
          </div>
          <span className="small muted">
            {T.tasks.subtasks}: {task.subtasks_progress.done}/{task.subtasks_progress.total}
          </span>
        </div>
      )}
      <div className="tcard-foot">
        <PriorityBadge priority={task.priority} />
        <span className="spacer" />
        {task.due_at && (
          <span className="row small" style={{ gap: 4 }}>
            <CalendarClock size={14} className="muted" />
            <Due value={task.due_at} done={done} format={fmtDateTime} />
          </span>
        )}
      </div>
    </article>
  );
}
