import { FolderKanban } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Badge, Due, StageBadge, TaskStatusBadge } from "@/shared/ui";

type Work = NonNullable<Person["work"]>[number];
type ProjectRef = NonNullable<Person["projects"]>[number];

/** Xodimning ishlari. Ro'yxatda (`full` emas) — faqat bitta eng yaqin ish (bo'lmasa bitta faol loyiha) va
 * "yana N ta"; muddat filtri tanlangan bo'lsa — shu muddatdagi ishlar. Profil oynasida (`full`) — barcha loyihalar. */
export function PersonWork({ person, full = false }: { person: Person; full?: boolean }) {
  const { open } = useModal();
  const work = person.work ?? [];
  const projects = person.projects ?? [];
  const activeProjects = projects.filter((p) => p.stage !== "done");
  const inRange = person.range_tasks != null;

  function taskButton(task: Work) {
    return <button type="button" className="person-work-item" key={task.id} onClick={() => open({ task: task.id })}>
      <span className="person-work-title">{task.title}</span>
      <span className="small muted">{task.project.code} · {task.project.name}</span>
      <span className="row-wrap"><TaskStatusBadge status={task.status} />{task.is_overdue ? <Badge tone="danger">{T.dashboard.overdue}</Badge> : <Due value={task.due_at} done={task.status === "done"} format={fmtDate} />}</span>
    </button>;
  }
  function projectButton(project: ProjectRef) {
    return <button type="button" className="person-work-item person-project" key={project.id} onClick={() => open({ project: project.id })}>
      <span className="row"><FolderKanban size={16} className="muted" /><span className="person-work-title">{project.name}</span></span>
      <span className="row-wrap small muted"><span>{project.code}</span><StageBadge stage={project.stage} />{full && <Due value={project.end_date} done={project.stage === "done"} format={fmtDate} />}</span>
    </button>;
  }
  function more(label: string) {
    return <button type="button" className="person-work-more" onClick={() => open({ person: person.id })}>{label}</button>;
  }

  if (full) {
    return <div className="person-work stack-sm">
      <h3 className="person-section-title"><FolderKanban size={18} />{T.people.projectsTitle}<Badge tone="slate" dot={false}>{projects.length}</Badge></h3>
      {projects.map(projectButton)}
      {!projects.length && <div className="small muted person-work-empty">{T.people.noProjects}</div>}
    </div>;
  }

  const task = work[0];
  const totalTasks = inRange ? person.range_tasks ?? 0 : person.active_tasks;
  const project = !task && !inRange ? activeProjects[0] : undefined;
  return <div className="person-work stack-sm">
    {task && taskButton(task)}
    {task && totalTasks > 1 && more(T.people.moreWork(totalTasks - 1))}
    {project && projectButton(project)}
    {project && activeProjects.length > 1 && more(T.people.moreProjects(activeProjects.length - 1))}
    {!task && !project && <span className="small muted">{inRange ? T.people.noWorkInRange : T.people.noWork}</span>}
  </div>;
}
