import { useMutation, useQuery } from "@tanstack/react-query";
import { Briefcase, CheckCircle2, FolderKanban, Link2, Plus, Trophy, UserCheck, UserPlus, Users, Video } from "lucide-react";
import type { ReactNode } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { ProfileHeader } from "@/features/people/ProfileHeader";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";
import type { PortfolioDetail, PortfolioItem } from "@/shared/types";
import { Badge, Button, CodeTag, Empty, ErrorBox, Modal, Skeleton, useToast } from "@/shared/ui";

import { periodText } from "./period";
import { PortfolioItemForm, PortfolioItemView } from "./PortfolioItem";
import { Stars } from "./Stars";

/**
 * "Portfolio" modali (bitta modal, ichida 3 ko'rinish — modal ustida modal yo'q):
 * dasturchi sahifasi → loyiha (`item`) → yangi loyiha formasi (`add`). Loyiha va forma "Orqaga" bilan qaytadi.
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

  // Har ekranda bitta asosiy amal: egasiga — "Loyiha qo'shish", boshqalarga — "Kuzatish"
  const footer = data && (data.actions.add || data.actions.follow) ? (
    <>
      <span className="spacer" />
      {data.actions.add && (
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => open({ portfolio: id, add: true })}>
          {T.portfolio.add}
        </Button>
      )}
      {data.actions.follow && (
        data.is_following ? (
          <Button icon={<UserCheck size={16} />} loading={follow.isPending} onClick={() => follow.mutate(false)}>
            {T.portfolio.unfollow}
          </Button>
        ) : (
          <Button variant="primary" icon={<UserPlus size={16} />} loading={follow.isPending} onClick={() => follow.mutate(true)}>
            {T.portfolio.follow}
          </Button>
        )
      )}
    </>
  ) : undefined;

  return (
    <Modal title={T.portfolio.title} size="lg" onClose={close} footer={footer}>
      {query.isLoading && <Skeleton h={220} />}
      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <div className="stack" style={{ gap: 24 }}>
          <ProfileHeader
            user={data}
            subtitle={data.specialty || T.portfolio.developer}
            actions={data.is_following ? <Badge tone="info" dot={false}><UserCheck size={13} /> {T.portfolio.following}</Badge> : undefined}
          />

          <div className="portfolio-stats">
            <Stat icon={<Trophy />} tone="warning" label={T.portfolio.stat.rating}>
              <Stars value={data.rating} count={data.reviews_count} />
            </Stat>
            <Stat icon={<Users />} tone="info" label={T.portfolio.stat.followers}><b>{data.followers_count}</b></Stat>
            <Stat icon={<FolderKanban />} tone="violet" label={T.portfolio.stat.projects}><b>{data.projects_count}</b></Stat>
            <Stat icon={<CheckCircle2 />} tone="success" label={T.portfolio.stat.tasks}><b>{data.tasks_done}</b></Stat>
            <Stat icon={<Briefcase />} tone="slate" label={T.portfolio.stat.experience}>
              <b>{T.portfolio.experience(data.experience.months)}</b>
              <span className="small muted">{T.portfolio.since(fmtDate(data.experience.since))}</span>
            </Stat>
          </div>

          <section>
            <h3 className="section-title">{T.portfolio.projects}</h3>
            {data.items.length ? (
              <div className="portfolio-items">
                {data.items.map((i) => <ItemCard key={i.id} item={i} onOpen={() => open({ portfolio: id, item: i.id })} />)}
              </div>
            ) : (
              <div className="card">
                <Empty icon={<FolderKanban />} title={T.portfolio.projectsEmpty}
                  hint={data.actions.add ? T.portfolio.projectsEmptyOwner : T.portfolio.projectsEmptyOther} />
              </div>
            )}
          </section>

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
      )}
    </Modal>
  );
}

function Stat({ icon, tone, label, children }: { icon: ReactNode; tone: Tone; label: string; children: ReactNode }) {
  return (
    <div className="portfolio-stat">
      <span className={`total-icon tone-${tone}`}>{icon}</span>
      <span className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
        <span className="small muted">{label}</span>
        {children}
      </span>
    </div>
  );
}

function ItemCard({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  const period = periodText(item.start_date, item.end_date);
  return (
    <button type="button" className="card card-pad clickable portfolio-item-card" onClick={onOpen}>
      <span className="row-wrap" style={{ gap: 8 }}>
        <Badge tone={item.is_auto ? "violet" : "info"} dot={false}>{item.is_auto ? T.portfolio.auto : T.portfolio.manual}</Badge>
        {item.project && <CodeTag code={item.project.code} />}
      </span>
      <b className="portfolio-item-title">{item.title}</b>
      {period && <span className="small muted">{period}</span>}
      <Stars value={item.rating} count={item.reviews_count} size={14} />
      <span className="row-wrap small muted" style={{ gap: 12 }}>
        {item.tasks_done !== null && <span className="row" style={{ gap: 4 }}><CheckCircle2 size={14} /> {T.portfolio.tasksN(item.tasks_done)}</span>}
        {item.videos_count > 0 && <span className="row" style={{ gap: 4 }}><Video size={14} /> {T.portfolio.videosN(item.videos_count)}</span>}
        {item.link && <span className="row" style={{ gap: 4 }}><Link2 size={14} /> {T.portfolio.openLink}</span>}
      </span>
    </button>
  );
}
