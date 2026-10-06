import { ClipboardCheck } from "lucide-react";

import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { Task } from "@/shared/types";
import { Button, CodeTag, Due, Empty, ErrorBox, People, PriorityBadge, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

/** Tekshiruv navbati (PM/Boshliq): dasturchi yuborgan vazifalar. Bosilsa — vazifa modali tekshiruv tabida. */
export default function ReviewPage() {
  const { open } = useModal();
  const query = usePagedList<Task>(["tasks", "review"], "/tasks/", { status: "in_review" });

  return (
    <>
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
      <Pagination data={query.pagination} page={query.page} onPageChange={query.onPageChange} />
    </>
  );
}
