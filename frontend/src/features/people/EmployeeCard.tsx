import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Trophy,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useModal } from "@/app/modals";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Person } from "@/shared/types";
import { Avatar, Badge, Button, Due, StageBadge } from "@/shared/ui";

interface EmployeeCardProps {
  person: Person;
  hasRange?: boolean;
}

/** Circular progress indicator for employee workload (exact mockup matching) */
function CircularProgress({ activeCount }: { activeCount: number }) {
  const percent =
    activeCount === 0
      ? 0
      : activeCount === 1
        ? 35
        : activeCount === 2
          ? 70
          : activeCount === 3
            ? 85
            : 100;

  const size = 36;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color =
    percent === 0
      ? "var(--success)"
      : percent <= 40
        ? "var(--info)"
        : percent <= 85
          ? "var(--success)"
          : "var(--danger)";

  return (
    <div className="employee-progress-wrap" title={`Bandlik: ${percent}%`}>
      <div className="employee-progress-ring">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--border)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span className="employee-progress-pct">{percent}%</span>
      </div>
      <span className="employee-progress-label">Bandlik</span>
    </div>
  );
}

export function EmployeeCard({ person: p, hasRange = false }: EmployeeCardProps) {
  const { open } = useModal();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Odatiy holatda bajarilgan vazifalar bu sahifada ko'rsatilmaydi; muddat filtri bo'lsa — shu muddatdagilar
  const rawWork = p.work ?? [];
  const displayTasks = hasRange ? rawWork : rawWork.filter((t) => t.status !== "done");

  const totalTasks = hasRange ? p.range_tasks ?? displayTasks.length : p.active_tasks;
  const visibleTasks = displayTasks.slice(0, 3);
  const hasMore = totalTasks > 1;

  const projects = p.projects ?? [];
  const activeProjects = projects.filter((prj) => prj.stage !== "done");
  const fallbackProject = displayTasks.length === 0 ? activeProjects[0] : undefined;

  function renderStatusPill(task: (typeof rawWork)[0]) {
    if (task.is_overdue) {
      return <span className="employee-status-badge status-overdue">{T.dashboard.overdue}</span>;
    }
    if (task.status === "in_progress") {
      return <span className="employee-status-badge status-progress">Jarayonda</span>;
    }
    if (task.status === "control") {
      return <span className="employee-status-badge status-control">Nazoratda</span>;
    }
    if (task.status === "in_review") {
      return <span className="employee-status-badge status-review">Tekshiruvda</span>;
    }
    if (task.status === "done") {
      return <span className="employee-status-badge status-done">Bajarildi</span>;
    }
    return <span className="employee-status-badge status-default">{task.status}</span>;
  }

  // Jamoa va tajriba matnlari
  const teamName = p.specialty
    ? `${p.specialty} jamoasi`
    : p.department_name
      ? `${p.department_name} jamoasi`
      : "Backend jamoasi";

  // Mas'ul loyihalar (Boshliq/PM kiritadi) — karta tepasida qisqa qator; yo'q bo'lsa pill ko'rsatilmaydi
  const expInfo = p.responsible_projects?.length ? T.people.responsible.line(p.responsible_projects) : "";

  return (
    <article className="card employee-card" key={p.id}>
      {/* ─── 1. Karta yuqori qismi (Header) ─── */}
      <div className="employee-card-header">
        {/* Chap taraf: Avatar, ism, lavozim, jamoa va tajriba pillari */}
        <div className="employee-header-left">
          <div className="employee-avatar-wrap">
            <Avatar user={p} />
            <span
              className={`employee-status-dot ${p.is_on_business_trip ? "trip" : "online"}`}
              title={p.is_on_business_trip ? T.people.onBusinessTrip : "Faol xodim"}
            />
          </div>
          <div className="employee-info">
            <div className="employee-name-row">
              <button
                type="button"
                className="employee-name-btn"
                onClick={() => open({ person: p.id })}
                title={T.people.profileOpen}
              >
                <strong>{p.full_name}</strong>
              </button>
              <span className="employee-online-dot" title="Online" />
              {p.is_on_business_trip && (
                <Badge tone="warning">{T.people.onBusinessTrip}</Badge>
              )}
            </div>
            <div className="employee-meta-row">
              <span className="employee-role">
                {p.department_name || (p.specialty ? `${p.specialty} dasturchi` : p.role_label)}
              </span>
            </div>
          </div>
          <div className="employee-pills-group">
            <span className="employee-team-pill">{teamName}</span>
            {expInfo && <span className="employee-exp-pill" title={expInfo}>{expInfo}</span>}
          </div>
        </div>

        {/* O'rta qism: faol vazifalar, kechikkan, circular progress */}
        <div className="employee-header-center">
          <div className="employee-metric-item">
            <Briefcase size={17} className="employee-metric-icon text-primary" />
            <div className="employee-metric-copy">
              <strong className="employee-metric-num">{p.active_tasks}</strong>
              <span className="employee-metric-label">Faol vazifalar</span>
            </div>
          </div>
          <div className={`employee-metric-item ${p.overdue_tasks > 0 ? "danger" : ""}`}>
            <Clock size={17} className={`employee-metric-icon ${p.overdue_tasks > 0 ? "text-danger" : "muted"}`} />
            <div className="employee-metric-copy">
              <strong className="employee-metric-num">{p.overdue_tasks}</strong>
              <span className="employee-metric-label">Kechikkan</span>
            </div>
          </div>
          <CircularProgress activeCount={p.active_tasks} />
        </div>

        {/* O'ng taraf: Amallar va 3 nuqta menyu */}
        <div className="employee-header-actions">
          <Button
            size="sm"
            variant="ghost"
            icon={<User size={15} />}
            aria-label={T.people.profileOpen}
            onClick={() => open({ person: p.id })}
            className="employee-action-profile-btn"
          >
            Profil
          </Button>

          {p.role === "developer" && (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={15} />}
              disabled={p.is_on_business_trip}
              title={p.is_on_business_trip ? T.people.tripBlocked : undefined}
              onClick={() => open({ new: "task", assignee: p.id })}
              className="employee-action-task-btn"
            >
              {T.people.giveTask}
            </Button>
          )}

          {/* Uch nuqtali qo'shimcha menyu */}
          <div className="employee-dropdown-wrap" ref={menuRef}>
            <button
              type="button"
              className="employee-dots-btn"
              aria-label="Qo'shimcha amallar"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="employee-dropdown-menu" role="menu">
                <button
                  type="button"
                  className="employee-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    open({ person: p.id });
                  }}
                >
                  <User size={14} />
                  <span>Profilni ochish</span>
                </button>
                {p.role === "developer" && !p.is_on_business_trip && (
                  <button
                    type="button"
                    className="employee-dropdown-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      open({ new: "task", assignee: p.id });
                    }}
                  >
                    <Plus size={14} />
                    <span>Vazifa biriktirish</span>
                  </button>
                )}
                <button
                  type="button"
                  className="employee-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/xabarlar");
                  }}
                >
                  <MessageCircle size={14} />
                  <span>Xabarlar (Chat)</span>
                </button>
                <button
                  type="button"
                  className="employee-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    open({ portfolio: p.id });
                  }}
                >
                  <Trophy size={14} />
                  <span>Portfolio ko'rish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. Karta pastki qismi: Vazifalar jadvali (Mockupdagi kabi) ─── */}
      <div className="employee-tasks-section">
        {/* Jadval ustunlari sarlavhasi */}
        <div className="employee-tasks-header-row">
          <span className="col-title">{T.people.col.tasks}</span>
          <span className="col-project">Loyiha</span>
          <span className="col-status">{hasRange ? T.people.col.inRange : T.people.col.doing}</span>
          <span className="col-due">{T.filters.due}</span>
          <span className="col-actions"></span>
        </div>

        {/* Vazifalar qatorlari */}
        {visibleTasks.length > 0 ? (
          <div className="employee-tasks-list">
            {visibleTasks.map((t) => (
              <div key={t.id} className="employee-task-row">
                {/* 1. Vazifa nomi */}
                <div className="col-title">
                  <FileText size={15} className="employee-task-icon" />
                  <button
                    type="button"
                    className="employee-task-link"
                    onClick={() => open({ task: t.id })}
                  >
                    <span>{t.title}</span>
                  </button>
                </div>

                {/* 2. Loyiha */}
                <div className="col-project">
                  {t.project ? (
                    <button
                      type="button"
                      className="employee-project-pill-btn"
                      onClick={() => open({ project: t.project!.id })}
                    >
                      <span className="employee-project-badge">{t.project.code} · {t.project.name}</span>
                    </button>
                  ) : (
                    <span className="employee-project-badge">{T.tasks.noProject}</span>
                  )}
                </div>

                {/* 3. Holat */}
                <div className="col-status">
                  {renderStatusPill(t)}
                </div>

                {/* 4. Muddat */}
                <div className="col-due">
                  <Calendar size={14} className="employee-due-icon" />
                  <Due value={t.due_at} done={false} format={fmtDate} />
                </div>

                {/* 5. Amallar */}
                <div className="col-actions">
                  <button
                    type="button"
                    className="employee-task-dots-btn"
                    onClick={() => open({ task: t.id })}
                    aria-label="Vazifa amallari"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : fallbackProject ? (
          <div className="employee-task-row fallback-project-row">
            <div className="col-title">
              <button
                type="button"
                className="employee-project-link"
                onClick={() => open({ project: fallbackProject.id })}
              >
                <FolderKanban size={15} className="muted" />
                <span className="person-work-title">{fallbackProject.name}</span>
                <span className="muted">{fallbackProject.code}</span>
              </button>
            </div>
            <div className="col-project">
              <span className="employee-project-badge">{fallbackProject.code}</span>
            </div>
            <div className="col-status">
              <StageBadge stage={fallbackProject.stage} />
            </div>
            <div className="col-due">
              <Calendar size={14} className="employee-due-icon" />
              <Due value={fallbackProject.end_date} done={fallbackProject.stage === "done"} format={fmtDate} />
            </div>
            <div className="col-actions"></div>
          </div>
        ) : (
          <div className="employee-empty-work">
            <CheckCircle2 size={16} className="text-success" />
            <span className="small muted">Hozirda faol vazifalar yo'q. Xodim bo'sh</span>
          </div>
        )}

        {/* 3 tadan ko'p bo'lsa: "Yana N ta ish — profilda" */}
        {hasMore && (
          <div className="employee-more-bar">
            <button
              type="button"
              className="person-work-more employee-more-btn"
              onClick={() => open({ person: p.id })}
            >
              <span>{T.people.moreWork(totalTasks - 1)}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
