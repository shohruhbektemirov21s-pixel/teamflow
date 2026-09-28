import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { SuggestionDetail } from "@/shared/types";
import { Badge, Button, ErrorBox, Modal, Skeleton, useToast } from "@/shared/ui";

export default function SuggestionModal({ id }: { id: number }) {
  const { close } = useModal();
  const qc = useQueryClient();
  const toast = useToast();
  const [bossNote, setBossNote] = useState("");

  const { data: s, isLoading, error } = useQuery<SuggestionDetail>({
    queryKey: ["suggestion", id],
    queryFn: () => api.get<SuggestionDetail>(`/api/suggestions/${id}/`),
  });

  const voteM = useMutation({
    mutationFn: async (kind: "for" | "against" | "remove") => {
      if (kind === "remove") {
        await api.del(`/api/suggestions/${id}/remove_vote/`);
      } else {
        await api.post(`/api/suggestions/${id}/vote/`, { kind });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestion", id] });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast(T.suggestions.votedToast, "ok");
    },
  });

  const decideM = useMutation({
    mutationFn: async (status: "accepted" | "rejected") => {
      await api.post(`/api/suggestions/${id}/decide/`, { status, boss_note: bossNote });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestion", id] });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast(T.suggestions.decidedToast, "ok");
    },
  });

  return (
    <Modal title={T.suggestions.title} onClose={close}>
      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !s ? (
        <div className="stack">
          <Skeleton h={32} />
          <Skeleton h={100} />
        </div>
      ) : (
        <div className="stack">
          <div className="row spread">
            <h3>{s.title}</h3>
            <Badge tone={s.status === "accepted" ? "success" : s.status === "rejected" ? "danger" : "slate"}>
              {T.suggestions.tabs[s.status]}
            </Badge>
          </div>
          
          <div className="row hint xs">
            <span>{s.is_anonymous ? T.suggestions.anonymousAuthor : s.author?.full_name || T.suggestions.anonymousAuthor}</span>
            <span>•</span>
            <span>{fmtDateTime(s.created_at)}</span>
          </div>

          <div className="card surface stack-sm">
            <p className="whitespace-pre-wrap">{s.body}</p>
          </div>

          {(s.status !== "pending" && s.boss_note) && (
            <div className="card surface-alt stack-sm">
              <div className="row xs hint">
                <strong>{T.suggestions.bossDecision}</strong> • {s.decided_by?.full_name} • {fmtDateTime(s.decided_at)}
              </div>
              <p className="whitespace-pre-wrap">{s.boss_note}</p>
            </div>
          )}

          {s.actions.vote && (
            <div className="row mt-2">
              <Button
                variant={s.my_vote === "for" ? "primary" : "ghost"}
                onClick={() => voteM.mutate(s.my_vote === "for" ? "remove" : "for")}
                disabled={voteM.isPending}
              >
                <ThumbsUp className="icon" /> {s.votes_for}
              </Button>
              <Button
                variant={s.my_vote === "against" ? "danger" : "ghost"}
                onClick={() => voteM.mutate(s.my_vote === "against" ? "remove" : "against")}
                disabled={voteM.isPending}
              >
                <ThumbsDown className="icon" /> {s.votes_against}
              </Button>
            </div>
          )}

          {s.actions.decide && s.status === "pending" && (
            <div className="stack mt-2 border-t pt-2">
              <div className="field">
                <label>{T.suggestions.bossNote}</label>
                <textarea
                  className="input"
                  rows={2}
                  value={bossNote}
                  onChange={(e) => setBossNote(e.target.value)}
                />
              </div>
              <div className="row end">
                <Button variant="danger" onClick={() => decideM.mutate("rejected")} disabled={decideM.isPending}>
                  {T.suggestions.reject}
                </Button>
                <Button variant="primary" onClick={() => decideM.mutate("accepted")} disabled={decideM.isPending}>
                  {T.suggestions.accept}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
