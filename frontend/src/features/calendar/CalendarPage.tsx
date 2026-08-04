import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { isManager, useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { isoDate } from "@/shared/format";
import { TASK_TONE } from "@/shared/status";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { Task } from "@/shared/types";
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

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of query.data ?? []) {
      if (!t.due_at) continue;
      const key = isoDate(new Date(t.due_at));
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [query.data]);

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
      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
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
            const out = d.getMonth() !== month.getMonth();
            return (
              <div key={key} className={`cal-day ${out ? "out" : ""} ${key === today ? "today" : ""}`}>
                <span className="cal-num">{d.getDate()}</span>
                {items.slice(0, MAX_PER_DAY).map((t) => (
                  <button
                    key={t.id}
                    className={`cal-chip tone-${t.is_overdue ? "danger" : TASK_TONE[t.status]}`}
                    title={`${t.title} · ${meta.label("task_statuses", t.status)}`}
                    onClick={() => open({ task: t.id })}
                  >
                    <span className="ellipsis" style={{ display: "block" }}>
                      {t.title}
                    </span>
                  </button>
                ))}
                {items.length > MAX_PER_DAY && (
                  <span className="small muted" style={{ paddingLeft: 4 }}>
                    {T.calendar.more(items.length - MAX_PER_DAY)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
