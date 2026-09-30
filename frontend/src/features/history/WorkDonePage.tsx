import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useProjects } from "@/app/queries";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { HistoryItem, UserBrief } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";

interface WorkDoneData {
  page: number;
  counts: { tasks: number; reviews: number; history: number };
  completed_tasks: { id: number; title: string; project: { id: number; name: string }; completed_at: string; assignees: UserBrief[] }[];
  reviews: { id: number; task_id: number; task_title: string; project: string; submitted_by: UserBrief; reviewed_by: UserBrief | null; decision: "accepted" | "returned"; decision_label: string; note: string; review_note: string; reviewed_at: string }[];
  recent_activity: HistoryItem[];
}

export default function WorkDonePage() {
  const [tab, setTab] = useState("tasks");
  const [days, setDays] = useState("7");
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const { open } = useModal();
  const openTarget = (target: HistoryItem["target"]) => {
    if (target?.type === "task") open({ task: target.id });
    else if (target?.type === "order") open({ order: target.id });
    else if (target?.type === "project") open({ project: target.id });
  };
  const projects = useProjects();

  const query = useQuery({
    queryKey: ["workdone", days, project, page],
    queryFn: () => api.get<WorkDoneData>(`/workdone/${qs({ days, project, page })}`),
  });
  const data = query.data;
  const hasPrevious = page > 1;
  const hasNext = data ? data.counts[tab as keyof WorkDoneData["counts"]] > page * 20 : false;

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.workDone.title}</h1>
        </div>
        <div className="row-wrap">
          <select className="input" value={project} onChange={(e) => (setProject(e.target.value), setPage(1))} style={{ width: 220 }}>
            <option value="">{T.filters.allProjects}</option>
            {projects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="input" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 120 }}>
            <option value="1">1 {T.workDone.days}</option>
            <option value="7">7 {T.workDone.days}</option>
            <option value="30">30 {T.workDone.days}</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="tabs">
          <button className={`tab ${tab === "tasks" ? "active" : ""}`} onClick={() => setTab("tasks")}>
            {T.workDone.tabs.tasks}
            {data && <span className="badge tone-slate" style={{ marginLeft: 6 }}>{data.counts.tasks}</span>}
          </button>
          <button className={`tab ${tab === "reviews" ? "active" : ""}`} onClick={() => setTab("reviews")}>
            {T.workDone.tabs.reviews}
            {data && <span className="badge tone-slate" style={{ marginLeft: 6 }}>{data.counts.reviews}</span>}
          </button>
          <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            {T.workDone.tabs.history}
            {data && <span className="badge tone-slate" style={{ marginLeft: 6 }}>{data.counts.history}</span>}
          </button>
        </div>
      </div>

      {query.isLoading && (
        <div className="card">
          <SkeletonRows rows={5} />
        </div>
      )}

      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}

      {data && (
        <div className="card">
          {tab === "tasks" && (
            <div className="table-wrap">
              {!data.completed_tasks.length ? (
                <Empty title={T.workDone.noTasks} />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{T.workDone.col.task}</th>
                      <th>{T.workDone.col.project}</th>
                      <th>{T.workDone.col.assignees}</th>
                      <th>{T.workDone.col.doneAt}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.completed_tasks.map((t) => (
                      <tr key={t.id} onClick={() => open({ task: t.id })} className="clickable">
                        <td><b>{t.title}</b></td>
                        <td>{t.project.name}</td>
                        <td>
                          <div className="row-wrap" style={{ gap: 4 }}>
                            {t.assignees.map((a) => (
                              <div key={a.id} title={a.full_name}>
                                <Avatar user={a} size="sm" />
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="muted">{t.completed_at ? fmtDate(t.completed_at) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="table-wrap">
              {!data.reviews.length ? (
                <Empty title={T.workDone.noReviews} />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{T.workDone.col.submittedBy}</th>
                      <th>{T.workDone.col.note}</th>
                      <th>{T.workDone.decision}</th>
                      <th>{T.workDone.col.reviewer}</th>
                      <th>{T.workDone.col.date}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reviews.map((r) => (
                      <tr key={r.id} className="clickable" onClick={() => open({ task: r.task_id })}>
                        <td>
                          <div className="row">
                            <Avatar user={r.submitted_by} size="sm" />
                            <span>{r.submitted_by.full_name}</span>
                          </div>
                        </td>
                        <td style={{ maxWidth: 300 }} className="ellipsis">{r.note}</td>
                        <td>
                          <Badge tone={r.decision === "accepted" ? "success" : r.decision === "returned" ? "danger" : "info"}>
                            {r.decision_label}
                          </Badge>
                        </td>
                        <td>
                          {r.reviewed_by ? (
                            <div className="row">
                              <Avatar user={r.reviewed_by} size="sm" />
                              <span>{r.reviewed_by.full_name}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="muted">{fmtDate(r.reviewed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="table-wrap">
              {!data.recent_activity.length ? (
                <Empty title={T.workDone.noHistory} />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{T.workDone.col.person}</th>
                      <th>{T.workDone.col.action}</th>
                      <th>{T.workDone.col.time}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_activity.map((h) => (
                      <tr key={h.id} className={h.target ? "clickable" : undefined} onClick={() => openTarget(h.target)}>
                        <td>
                          {h.actor ? (
                            <div className="row">
                              <Avatar user={h.actor} size="sm" />
                              <span>{h.actor.full_name}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{h.message}</td>
                        <td className="muted">{fmtDate(h.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
      {data && (hasPrevious || hasNext) && (
        <div className="row" style={{ justifyContent: "end", marginTop: 16 }}>
          <Button size="sm" disabled={!hasPrevious} onClick={() => setPage((current) => current - 1)}>{T.workDone.prev}</Button>
          <span className="small muted">{T.workDone.page(page)}</span>
          <Button size="sm" disabled={!hasNext} onClick={() => setPage((current) => current + 1)}>{T.workDone.next}</Button>
        </div>
      )}
    </>
  );
}
