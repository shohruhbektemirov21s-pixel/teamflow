import { FolderKanban } from "lucide-react";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Badge, Due, StageBadge } from "@/shared/ui";

type ProjectRef = NonNullable<Person["projects"]>[number];

/** Xodimning loyihalari. Ro'yxatda (`full` emas) vazifasi bo'lmagan xodim uchun — bitta faol loyiha va "yana N ta"
 * (vazifalar `PersonCard` da). Profil oynasida (`full`) — barcha loyihalar. */
export function PersonWork({ person, full = false }: { person: Person; full?: boolean }) {
  const { open } = useModal();
  const projects = person.projects ?? [];
  const activeProjects = projects.filter((p) => p.stage !== "done");
  const inRange = person.range_tasks != null;

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

  const project = inRange ? undefined : activeProjects[0];
  return <div className="person-work stack-sm">
    {project && projectButton(project)}
    {project && activeProjects.length > 1 && more(T.people.moreProjects(activeProjects.length - 1))}
    {!project && <span className="small muted">{inRange ? T.people.noWorkInRange : T.people.noWork}</span>}
  </div>;
}
