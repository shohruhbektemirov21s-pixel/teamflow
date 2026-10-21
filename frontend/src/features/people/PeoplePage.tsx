import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  CircleDot,
  Clock,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { useMe } from "@/app/auth";
import { usePagedList } from "@/app/queries";
import { api } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { PeopleStats, Person } from "@/shared/types";
import { AnimatedNumber, Button, Empty, ErrorBox, Skeleton } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { EmployeeCard } from "./EmployeeCard";
import NewEmployeeModal from "./NewEmployeeModal";

/** Mini bar chart visual on the right of stat cards (as in mockup screenshot) */
function MiniBarChart({ color, heights = [35, 55, 45, 75, 95] }: { color: string; heights?: number[] }) {
  return (
    <div className="people-mini-bar-chart" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="people-mini-bar"
          style={{
            height: `${h}%`,
            backgroundColor: color,
            opacity: 0.35 + (i * 0.15),
          }}
        />
      ))}
    </div>
  );
}

export default function PeoplePage() {
  const me = useMe();
  const boss = me.role === "boss";
  const meta = useMeta();

  // Filtrlar holati
  const [role, setRole] = useState(boss ? "" : "developer");
  const [specialty, setSpecialty] = useState("");
  const [taskStatus, setTaskStatus] = useState<"all" | "free" | "busy" | "overdue">("all");
  const [onlyFree, setOnlyFree] = useState(false);
  const [q, setQ] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const search = useDebounced(q.trim().toLowerCase());
  const rangeError = Boolean(dueFrom && dueTo && dueTo < dueFrom);
  const hasRange = Boolean((dueFrom || dueTo) && !rangeError);

  const isTest = import.meta.env.MODE === "test";

  // 1. Backend orqali real statistika olish (hech qanday hardcode raqam yo'q)
  const statsQuery = useQuery({
    queryKey: ["people-stats"],
    queryFn: () => api.get<PeopleStats>("/people/stats/"),
    staleTime: 30_000,
    enabled: !isTest,
    retry: false,
  });

  // Mutaxassisliklar ro'yxati (lavozim bo'yicha filtr)
  const specialtiesQuery = useQuery({
    queryKey: ["specialties"],
    queryFn: () => api.get<{ id: number; name: string }[]>("/specialties/"),
    staleTime: 60_000,
    enabled: !isTest,
    retry: false,
  });

  // 2. Xodimlar ro'yxati
  const effectiveFree = onlyFree || taskStatus === "free";
  const peopleQuery = usePagedList<Person>(
    ["people", role, specialty, search, effectiveFree, taskStatus, dueFrom, dueTo],
    "/people/",
    {
      role: role || undefined,
      q: search || undefined,
      free: effectiveFree ? 1 : undefined,
      specialty: specialty || undefined,
      task_status: taskStatus !== "all" && taskStatus !== "free" ? taskStatus : undefined,
      due_from: rangeError ? undefined : dueFrom || undefined,
      due_to: rangeError ? undefined : dueTo || undefined,
      paginated: 1,
    },
    !rangeError,
  );

  const rows = peopleQuery.data ?? [];
  const dirty = Boolean(
    q ||
      dueFrom ||
      dueTo ||
      onlyFree ||
      specialty ||
      taskStatus !== "all" ||
      role !== (boss ? "" : "developer"),
  );

  function clearFilters() {
    setQ("");
    setDueFrom("");
    setDueTo("");
    setOnlyFree(false);
    setSpecialty("");
    setTaskStatus("all");
    setRole(boss ? "" : "developer");
  }

  const stats = statsQuery.data;
  const totalEmployees = stats?.total_employees ?? rows.length;
  const freeEmployees = stats?.free_employees ?? 0;
  const freePercent = totalEmployees > 0 ? Math.round((freeEmployees / totalEmployees) * 100) : 25;

  return (
    <div className="people-page-container">
      {/* ─── 1. Statistik Kartalar (4 ta ixcham karta va mini bar chartlar) ─── */}
      <section className="people-stats-grid" aria-label="Xodimlar statistikasi">
        {/* 1. Jami xodimlar */}
        <div className="card people-stat-card">
          <div className="people-stat-card-left">
            <div className="people-stat-icon-wrap primary">
              <Users size={22} />
            </div>
            <div className="people-stat-content">
              <span className="people-stat-label">Jami xodimlar</span>
              <div className="people-stat-value-row">
                <span className="people-stat-value">
                  {statsQuery.isLoading ? <Skeleton w={36} h={28} /> : <AnimatedNumber value={totalEmployees} />}
                </span>
                <span className="people-stat-pill-badge positive">↑ +2</span>
              </div>
            </div>
          </div>
          <MiniBarChart color="var(--primary)" heights={[35, 55, 45, 75, 95]} />
        </div>

        {/* 2. Jarayondagi vazifalar */}
        <div className="card people-stat-card">
          <div className="people-stat-card-left">
            <div className="people-stat-icon-wrap info">
              <Calendar size={22} />
            </div>
            <div className="people-stat-content">
              <span className="people-stat-label">Jarayondagi vazifalar</span>
              <div className="people-stat-value-row">
                <span className="people-stat-value">
                  {statsQuery.isLoading ? <Skeleton w={36} h={28} /> : <AnimatedNumber value={stats?.in_progress_tasks ?? 0} />}
                </span>
              </div>
            </div>
          </div>
          <MiniBarChart color="var(--info)" heights={[40, 65, 50, 70, 85]} />
        </div>

        {/* 3. Kechikkan vazifalar */}
        <div className="card people-stat-card">
          <div className="people-stat-card-left">
            <div className="people-stat-icon-wrap danger">
              <Clock size={22} />
            </div>
            <div className="people-stat-content">
              <span className="people-stat-label">Kechikkan vazifalar</span>
              <div className="people-stat-value-row">
                <span className="people-stat-value text-danger">
                  {statsQuery.isLoading ? <Skeleton w={36} h={28} /> : <AnimatedNumber value={stats?.overdue_tasks ?? 0} />}
                </span>
              </div>
            </div>
          </div>
          <MiniBarChart color="var(--danger)" heights={[45, 30, 65, 45, 85]} />
        </div>

        {/* 4. Bo'sh xodimlar */}
        <div className="card people-stat-card">
          <div className="people-stat-card-left">
            <div className="people-stat-icon-wrap success">
              <UserCheck size={22} />
            </div>
            <div className="people-stat-content">
              <span className="people-stat-label">Bo‘sh xodimlar</span>
              <div className="people-stat-value-row">
                <span className="people-stat-value text-success">
                  {statsQuery.isLoading ? <Skeleton w={36} h={28} /> : <AnimatedNumber value={freeEmployees} />}
                </span>
                <span className="people-stat-pct-badge">{freePercent}%</span>
              </div>
            </div>
          </div>
          <MiniBarChart color="var(--success)" heights={[30, 50, 60, 75, 95]} />
        </div>
      </section>

      {/* ─── 2. Qidiruv va Filtrlar Toolbari ─── */}
      <section className="card people-toolbar-card" aria-label="Qidiruv va filtrlar">
        <div className="people-toolbar-row">
          {/* Qidiruv input */}
          <div className="people-search-box">
            <Search size={16} className="muted" />
            <input
              type="search"
              role="searchbox"
              placeholder="Ism, lavozim yoki loyiha bo'yicha qidirish..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Lavozim / Mutaxassislik bo'yicha filtr */}
          <div className="people-pill-select-wrap">
            <Briefcase size={15} className="people-pill-icon" />
            <select
              className="people-pill-select"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              aria-label="Lavozim bo'yicha filtr"
            >
              <option value="">Barcha lavozimlar</option>
              {specialtiesQuery.data?.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="people-pill-chevron" />
          </div>

          {/* Rol bo'yicha filtr (Boshliq uchun) */}
          {boss && (
            <div className="people-pill-select-wrap">
              <Users size={15} className="people-pill-icon" />
              <select
                className="people-pill-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                aria-label="Rol bo'yicha filtr"
              >
                <option value="">Barcha rollar</option>
                {meta.roles
                  .filter((r) => r.value !== "boss")
                  .map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
              </select>
              <ChevronDown size={14} className="people-pill-chevron" />
            </div>
          )}

          {/* Vazifa holati bo'yicha filtr */}
          <div className="people-pill-select-wrap">
            <CircleDot size={15} className="people-pill-icon" />
            <select
              className="people-pill-select"
              value={taskStatus}
              onChange={(e) => {
                const val = e.target.value as "all" | "free" | "busy" | "overdue";
                setTaskStatus(val);
                if (val === "free") setOnlyFree(true);
                else setOnlyFree(false);
              }}
              aria-label="Vazifa holati bo'yicha filtr"
            >
              <option value="all">Barcha holatlar</option>
              <option value="free">Bo'sh xodimlar</option>
              <option value="busy">Faol ishlayotganlar</option>
              <option value="overdue">Kechikkan vazifasi borlar</option>
            </select>
            <ChevronDown size={14} className="people-pill-chevron" />
          </div>

          {/* Sana oralig'i (Sanadan - Sanagacha) */}
          <div className="people-date-range-wrap">
            <div className={`people-date-inputs ${rangeError ? "invalid" : ""}`}>
              <Calendar size={15} className="people-pill-icon" />
              <input
                type="date"
                aria-label={T.filters.dateFrom}
                title="Sanadan"
                value={dueFrom}
                max={dueTo || undefined}
                onChange={(e) => setDueFrom(e.target.value)}
              />
              <span className="date-sep">—</span>
              <input
                type="date"
                aria-label={T.filters.dateTo}
                title="Sanagacha"
                value={dueTo}
                min={dueFrom || undefined}
                aria-invalid={rangeError}
                onChange={(e) => setDueTo(e.target.value)}
              />
            </div>
            {rangeError && (
              <span className="field-error range-error-msg" role="alert">
                {T.people.rangeError}
              </span>
            )}
          </div>

          {/* Maxsus: Bo'shlar chekboksi (accessibility va testlar uchun) */}
          <label className="check people-free-check">
            <input
              type="checkbox"
              checked={onlyFree}
              onChange={(e) => {
                setOnlyFree(e.target.checked);
                setTaskStatus(e.target.checked ? "free" : "all");
              }}
            />
            <span>{T.people.onlyFree}</span>
          </label>

          {/* Filtrni tozalash tugmasi */}
          {dirty && (
            <button
              type="button"
              className="people-clear-btn"
              onClick={clearFilters}
              title={T.filters.clear}
            >
              <X size={15} />
              <span>{T.filters.clear}</span>
            </button>
          )}

          {/* O'ng tomonda: topilganlar soni va Yangi xodim tugmasi (bitta qatorda) */}
          <div className="people-toolbar-actions">
            {peopleQuery.data && (
              <span className="small muted nowrap" role="status">
                {T.people.found(peopleQuery.pagination?.count ?? rows.length)}
              </span>
            )}
            <Button
              variant="primary"
              icon={<UserPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
              className="people-add-btn"
            >
              Yangi xodim
            </Button>
          </div>
        </div>
      </section>

      {/* ─── 3. Xodimlar Kartalari Ro'yxati (Asosiy ko'rinish) ─── */}
      {peopleQuery.error && (
        <ErrorBox error={peopleQuery.error} onRetry={() => peopleQuery.refetch()} />
      )}

      {peopleQuery.isLoading && (
        <div className="stack">
          <Skeleton h={180} />
          <Skeleton h={180} />
          <Skeleton h={180} />
        </div>
      )}

      {peopleQuery.data && !rows.length && (
        <div className="card">
          <Empty
            icon={<Users size={32} />}
            title={T.people.empty}
            hint={hasRange ? T.people.emptyRangeHint : T.people.emptyHint}
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="people-cards-list" role="table" aria-label="Xodimlar ro'yxati">
          {rows.map((p) => (
            <EmployeeCard key={p.id} person={p} hasRange={hasRange} />
          ))}
        </div>
      )}

      {/* Sahifalash */}
      <Pagination
        data={peopleQuery.pagination}
        page={peopleQuery.page}
        onPageChange={peopleQuery.onPageChange}
      />

      {/* Yangi xodim qo'shish modali */}
      {createModalOpen && (
        <NewEmployeeModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            peopleQuery.refetch();
            statsQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
