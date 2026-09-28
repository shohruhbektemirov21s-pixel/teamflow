import { ListChecks } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDateTime } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Task } from "@/shared/types";
import { Due, Empty, Field, People, PriorityBadge, SkeletonRows, TaskStatusBadge } from "@/shared/ui";

export interface TaskFilterState {
  q: string;
  due: "" | "today" | "week" | "month";
  date_from: string;
  date_to: string;
  status: string;
  project_name: string;
  assignee_name: string;
}

export const EMPTY_FILTERS: TaskFilterState = {
  q: "",
  due: "",
  date_from: "",
  date_to: "",
  status: "",
  project_name: "",
  assignee_name: "",
};

/** Vazifa filtrlari: qidiruv, muddat, sanadan/sanagacha, holat, loyiha, xodim. */
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
  return (
    <div className="filters">
      <Field label={T.filters.search}>
        {(id) => <input id={id} className="input" placeholder={T.filters.searchPh} value={value.q} onChange={set("q")} />}
      </Field>
      <Field label={T.filters.due}>
        {(id) => (
          <select id={id} className="select" value={value.due} onChange={set("due")}>
            <option value="">{T.filters.dueAll}</option>
            <option value="today">{T.filters.dueToday}</option>
            <option value="week">{T.filters.dueWeek}</option>
            <option value="month">{T.filters.dueMonth}</option>
          </select>
        )}
      </Field>
      <Field label={T.filters.dateFrom}>
        {(id) => <input id={id} type="date" className="input" value={value.date_from} onChange={set("date_from")} />}
      </Field>
      <Field label={T.filters.dateTo}>
        {(id) => <input id={id} type="date" className="input" value={value.date_to} onChange={set("date_to")} />}
      </Field>
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
      <Field label={T.filters.project}>
        {(id) => <input id={id} className="input" placeholder={T.filters.projectPh} value={value.project_name} onChange={set("project_name")} />}
      </Field>
      {showPerson && (
        <Field label={T.filters.person}>
          {(id) => <input id={id} className="input" placeholder={T.filters.personPh} value={value.assignee_name} onChange={set("assignee_name")} />}
        </Field>
      )}
      <button className="btn" onClick={() => onChange(EMPTY_FILTERS)} disabled={!dirty}>
        {T.common.clear}
      </button>
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
            <th>{T.tasks.col.status}</th>
            <th>{T.tasks.col.priority}</th>
            <th>{T.tasks.col.assignees}</th>
            <th>{T.tasks.col.due}</th>
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
                <div className="task-title">{t.title}</div>
                <div className="small muted ellipsis" style={{ maxWidth: 480 }}>
                  {t.project.name}
                  {t.description && ` · ${t.description}`}
                </div>
              </td>
              <td>
                <TaskStatusBadge status={t.status} />
              </td>
              <td>
                <PriorityBadge priority={t.priority} />
              </td>
              <td style={{ maxWidth: 220 }}>
                <People users={t.assignees} />
              </td>
              <td>
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
    due: f.due,
    due_from: f.date_from,
    due_to: f.date_to,
    status: f.status,
    project_name: f.project_name,
    assignee_name: f.assignee_name,
  };
}
