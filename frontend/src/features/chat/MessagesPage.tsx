import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Search, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useMe } from "@/app/auth";
import { api, qs } from "@/shared/api";
import { fmtDateTime } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { ChatConversation, ChatMessage, UserBrief } from "@/shared/types";
import { Avatar, Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";

/** Xabarlar: chapda suhbatlar (yoki qidiruv natijasi), o'ngda tanlangan suhbat.
 * Telefonda bir vaqtda bittasi ko'rinadi: ro'yxat yoki suhbat ("← Orqaga" bilan). */
export default function MessagesPage() {
  const me = useMe();
  const meta = useMeta();
  const qc = useQueryClient();
  const [partner, setPartner] = useState<UserBrief | null>(null);
  const partnerId = partner?.id ?? null;
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const query = useDebounced(search.trim());

  const peopleQuery = useQuery({
    queryKey: ["chat", "people", query],
    queryFn: () => api.get<UserBrief[]>(`/chat/people/${qs({ q: query })}`),
    enabled: Boolean(query),
  });

  const convQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => api.get<ChatConversation[]>("/chat/conversations/"),
    enabled: !query,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const msgsQuery = useQuery({
    queryKey: ["chat", "messages", partnerId],
    queryFn: async () => {
      // Pollingda tarixni qayta yuklamaymiz; har suhbatning keshi alohida.
      const cached = qc.getQueryData<ChatMessage[]>(["chat", "messages", partnerId]) ?? [];
      const after = cached.length ? Math.max(...cached.map((message) => message.id)) : undefined;
      const incoming = await api.get<ChatMessage[]>(`/chat/messages/${qs({ partner: partnerId, after })}`);
      if (!incoming.length) return cached;
      return [...cached, ...incoming].slice(-200);
    },
    enabled: Boolean(partnerId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsQuery.data]);

  const sendMut = useMutation({
    mutationFn: () => api.post<ChatMessage>("/chat/send/", { partner: partnerId, text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat", "messages", partnerId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });

  const conversations = convQuery.data || [];
  const searching = Boolean(query);
  const items = searching
    ? (peopleQuery.data || []).map((person) => ({ person, last: "", unread: 0 }))
    : conversations.map((c) => ({ person: c.partner, last: c.last_message, unread: c.unread_count }));

  const subtitle = (u: UserBrief) => u.department_name || meta.label("roles", u.role);
  const listLoading = searching ? peopleQuery.isLoading : convQuery.isLoading;

  return (
    <div className="card chat" data-open={partner ? "1" : "0"}>
      <div className="chat-list">
        <div className="chat-search">
          <Search />
          <input
            className="input"
            placeholder={T.chat.searchPh}
            aria-label={T.chat.searchPh}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chat-items">
          {listLoading && <SkeletonRows rows={4} />}
          {!listLoading &&
            items.map(({ person, last, unread }) => (
              <button
                key={person.id}
                type="button"
                className="chat-item"
                aria-current={person.id === partnerId}
                onClick={() => {
                  setPartner(person);
                  setSearch("");
                }}
              >
                <Avatar user={person} size="sm" />
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block", fontWeight: 600 }}>
                    {person.full_name}
                  </span>
                  <span className="small muted ellipsis" style={{ display: "block" }}>
                    {last || subtitle(person)}
                  </span>
                </span>
                {unread > 0 && <span className="count-pill">{unread}</span>}
              </button>
            ))}
          {!listLoading && items.length === 0 && (
            <Empty
              icon={<MessageCircle />}
              title={searching ? T.chat.notFound : T.chat.noConversations}
              hint={searching ? undefined : T.chat.noConversationsHint}
            />
          )}
        </div>
      </div>

      <div className="chat-main">
        {partner ? (
          <>
            <div className="chat-head">
              <button type="button" className="icon-btn mobile-only" onClick={() => setPartner(null)} aria-label={T.common.back}>
                <ArrowLeft />
              </button>
              <Avatar user={partner} size="sm" />
              <div>
                <div style={{ fontWeight: 600 }}>{partner.full_name}</div>
                <div className="small muted">{subtitle(partner)}</div>
              </div>
            </div>

            <div className="chat-messages">
              {msgsQuery.error && <ErrorBox error={msgsQuery.error} onRetry={() => msgsQuery.refetch()} />}
              {msgsQuery.isLoading && <SkeletonRows rows={3} />}
              {msgsQuery.data?.length === 0 && <p className="muted small" style={{ textAlign: "center" }}>{T.chat.firstMessage}</p>}
              {msgsQuery.data?.map((m) => (
                <div key={m.id} className={`bubble ${m.author_id === me.id ? "mine" : ""}`} title={fmtDateTime(m.created_at)}>
                  {m.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) sendMut.mutate();
              }}
            >
              <input
                className="input grow"
                placeholder={T.chat.messagePh}
                aria-label={T.chat.messagePh}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
              <Button variant="primary" type="submit" icon={<Send />} loading={sendMut.isPending} disabled={!text.trim()}>
                {T.chat.send}
              </Button>
            </form>
          </>
        ) : (
          <Empty icon={<MessageCircle />} title={T.chat.pickTitle} hint={T.chat.pickHint} />
        )}
      </div>
    </div>
  );
}
