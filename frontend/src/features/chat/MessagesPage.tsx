import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, MessageCircle, RotateCw, Search, Send, X } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useMe } from "@/app/auth";
import { api, qs } from "@/shared/api";
import { fmtChatListTime, fmtDateTime, fmtDayLabel, fmtTime, sameDay } from "@/shared/format";
import { useDebounced } from "@/shared/hooks";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import type { ChatConversation, ChatMessage, UserBrief } from "@/shared/types";
import { Avatar, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";

import { CHAT_POLL_FAST_MS, nextChatPollDelay } from "./polling";

/** Yuborilmoqda yoki yuborilmagan (qayta urinish mumkin) xabar — serverda hali yo'q. */
interface PendingMessage {
  key: number;
  partnerId: number;
  text: string;
  failed: boolean;
}

const STICK_THRESHOLD_PX = 80;

/** Xabarlar: chapda suhbatlar (yoki qidiruv natijasi), o'ngda tanlangan suhbat.
 * Telefonda bir vaqtda bittasi ko'rinadi: ro'yxat yoki suhbat ("← Orqaga" bilan).
 * Real-time yo'q — yangi xabarlar tez-tez so'raladi (polling), jim bo'lsa sekinlashadi. */
export default function MessagesPage() {
  const me = useMe();
  const meta = useMeta();
  const qc = useQueryClient();
  const [partner, setPartner] = useState<UserBrief | null>(null);
  const partnerId = partner?.id ?? null;
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const pendingKeyRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const pollDelayRef = useRef(CHAT_POLL_FAST_MS);
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
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const msgsQuery = useQuery({
    queryKey: ["chat", "messages", partnerId],
    queryFn: async () => {
      // Pollingda tarixni qayta yuklamaymiz; har suhbatning keshi alohida.
      const cached = qc.getQueryData<ChatMessage[]>(["chat", "messages", partnerId]) ?? [];
      const after = cached.length ? Math.max(...cached.map((message) => message.id)) : undefined;
      const incoming = await api.get<ChatMessage[]>(`/chat/messages/${qs({ partner: partnerId, after })}`);
      pollDelayRef.current = nextChatPollDelay(pollDelayRef.current, incoming.length > 0);
      if (!incoming.length) return cached;
      return [...cached, ...incoming].slice(-200);
    },
    enabled: Boolean(partnerId),
    refetchInterval: () => pollDelayRef.current,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    pollDelayRef.current = CHAT_POLL_FAST_MS;
    stickRef.current = true;
  }, [partnerId]);

  const partnerPending = pending.filter((item) => item.partnerId === partnerId);

  // Pastga faqat foydalanuvchi pastda bo'lsa yoki o'zi yozgan bo'lsa tushadi — tepada o'qiyotganini bezovta qilmaydi.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [msgsQuery.data, partnerPending.length, partnerId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  };

  const deliver = useCallback(
    async (item: PendingMessage) => {
      try {
        const saved = await api.post<ChatMessage>("/chat/send/", { partner: item.partnerId, text: item.text });
        qc.setQueryData<ChatMessage[]>(["chat", "messages", item.partnerId], (old) =>
          old && old.some((message) => message.id === saved.id) ? old : [...(old ?? []), saved],
        );
        setPending((list) => list.filter((entry) => entry.key !== item.key));
        pollDelayRef.current = CHAT_POLL_FAST_MS;
        qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
      } catch {
        setPending((list) => list.map((entry) => (entry.key === item.key ? { ...entry, failed: true } : entry)));
      }
    },
    [qc],
  );

  const send = () => {
    const value = text.trim();
    if (!value || partnerId === null) return;
    const item: PendingMessage = { key: ++pendingKeyRef.current, partnerId, text: value, failed: false };
    setText("");
    stickRef.current = true;
    setPending((list) => [...list, item]);
    void deliver(item);
  };

  const retry = (item: PendingMessage) => {
    const fresh = { ...item, failed: false };
    setPending((list) => list.map((entry) => (entry.key === item.key ? fresh : entry)));
    void deliver(fresh);
  };

  const discard = (key: number) => setPending((list) => list.filter((entry) => entry.key !== key));

  const conversations = convQuery.data || [];
  const searching = Boolean(query);
  const items = searching
    ? (peopleQuery.data || []).map((person) => ({ person, last: "", lastAt: "", unread: 0, outgoing: false }))
    : conversations.map((c) => ({
        person: c.partner,
        last: c.last_message,
        lastAt: c.last_at,
        unread: c.unread_count,
        outgoing: c.outgoing,
      }));

  const subtitle = (u: UserBrief) => u.department_name || meta.label("roles", u.role);
  const listLoading = searching ? peopleQuery.isLoading : convQuery.isLoading;
  const listError = searching ? peopleQuery.error : convQuery.error;
  const messages = msgsQuery.data ?? [];

  return (
    <div className="card chat" data-open={partner ? "1" : "0"}>
      <div className="chat-list">
        <div className="chat-search">
          <Search />
          <input
            className="input"
            type="search"
            placeholder={T.chat.searchPh}
            aria-label={T.chat.searchPh}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chat-items">
          {listLoading && <SkeletonRows rows={4} />}
          {listError && !listLoading && (
            <ErrorBox error={listError} onRetry={() => (searching ? peopleQuery.refetch() : convQuery.refetch())} />
          )}
          {!listLoading &&
            !listError &&
            items.map(({ person, last, lastAt, unread, outgoing }) => (
              <button
                key={person.id}
                type="button"
                className="chat-item"
                data-unread={unread > 0 ? "1" : "0"}
                aria-current={person.id === partnerId}
                onClick={() => {
                  setPartner(person);
                  setSearch("");
                }}
              >
                <Avatar user={person} size="sm" />
                <span className="chat-item-body">
                  <span className="chat-item-top">
                    <span className="chat-item-name ellipsis">{person.full_name}</span>
                    {lastAt && <time className="chat-item-time" dateTime={lastAt}>{fmtChatListTime(lastAt)}</time>}
                  </span>
                  <span className="chat-item-bottom">
                    <span className="chat-item-last ellipsis">
                      {last ? (outgoing ? T.chat.you : "") + last : subtitle(person)}
                    </span>
                    {unread > 0 && (
                      <span className="count-pill" aria-label={`${unread} ${T.chat.unread}`}>
                        {unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          {!listLoading && !listError && items.length === 0 && (
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
              <div className="chat-head-text">
                <div className="chat-head-name ellipsis">{partner.full_name}</div>
                <div className="small muted ellipsis">{subtitle(partner)}</div>
              </div>
            </div>

            <div className="chat-messages" ref={scrollRef} onScroll={onScroll}>
              {msgsQuery.error && <ErrorBox error={msgsQuery.error} onRetry={() => msgsQuery.refetch()} />}
              {msgsQuery.isLoading && <SkeletonRows rows={3} />}
              {!msgsQuery.isLoading && !msgsQuery.error && messages.length === 0 && partnerPending.length === 0 && (
                <p className="muted small chat-empty">{T.chat.firstMessage}</p>
              )}
              {messages.map((m, index) => {
                const prev = messages[index - 1];
                const newDay = !prev || !sameDay(new Date(prev.created_at), new Date(m.created_at));
                const mine = m.author_id === me.id;
                return (
                  <Fragment key={m.id}>
                    {newDay && <div className="chat-day">{fmtDayLabel(m.created_at)}</div>}
                    <div className={`bubble ${mine ? "mine" : ""}`} title={fmtDateTime(m.created_at)}>
                      <span className="bubble-text">{m.text}</span>
                      <time className="bubble-time" dateTime={m.created_at}>{fmtTime(m.created_at)}</time>
                    </div>
                  </Fragment>
                );
              })}
              {partnerPending.map((item) => (
                <div key={item.key} className="bubble-wrap mine">
                  <div className={`bubble mine pending ${item.failed ? "failed" : ""}`}>
                    <span className="bubble-text">{item.text}</span>
                  </div>
                  {item.failed ? (
                    <div className="bubble-status error" role="alert">
                      <AlertCircle />
                      <span>{T.chat.failed}</span>
                      <button type="button" className="link-btn" onClick={() => retry(item)}>
                        <RotateCw /> {T.chat.retry}
                      </button>
                      <button type="button" className="icon-btn" onClick={() => discard(item.key)} aria-label={T.chat.discard}>
                        <X />
                      </button>
                    </div>
                  ) : (
                    <div className="bubble-status">{T.chat.sending}</div>
                  )}
                </div>
              ))}
            </div>

            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                className="input grow"
                rows={1}
                maxLength={5000}
                placeholder={T.chat.messagePh}
                aria-label={T.chat.messagePh}
                title={T.chat.hint}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary chat-send" disabled={!text.trim()}>
                <Send />
                <span>{T.chat.send}</span>
              </button>
            </form>
          </>
        ) : (
          <Empty icon={<MessageCircle />} title={T.chat.pickTitle} hint={T.chat.pickHint} />
        )}
      </div>
    </div>
  );
}
