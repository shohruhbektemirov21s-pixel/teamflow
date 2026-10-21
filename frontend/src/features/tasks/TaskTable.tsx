import { FolderKanban, ListChecks, SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useModal } from "@/app/modals";
import { fmtDateTime } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Task } from "@/shared/types";
import { Button, CodeTag, Due, Empty, Field, People, PriorityBadge, SkeletonRows, SortHeader, TaskStatusBadge } from "@/shared/ui";

export interface TaskFilterState {
  q: string;
  date_from: string;
  date_to: string;
  status: string;
  assignee_name: string;
  /** Muhimlik ("low" … "urgent"); bo'sh — hammasi. */
  priority: string;
  /** Vazifalar sahifasi: saralash kaliti ("due", "-priority", …); bo'sh — odatdagi tartib. */
  sort: string;
  /** "1" — faqat kechikkanlar. */
  overdue: string;
  /** "me" — faqat o'zim yaratgan vazifalar. */
  created: string;
}

export const EMPTY_FILTERS: TaskFilterState = {
  q: "",
  date_from: "",
  date_to: "",
  status: "",
  assignee_name: "",
  priority: "",
  sort: "",
  overdue: "",
  created: "",
};

/** Vazifa filtrlari: qidiruv, sanadan/sanagacha, holat, xodim.
 * Telefonda faqat qidiruv ko'rinadi, qolganlari "Filtrlar" tugmasi ortida — ro'yxat birinchi ekranda ko'rinsin. */
