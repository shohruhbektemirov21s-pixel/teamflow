import { ListChecks, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { fmtDateTime } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Task } from "@/shared/types";
import { Button, CodeTag, Due, Empty, Field, People, PriorityBadge, SkeletonRows, TaskStatusBadge } from "@/shared/ui";

export interface TaskFilterState {
  q: string;
  date_from: string;
  date_to: string;
  status: string;
  assignee_name: string;
}

export const EMPTY_FILTERS: TaskFilterState = {
  q: "",
  date_from: "",
  date_to: "",
  status: "",
  assignee_name: "",
};

/** Vazifa filtrlari: qidiruv, sanadan/sanagacha, holat, xodim.
 * Telefonda faqat qidiruv ko'rinadi, qolganlari "Filtrlar" tugmasi ortida — ro'yxat birinchi ekranda ko'rinsin. */
export function TaskFilters({
  value,
  onChange,
  showPerson,
  showStatus = true,
}: {
  value: TaskFilterState;
  onChange: (v: TaskFilterState) => void;
  showPerson: boolean;
  showStatus?: boolean;
}) {
  const meta = useMeta();
  const set = <K extends keyof TaskFilterState>(k: K) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const dirty = JSON.stringify(value) !== JSON.stringify(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  const extra = (Object.keys(value) as (keyof TaskFilterState)[]).filter((k) => k !== "q" && value[k]).length;
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
            style={{ border: "none", background: "transparent", outline: "none", flex: 1, padding: 0 }}
            value={value.date_from}
            onChange={set("date_from")}
          />
          <span className="muted" style={{ fontWeight: 600 }}>—</span>
          <input
            type="date"
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
    </div>
  );
}

/** Vazifalar jadvali. Qator bosilsa — vazifa modali. */
export function TaskTable({ tasks, loading, emptyHint }: { tasks: Task[] | undefined; loading?: boolean; emptyHint?: string }) {
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
            <th className="hide-sm">{T.tasks.col.priority}</th>
            <th className="hide-sm">{T.tasks.col.assignees}</th>
            <th className="hide-sm">{T.tasks.col.due}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr
              key={t.id}
              tabIndex={0}
              onClick={() => open({ task: t.id })}
              onKeyDown={(e) => e.key === "Enter" && open({ task: t.id })}
            >
              <td className="muted">{i + 1}</td>
              <td style={{ minWidth: 260 }}>
                <div className="task-title">
                  <CodeTag code={t.code} /> {t.title}
                </div>
                <div className="small muted ellipsis" style={{ maxWidth: 480 }}>
                  {t.project.name}
                  {t.description && ` · ${t.description}`}
                </div>
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
  };
}
