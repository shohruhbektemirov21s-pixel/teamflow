import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { Suggestion } from "@/shared/types";
import { Badge, Button, Empty, ErrorBox, Segmented, Skeleton } from "@/shared/ui";

export default function SuggestionsPage() {
  const [tab, setTab] = useState<"pending" | "accepted" | "rejected">("pending");
  const { open } = useModal();

  const { data, isLoading, error } = useQuery<Suggestion[]>({
    queryKey: ["suggestions", tab],
    queryFn: () => api.get<Suggestion[]>(`/api/suggestions/?status=${tab}`),
  });

  return (
    <div className="page">
      <div className="row spread">
        <h2>{T.suggestions.title}</h2>
        <Button variant="primary" onClick={() => open({ new: "suggestion" })}>
          <Plus className="icon" /> {T.suggestions.new}
        </Button>
      </div>

      <Segmented
        options={[
          { value: "pending", label: T.suggestions.tabs.pending },
          { value: "accepted", label: T.suggestions.tabs.accepted },
          { value: "rejected", label: T.suggestions.tabs.rejected },
        ]}
        value={tab}
        onChange={(v) => setTab(v as any)}
      />

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading ? (
        <div className="stack">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} h={100} />
          ))}
        </div>
      ) : data?.length ? (
        <div className="stack">
          {data.map((s) => (
            <div key={s.id} className="card interactive stack-sm" onClick={() => open({ suggestion: s.id })}>
              <div className="row spread">
                <h4>{s.title}</h4>
                <Badge
                  tone={s.status === "accepted" ? "success" : s.status === "rejected" ? "danger" : "slate"}
                >
                  {T.suggestions.tabs[s.status]}
                </Badge>
              </div>
              <p className="hint line-clamp">{s.body}</p>
              <div className="row hint xs">
                <span>{s.is_anonymous ? T.suggestions.anonymousAuthor : s.author?.full_name || T.suggestions.anonymousAuthor}</span>
                <span>•</span>
                <span>{fmtDateTime(s.created_at)}</span>
                <span>•</span>
                <span>{T.suggestions.votes}: {s.votes_for} {T.suggestions.voteFor.toLowerCase()}, {s.votes_against} {T.suggestions.voteAgainst.toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={<Plus />} title={T.suggestions.empty} hint={T.suggestions.emptyHint} />
      )}
    </div>
  );
}
