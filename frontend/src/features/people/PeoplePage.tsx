import { Eye, Plus, Search, Users } from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, Segmented, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { PersonWork } from "./PersonWork";

export default function PeoplePage() {
  const boss = useMe().role === "boss";
  const { open } = useModal();
  const meta = useMeta();
  const [role, setRole] = useState(boss ? "" : "developer");
  const [view, setView] = useState<"table" | "grid">("table");
  const [onlyFree, setOnlyFree] = useState(false);
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim().toLowerCase());
  const peopleQuery = usePagedList<Person>(["people", role, search, onlyFree], "/people/",
    { role, q: search, free: onlyFree ? 1 : undefined, paginated: 1 });
  const filtered = peopleQuery.data ?? [];

  function identity(p: Person) {
    return <button type="button" className="person-identity" onClick={() => open({ person: p.id })}>
      <Avatar user={p} size="sm" /><span className="stack-sm"><strong>{p.full_name}</strong><span className="small muted">{p.department_name || p.specialty || p.role_label}</span></span>
    </button>;
  }
  function workload(p: Person) {
    return <div className="person-nums">
      {p.is_on_business_trip ? <Badge tone="warning">{T.people.onBusinessTrip}</Badge> : p.role === "developer" ? <Badge tone={p.active_tasks ? "info" : "success"}>{p.active_tasks ? T.people.activeN(p.active_tasks) : T.dashboard.free}</Badge> : <Badge tone="slate">{p.role_label}</Badge>}
      {p.overdue_tasks > 0 && <Badge tone="danger">{T.people.overdueN(p.overdue_tasks)}</Badge>}
      {p.review_tasks > 0 && <Badge tone="violet">{T.people.reviewN(p.review_tasks)}</Badge>}
      {p.done_tasks > 0 && <Badge tone="success">{T.people.doneN(p.done_tasks)}</Badge>}
    </div>;
  }
  function actions(p: Person) {
    return <div className="person-actions">
      <Button size="sm" icon={<Eye size={15} />} onClick={() => open({ person: p.id })}>{T.people.profileOpen}</Button>
      {p.role === "developer" && <Button size="sm" variant="primary" icon={<Plus size={15} />} disabled={p.is_on_business_trip} title={p.is_on_business_trip ? T.people.tripBlocked : undefined} onClick={() => open({ new: "task", assignee: p.id })}>{T.people.giveTask}</Button>}
    </div>;
  }

  return <>
    <div className="card card-pad people-toolbar">
      <div className="page-toolbar">
        <div className="row-wrap">
          {boss && <Segmented value={role} onChange={setRole} options={[{ value: "", label: T.common.all }, ...meta.roles.filter((r) => r.value !== "boss")]} />}
          <Button aria-pressed={onlyFree} className={onlyFree ? "people-free-selected" : ""} onClick={() => setOnlyFree(!onlyFree)}>{T.people.onlyFree}</Button>
        </div>
        <div className="page-actions"><Segmented value={view} onChange={setView} options={[{ value: "table", label: T.people.viewTable }, { value: "grid", label: T.people.viewGrid }]} /></div>
      </div>
      <div className="row-wrap people-search-row">
        <label className="people-search"><Search size={18} className="muted" /><input type="search" placeholder={T.people.searchPh} aria-label={T.people.searchPh} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {peopleQuery.data && <span className="small muted" role="status">{T.people.found(peopleQuery.pagination?.count ?? 0)}</span>}
      </div>
    </div>
    {peopleQuery.error && <ErrorBox error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} />}
    {peopleQuery.isLoading && <div className="card"><SkeletonRows rows={6} /></div>}
    {peopleQuery.data && !filtered.length && <div className="card"><Empty icon={<Users />} title={T.people.empty} hint={T.people.emptyHint} /></div>}
    {view === "table" && filtered.length > 0 && <div className="card people-table"><div className="table-wrap"><table className="table">
      <thead><tr><th>{T.people.col.person}</th><th>{T.people.col.load}</th><th>{T.people.col.doing}</th><th>{T.people.col.actions}</th></tr></thead>
      <tbody>{filtered.map((p) => <tr key={p.id}><td>{identity(p)}</td><td>{workload(p)}</td><td><PersonWork person={p} /></td><td>{actions(p)}</td></tr>)}</tbody>
    </table></div></div>}
    <div className={`people-grid ${view === "table" ? "people-mobile-grid" : ""}`}>
      {filtered.map((p) => <article key={p.id} className="card card-pad people-person-card">{identity(p)}{workload(p)}<div className="person-card-work"><div className="small muted person-work-label">{T.people.workTitle}</div><PersonWork person={p} /></div>{actions(p)}</article>)}
    </div>
    <Pagination data={peopleQuery.pagination} page={peopleQuery.page} onPageChange={peopleQuery.onPageChange} />
  </>;
}
