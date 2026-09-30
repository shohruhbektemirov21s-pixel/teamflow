import { useQuery } from "@tanstack/react-query";
import { FileText, FolderKanban, ListChecks, Search, User } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { type ModalTarget, useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { OrderStatus, ProjectStage, TaskStatus } from "@/shared/types";
import { CodeTag, OrderStatusBadge, StageBadge, TaskStatusBadge } from "@/shared/ui";

interface Results {
  tasks: { id: number; code: string; title: string; status: TaskStatus; project: string }[];
  projects: { id: number; code: string; name: string; stage: ProjectStage }[];
  orders: { id: number; title: string; status: OrderStatus }[];
  people: { id: number; full_name: string; role_label: string }[];
}

interface Item {
  key: string;
  icon: typeof Search;
  code?: string;
  title: string;
  sub?: string;
  badge?: ReactNode;
  go: () => void;
}

/** Ctrl K — tezkor qidiruv. Natija tanlansa, tegishli modal ochiladi. */
export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { open } = useModal();
  const navigate = useNavigate();

  const debounced = useDebounced(q.trim(), 200);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.get<Results>(`/search/${qs({ q: debounced })}`),
    enabled: debounced.length >= 2,
  });

  const go = (target: ModalTarget) => {
    onClose();
    open(target);
  };

  const groups = useMemo(() => {
    if (!data) return [];
    const g: { key: string; items: Item[] }[] = [
      {
        key: "tasks",
        items: data.tasks.map((t) => ({ key: `t${t.id}`, icon: ListChecks, code: t.code, title: t.title, sub: t.project, badge: <TaskStatusBadge status={t.status} />, go: () => go({ task: t.id }) })),
      },
      {
        key: "projects",
        items: data.projects.map((p) => ({ key: `p${p.id}`, icon: FolderKanban, code: p.code, title: p.name, badge: <StageBadge stage={p.stage} />, go: () => go({ project: p.id }) })),
      },
      {
        key: "orders",
        items: data.orders.map((o) => ({ key: `o${o.id}`, icon: FileText, title: o.title, badge: <OrderStatusBadge status={o.status} />, go: () => go({ order: o.id }) })),
      },
      {
        key: "people",
        items: data.people.map((p) => ({
          key: `u${p.id}`,
          icon: User,
          title: p.full_name,
          sub: p.role_label,
          go: () => {
            onClose();
            navigate(`/vazifalar${qs({ assignee: p.id, assignee_label: p.full_name })}`);
          },
        })),
      },
    ];
    return g.filter((x) => x.items.length);
  }, [data]);

  const flat = groups.flatMap((g) => g.items);
  useEffect(() => setActive(0), [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, flat.length - 1)));
      else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
      else if (e.key === "Enter" && flat[active]) flat[active]!.go();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flat, active, onClose]);

  let index = -1;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-modal="true" aria-label={T.search.title}>
        <div className="palette-input">
          <Search className="muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={T.search.placeholder} aria-label={T.search.title} />
          <kbd>Esc</kbd>
        </div>
        <div className="modal-body" style={{ padding: 8, maxHeight: "60vh" }}>
          {debounced.length < 2 ? (
            <p className="muted small" style={{ padding: 12 }}>{T.search.min}</p>
          ) : !isFetching && !flat.length ? (
            <p className="muted small" style={{ padding: 12 }}>{T.search.empty}</p>
          ) : (
            groups.map((g) => (
              <div key={g.key} style={{ marginBottom: 6 }}>
                <div className="section-title" style={{ padding: "8px 12px 4px", margin: 0 }}>{T.search.groups[g.key]}</div>
                {g.items.map((it) => {
                  index += 1;
                  const i = index;
                  return (
                    <button key={it.key} className={`palette-item ${i === active ? "active" : ""}`} onMouseEnter={() => setActive(i)} onClick={it.go}>
                      <it.icon size={16} className="muted" />
                      <span className="grow ellipsis">
                        {it.code && <><CodeTag code={it.code} /> </>}
                        <b style={{ fontWeight: 600 }}>{it.title}</b>
                        {it.sub && <span className="muted small"> · {it.sub}</span>}
                      </span>
                      {it.badge}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
