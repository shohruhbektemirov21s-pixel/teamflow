import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FolderKanban, MessageSquare, Plus, UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";

import { useModal } from "@/app/modals";
import { usePagedList, useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { fmtDate, timeAgo } from "@/shared/format";
import type { Tone } from "@/shared/status";
import { T } from "@/shared/text";
import type { DeveloperReview, PortfolioDetail, PortfolioItem } from "@/shared/types";
import { Avatar, Badge, Button, Empty, ErrorBox, Modal, Skeleton, SkeletonRows, Tabs, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

import { periodText } from "./period";
import { PortfolioItemForm, PortfolioItemView } from "./PortfolioItem";
import { Stars } from "./Stars";

type Tab = "overview" | "projects" | "reviews" | "experience";
const TABS: Tab[] = ["overview", "projects", "reviews", "experience"];
const STATUS_TONE: Record<string, Tone> = { done: "success", active: "info", planned: "slate" };
const CARD_TECH = 4;

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
  const [tab, setTab] = useState<Tab>("overview");
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
      {query.isLoading && <Skeleton h={320} />}
      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <div className="pf">
          <Header data={data} />
          <Tabs
            tabs={TABS.map((key) => ({ key, label: key === "projects" ? `${T.portfolio.tabs[key]} (${data.items.length})` : T.portfolio.tabs[key] }))}
            value={tab}
            onChange={setTab}
          />
          {tab === "overview" && <Overview data={data} />}
          {tab === "projects" && <Projects data={data} onOpen={(itemId) => open({ portfolio: id, item: itemId })} />}
          {tab === "reviews" && <Reviews data={data} />}
          {tab === "experience" && <Experience data={data} />}
        </div>
      )}
    </Modal>
  );
}

/** Barcha bo'limlarda bir xil turadi: cover, avatar, ism, mutaxassislik va reyting. */
function Header({ data }: { data: PortfolioDetail }) {
  return (
    <header className="pf-head">
      <div className={`pf-cover ucover-${data.id % 6}`} aria-hidden />
      <div className="pf-id">
        <span className="pf-avatar"><Avatar user={data} size="xl" card={false} /></span>
        <div className="pf-name">
          <h2 className="pf-title">{data.full_name}</h2>
          <span className="muted">{data.specialty || T.portfolio.developer}</span>
        </div>
        <div className="pf-rating">
          <Stars value={data.rating} count={data.rating === null ? undefined : data.reviews_count} size={18} />
          {data.is_following && <Badge tone="info" dot={false}><UserCheck size={13} /> {T.portfolio.following}</Badge>}
        </div>
      </div>
    </header>
  );
}

function Chips({ names, limit }: { names: string[]; limit?: number }) {
  const shown = limit ? names.slice(0, limit) : names;
  const extra = names.length - shown.length;
  return (
    <span className="pf-chips">
      {shown.map((name) => <span key={name} className="utag" title={name}>{name}</span>)}
      {extra > 0 && <span className="utag utag-more">{T.portfolio.moreTech(extra)}</span>}
    </span>
  );
}

