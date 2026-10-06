import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { api } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { T } from "@/shared/text";
import type { SuggestionDetail } from "@/shared/types";
import { Badge, Button, Callout, ConfirmButton, ErrorBox, Field, Modal, Skeleton, useToast } from "@/shared/ui";

import { SUGGESTION_TONE } from "./SuggestionsPage";

export default function SuggestionModal({ id }: { id: number }) {
  const { close } = useModal();
  const qc = useQueryClient();
  const toast = useToast();
  const [bossNote, setBossNote] = useState("");

  const query = useQuery({
    queryKey: ["suggestion", id],
    queryFn: () => api.get<SuggestionDetail>(`/suggestions/${id}/`),
  });
  const s = query.data;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["suggestion", id] });
    qc.invalidateQueries({ queryKey: ["suggestions"] });
  };
  const onError = (err: Error) => toast(err.message || T.common.errorGeneric, "error");

  const voteM = useMutation({
    mutationFn: (kind: "for" | "against" | "remove") =>
      kind === "remove" ? api.del(`/suggestions/${id}/remove_vote/`) : api.post(`/suggestions/${id}/vote/`, { kind }),
    onSuccess: () => {
      refresh();
      toast(T.suggestions.votedToast);
    },
    onError,
  });

  const decideM = useMutation({
    mutationFn: (status: "accepted" | "rejected") => api.post(`/suggestions/${id}/decide/`, { status, boss_note: bossNote }),
    onSuccess: () => {
      refresh();
      toast(T.suggestions.decidedToast);
    },
    onError,
  });

  const deleteM = useMutation({
    mutationFn: () => api.del(`/suggestions/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast(T.suggestions.deletedToast);
      close();
    },
    onError,
  });

  const footer = s && (s.actions.decide || s.actions.delete) && (
    <>
      {s.actions.delete && (
        <ConfirmButton onConfirm={() => deleteM.mutate()} loading={deleteM.isPending}>
          <Trash2 size={16} /> {T.common.delete}
        </ConfirmButton>
      )}
      {s.actions.decide && <Button variant="danger" icon={<X />} loading={decideM.isPending && decideM.variables === "rejected"} disabled={decideM.isPending} onClick={() => decideM.mutate("rejected")}>
        {T.suggestions.reject}
      </Button>}
      <div className="spacer" />
      {s.actions.decide && (
        <>
          <Button variant="primary" icon={<Check />} loading={decideM.isPending && decideM.variables === "accepted"} disabled={decideM.isPending} onClick={() => decideM.mutate("accepted")}>
            {T.suggestions.accept}
          </Button>
        </>
      )}
    </>
  );

  return (
    <Modal
      title={s?.title ?? T.suggestions.title}
      subtitle={s && `${s.author?.full_name ?? T.suggestions.anonymousAuthor} · ${fmtDateTime(s.created_at)}`}
      headerExtra={s && <Badge tone={SUGGESTION_TONE[s.status]}>{T.suggestions.tabs[s.status]}</Badge>}
      onClose={close}
      footer={footer || undefined}
    >
      {query.error ? (
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
      ) : !s ? (
        <div className="stack">
          <Skeleton h={32} />
          <Skeleton h={100} />
        </div>
      ) : (
        <div className="stack">
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{s.body}</p>

          {s.status !== "pending" && (
            <Callout tone={SUGGESTION_TONE[s.status] === "success" ? "success" : "danger"}>
              <b>{T.suggestions.bossDecision}</b>
              {s.decided_by && ` · ${s.decided_by.full_name}`}
              {s.decided_at && ` · ${fmtDateTime(s.decided_at)}`}
              {s.boss_note && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{s.boss_note}</p>}
            </Callout>
          )}

          {s.actions.vote ? (
            <div className="row-wrap">
              <Button
                variant={s.my_vote === "for" ? "primary" : "default"}
                icon={<ThumbsUp />}
                aria-pressed={s.my_vote === "for"}
                disabled={voteM.isPending}
                onClick={() => voteM.mutate(s.my_vote === "for" ? "remove" : "for")}
              >
                {T.suggestions.voteFor} · {s.votes_for}
              </Button>
              <Button
                variant={s.my_vote === "against" ? "danger" : "default"}
                icon={<ThumbsDown />}
                aria-pressed={s.my_vote === "against"}
                disabled={voteM.isPending}
                onClick={() => voteM.mutate(s.my_vote === "against" ? "remove" : "against")}
              >
                {T.suggestions.voteAgainst} · {s.votes_against}
              </Button>
            </div>
          ) : (
            <span className="small muted">{T.suggestions.voteCounts(s.votes_for, s.votes_against)}</span>
          )}

          {s.actions.decide && (
            <Field label={T.suggestions.bossNote}>
              {(fid) => (
                <textarea id={fid} className="textarea" rows={3} placeholder={T.suggestions.bossNotePh} value={bossNote} onChange={(e) => setBossNote(e.target.value)} />
              )}
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
}
