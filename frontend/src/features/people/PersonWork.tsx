import { FolderKanban } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Badge, Due, StageBadge, TaskStatusBadge } from "@/shared/ui";

export function PersonWork({ person, full = false }: { person: Person; full?: boolean }) {
  const { open } = useModal();
  const work = person.work ?? [];
  const projects = person.projects ?? [];
  const activeProjects = projects.filter((p) => p.stage !== "done");
  const visibleProjects = full ? projects : activeProjects.slice(0, 2);
  return <div className="person-work stack-sm">
    {!full && person.responsibilities && <div className="person-responsibilities-preview"><span className="small muted">{T.people.responsibilities}</span><p>{person.responsibilities}</p></div>}
    {!full && work.map((task) => <button type="button" className="person-work-item" key={task.id} onClick={() => open({ task: task.id })}>
      <span className="person-work-title">{task.title}</span>
      <span className="small muted">{task.project.code} · {task.project.name}</span>
      <span className="row-wrap"><TaskStatusBadge status={task.status} />{task.is_overdue ? <Badge tone="danger">{T.dashboard.overdue}</Badge> : <Due value={task.due_at} format={fmtDate} />}</span>
    </button>)}
    {!full && person.active_tasks > work.length && <button type="button" className="person-work-more" onClick={() => open({ person: person.id })}>{T.people.moreWork(person.active_tasks - work.length)}</button>}
    {full && <h3 className="person-section-title"><FolderKanban size={18} />{T.people.projectsTitle}<Badge tone="slate" dot={false}>{projects.length}</Badge></h3>}
    {visibleProjects.map((project) => <button type="button" className="person-work-item person-project" key={project.id} onClick={() => open({ project: project.id })}>
      <span className="row"><FolderKanban size={16} className="muted" /><span className="person-work-title">{project.name}</span></span>
      <span className="row-wrap small muted"><span>{project.code}</span><StageBadge stage={project.stage} />{full && <Due value={project.end_date} done={project.stage === "done"} format={fmtDate} />}</span>
    </button>)}
    {!full && activeProjects.length > visibleProjects.length && <button type="button" className="person-work-more" onClick={() => open({ person: person.id })}>{T.people.moreProjects(activeProjects.length - visibleProjects.length)}</button>}
    {full && !projects.length && <div className="small muted person-work-empty">{T.people.noProjects}</div>}
    {!full && !work.length && !visibleProjects.length && <span className="small muted">{T.people.noWork}</span>}
  </div>;
}
