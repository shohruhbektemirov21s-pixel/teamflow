import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { useMe } from "@/app/auth";
import { api } from "@/shared/api";
import { Avatar, Button, SkeletonRows } from "@/shared/ui";
import type { ChatConversation, ChatMessage, UserBrief } from "@/shared/types";
import { Search } from "lucide-react";

export default function MessagesPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const peopleQuery = useQuery({
    queryKey: ["chat", "people", search],
    queryFn: () => api.get<UserBrief[]>(`/chat/people/?q=${search}`),
  });

  const convQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => api.get<ChatConversation[]>("/chat/conversations/"),
    refetchInterval: 5000,
  });

  const msgsQuery = useQuery({
    queryKey: ["chat", "messages", partnerId],
    queryFn: () => api.get<ChatMessage[]>(`/chat/messages/?partner=${partnerId}`),
    enabled: Boolean(partnerId),
    refetchInterval: 3000,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsQuery.data]);

  const [text, setText] = useState("");
  const sendMut = useMutation({
    mutationFn: () => api.post<ChatMessage>("/chat/send/", { partner: partnerId, text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat", "messages", partnerId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });

  const allPeople = peopleQuery.data || [];
  const conversations = convQuery.data || [];

  const sidebarItems = search 
    ? allPeople.map((person) => ({ ...person, last_message: "", unread_count: 0 }))
    : conversations.map((conversation) => ({
        ...conversation.partner,
        last_message: conversation.last_message,
        unread_count: conversation.unread_count,
      }));

  const activePartner = partnerId 
    ? (allPeople.find((person) => person.id === partnerId) || conversations.find((conversation) => conversation.partner.id === partnerId)?.partner)
    : null;

  return (
    <div className="card row" style={{ height: "calc(100vh - 120px)", padding: 0, overflow: "hidden", alignItems: "stretch" }}>
      <div style={{ width: 320, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Ism bo'yicha qidirish..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="input" 
              style={{ border: "none", background: "transparent", padding: 0, height: "100%", width: "100%", outline: "none" }} 
            />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {sidebarItems.map((p) => {
            const isActive = p.id === partnerId;
            return (
              <button 
                key={p.id} 
                onClick={() => { setPartnerId(p.id); setSearch(""); }}
                style={{ 
                  display: "flex", alignItems: "center", width: "100%", padding: "12px 16px",
                  border: "none", background: isActive ? "var(--accent-soft)" : "transparent",
                  textAlign: "left", cursor: "pointer", borderBottom: "1px solid var(--border-soft)", gap: 12
                }}
              >
                <Avatar user={p} size="sm" />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.full_name}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.last_message || p.role}
                  </div>
                </div>
                {p.unread_count > 0 && <span className="badge badge-primary">{p.unread_count}</span>}
              </button>
            );
          })}
          {sidebarItems.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>Topilmadi</div>}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-inset)" }}>
        {activePartner ? (
          <>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "var(--bg)" }}>
              <Avatar user={activePartner} size="sm" />
              <div>
                <div style={{ fontWeight: 600 }}>{activePartner.full_name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{activePartner.role}</div>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {msgsQuery.isLoading ? <SkeletonRows rows={3} /> : (
                msgsQuery.data?.map(m => {
                  const isMe = m.author_id === me.id;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ 
                        background: isMe ? "var(--accent)" : "var(--bg)", 
                        color: isMe ? "#fff" : "inherit",
                        padding: "8px 14px", 
                        borderRadius: 16,
                        borderBottomRightRadius: isMe ? 4 : 16,
                        borderBottomLeftRadius: isMe ? 16 : 4,
                        maxWidth: "70%",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        border: isMe ? "none" : "1px solid var(--border)"
                      }}>
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form 
              onSubmit={e => { e.preventDefault(); if (text.trim()) sendMut.mutate(); }}
              style={{ padding: 16, borderTop: "1px solid var(--border)", background: "var(--bg)", display: "flex", gap: 12 }}
            >
              <input 
                type="text" 
                className="input grow" 
                placeholder="Xabar yozing..." 
                value={text} 
                onChange={e => setText(e.target.value)} 
                autoFocus
              />
              <Button variant="primary" type="submit" disabled={!text.trim() || sendMut.isPending}>
                Yuborish
              </Button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            Suhbatni boshlash uchun chap tomondan xodimni tanlang
          </div>
        )}
      </div>
    </div>
  );
}
