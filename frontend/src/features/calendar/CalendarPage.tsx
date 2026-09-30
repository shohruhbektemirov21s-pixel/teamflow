import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useMemo, useState } from "react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDate, isoDate } from "@/shared/format";
import { TASK_TONE } from "@/shared/status";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Project, Task } from "@/shared/types";
import { Button, ErrorBox } from "@/shared/ui";

const MAX_PER_DAY = 3;

/** Taqvim: vazifalar tugash sanasi bo'yicha oylik ko'rinishda. */
export default function CalendarPage() {
  const me = useMe();
  const { open } = useModal();
  const meta = useMeta();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Oy setkasi: dushanbadan boshlanadi, 6 hafta
  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const range = { due_from: isoDate(days[0]!), due_to: isoDate(days[days.length - 1]!) };
  const query = useQuery({
    queryKey: ["tasks", "calendar", range.due_from, me.role],
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ ...range, all: 1, mine: isManager(me) ? undefined : 1 })}`),
    placeholderData: keepPreviousData,
  });

  // Loyihalar tugash sanasi (serverda rol bo'yicha cheklangan: dasturchi — faqat o'z loyihalari)
  const projectsQuery = useQuery({
    queryKey: ["projects", "calendar", range.due_from],
    queryFn: () => api.get<Project[]>(`/projects/${qs({ end_from: range.due_from, end_to: range.due_to, all: 1 })}`),
    placeholderData: keepPreviousData,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of query.data ?? []) {
      if (!t.due_at) continue;
      const key = isoDate(new Date(t.due_at));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [query.data]);

  const projectsByDay = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projectsQuery.data ?? []) map.set(p.end_date, [...(map.get(p.end_date) ?? []), p]);
    return map;
  }, [projectsQuery.data]);

  const openDay = (key: string) => open({ day: key });

  const today = isoDate(new Date());
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>
            {T.calendar.months[month.getMonth()]} {month.getFullYear()}
          </h1>
          <p>{T.calendar.hint}</p>
        </div>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="←">
          <ChevronLeft />
        </button>
        <Button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>{T.calendar.today}</Button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="→">
          <ChevronRight />
        </button>
      </div>
      {(query.error || projectsQuery.error) && (
        <ErrorBox error={query.error ?? projectsQuery.error} onRetry={() => (query.refetch(), projectsQuery.refetch())} />
      )}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="cal">
          {T.calendar.weekdays.map((w) => (
            <div key={w} className="cal-head">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const key = isoDate(d);
            const items = byDay.get(key) ?? [];
            const ends = projectsByDay.get(key) ?? [];
            // Loyiha muddatlari birinchi, keyin vazifalar; kunda jami MAX_PER_DAY ta belgi
            const taskSlots = Math.max(0, MAX_PER_DAY - ends.length);
            const hidden = Math.max(0, ends.length - MAX_PER_DAY) + Math.max(0, items.length - taskSlots);
            const out = d.getMonth() !== month.getMonth();
            return (
              // Kunning istalgan joyi bosilsa — kun ro'yxati; klaviatura uchun kun raqami tugma
              <div key={key} className={`cal-day ${out ? "out" : ""} ${key === today ? "today" : ""}`} onClick={() => openDay(key)}>
                <button className="cal-num" aria-label={T.calendar.openDay(fmtDate(d))} onClick={(e) => (e.stopPropagation(), openDay(key))}>
                  {d.getDate()}
                </button>
                {ends.slice(0, MAX_PER_DAY).map((p) => (
                  <button
                    key={`p${p.id}`}
                    className="cal-chip cal-chip-project"
                    title={T.calendar.projectEnds(p.name)}
                    onClick={(e) => (e.stopPropagation(), open({ project: p.id }))}
                  >
                    <Flag aria-hidden />
                    <span className="ellipsis">{p.name}</span>
                  </button>
                ))}
                {items.slice(0, taskSlots).map((t) => (
                  <button
                    key={t.id}
                    className={`cal-chip tone-${t.is_overdue ? "danger" : TASK_TONE[t.status]}`}
                    title={`${t.title} · ${meta.label("task_statuses", t.status)}`}
                    onClick={(e) => (e.stopPropagation(), open({ task: t.id }))}
                  >
                    <span className="ellipsis" style={{ display: "block" }}>
                      {t.title}
                    </span>
                  </button>
                ))}
                {hidden > 0 && (
                  <button className="cal-more" onClick={(e) => (e.stopPropagation(), openDay(key))}>
                    {T.calendar.more(hidden)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
