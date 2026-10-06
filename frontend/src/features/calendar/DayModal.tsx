import { Flag, FolderKanban } from "lucide-react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { TaskTable } from "@/features/tasks/TaskTable";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Project, Task } from "@/shared/types";
import { CodeTag, Empty, ErrorBox, Modal, People, SkeletonRows, StageBadge } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

/**
 * Taqvimdagi kun: shu kuni tugaydigan loyihalar va shu kungi vazifalar.
 * Vazifa yoki loyiha bosilsa, shu modal o'rniga uning modali ochiladi (modal ustida modal yo'q);
 * "Orqaga" yoki ✕ — yana shu kun ro'yxatiga qaytaradi.
 */
export default function DayModal({ date }: { date: string }) {
  const me = useMe();
  const { open, close } = useModal();
  const tasks = usePagedList<Task>(["tasks", "calendar-day", date, me.role], "/tasks/", { date, mine: isManager(me) ? undefined : 1 });
  const projects = usePagedList<Project>(["projects", "calendar-day", date], "/projects/", { end_from: date, end_to: date });
  const loading = tasks.isLoading || projects.isLoading;
  const taskList = tasks.data ?? [];
  const projectList = projects.data ?? [];

  return (
    <Modal
      title={fmtDate(date)}
      subtitle={!loading && <span className="muted small">{T.calendar.dayCount(tasks.pagination?.count ?? 0, projects.pagination?.count ?? 0)}</span>}
      onClose={close}
    >
      {(tasks.error || projects.error) && <ErrorBox error={tasks.error ?? projects.error} onRetry={() => (tasks.refetch(), projects.refetch())} />}
      {loading ? (
        <SkeletonRows rows={3} />
      ) : !taskList.length && !projectList.length ? (
        <Empty title={T.calendar.dayEmpty} hint={T.calendar.dayEmptyHint} />
      ) : (
        <div className="stack" style={{ gap: 24 }}>
          {projectList.length > 0 && (
            <section>
              <h3 className="section-title">{T.calendar.dayProjects}</h3>
              <div className="card">
                {projectList.map((p) => (
                  <button key={p.id} className="list-row clickable" onClick={() => open({ project: p.id })}>
                    <span className="total-icon tone-violet">
                      <Flag />
                    </span>
                    <span className="grow stack-sm" style={{ gap: 2 }}>
                      <span className="row" style={{ gap: 6 }}>
                        <CodeTag code={p.code} />
                        <span className="task-title ellipsis">{p.name}</span>
                      </span>
                      <span className="small muted row" style={{ gap: 4 }}>
                        <FolderKanban size={14} /> {T.projects.progress(p.progress.done, p.progress.total)}
                      </span>
                    </span>
                    <span className="hide-sm">
                      <People users={p.members} />
                    </span>
                    <StageBadge stage={p.stage} />
                  </button>
                ))}
              </div>
              <Pagination data={projects.pagination} page={projects.page} onPageChange={projects.onPageChange} />
            </section>
          )}
          {taskList.length > 0 && (
            <section>
              <h3 className="section-title">{T.calendar.dayTasks}</h3>
              <div className="card" style={{ overflow: "hidden" }}>
                <TaskTable tasks={taskList} />
                <Pagination data={tasks.pagination} page={tasks.page} onPageChange={tasks.onPageChange} />
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
