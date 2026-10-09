import { Eye, Plus, Search, Users, X } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { PersonWork } from "./PersonWork";

/** Xodimlar: bitta filtr qatori (qidiruv, vazifa muddati, rol, bo'shlar), kompyuterda jadval, telefonda kartochka. */
export default function PeoplePage() {
  const boss = useMe().role === "boss";
  const { open } = useModal();
  const meta = useMeta();
  const [role, setRole] = useState(boss ? "" : "developer");
  const [onlyFree, setOnlyFree] = useState(false);
  const [q, setQ] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const search = useDebounced(q.trim().toLowerCase());
  const rangeError = Boolean(dueFrom && dueTo && dueTo < dueFrom);
  const hasRange = Boolean((dueFrom || dueTo) && !rangeError);
  const peopleQuery = usePagedList<Person>(["people", role, search, onlyFree, dueFrom, dueTo], "/people/", {
    role, q: search, free: onlyFree ? 1 : undefined,
    due_from: rangeError ? undefined : dueFrom, due_to: rangeError ? undefined : dueTo, paginated: 1,
  }, !rangeError);
  const rows = peopleQuery.data ?? [];
  const dirty = Boolean(q || dueFrom || dueTo || onlyFree || role !== (boss ? "" : "developer"));

  function clear() {
    setQ(""); setDueFrom(""); setDueTo(""); setOnlyFree(false); setRole(boss ? "" : "developer");
  }

  function identity(p: Person) {
    return <div className="stack-sm person-cell">
      <button type="button" className="person-identity" title={T.people.profileOpen} onClick={() => open({ person: p.id })}>
        <Avatar user={p} size="sm" /><span className="stack-sm"><strong>{p.full_name}</strong><span className="small muted">{p.department_name || p.specialty || p.role_label}</span></span>
      </button>
      {p.responsibilities && <p className="person-responsibilities-line small muted" title={p.responsibilities}>{p.responsibilities}</p>}
    </div>;
  }
  function workload(p: Person) {
    return <div className="person-nums">
      {p.is_on_business_trip ? <Badge tone="warning">{T.people.onBusinessTrip}</Badge>
        : p.role === "developer" ? <Badge tone={p.active_tasks ? "info" : "success"}>{p.active_tasks ? T.people.activeN(p.active_tasks) : T.dashboard.free}</Badge>
          : <Badge tone="slate">{p.role_label}</Badge>}
      {p.overdue_tasks > 0 && <Badge tone="danger">{T.people.overdueN(p.overdue_tasks)}</Badge>}
    </div>;
  }
  function actions(p: Person) {
    return <div className="person-actions">
      <Button size="sm" variant="ghost" icon={<Eye size={15} />} onClick={() => open({ person: p.id })}>{T.people.profileOpen}</Button>
      {p.role === "developer" && <Button size="sm" variant="primary" icon={<Plus size={15} />} disabled={p.is_on_business_trip} title={p.is_on_business_trip ? T.people.tripBlocked : undefined} onClick={() => open({ new: "task", assignee: p.id })}>{T.people.giveTask}</Button>}
    </div>;
  }

  return <>
    <div className="card card-pad people-toolbar">
      <div className="people-filters">
        <div className="field people-filter-search">
          <label className="field-label" htmlFor="people-search">{T.filters.search}</label>
          <label className="people-search"><Search size={18} className="muted" /><input id="people-search" type="search" placeholder={T.people.searchPh} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        </div>
        <div className="field people-filter-range">
          <span className="field-label" id="people-due-label">{T.people.dueRange}</span>
          <div className={`input people-range ${rangeError ? "invalid" : ""}`} role="group" aria-labelledby="people-due-label">
            <input type="date" aria-label={T.filters.dateFrom} value={dueFrom} max={dueTo || undefined} onChange={(e) => setDueFrom(e.target.value)} />
            <span className="muted" aria-hidden="true">—</span>
            <input type="date" aria-label={T.filters.dateTo} value={dueTo} min={dueFrom || undefined} aria-invalid={rangeError} onChange={(e) => setDueTo(e.target.value)} />
          </div>
          {rangeError && <span className="field-error" role="alert">{T.people.rangeError}</span>}
        </div>
        {boss && <div className="field people-filter-role">
          <label className="field-label" htmlFor="people-role">{T.people.role}</label>
          <select id="people-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{T.common.all}</option>
            {meta.roles.filter((r) => r.value !== "boss").map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>}
        <label className="check people-filter-free"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />{T.people.onlyFree}</label>
        {dirty && <Button variant="ghost" icon={<X size={16} />} className="people-filter-clear" onClick={clear}>{T.filters.clear}</Button>}
      </div>
      {peopleQuery.data && <p className="small muted people-found" role="status">
        {T.people.found(peopleQuery.pagination?.count ?? 0)}{hasRange && ` · ${T.people.rangeHint}`}
      </p>}
    </div>
    {peopleQuery.error && <ErrorBox error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} />}
    {peopleQuery.isLoading && <div className="card"><SkeletonRows rows={6} /></div>}
    {peopleQuery.data && !rows.length && <div className="card"><Empty icon={<Users />} title={T.people.empty} hint={hasRange ? T.people.emptyRangeHint : T.people.emptyHint} /></div>}
    {rows.length > 0 && <>
      <div className="card people-table"><div className="table-wrap"><table className="table">
        <thead><tr><th>{T.people.col.person}</th><th>{T.people.col.load}</th><th>{hasRange ? T.people.col.inRange : T.people.col.doing}</th><th>{T.people.col.actions}</th></tr></thead>
        <tbody>{rows.map((p) => <tr key={p.id}><td>{identity(p)}</td><td>{workload(p)}</td><td><PersonWork person={p} /></td><td>{actions(p)}</td></tr>)}</tbody>
      </table></div></div>
      <div className="people-grid people-mobile-grid">
        {rows.map((p) => <article key={p.id} className="card card-pad people-person-card">{identity(p)}{workload(p)}<div className="person-card-work"><PersonWork person={p} /></div>{actions(p)}</article>)}
      </div>
    </>}
    <Pagination data={peopleQuery.pagination} page={peopleQuery.page} onPageChange={peopleQuery.onPageChange} />
  </>;
}
