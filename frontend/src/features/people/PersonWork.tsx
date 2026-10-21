import { ChevronRight, FileText, FolderKanban } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Badge, Due, StageBadge, TaskStatusBadge } from "@/shared/ui";

type Work = NonNullable<Person["work"]>[number];
type ProjectRef = NonNullable<Person["projects"]>[number];

/** Xodimning ishlari. Ro'yxat kartasida (`full` emas) — "Vazifalar (N)", 3 tagacha eng yaqin ish va "Barchasini ko'rish"
 * (vazifa bo'lmasa — faol loyihalar); muddat filtri tanlangan bo'lsa — shu muddatdagi ishlar. Profil oynasida (`full`) — barcha loyihalar. */
export function PersonWork({ person, full = false }: { person: Person; full?: boolean }) {
  const { open } = useModal();
  const work = person.work ?? [];
  const projects = person.projects ?? [];
  const activeProjects = projects.filter((p) => p.stage !== "done");
  const inRange = person.range_tasks != null;

  function projectButton(project: ProjectRef) {
    return <button type="button" className="person-work-item person-project" key={project.id} onClick={() => open({ project: project.id })}>
      <span className="row"><FolderKanban size={16} className="muted" /><span className="person-work-title">{project.name}</span></span>
      <span className="row-wrap small muted"><span>{project.code}</span><StageBadge stage={project.stage} />{full && <Due value={project.end_date} done={project.stage === "done"} format={fmtDate} />}</span>
    </button>;
  }
  function taskRow(task: Work) {
    return <button type="button" className="person-task" onClick={() => open({ task: task.id })}>
      <FileText size={18} className="person-task-icon" aria-hidden="true" />
      <span className="person-task-title">{task.title}</span>
      <span className="person-task-project" title={task.project ? `${task.project.code} · ${task.project.name}` : T.tasks.noProject}>{task.project?.name ?? T.tasks.noProject}</span>
      <span className="person-task-status">{task.is_overdue ? <Badge tone="danger">{T.people.late}</Badge> : <TaskStatusBadge status={task.status} />}</span>
      <span className="person-task-date">{task.due_at ? fmtDate(task.due_at) : "—"}</span>
    </button>;
  }
  function projectRow(project: ProjectRef) {
    return <button type="button" className="person-task" onClick={() => open({ project: project.id })}>
      <FolderKanban size={18} className="person-task-icon" aria-hidden="true" />
      <span className="person-task-title">{project.name}</span>
      <span className="person-task-project">{project.code}</span>
      <span className="person-task-status"><StageBadge stage={project.stage} /></span>
      <span className="person-task-date">{project.end_date ? fmtDate(project.end_date) : "—"}</span>
    </button>;
  }

  if (full) {
    return <div className="person-work stack-sm">
      <h3 className="person-section-title"><FolderKanban size={18} />{T.people.projectsTitle}<Badge tone="slate" dot={false}>{projects.length}</Badge></h3>
      {projects.map(projectButton)}
      {!projects.length && <div className="small muted person-work-empty">{T.people.noProjects}</div>}
    </div>;
  }

  const showProjects = !work.length && !inRange && activeProjects.length > 0;
  const total = showProjects ? activeProjects.length : inRange ? person.range_tasks ?? 0 : person.active_tasks;
  return <div className="person-work">
    <div className="person-work-head">
      <h3 className="person-work-heading">{showProjects ? T.people.projectsN(total) : T.people.tasksN(total)}</h3>
      {total > 0 && <button type="button" className="person-work-all" onClick={() => open({ person: person.id })}>
        {T.people.seeAll}<ChevronRight size={16} aria-hidden="true" />
      </button>}
    </div>
    {work.length > 0 && <ul className="person-task-list">{work.map((task) => <li key={task.id}>{taskRow(task)}</li>)}</ul>}
    {showProjects && <ul className="person-task-list">{activeProjects.slice(0, 3).map((p) => <li key={p.id}>{projectRow(p)}</li>)}</ul>}
    {!work.length && !showProjects && <p className="person-work-none small muted">{inRange ? T.people.noWorkInRange : T.people.noWork}</p>}
  </div>;
}
