import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { HistoryItem, Submission, Task } from "@/shared/types";
import { Avatar, Badge, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";

interface WorkDoneData {
  tasks: Task[];
  reviews: Submission[];
  history: HistoryItem[];
}

export default function WorkDonePage() {
  const [tab, setTab] = useState("tasks");
  const [days, setDays] = useState("7");
  const { open } = useModal();

  const query = useQuery({
    queryKey: ["workdone", days],
    queryFn: () => api.get<WorkDoneData>(`/workdone/${qs({ days })}`),
  });

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.workDone.title}</h1>
        </div>
        <div className="row">
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
            {query.data && <span className="badge tone-slate" style={{ marginLeft: 6 }}>{query.data.tasks.length}</span>}
          </button>
          <button className={`tab ${tab === "reviews" ? "active" : ""}`} onClick={() => setTab("reviews")}>
            {T.workDone.tabs.reviews}
            {query.data && <span className="badge tone-slate" style={{ marginLeft: 6 }}>{query.data.reviews.length}</span>}
          </button>
          <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            {T.workDone.tabs.history}
            {query.data && <span className="badge tone-slate" style={{ marginLeft: 6 }}>{query.data.history.length}</span>}
          </button>
        </div>
      </div>

      {query.isLoading && (
        <div className="card">
          <SkeletonRows rows={5} />
        </div>
      )}

      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}

      {query.data && (
        <div className="card">
          {tab === "tasks" && (
            <div className="table-wrap">
              {!query.data.tasks.length ? (
                <Empty title={T.workDone.noTasks} />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vazifa</th>
                      <th>Loyiha</th>
                      <th>Ijrochilar</th>
                      <th>Bajarildi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.tasks.map((t) => (
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
              {!query.data.reviews.length ? (
                <Empty title={T.workDone.noReviews} />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Yubordi</th>
                      <th>Izoh</th>
                      <th>{T.workDone.decision}</th>
                      <th>Tekshirdi</th>
                      <th>Sana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.reviews.map((r) => (
                      <tr key={r.id}>
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
                        <td className="muted">{fmtDate(r.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="table-wrap">
              {!query.data.history.length ? (
                <Empty title={T.workDone.noHistory} />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Xodim</th>
                      <th>Harakat</th>
                      <th>Vaqt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.history.map((h) => (
                      <tr key={h.id}>
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
                        <td>
                          <div dangerouslySetInnerHTML={{ __html: h.message }} />
                        </td>
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
    </>
  );
}
