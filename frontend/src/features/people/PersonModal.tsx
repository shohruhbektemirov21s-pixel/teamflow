import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart, CheckCircle2, FolderKanban, ListTodo, Plus, TrendingUp, Trophy, UserRound } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { TaskTable } from "@/features/tasks/TaskTable";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person, Task } from "@/shared/types";
import { Button, ErrorBox, Modal, Skeleton, Tabs } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { ProfileHeader } from "./ProfileHeader";
import { PersonWork } from "./PersonWork";
import { PersonResponsibilities } from "./PersonResponsibilities";

type PersonTab = "overview" | "tasks" | "projects" | "report";

/**
 * Xodim profili (Boshliq/PM, Xodimlar sahifasidan). Sarlavhada xodim ismi — aylantirganda ham kimni ko'rayotganingiz
 * yo'qolmaydi. Tarkib tablarga ajratilgan, amallar doim ko'rinadigan pastki panelda: chapda Portfolio, o'ngda Vazifa berish.
 */
export default function PersonModal({ id }: { id: number }) {
  const me = useMe();
  const isMgr = me.role === "boss" || me.role === "pm";
  const { open, close } = useModal();

  const [tab, setTab] = useState<PersonTab>("overview");
  const [dirty, setDirty] = useState(false);

  const personQuery = useQuery({
    queryKey: ["person", id],
    queryFn: () => api.get<Person>(`/people/${id}/`),
  });

  const person = personQuery.data;
  const isDev = person?.role === "developer";
  // Vazifalar faqat "Vazifalar" yoki "Hisobot" tabi ochilganda yuklanadi
  const tasksQuery = usePagedList<Task>(["tasks", "person", id], "/tasks/", { assignee: id }, isDev && (tab === "tasks" || tab === "report"));
  const tasks = tasksQuery.data || [];

  // Hisobot hisob-kitoblari
  const totalTasks = person?.report?.total ?? tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done");
  const inProgressTasks = tasks.filter((t) => t.status !== "done");

  const doneCount = person?.report?.done ?? doneTasks.length;
  const lateDone = person?.report?.late ?? doneTasks.filter((t) => t.due_at && t.completed_at && new Date(t.completed_at) > new Date(t.due_at)).length;
  const onTimeDone = doneCount - lateDone;
  const currentlyOverdue = person?.overdue_tasks ?? inProgressTasks.filter((t) => t.is_overdue).length;

  const successRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
  const disciplineRate = doneCount > 0 ? Math.round((onTimeDone / doneCount) * 100) : 0;

  const tabs: { key: PersonTab; label: ReactNode }[] = [
    { key: "overview", label: <><UserRound size={16} /> {T.people.tabOverview}</> },
    ...(isDev ? [{ key: "tasks" as const, label: <><ListTodo size={16} /> {T.people.tasks}</> }] : []),
    { key: "projects", label: <><FolderKanban size={16} /> {T.people.tabProjects}</> },
    ...(isDev ? [{ key: "report" as const, label: <><BarChart size={16} /> {T.people.report}</> }] : []),
  ];
  const canGiveTask = isMgr && isDev;
  // Portfolioni dasturchi yuritadi, qolganlar ko'radi, kuzatadi va baholaydi
  const footer = person && isDev ? (
    <>
      <Button icon={<Trophy size={15} />} onClick={() => open({ portfolio: person.id })}>{T.people.portfolioOpen}</Button>
      <div className="spacer" />
      {canGiveTask && (
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          disabled={person.is_on_business_trip}
          title={person.is_on_business_trip ? T.people.tripBlocked : undefined}
          onClick={() => open({ new: "task", assignee: person.id })}
        >
          {T.people.giveTask}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <Modal
      title={person ? person.full_name : T.common.loading}
      subtitle={person ? <span className="small muted">{T.people.profileTitle}</span> : undefined}
      onClose={close}
      dirty={dirty}
      footer={footer}
    >
      {personQuery.isLoading && <Skeleton h={200} />}
      {personQuery.error && <ErrorBox error={personQuery.error} onRetry={() => personQuery.refetch()} />}
      {person && (
        <div className="stack">
          <ProfileHeader
            user={person}
            subtitle={person.department_name || person.specialty || person.role_label}
            stats={
              isDev
                ? { active: person.active_tasks, overdue: person.overdue_tasks, review: person.review_tasks, done: person.done_tasks }
                : null
            }
          />

          <Tabs value={tab} onChange={setTab} tabs={tabs} />

          {/* Mas'uliyat tahrirlanayotganda boshqa tabga o'tilsa matn yo'qolmasin — tab yashiriladi, o'chirilmaydi */}
          <div hidden={tab !== "overview"}><div className="stack">
            {person.is_on_business_trip && <div className="card card-pad small">{T.people.onBusinessTrip}. {T.people.tripUntil(fmtDate(person.business_trip_return_date!))}. {T.people.tripBlocked}.</div>}
            {isDev && !person.is_on_business_trip && (
              <div
                className="card card-pad"
                style={{
                  background: person.active_tasks === 0 ? "var(--success-soft)" : "var(--surface-2)",
                  border: person.active_tasks === 0 ? "1px solid var(--success)" : undefined,
                }}
              >
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>
                  {person.active_tasks === 0 ? T.people.freeNow : T.people.busyNow(person.active_tasks)}
                </div>
                {canGiveTask && <div className="small muted">{person.active_tasks === 0 ? T.people.freeHint : T.people.busyHint}</div>}
              </div>
            )}
            <PersonResponsibilities key={person.id} person={person} editable={isMgr} onDirtyChange={setDirty} />
            {!isDev && <div className="card card-pad small muted" style={{ textAlign: "center" }}>{T.people.devOnly}</div>}
          </div></div>

          {tab === "projects" && <PersonWork person={person} full />}

          {isDev && (tab === "tasks" || tab === "report") && tasksQuery.error && <ErrorBox error={tasksQuery.error} onRetry={() => tasksQuery.refetch()} />}
          {isDev && tab === "tasks" && !tasksQuery.error && (
            <div className="card">
              <TaskTable tasks={tasksQuery.data} loading={tasksQuery.isLoading} emptyHint={T.people.noTasksHint} />
              <Pagination data={tasksQuery.pagination} page={tasksQuery.page} onPageChange={tasksQuery.onPageChange} />
            </div>
          )}

          {isDev && tab === "report" && tasksQuery.isLoading && <Skeleton h={200} />}
          {isDev && tab === "report" && tasksQuery.data && !tasksQuery.error && (
            <div className="stack">
              <div className="grid-2">
                <div className="card card-pad stack-sm" style={{ textAlign: "center" }}>
                  <div className="row" style={{ justifyContent: "center", color: "var(--primary)" }}><TrendingUp size={24} /></div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{successRate}%</div>
                  <div className="small muted">{T.people.donePercent}</div>
                </div>
                <div className="card card-pad stack-sm" style={{ textAlign: "center" }}>
                  <div className="row" style={{ justifyContent: "center", color: "var(--success)" }}><CheckCircle2 size={24} /></div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{disciplineRate}%</div>
                  <div className="small muted">{T.people.onTimeRate}</div>
                </div>
              </div>

              <div className="grid-2">
                <div className="card card-pad row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{T.people.total}</span>
                  <b>{totalTasks}</b>
                </div>
                <div className="card card-pad row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{T.people.doneTotal}</span>
                  <b style={{ color: "var(--success)" }}>{doneCount}</b>
                </div>
                <div className="card card-pad row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{T.people.doneLate}</span>
                  <b style={{ color: lateDone > 0 ? "var(--warning)" : "inherit" }}>{lateDone}</b>
                </div>
                <div className="card card-pad row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{T.people.lateNow}</span>
                  <b style={{ color: currentlyOverdue > 0 ? "var(--danger)" : "inherit" }}>{currentlyOverdue}</b>
                </div>
              </div>

              <div className="card card-pad" style={{ background: "var(--surface-2)" }}>
                <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
                  <Activity size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                  {T.people.reportNote}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
