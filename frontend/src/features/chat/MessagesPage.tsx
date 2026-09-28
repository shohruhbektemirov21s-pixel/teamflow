import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { useMe } from "@/app/auth";
import { api } from "@/shared/api";
import { Avatar, Button, SkeletonRows } from "@/shared/ui";
import { Search } from "lucide-react";

export default function MessagesPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Users we can chat with
  const peopleQuery = useQuery({
    queryKey: ["chat", "people", search],
    queryFn: () => api.get<any[]>(`/chat/people/?q=${search}`),
  });

  // Conversations
  const convQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => api.get<any[]>("/chat/conversations/"),
    refetchInterval: 5000,
  });

  // Messages with partner
  const msgsQuery = useQuery({
    queryKey: ["chat", "messages", partnerId],
    queryFn: () => api.get<any[]>(`/chat/messages/?partner=${partnerId}`),
    enabled: Boolean(partnerId),
    refetchInterval: 3000,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgsQuery.data]);

  const [text, setText] = useState("");
  const sendMut = useMutation({
    mutationFn: () => api.post("/chat/send/", { partner: partnerId, text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["chat", "messages", partnerId] });
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });

  const allPeople = peopleQuery.data || [];
  const conversations = convQuery.data || [];

  // Combine people to show in sidebar
  const sidebarItems = search 
    ? allPeople
    : conversations.map(c => ({...c.partner, last_message: c.last_message, unread: c.unread_count}));

  // Find active partner details
  const activePartner = partnerId 
    ? (allPeople.find(p => p.id === partnerId) || conversations.find(c => c.partner.id === partnerId)?.partner)
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
                    {p.last_message || p.role_label}
                  </div>
                </div>
                {p.unread > 0 && <span className="badge badge-primary">{p.unread}</span>}
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
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{activePartner.specialty || activePartner.role_label}</div>
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
