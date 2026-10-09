import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FolderKanban, Grid3x3, History, Play, Plus, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { PortfolioDetail, PortfolioItem } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, Modal, Skeleton, Tabs, useToast } from "@/shared/ui";

import { PortfolioItemForm, PortfolioItemView } from "./PortfolioItem";
import { Stars } from "./Stars";

type Tab = "grid" | "history";

/**
 * "Portfolio" modali (bitta modal, ichida 3 ko'rinish — modal ustida modal yo'q):
 * dasturchi sahifasi → loyiha (`item`) → yangi loyiha formasi (`add`). Loyiha va forma "Orqaga" bilan qaytadi.
 * Ko'rinishi Instagram profiliga o'xshaydi: profil sarlavhasi, sonlar, loyihalar kvadrat setkada.
 */
export default function PortfolioModal({ id, item, add }: { id: number; item?: number; add?: boolean }) {
  if (add) return <PortfolioItemForm ownerId={id} />;
  if (item) return <PortfolioItemView id={item} />;
  return <PortfolioOverview id={id} />;
}

function PortfolioOverview({ id }: { id: number }) {
  const { open, close } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [tab, setTab] = useState<Tab>("grid");
  const query = useQuery({ queryKey: ["portfolio", "detail", id], queryFn: () => api.get<PortfolioDetail>(`/portfolio/${id}/`) });
  const data = query.data;
  const follow = useMutation({
    mutationFn: (on: boolean) => (on ? api.post(`/portfolio/${id}/follow/`) : api.del(`/portfolio/${id}/follow/`)),
    onSuccess: (_, on) => {
      toast(on ? T.portfolio.followedToast : T.portfolio.unfollowedToast);
      void refresh();
    },
    onError: (e) => toast(e.message, "error"),
  });

  // Boshqalarga asosiy amal — "Kuzatish"; egasiga "Loyiha qo'shish" setkadagi "+" katakda.
  const footer = data?.actions.follow ? (
    <>
      <span className="spacer" />
      {data.is_following ? (
        <Button icon={<UserCheck size={16} />} loading={follow.isPending} onClick={() => follow.mutate(false)}>
          {T.portfolio.unfollow}
        </Button>
      ) : (
        <Button variant="primary" icon={<UserPlus size={16} />} loading={follow.isPending} onClick={() => follow.mutate(true)}>
          {T.portfolio.follow}
        </Button>
      )}
    </>
  ) : undefined;

  const hasHistory = Boolean(data && (data.years.length || data.recent_tasks.length));

  return (
    <Modal title={T.portfolio.title} size="lg" onClose={close} footer={footer}>
      {query.isLoading && <Skeleton h={220} />}
      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <div className="stack" style={{ gap: 24 }}>
          <ProfileTop data={data} />

          <div className="ig-tabs">
            {hasHistory && (
              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { key: "grid", label: <><Grid3x3 size={16} /> {T.portfolio.tabs.grid}</> },
                  { key: "history", label: <><History size={16} /> {T.portfolio.tabs.history}</> },
                ]}
              />
            )}
            {tab === "grid" || !hasHistory ? (
              <ProjectGrid data={data} onOpen={(itemId) => open({ portfolio: id, item: itemId })} onAdd={() => open({ portfolio: id, add: true })} />
            ) : (
              <HistoryTab data={data} />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Instagram profili kabi: katta avatar, ism, sonlar qatori va qisqa "bio". */
function ProfileTop({ data }: { data: PortfolioDetail }) {
  const { open } = useModal();
  const avatar = data.avatar;
  const counts = [
    { value: data.projects_count, label: T.portfolio.counts.projects },
    { value: data.followers_count, label: T.portfolio.counts.followers },
    { value: data.tasks_done, label: T.portfolio.counts.tasks },
  ];
  return (
    <header className="ig-profile">
      {avatar ? (
        // Rasm bosilsa — katta ko'rinishda ochiladi (profil oynalaridagi kabi)
        <button type="button" className="avatar-btn ig-avatar" aria-label={T.people.photoOpen}
          onClick={() => open({ photo: data.id, name: data.full_name, src: avatar })}>
          <Avatar user={data} size="xl" card={false} />
        </button>
      ) : (
        <span className="ig-avatar"><Avatar user={data} size="xl" card={false} /></span>
      )}
      <div className="ig-profile-main">
        <div className="row-wrap" style={{ gap: 8 }}>
          <h2 className="ig-name">{data.full_name}</h2>
          {data.is_following && <Badge tone="info" dot={false}><UserCheck size={13} /> {T.portfolio.following}</Badge>}
        </div>
        <ul className="ig-counts">
          {counts.map((c) => (
            <li key={c.label}><b>{c.value}</b> {c.label}</li>
          ))}
        </ul>
        <div className="ig-bio">
          <b>{data.specialty || T.portfolio.developer}</b>
          <Stars value={data.rating} count={data.reviews_count} size={14} />
          <span className="small muted">{T.portfolio.bio(T.portfolio.experience(data.experience.months), fmtDate(data.experience.since))}</span>
        </div>
      </div>
    </header>
  );
}

function ProjectGrid({ data, onOpen, onAdd }: { data: PortfolioDetail; onOpen: (id: number) => void; onAdd: () => void }) {
  if (!data.items.length && !data.actions.add)
    return <div className="card"><Empty icon={<FolderKanban />} title={T.portfolio.projectsEmpty} hint={T.portfolio.projectsEmptyOther} /></div>;
  return (
    <div className="stack-sm">
      {!data.items.length && <p className="small muted" style={{ margin: 0 }}>{T.portfolio.projectsEmptyOwner}</p>}
      <div className="ig-grid">
        {data.items.map((i) => <Tile key={i.id} item={i} onOpen={() => onOpen(i.id)} />)}
        {data.actions.add && (
          <button type="button" className="ig-tile ig-tile-add" onClick={onAdd}>
            <Plus size={28} aria-hidden />
            <span>{T.portfolio.add}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Setkadagi kvadrat: muqova rasmi (yo'q bo'lsa rangli fon), pastda nomi va bahosi, videosi bo'lsa belgi. */
function Tile({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  return (
    <button type="button" className={`ig-tile tone-${TILE_TONES[item.id % TILE_TONES.length]} ${item.cover ? "has-cover" : ""}`} onClick={onOpen} aria-label={T.portfolio.tileLabel(item.title)}>
      {item.cover && <img src={item.cover} alt="" loading="lazy" />}
      {item.videos_count > 0 && (
        <span className="ig-tile-badge" title={T.portfolio.hasVideo}><Play size={14} aria-hidden /></span>
      )}
      <span className="ig-tile-caption">
        <b className="ig-tile-title">{item.title}</b>
        {item.rating !== null && <Stars value={item.rating} count={item.reviews_count} size={12} />}
      </span>
    </button>
  );
}

const TILE_TONES = ["violet", "info", "success", "warning"] as const;

function HistoryTab({ data }: { data: PortfolioDetail }) {
  return (
    <div className="stack" style={{ gap: 24 }}>
      {data.years.length > 0 && (
        <section>
          <h3 className="section-title">{T.portfolio.years}</h3>
          <div className="card">
            {data.years.map((y) => (
              <div key={y.year} className="list-row" style={{ padding: "12px 16px" }}>
                <b style={{ minWidth: 48 }}>{y.year}</b>
                <span className="small muted">{T.portfolio.yearRow(y.projects, y.tasks)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.recent_tasks.length > 0 && (
        <section>
          <h3 className="section-title">{T.portfolio.recentTasks}</h3>
          <div className="card">
            {data.recent_tasks.map((t) => (
              <div key={t.id} className="list-row" style={{ padding: "12px 16px" }}>
                <CheckCircle2 size={18} style={{ color: "var(--success)", flex: "none" }} aria-hidden />
                <span className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <span className="ellipsis" style={{ fontWeight: 600 }}>{t.title}</span>
                  <span className="small muted ellipsis">{t.project}</span>
                </span>
                {t.completed_at && <span className="small muted nowrap">{fmtDate(t.completed_at)}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
