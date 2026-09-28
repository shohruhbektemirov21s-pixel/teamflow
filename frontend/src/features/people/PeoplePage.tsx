import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Person, Task } from "@/shared/types";
import { Avatar, Badge, Button, Drawer, Empty, ErrorBox, Segmented, Skeleton, SkeletonRows } from "@/shared/ui";

/** Xodimlar sahifasi: Boshliq va PM uchun jamoa a'zolari, jadval yoki karta ko'rinishida. */
export default function PeoplePage() {
  const me = useMe();
  const boss = me.role === "boss";
  const meta = useMeta();
  const [role, setRole] = useState<string>(boss ? "" : "developer");
  const [view, setView] = useState<"table" | "grid">("table");
  const [q, setQ] = useState("");
  const search = useDebounced(q.toLowerCase());
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const peopleQuery = useQuery({
    queryKey: ["people", role],
    queryFn: () => api.get<Person[]>(`/people/${qs({ role })}`),
  });

  const allPeople = peopleQuery.data ?? [];
  const filtered = allPeople.filter((p) => {
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

          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: "Jadval" },
              { value: "grid", label: "Kartalar" },
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
              placeholder="Xodimni qidirish…"
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
          <Empty icon={<Users />} title="Xodimlar topilmadi" hint="Qidiruv yoki filtr mezonlarini o'zgartirib ko'ring." />
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
                  <th>Xodim</th>
                  <th>Lavozim / Bo'lim</th>
                  <th>Bandlik holati</th>
                  <th>Vazifalar ko'rsatkichi</th>
                  <th>Joriy ish</th>
                  <th style={{ width: 100, textAlign: "right" }}>Batafsil</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    onClick={() => setSelectedPerson(p)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedPerson(p)}
                  >
                    <td className="muted">{i + 1}</td>
                    <td>
                      <div className="row">
                        <Avatar user={p} size="sm" />
                        <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="small">
                        {p.department_name || p.specialty || p.role_label}
                      </span>
                    </td>
                    <td>
                      {p.role === "developer" || p.active_tasks || p.done_tasks ? (
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
                            {p.active_tasks} faol
                          </span>
                        )}
                        {p.overdue_tasks > 0 && (
                          <span className="badge tone-danger" style={{ height: 22, fontSize: 11.5 }}>
                            {p.overdue_tasks} kechikkan
                          </span>
                        )}
                        {p.review_tasks > 0 && (
                          <span className="badge tone-violet" style={{ height: 22, fontSize: 11.5 }}>
                            {p.review_tasks} tekshiruvda
                          </span>
                        )}
                        {p.active_tasks === 0 && p.overdue_tasks === 0 && (
                          <span className="muted small">Vazifalar yo'q</span>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPerson(p);
                        }}
                      >
                        {T.common.open}
                      </Button>
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
            <button key={p.id} className="card person clickable" onClick={() => setSelectedPerson(p)}>
              <div className="row">
                <Avatar user={p} size="lg" />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 650, fontSize: 15 }}>
                    {p.full_name}
                  </div>
                  <div className="small muted ellipsis">{p.department_name || p.specialty || p.role_label}</div>
                </div>
              </div>
              {p.role === "developer" || p.active_tasks || p.done_tasks ? (
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
            </button>
          ))}
        </div>
      )}

      {selectedPerson && <PersonDrawer person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </>
  );
}

function PersonDrawer({ person, onClose }: { person: Person; onClose: () => void }) {
  const { open } = useModal();
  const meta = useMeta();
  const tasks = useQuery({
    queryKey: ["tasks", "person", person.id],
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ assignee: person.id, all: 1 })}`),
    enabled: person.role === "developer",
  });

  return (
    <Drawer
      title={
        <span className="row">
          <Avatar user={person} size="lg" />
          <span className="stack-sm" style={{ gap: 0 }}>
            <b style={{ fontSize: 16 }}>{person.full_name}</b>
            <span className="small muted">{person.department_name || person.specialty || person.role_label}</span>
          </span>
        </span>
      }
      onClose={onClose}
    >
      <div className="stack">
        <div className="grid-3">
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="stat-num">{person.active_tasks}</div>
            <div className="stat-label">{T.dashboard.active}</div>
          </div>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="stat-num" style={{ color: person.overdue_tasks ? "var(--danger)" : undefined }}>
              {person.overdue_tasks}
            </div>
            <div className="stat-label">{T.dashboard.overdue}</div>
          </div>
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="stat-num">{person.done_tasks}</div>
            <div className="stat-label">{T.dashboard.done}</div>
          </div>
        </div>

        {person.role === "developer" && (
          <>
            <div className="section-title">{T.dashboard.personTasks}</div>
            {tasks.isLoading && <Skeleton h={80} />}
            {tasks.data && !tasks.data.length && <p className="muted">{T.tasks.empty}</p>}
            {tasks.data?.map((t) => (
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
      </div>
    </Drawer>
  );
}
