import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart, CheckCircle2, ListTodo, Plus, TrendingUp } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Person, Task } from "@/shared/types";
import { Avatar, Badge, Button, Modal, Skeleton, Tabs } from "@/shared/ui";

export default function PersonModal({ id }: { id: number }) {
  const me = useMe();
  const isMgr = me.role === "boss" || me.role === "pm";
  const { open, close } = useModal();
  const meta = useMeta();

  const [tab, setTab] = useState<"tasks" | "report">("tasks");

  const personQuery = useQuery({
    queryKey: ["person", id],
    queryFn: () => api.get<Person>(`/people/${id}/`),
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", "person", id],
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ assignee: id, all: 1 })}`),
    enabled: personQuery.data?.role === "developer",
  });

  const person = personQuery.data;
  const tasks = tasksQuery.data || [];

  // Hisobot hisob-kitoblari
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done");
  const inProgressTasks = tasks.filter((t) => t.status !== "done");
  
  const lateDone = doneTasks.filter((t) => t.due_at && t.completed_at && new Date(t.completed_at) > new Date(t.due_at)).length;
  const onTimeDone = doneTasks.length - lateDone;
  const currentlyOverdue = inProgressTasks.filter((t) => t.is_overdue).length;

  const successRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
  const disciplineRate = doneTasks.length > 0 ? Math.round((onTimeDone / doneTasks.length) * 100) : 0;

  return (
    <Modal
      title={
        person ? (
          <span className="row">
            <Avatar user={person} size="lg" />
            <span className="stack-sm" style={{ gap: 0 }}>
              <b style={{ fontSize: 16 }}>{person.full_name}</b>
              <span className="small muted">{person.department_name || person.specialty || person.role_label}</span>
            </span>
          </span>
        ) : (
          "Yuklanmoqda..."
        )
      }
      onClose={close}
    >
      {personQuery.isLoading && <Skeleton h={200} />}
      {person && (
        <div className="stack">
          {isMgr && person.role === "developer" && (
            <div
              className="card card-pad"
              style={{
                background: person.active_tasks === 0 ? "var(--success-soft)" : "var(--surface-2)",
                border: person.active_tasks === 0 ? "1px solid var(--success)" : undefined,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 650, fontSize: 13.5 }}>
                    {person.active_tasks === 0 ? T.people.freeNow : T.people.busyNow(person.active_tasks)}
                  </div>
                  <div className="small muted">
                    {person.active_tasks === 0 ? T.people.freeHint : T.people.busyHint}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus size={14} />}
                  onClick={() => open({ new: "task", assignee: person.id })}
                >
                  {T.people.giveTask}
                </Button>
              </div>
            </div>
          )}

          {person.role === "developer" && (
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "tasks", label: <><ListTodo size={16} /> {T.people.tasks}</> },
                { key: "report", label: <><BarChart size={16} /> {T.people.report}</> },
              ]}
            />
          )}

          {person.role === "developer" && tab === "tasks" && (
            <>
              {tasksQuery.isLoading && <Skeleton h={80} />}
              {!tasksQuery.isLoading && tasks.length === 0 && <p className="muted">{T.tasks.empty}</p>}
              {tasks.map((t) => (
                <button
                  key={t.id}
                  className="card card-pad clickable stack-sm"
                  style={{ textAlign: "left", font: "inherit", color: "inherit" }}
                  onClick={() => open({ task: t.id })}
                >
                  <span className="row">
                    <b className="grow">{t.title}</b>
                    <Badge tone={t.status === "done" ? "success" : t.is_overdue ? "danger" : "info"}>
                      {meta.label("task_statuses", t.status)}
                    </Badge>
                  </span>
                  <span className="small muted">
                    {t.project.name} · {t.due_at ? fmtDate(t.due_at) : T.common.notSet}
                  </span>
                </button>
              ))}
            </>
          )}

          {person.role === "developer" && tab === "report" && (
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
                  <b style={{ color: "var(--success)" }}>{doneTasks.length}</b>
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

          {person.role !== "developer" && (
            <div className="card card-pad stack-sm" style={{ textAlign: "center", marginTop: 20 }}>
              <div className="muted small">{T.people.devOnly}</div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
