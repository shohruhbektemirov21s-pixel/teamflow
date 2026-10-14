import { ArrowUpDown, LayoutGrid, List, Search, Users, X } from "lucide-react";
import { useRef, useState } from "react";

import { useMe } from "@/app/auth";
import { usePagedList } from "@/app/queries";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { PeopleSummary, Person } from "@/shared/types";
import { Button, Dropdown, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { type PeopleView, PersonCard } from "./PersonCard";

type StateKey = "all" | "active" | "free";
type SortKey = "name" | "free" | "overdue";

const VIEW_KEY = "people-view";
const STATES: { key: StateKey; dot?: string }[] = [{ key: "all" }, { key: "active", dot: "info" }, { key: "free", dot: "success" }];

/** Ko'rinish tanlovi faqat shu brauzerda eslab qolinadi (qulaylik uchun; saqlanmasa ham sahifa ishlaydi). */
function savedView(): PeopleView {
  try { return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list"; } catch { return "list"; }
}

/** Xodimlar: sarlavha, qidiruv, holat chiplari (Barchasi / Faol / Bo'sh), saralash, ro'yxat/kartalar ko'rinishi,
 * vazifa muddati oralig'i va rol filtri. Telefonda kartochkalar ustma-ust turadi. */
export default function PeoplePage() {
  const boss = useMe().role === "boss";
  const meta = useMeta();
  const defaultRole = boss ? "" : "developer";
  const [role, setRole] = useState(defaultRole);
  const [state, setState] = useState<StateKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setViewState] = useState<PeopleView>(savedView);
  const [q, setQ] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const search = useDebounced(q.trim().toLowerCase());
  const rangeError = Boolean(dueFrom && dueTo && dueTo < dueFrom);
  const hasRange = Boolean((dueFrom || dueTo) && !rangeError);
  const peopleQuery = usePagedList<Person, { summary?: PeopleSummary }>(["people", role, search, state, sort, dueFrom, dueTo], "/people/", {
    role, q: search, state: state === "all" ? undefined : state, sort: sort === "name" ? undefined : sort,
    due_from: rangeError ? undefined : dueFrom, due_to: rangeError ? undefined : dueTo, paginated: 1,
  }, !rangeError);
  const rows = peopleQuery.data ?? [];
  const dirty = Boolean(q || dueFrom || dueTo || state !== "all" || role !== defaultRole);

  // Chip sonlari holat almashganda yo'qolib qolmasin: oxirgi kelgan son saqlanadi
  const lastSummary = useRef<PeopleSummary | undefined>(undefined);
  if (peopleQuery.pagination?.summary) lastSummary.current = peopleQuery.pagination.summary;
  const summary = lastSummary.current;

  function setView(next: PeopleView) {
    setViewState(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* saqlanmasa ham ishlayveradi */ }
  }
  function clear() {
    setQ(""); setDueFrom(""); setDueTo(""); setState("all"); setRole(defaultRole);
  }

  return <div className="stack">
    <div className="uhead"><div className="uhead-text">
      <h1 className="uhead-title">{T.people.pageTitle}</h1>
      <p className="uhead-sub muted">{T.people.pageHint}</p>
    </div></div>

    <div className="card card-pad people-toolbar">
      <div className="people-bar">
        <label className="people-search people-bar-search">
          <Search size={18} className="muted" aria-hidden />
          <input type="search" aria-label={T.filters.search} placeholder={T.people.searchPh} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="uchips" role="group" aria-label={T.people.stateLabel}>
          {STATES.map(({ key, dot }) => <button key={key} type="button" className="uchip" aria-pressed={state === key} onClick={() => setState(key)}>
            {dot && <span className={`uchip-dot uchip-dot-${dot}`} aria-hidden />}
            {T.people.state[key]}
            <span className="uchip-n">{summary ? summary[key] : "–"}</span>
          </button>)}
        </div>
        <Dropdown<SortKey>
          className="usort people-sort"
          ariaLabel={T.people.sortLabel}
          prefix={T.people.sortPrefix}
          icon={<ArrowUpDown size={18} aria-hidden />}
          value={sort}
          onChange={setSort}
          options={(Object.keys(T.people.sort) as SortKey[]).map((key) => ({ value: key, label: T.people.sort[key] }))}
        />
        <div className="uview-toggle people-view" role="group" aria-label={T.people.viewLabel}>
          <button type="button" aria-pressed={view === "list"} aria-label={T.people.viewList} title={T.people.viewList} onClick={() => setView("list")}><List size={18} aria-hidden /></button>
          <button type="button" aria-pressed={view === "grid"} aria-label={T.people.viewGrid} title={T.people.viewGrid} onClick={() => setView("grid")}><LayoutGrid size={18} aria-hidden /></button>
        </div>
      </div>
      <div className="people-filters">
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
        {dirty && <Button variant="ghost" icon={<X size={16} />} className="people-filter-clear" onClick={clear}>{T.filters.clear}</Button>}
      </div>
      {peopleQuery.data && <p className="small muted people-found" role="status">
        {T.people.found(peopleQuery.pagination?.count ?? 0)}{hasRange && ` · ${T.people.rangeHint}`}
      </p>}
    </div>

    {peopleQuery.error && <ErrorBox error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} />}
    {peopleQuery.isLoading && <div className="card"><SkeletonRows rows={6} /></div>}
    {peopleQuery.data && !rows.length && <div className="card"><Empty icon={<Users />} title={T.people.empty} hint={hasRange ? T.people.emptyRangeHint : T.people.emptyHint} /></div>}
    {rows.length > 0 && <div className={`people-cards ${view}`}>
      {view === "list" && <div className="people-colhead" aria-hidden>
        <span>{T.people.col.person}</span><span>{T.people.col.load}</span><span>{hasRange ? T.people.col.inRange : T.people.col.doing}</span>
      </div>}
      {rows.map((p) => <PersonCard key={p.id} person={p} view={view} hasRange={hasRange} />)}
    </div>}
    <Pagination data={peopleQuery.pagination} page={peopleQuery.page} onPageChange={peopleQuery.onPageChange} />
  </div>;
}
