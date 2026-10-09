import { UserCheck, Users, MessageCircle, Heart } from "lucide-react";
import { useState } from "react";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { useDebounced } from "@/shared/hooks";
import { T } from "@/shared/text";
import type { PortfolioDeveloper } from "@/shared/types";
import { Avatar, SkeletonRows, Empty, ErrorBox } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";
import { Stars } from "../portfolio/Stars";

export default function UserDashboard() {
  const { open } = useModal();
  const [q] = useState("");
  const search = useDebounced(q.trim());
  const list = usePagedList<PortfolioDeveloper>(["portfolio", "list", search], "/portfolio/", { q: search });
  const rows = list.data ?? [];

  return (
    <div className="instagram-feed stack" style={{ padding: "16px 0", gap: 24 }}>

      {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="card"><SkeletonRows rows={6} /></div>}
      {list.data && !rows.length && <div className="card"><Empty icon={<Users />} title="Hech kim yo'q" /></div>}
      
      {/* Feed Posts */}
      <div className="stack" style={{ gap: 24 }}>
        {rows.map((d) => (
          <div key={d.id} className="card ig-post" style={{ padding: 0, overflow: "hidden", borderRadius: 12 }}>
            {/* Post Header */}
            <div className="row" style={{ padding: "12px 16px", gap: 12, alignItems: "center" }}>
              <Avatar user={d} />
              <div className="grow">
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.full_name}</div>
                <div className="small muted">{d.specialty || "Dasturchi"}</div>
              </div>
              {d.is_following && <span style={{ color: "var(--brand)" }}><UserCheck size={18} /></span>}
            </div>

            {/* Post Image (Dummy or Avatar placeholder) */}
            <div 
              style={{ 
                width: "100%", 
                aspectRatio: "1", 
                backgroundColor: "var(--hov)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                cursor: "pointer"
              }}
              onClick={() => open({ portfolio: d.id })}
            >
              {d.avatar ? (
                <img src={d.avatar} alt={d.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Users size={64} style={{ color: "var(--mut)", opacity: 0.2 }} />
              )}
            </div>

            {/* Post Actions */}
            <div className="stack" style={{ padding: "12px 16px", gap: 8 }}>
              <div className="row" style={{ gap: 16 }}>
                <button className="icon-btn" onClick={() => open({ portfolio: d.id })}>
                  <Heart size={24} />
                </button>
                <button className="icon-btn" onClick={() => open({ portfolio: d.id })}>
                  <MessageCircle size={24} />
                </button>
                <div className="grow" />
                <Stars value={d.rating} />
              </div>
              
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {d.followers_count} {T.portfolio.followersN(d.followers_count).replace(/\d+ /, "")}
              </div>
              
              <div>
                <span style={{ fontWeight: 600, marginRight: 8 }}>{d.full_name}</span>
                <span className="muted">Reyting: {d.rating ? d.rating.toFixed(1) : "Yo'q"} | Loyihalar: {d.projects_count}</span>
              </div>
              
              <button 
                className="text-btn muted small" 
                style={{ textAlign: "left", padding: 0 }}
                onClick={() => open({ portfolio: d.id })}
              >
                Barcha {d.reviews_count} ta sharhni ko'rish va baholash...
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <Pagination data={list.pagination} page={list.page} onPageChange={list.onPageChange} />
    </div>
  );
}
