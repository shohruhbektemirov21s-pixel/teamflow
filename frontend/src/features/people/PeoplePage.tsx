import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, Segmented, SkeletonRows } from "@/shared/ui";

/** Xodimlar sahifasi: Boshliq va PM uchun jamoa a'zolari, jadval yoki karta ko'rinishida. */
export default function PeoplePage() {
  const me = useMe();
  const boss = me.role === "boss";
  const isMgr = me.role === "boss" || me.role === "pm";
  const { open } = useModal();
  const meta = useMeta();
  const [role, setRole] = useState<string>(boss ? "" : "developer");
  const [view, setView] = useState<"table" | "grid">("table");
  const [onlyFree, setOnlyFree] = useState(false);
  const [q, setQ] = useState("");
  const search = useDebounced(q.toLowerCase());

  const peopleQuery = useQuery({
    queryKey: ["people", role],
    queryFn: () => api.get<Person[]>(`/people/${qs({ role })}`),
  });

  const allPeople = peopleQuery.data ?? [];
  const filtered = allPeople.filter((p) => {
    if (onlyFree && (p.active_tasks > 0 || p.role !== "developer" || p.is_on_business_trip)) return false;
    if (!search) return true;
    return (
      p.full_name.toLowerCase().includes(search) ||
      (p.specialty && p.specialty.toLowerCase().includes(search)) ||
      (p.department_name && p.department_name.toLowerCase().includes(search)) ||
      p.role_label.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.nav.people}</h1>
          <p className="muted">
            {allPeople.length ? T.common.count(allPeople.length) + " xodim" : T.dashboard.teamHint}
          </p>
        </div>
        <div className="row-wrap" style={{ gap: 12 }}>
          {boss && (
            <Segmented
              value={role}
              onChange={setRole}
              options={[{ value: "", label: T.common.all }, ...meta.roles.filter((r) => r.value !== "boss")]}
            />
          )}

          <button
            type="button"
            className="btn-ghost"
            style={{
              height: 36,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: 600,
              border: onlyFree ? "1.5px solid var(--success)" : "1px solid var(--border-strong)",
              background: onlyFree ? "var(--success-soft)" : "var(--surface)",
              color: onlyFree ? "var(--success)" : "var(--text)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => setOnlyFree(!onlyFree)}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
            {T.people.onlyFree}
          </button>

          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: T.people.viewTable },
              { value: "grid", label: T.people.viewGrid },
            ]}
          />

          <div
            className="row"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              padding: "0 10px",
              height: 36,
            }}
          >
            <Search size={16} className="muted" />
            <input
              type="text"
              placeholder={T.people.searchPh}
              aria-label={T.people.searchPh}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text)" }}
            />
          </div>
        </div>
      </div>

      {peopleQuery.error && <ErrorBox error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} />}

      {peopleQuery.isLoading && (
        <div className="card">
          <SkeletonRows rows={6} />
        </div>
      )}

      {peopleQuery.data && !filtered.length && (
        <div className="card">
          <Empty icon={<Users />} title={T.people.empty} hint={T.people.emptyHint} />
        </div>
      )}

      {/* ─── Jadval ko'rinishi (Standart asosiy ko'rinish) ─── */}
      {view === "table" && filtered.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>№</th>
                  <th>{T.people.col.person}</th>
                  <th>{T.people.col.position}</th>
                  <th>{T.people.col.load}</th>
                  <th>{T.people.col.tasks}</th>
                  <th>{T.people.col.doing}</th>
                  <th style={{ width: 190, textAlign: "right" }}>{T.people.col.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={() => open({ person: p.id })}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open({ person: p.id })}
                  >
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="row">
                        <Avatar user={p} size="sm" />
                        <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                        {p.is_on_business_trip && <Badge tone="warning">{T.people.onBusinessTrip}</Badge>}
                      </div>
                    </td>
                    <td>
                      <span className="small">
                        {p.department_name || p.specialty || p.role_label}
                      </span>
                    </td>
                    <td>
                      {p.is_on_business_trip ? (
                        <Badge tone="warning">{T.people.onBusinessTrip}</Badge>
                      ) : p.role === "developer" || p.active_tasks || p.done_tasks ? (
                        p.active_tasks === 0 ? (
                          <Badge tone="success">{T.dashboard.free}</Badge>
                        ) : (
                          <Badge tone="info">
                            {T.dashboard.active}: {p.active_tasks}
                          </Badge>
                        )
                      ) : (
                        <Badge tone="slate" dot={false}>
                          {p.role_label}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {p.active_tasks > 0 && (
                          <span className="badge tone-primary" style={{ height: 22, fontSize: 11.5 }}>
                            {T.people.activeN(p.active_tasks)}
                          </span>
                        )}
                        {p.overdue_tasks > 0 && (
                          <span className="badge tone-danger" style={{ height: 22, fontSize: 11.5 }}>
                            {T.people.overdueN(p.overdue_tasks)}
                          </span>
                        )}
                        {p.review_tasks > 0 && (
                          <span className="badge tone-violet" style={{ height: 22, fontSize: 11.5 }}>
                            {T.people.reviewN(p.review_tasks)}
                          </span>
                        )}
                        {p.active_tasks === 0 && p.overdue_tasks === 0 && (
                          <span className="muted small">{T.people.noTasks}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {p.doing[0] ? (
                        <span className="small ellipsis" style={{ display: "block", fontWeight: 550, color: "var(--primary)" }} title={p.doing[0].title}>
                          ▶ {p.doing[0].title}
                        </span>
                      ) : (
                        <span className="small muted">{T.dashboard.noDoing}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        {isMgr && p.role === "developer" && (
                          <Button
                            size="sm"
                            variant={p.active_tasks === 0 ? "primary" : "default"}
                            icon={<Plus size={14} />}
                            disabled={p.is_on_business_trip}
                            title={p.is_on_business_trip ? T.people.tripBlocked : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              open({ new: "task", assignee: p.id });
                            }}
                          >
                            {T.people.giveTask}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            open({ person: p.id });
                          }}
                        >
                          {T.common.open}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Karta ko'rinishi ─── */}
      {view === "grid" && filtered.length > 0 && (
        <div className="people-grid">
          {filtered.map((p) => (
            <button key={p.id} className="card person clickable" onClick={() => open({ person: p.id })}>
              <div className="row">
                <Avatar user={p} size="lg" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 650, fontSize: 15 }}>
                    {p.full_name}
                  </div>
                  <div className="small muted ellipsis">{p.department_name || p.specialty || p.role_label}</div>
                  {p.is_on_business_trip && <Badge tone="warning">{T.people.onBusinessTrip}</Badge>}
                </div>
              </div>
              {p.is_on_business_trip ? (
                <Badge tone="warning">{T.people.onBusinessTrip}</Badge>
              ) : p.role === "developer" || p.active_tasks || p.done_tasks ? (
                <div className="person-nums">
                  {p.active_tasks === 0 ? (
                    <Badge tone="success">{T.dashboard.free}</Badge>
                  ) : (
                    <Badge tone="info">
                      {T.dashboard.active}: {p.active_tasks}
                    </Badge>
                  )}
                  {p.overdue_tasks > 0 && (
                    <Badge tone="danger">
                      {T.dashboard.overdue}: {p.overdue_tasks}
                    </Badge>
                  )}
                  {p.review_tasks > 0 && (
                    <Badge tone="violet">
                      {meta.label("task_statuses", "in_review")}: {p.review_tasks}
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge tone="slate" dot={false}>
                  {p.role_label}
                </Badge>
              )}
              <div className="small muted ellipsis" style={{ marginTop: 2 }}>
                {p.doing[0] ? `▶ ${p.doing[0].title}` : T.dashboard.noDoing}
              </div>
              {isMgr && p.role === "developer" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", width: "100%" }} onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant={p.active_tasks === 0 ? "primary" : "default"}
                    icon={<Plus size={14} />}
                    disabled={p.is_on_business_trip}
                    title={p.is_on_business_trip ? T.people.tripBlocked : undefined}
                    style={{ width: "100%" }}
                    onClick={() => open({ new: "task", assignee: p.id })}
                  >
                    {T.people.giveTask}
                  </Button>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

    </>
  );
}
