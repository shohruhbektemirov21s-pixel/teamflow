import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Plus } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api, qs } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { Paged, Suggestion } from "@/shared/types";
import { Badge, Button, Empty, ErrorBox, Segmented, SkeletonRows } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

type Status = Suggestion["status"];
export const SUGGESTION_TONE = { pending: "slate", accepted: "success", rejected: "danger" } as const;

export default function SuggestionsPage() {
  const [tab, setTab] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const { open } = useModal();

  const query = useQuery({
    queryKey: ["suggestions", tab, page],
    queryFn: () => api.get<Paged<Suggestion>>(`/suggestions/${qs({ status: tab, page: page === 1 ? undefined : page })}`),
  });
  const items = query.data?.results ?? [];

  return (
    <>
      <div className="page-toolbar">
        <Segmented<Status>
          label={T.suggestions.status}
          value={tab}
          onChange={(value) => { setTab(value); setPage(1); }}
          options={[
            { value: "pending", label: T.suggestions.tabs.pending! },
            { value: "accepted", label: T.suggestions.tabs.accepted! },
            { value: "rejected", label: T.suggestions.tabs.rejected! },
          ]}
        />
        <div className="page-actions">
        <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "suggestion" })}>
          {T.suggestions.new}
        </Button>
        </div>
      </div>

      {query.error ? (
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <div className="card">
          <SkeletonRows rows={3} />
        </div>
      ) : items.length ? (
        <div className="stack">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              className="card card-pad clickable stack-sm"
              style={{ textAlign: "left", font: "inherit", color: "inherit" }}
              onClick={() => open({ suggestion: s.id })}
            >
              <span className="row">
                <b className="grow">{s.title}</b>
                <Badge tone={SUGGESTION_TONE[s.status]}>{T.suggestions.tabs[s.status]}</Badge>
              </span>
              <span className="muted ellipsis" style={{ display: "block" }}>
                {s.body}
              </span>
              <span className="small muted">
                {s.author?.full_name ?? T.suggestions.anonymousAuthor} · {fmtDateTime(s.created_at)} ·{" "}
                {T.suggestions.voteCounts(s.votes_for, s.votes_against)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty
            icon={<Lightbulb />}
            title={T.suggestions.empty}
            hint={T.suggestions.emptyHint}
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => open({ new: "suggestion" })}>
                {T.suggestions.new}
              </Button>
            }
          />
        </div>
      )}
      <Pagination data={query.data} page={page} onPageChange={setPage} />
    </>
  );
}
