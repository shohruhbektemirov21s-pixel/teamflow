import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { useState } from "react";

import { useRefresh } from "@/app/queries";
import { api, qs } from "@/shared/api";
import { timeAgo } from "@/shared/format";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { CommentItem } from "@/shared/types";
import { Avatar, Button, Empty, ErrorBox, Skeleton, useToast } from "@/shared/ui";

/** Buyurtma, loyiha yoki vazifaga izohlar. Boshliq ham shu yerda izoh qoldiradi. */
export function Comments({ type, id, readOnly = false }: { type: "order" | "project" | "task"; id: number; readOnly?: boolean }) {
  const key = ["comments", type, id];
  const query = useQuery({ queryKey: key, queryFn: () => api.get<CommentItem[]>(`/comments/${qs({ target_type: type, target_id: id })}`) });
  const [text, setText] = useState("");
  const toast = useToast();
  const refresh = useRefresh();
  const meta = useMeta();

  const send = useMutation({
    mutationFn: () => api.post("/comments/", { target_type: type, target_id: id, text }),
    onSuccess: () => {
      setText("");
      refresh();
    },
    onError: (e: Error) => toast(e.message, "error"),
  });

  return (
    <div className="stack">
      {query.isLoading && <Skeleton h={60} />}
      {query.error && <ErrorBox error={query.error} />}
      {query.data && !query.data.length && <Empty icon={<MessageSquare />} title={T.comments.empty} />}
      {query.data?.map((c) => (
        <div key={c.id} className="comment">
          <Avatar user={c.author} size="sm" />
          <div className="comment-bubble">
            <div className="row small">
              <b>{c.author.full_name}</b>
              <span className="muted">· {meta.label("roles", c.author.role)}</span>
              <span className="spacer" />
              <span className="muted">{timeAgo(c.created_at)}</span>
            </div>
            <div className="prose" style={{ marginTop: 4, color: "var(--text)" }}>
              {c.text}
            </div>
          </div>
        </div>
      ))}
      {!readOnly && <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate();
        }}
      >
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          placeholder={T.comments.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && text.trim()) send.mutate();
          }}
          aria-label={T.common.comments}
        />
        <div className="row">
          <span className="small muted">Ctrl + Enter</span>
          <span className="spacer" />
          <Button type="submit" variant="primary" size="sm" icon={<Send />} loading={send.isPending} disabled={!text.trim()}>
            {T.comments.send}
          </Button>
        </div>
      </form>}
    </div>
  );
}
