import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";

import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { Task } from "@/shared/types";
import { Button, CodeTag, Due, Empty, ErrorBox, People, PriorityBadge, SkeletonRows } from "@/shared/ui";

/** Tekshiruv navbati (PM/Boshliq): dasturchi yuborgan vazifalar. Bosilsa — vazifa modali tekshiruv tabida. */
export default function ReviewPage() {
  const { open } = useModal();
  const query = useQuery({
    queryKey: ["tasks", "review"],
    queryFn: () => api.get<Task[]>(`/tasks/${qs({ status: "in_review", all: 1 })}`),
  });

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1>{T.review.title}</h1>
          {query.data && <p>{T.common.count(query.data.length)}</p>}
        </div>
      </div>
      <div className="card">
        {query.error && (
          <div className="card-pad">
            <ErrorBox error={query.error} onRetry={() => query.refetch()} />
          </div>
        )}
        {query.isLoading && <SkeletonRows />}
        {query.data && !query.data.length && <Empty icon={<ClipboardCheck />} title={T.review.empty} hint={T.review.emptyHint} />}
        {query.data?.map((t) => (
          <div
            key={t.id}
            className="list-row clickable"
            style={{ flexWrap: "wrap" }}
            onClick={() => open({ task: t.id })}
          >
            <div className="grow" style={{ minWidth: 240 }}>
              <div className="task-title">
                <CodeTag code={t.code} /> {t.title}
              </div>
              <div className="small muted">{t.project.name}</div>
            </div>
            <PriorityBadge priority={t.priority} />
            <div style={{ minWidth: 160 }}>
              <People users={t.assignees} />
            </div>
            <div style={{ minWidth: 140 }}>
              <Due value={t.due_at} format={fmtDateTime} />
            </div>
            <Button variant="primary" size="sm" onClick={(e) => (e.stopPropagation(), open({ task: t.id }))}>
              {T.review.open}
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