function Overview({ data }: { data: PortfolioDetail }) {
  const facts: [string, string][] = [
    [T.portfolio.facts.experience, T.portfolio.experience(data.experience.months)],
    [T.portfolio.facts.projects, String(data.projects_count)],
    [T.portfolio.facts.tasks, String(data.tasks_done)],
    [T.portfolio.facts.followers, String(data.followers_count)],
  ];
  return (
    <div className="pf-body">
      <section>
        <h3 className="section-title">{T.portfolio.about}</h3>
        <dl className="pf-facts card">
          {facts.map(([label, value]) => (
            <div key={label}><dt className="muted">{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="section-title">{T.portfolio.technologies}</h3>
        {data.technologies.length ? (
          <Chips names={data.technologies.map((t) => t.name)} />
        ) : (
          <p className="small muted">{data.actions.add ? T.portfolio.technologiesEmptyOwner : T.portfolio.technologiesEmpty}</p>
        )}
      </section>
    </div>
  );
}

function Projects({ data, onOpen }: { data: PortfolioDetail; onOpen: (itemId: number) => void }) {
  if (!data.items.length)
    return (
      <div className="card">
        <Empty icon={<FolderKanban />} title={T.portfolio.projectsEmpty}
          hint={data.actions.add ? T.portfolio.projectsEmptyOwner : T.portfolio.projectsEmptyOther} />
      </div>
    );
  return (
    <section>
      {!data.actions.add && <p className="small muted">{T.portfolio.rateHint}</p>}
      <div className="pf-projects">
        {data.items.map((item) => <ProjectCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />)}
      </div>
    </section>
  );
}

function ProjectCard({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  const period = periodText(item.start_date, item.end_date);
  return (
    <article className="card pf-card">
      {item.cover ? <img className="pf-card-cover" src={item.cover} alt="" loading="lazy" /> : <div className={`pf-card-cover ucover-${item.id % 6}`} aria-hidden />}
      <div className="pf-card-body">
        <div className="pf-card-top">
          <b className="pf-card-title">{item.title}</b>
          {item.status && <Badge tone={STATUS_TONE[item.status]}>{T.portfolio.status[item.status]}</Badge>}
        </div>
        {period && <span className="small muted">{period}</span>}
        {item.summary && <p className="pf-card-text">{item.summary}</p>}
        {!!item.technologies.length && <Chips names={item.technologies} limit={CARD_TECH} />}
        <div className="pf-card-foot">
          <Stars value={item.rating} count={item.rating === null ? undefined : item.reviews_count} size={14} />
          <Button size="sm" icon={<ExternalLink size={14} />} onClick={onOpen}>{T.portfolio.viewProject}</Button>
        </div>
      </div>
    </article>
  );
}

function Reviews({ data }: { data: PortfolioDetail }) {
  const reviews = usePagedList<DeveloperReview>(["portfolio", "developer-reviews", data.id], `/portfolio/${data.id}/reviews/`, {});
  return (
    <section className="stack">
      <h3 className="section-title" style={{ marginBottom: 0 }}>{T.portfolio.reviewsTitle}</h3>
      {reviews.error && <ErrorBox error={reviews.error} onRetry={() => reviews.refetch()} />}
      {reviews.isLoading && <div className="card"><SkeletonRows rows={3} /></div>}
      {reviews.data && !reviews.data.length && (
        <div className="card"><Empty icon={<MessageSquare />} title={T.portfolio.reviewsProfileEmpty} hint={data.actions.add ? undefined : T.portfolio.reviewsProfileEmptyHint} /></div>
      )}
      {!!reviews.data?.length && (
        <div className="card">
          {reviews.data.map((r) => (
            <div key={r.id} className="list-row portfolio-review">
              <Avatar user={r.author} />
              <div className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
                <div className="row-wrap" style={{ gap: 8 }}>
                  <b>{r.author.full_name}</b>
                  <Stars value={r.stars} size={14} />
                  <span className="small muted" title={fmtDate(r.updated_at)}>{timeAgo(r.updated_at)}</span>
                </div>
                <span className="small muted ellipsis">{T.portfolio.reviewsFor(r.item_title)}</span>
                {r.text && <p className="portfolio-description">{r.text}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination data={reviews.pagination} page={reviews.page} onPageChange={reviews.onPageChange} />
    </section>
  );
}

function Experience({ data }: { data: PortfolioDetail }) {
  return (
    <div className="pf-body">
      <section>
        <h3 className="section-title">{T.portfolio.experienceTitle}</h3>
        <div className="card card-pad">
          <b>{T.portfolio.experience(data.experience.months)}</b>
          <span className="small muted"> · {T.portfolio.since(fmtDate(data.experience.since))}</span>
        </div>
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
  );
}
