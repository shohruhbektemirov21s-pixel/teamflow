import { AlertTriangle, Eye, MoreHorizontal, Plus } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person, PersonTask } from "@/shared/types";
import { Avatar, Badge, Button, PriorityBadge, TaskStatusBadge } from "@/shared/ui";

import { PersonWork } from "./PersonWork";

export type PeopleView = "list" | "grid";

/** Xodim holati: xizmat safarida / bo'sh / faol (dasturchi); boshqa rolda — rol nomi. */
function StateBadge({ person }: { person: Person }) {
  if (person.is_on_business_trip) return <Badge tone="warning">{T.people.onBusinessTrip}</Badge>;
  if (person.role !== "developer") return <Badge tone="slate">{person.role_label}</Badge>;
  return person.active_tasks
    ? <Badge tone="info">{T.people.state.active}</Badge>
    : <Badge tone="success">{T.people.state.free}</Badge>;
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "primary" | "danger" | "info" | "muted" }) {
  return <div className={`pc-stat pc-stat-${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

/** Faol vazifalar ulushi (faol / jami) va unga izoh: avval muddati o'tganlar, bo'lmasa yuqori ustuvorlikdagilar. */
function Load({ person }: { person: Person }) {
  const total = person.total_tasks ?? 0;
  const active = person.active_tasks;
  const fill = total ? Math.min(100, Math.round((active / total) * 100)) : 0;
  const hint = person.overdue_tasks ? T.people.loadOverdue(person.overdue_tasks)
    : person.high_tasks ? T.people.loadHigh(person.high_tasks) : "";
  return <div className="pc-load">
    <div className="pc-meter" role="meter" aria-label={T.people.loadLabel} aria-valuemin={0} aria-valuemax={Math.max(total, 1)} aria-valuenow={active}>
      <span className={person.overdue_tasks ? "danger" : ""} style={{ width: `${fill}%` }} />
    </div>
    <strong>{T.people.loadTasks(active)}</strong>
    {hint && <span className={`small ${person.overdue_tasks ? "pc-hint-danger" : "muted"}`}>{hint}</span>}
  </div>;
}

function TaskRow({ task }: { task: PersonTask }) {
  const { open } = useModal();
  const overdue = task.is_overdue;
  return <li className="pc-task">
    <span className="pc-task-code small muted">{task.code ? `#${task.code}` : ""}</span>
    <button type="button" className="pc-task-title" onClick={() => open({ task: task.id })}>
      <strong>{task.title}</strong>
      <span className="small muted">{task.project.code} · {task.project.name}</span>
    </button>
    <span className="pc-task-status"><TaskStatusBadge status={task.status} /></span>
    <span className="pc-task-priority">{task.priority && <PriorityBadge priority={task.priority} />}</span>
    <span className={`pc-task-due nowrap ${overdue ? "overdue" : ""}`}>
      {overdue && <AlertTriangle size={14} aria-hidden />}
      <span>{task.due_at ? fmtDate(task.due_at) : T.common.notSet}</span>
      {overdue && <span className="sr-only">{T.dashboard.overdue}</span>}
    </span>
    <button type="button" className="icon-btn pc-task-open" title={T.people.openTask} aria-label={`${T.people.openTask}: ${task.title}`} onClick={() => open({ task: task.id })}>
      <MoreHorizontal size={18} aria-hidden />
    </button>
  </li>;
}

/** Xodim kartochkasi: ism va holat, vazifalar soni, yuklama, so'nggi vazifalar. Ro'yxat va to'r ko'rinishida bir xil. */
export function PersonCard({ person, view, hasRange }: { person: Person; view: PeopleView; hasRange: boolean }) {
  const { open } = useModal();
  const developer = person.role === "developer";
  const work = person.work ?? [];
  const count = hasRange ? person.range_tasks ?? 0 : person.active_tasks;
  return <article className={`card person-card ${view}`}>
    <div className="pc-main">
      <div className="pc-head">
        <button type="button" className="person-identity" title={T.people.profileOpen} onClick={() => open({ person: person.id })}>
          <Avatar user={person} size="lg" card={false} />
          <span className="stack-sm"><strong>{person.full_name}</strong><span className="small muted">{person.department_name || person.specialty || person.role_label}</span></span>
        </button>
        <StateBadge person={person} />
      </div>
      {developer && <div className="pc-stats">
        <Stat value={person.total_tasks ?? 0} label={T.people.statTotal} tone="primary" />
        <Stat value={person.overdue_tasks} label={T.people.statOverdue} tone={person.overdue_tasks ? "danger" : "muted"} />
        <Stat value={person.active_tasks} label={T.people.statActive} tone="info" />
      </div>}
      {person.responsibilities && <p className="person-responsibilities-line small muted" title={person.responsibilities}>{person.responsibilities}</p>}
    </div>
    <div className="pc-side">
      {developer && <Load person={person} />}
      <div className="person-actions">
        <Button size="sm" variant="ghost" icon={<Eye size={15} />} onClick={() => open({ person: person.id })}>{T.people.profileOpen}</Button>
        {developer && <Button size="sm" variant="primary" icon={<Plus size={15} />} disabled={person.is_on_business_trip} title={person.is_on_business_trip ? T.people.tripBlocked : undefined} onClick={() => open({ new: "task", assignee: person.id })}>{T.people.giveTask}</Button>}
      </div>
    </div>
    <div className="pc-work">
      {work.length > 0 ? <>
        <div className="pc-work-head" aria-hidden>
          <span>{T.people.col.code}</span><span>{T.people.col.task}</span><span>{T.people.col.status}</span><span>{T.people.col.priority}</span><span>{T.people.col.due}</span><span />
        </div>
        <ul className="pc-tasks" aria-label={hasRange ? T.people.col.inRange : T.people.col.doing}>{work.map((task) => <TaskRow key={task.id} task={task} />)}</ul>
        {count > work.length && <button type="button" className="person-work-more" onClick={() => open({ person: person.id })}>{T.people.moreWork(count - work.length)}</button>}
      </> : <PersonWork person={person} />}
    </div>
  </article>;
}