export function TaskFilters({
  value,
  onChange,
  showPerson,
  showStatus = true,
  actions,
}: {
  value: TaskFilterState;
  onChange: (v: TaskFilterState) => void;
  showPerson: boolean;
  showStatus?: boolean;
  actions?: ReactNode;
}) {
  const meta = useMeta();
  const set = <K extends keyof TaskFilterState>(k: K) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const dirty = JSON.stringify(value) !== JSON.stringify(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  // "Filtrlar" tugmasidagi son: faqat shu panel ichidagilar (qidiruv va tashqaridagi tugmalar kirmaydi)
  const inPanel: (keyof TaskFilterState)[] = ["date_from", "date_to", "assignee_name", ...(showStatus ? (["status"] as const) : [])];
  const extra = inPanel.filter((k) => value[k]).length;
  return (
    <div className={`filters ${open ? "open" : ""}`}>
      <Field label={T.filters.search}>
        {(id) => <input id={id} className="input" placeholder={T.filters.searchPh} value={value.q} onChange={set("q")} />}
      </Field>
      <button type="button" className="btn filters-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={16} /> {T.filters.toggle}
        {extra > 0 && <span className="count-pill">{extra}</span>}
      </button>
      <div className="filters-more">
      <div className="field" style={{ minWidth: 280 }}>
        <label className="field-label">{T.filters.dateRange}</label>
        <div className="input" style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 8px" }}>
          <input
            type="date"
            aria-label={T.filters.dateFrom}
            style={{ border: "none", background: "transparent", outline: "none", flex: 1, padding: 0 }}
            value={value.date_from}
            onChange={set("date_from")}
          />
          <span className="muted" style={{ fontWeight: 600 }}>—</span>
          <input
            type="date"
            aria-label={T.filters.dateTo}
            style={{ border: "none", background: "transparent", outline: "none", flex: 1, padding: 0 }}
            value={value.date_to}
            onChange={set("date_to")}
          />
        </div>
      </div>
      {showStatus && (
        <Field label={T.filters.status}>
          {(id) => (
            <select id={id} className="select" value={value.status} onChange={set("status")}>
              <option value="">{T.filters.dueAll}</option>
              {meta.task_statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      {showPerson && (
        <Field label={T.filters.person}>
          {(id) => <input id={id} className="input" placeholder={T.filters.personPh} value={value.assignee_name} onChange={set("assignee_name")} />}
        </Field>
      )}
      {dirty && (
        <Button variant="ghost" icon={<X />} onClick={() => onChange(EMPTY_FILTERS)}>
          {T.filters.clear}
        </Button>
      )}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/** Topshiriqlar bajarilish chizig'i (faqat topshiriq bo'lsa). */
function SubtaskProgress({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  return (
    <span className="task-progress" title={T.tasks.subtasksDone(done, total)}>
      <span className="progress"><span style={{ width: `${Math.round((done / total) * 100)}%` }} /></span>
      <span className="small muted nowrap">{T.tasks.subtasksDone(done, total)}</span>
    </span>
  );
}

/**
 * Vazifalar jadvali. Qator bosilsa — vazifa modali. Chap chetdagi rangli chiziq — muhimlik, kechikkan qator ajralib turadi.
 * `showProject` — vazifa nomi ostida loyiha (loyiha oynasida kerak emas).
 */
export function TaskTable({ tasks, loading, emptyHint, showProject = false, rich = false, sort, onSort }: {
  tasks: Task[] | undefined; loading?: boolean; emptyHint?: string; showProject?: boolean;
  /** Vazifalar sahifasi ko'rinishi: muhimlik chizig'i, kechikkan qator rangi, topshiriqlar chizig'i. Boshqa joylarda — oddiy. */
  rich?: boolean;
  /** Ikkalasi ham berilsa, "Muhimlik" va "Muddat" sarlavhalari bosilib saralanadi. */
  sort?: string; onSort?: (s: string) => void;
}) {
  const { open } = useModal();
  if (loading && !tasks) return <SkeletonRows rows={5} />;
  if (!tasks?.length) return <Empty icon={<ListChecks />} title={T.tasks.empty} hint={emptyHint ?? T.tasks.emptyHint} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>№</th>
            <th>{T.tasks.col.title}</th>
            <th className="hide-sm">{T.tasks.col.status}</th>
            {onSort ? <SortHeader className="hide-sm" label={T.tasks.col.priority} first="-priority" second="priority" sort={sort ?? ""} onSort={onSort} /> : <th className="hide-sm">{T.tasks.col.priority}</th>}
            <th className="hide-sm">{T.tasks.col.assignees}</th>
            {onSort ? <SortHeader className="hide-sm" label={T.tasks.col.due} first="due" second="-due" sort={sort ?? ""} onSort={onSort} /> : <th className="hide-sm">{T.tasks.col.due}</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr
              key={t.id}
              className={rich ? `row-p-${t.priority}${t.is_overdue && t.status !== "done" ? " row-overdue" : ""}` : undefined}
              tabIndex={0}
              onClick={() => open({ task: t.id })}
              onKeyDown={(e) => e.key === "Enter" && open({ task: t.id })}
            >
              <td className="muted">{i + 1}</td>
              <td style={{ minWidth: 260 }}>
                <div className="task-title">
                  <CodeTag code={t.code} /> {t.title}
                </div>
                {showProject && (
                  <div className="small muted task-project">
                    <FolderKanban size={13} /> {t.project ? t.project.name : T.tasks.noProject}
                  </div>
                )}
                {rich && <SubtaskProgress done={t.subtasks_progress.done} total={t.subtasks_progress.total} />}
                <div className="row-wrap show-sm" style={{ marginTop: 8 }}>
                  <TaskStatusBadge status={t.status} />
                  <Due value={t.due_at} done={t.status === "done"} format={fmtDateTime} />
                </div>
              </td>
              <td className="hide-sm">
                <TaskStatusBadge status={t.status} />
              </td>
              <td className="hide-sm">
                <PriorityBadge priority={t.priority} />
              </td>
              <td className="hide-sm" style={{ maxWidth: 220 }}>
                <People users={t.assignees} />
              </td>
              <td className="hide-sm">
                <Due value={t.due_at} done={t.status === "done"} format={fmtDateTime} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function filterParams(f: TaskFilterState) {
  return {
    q: f.q,
    due_from: f.date_from,
    due_to: f.date_to,
    status: f.status,
    assignee_name: f.assignee_name,
    priority: f.priority,
    sort: f.sort,
    // `bucket` faqat kerak bo'lganda: Bosh panel o'z toifasini shu obyektdan oldin beradi va uni bosib ketmasligi kerak
    ...(f.overdue ? { bucket: "overdue" } : {}),
    ...(f.created ? { created: f.created } : {}),
  };
}
