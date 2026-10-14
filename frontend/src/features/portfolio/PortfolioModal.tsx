import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  FolderKanban,
  Heart,
  Image,
  Link2,
  Mail,
  MapPin,
  Plus,
  Send,
  Trophy,
  UserCheck,
  UserPlus,
  Video,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { useModal } from "@/app/modals";
import { useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { PortfolioDetail, PortfolioDeveloperReview, PortfolioItem } from "@/shared/types";
import { Avatar, Badge, Button, CodeTag, Empty, ErrorBox, Modal, Skeleton, Tabs, useToast } from "@/shared/ui";

import { periodText } from "./period";
import { PortfolioItemForm, PortfolioItemView } from "./PortfolioItem";
import { Stars } from "./Stars";

type OverviewTab = "overview" | "projects" | "reviews" | "experience";

/** Bitta portfolio modali: profil tablari, loyiha tafsiloti va loyiha formasi ichki holat sifatida almashadi. */
export default function PortfolioModal({ id, item, add }: { id: number; item?: number; add?: boolean }) {
  if (add) return <PortfolioItemForm ownerId={id} />;
  if (item) return <PortfolioItemView id={item} />;
  return <PortfolioOverview id={id} />;
}

function PortfolioOverview({ id }: { id: number }) {
  const { open, close } = useModal();
  const toast = useToast();
  const refresh = useRefresh(["portfolio", "profile"]);
  const [tab, setTab] = useState<OverviewTab>("overview");
  const query = useQuery({ queryKey: ["portfolio", "detail", id], queryFn: () => api.get<PortfolioDetail>(`/portfolio/${id}/`) });
  const data = query.data;
  const follow = useMutation({
    mutationFn: (on: boolean) => (on ? api.post(`/portfolio/${id}/follow/`) : api.del(`/portfolio/${id}/follow/`)),
    onSuccess: (_, on) => {
      toast(on ? T.portfolio.followedToast : T.portfolio.unfollowedToast);
      void refresh();
    },
    onError: (error) => toast(error.message, "error"),
  });

  const footer = data && (data.actions.add || data.actions.follow) ? (
    <>
      <span className="spacer" />
      {data.actions.add && (
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => open({ portfolio: id, add: true })}>
          {T.portfolio.add}
        </Button>
      )}
      {data.actions.follow && (data.is_following ? (
        <Button icon={<UserCheck size={16} />} loading={follow.isPending} onClick={() => follow.mutate(false)}>
          {T.portfolio.unfollow}
        </Button>
      ) : (
        <Button variant="primary" icon={<UserPlus size={16} />} loading={follow.isPending} onClick={() => follow.mutate(true)}>
          {T.portfolio.follow}
        </Button>
      ))}
    </>
  ) : undefined;

  return (
    <Modal title={T.portfolio.title} size="lg" onClose={close} footer={footer}>
      {query.isLoading && <Skeleton h={220} />}
      {query.error && <ErrorBox error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <div className="stack" style={{ gap: 20 }}>
          <PortfolioHeader data={data} onFollow={(on) => follow.mutate(on)} isPending={follow.isPending} />
          <Tabs<OverviewTab>
            value={tab}
            onChange={setTab}
            tabs={([
              { key: "overview", label: T.portfolio.tabs.overview },
              { key: "projects", label: T.portfolio.tabs.projects },
              { key: "reviews", label: T.portfolio.tabs.reviews },
              { key: "experience", label: T.portfolio.tabs.experience },
            ] as { key: OverviewTab; label: ReactNode }[])}
          />
          {tab === "overview" && <Overview data={data} />}
          {tab === "projects" && <Projects data={data} onOpen={(itemId) => open({ portfolio: id, item: itemId })} />}
          {tab === "reviews" && <Reviews reviews={data.reviews ?? []} />}
          {tab === "experience" && <Experience data={data} />}
        </div>
      )}
    </Modal>
  );
}

function PortfolioHeader({
  data,
  onFollow,
  isPending,
}: {
  data: PortfolioDetail;
  onFollow?: (on: boolean) => void;
  isPending?: boolean;
}) {
  const cover = data.cover ?? data.items.find((item) => item.cover)?.cover;
  return (
    <div className="pmodal-header">
      <div
        className="pmodal-cover"
        aria-label={cover ? undefined : T.portfolio.coverEmpty(data.full_name)}
        role={cover ? undefined : "img"}
      >
        {cover ? (
          <img src={cover} alt={T.portfolio.coverAlt(data.full_name)} className="pmodal-cover-img" />
        ) : (
          <div className="pmodal-cover-art" aria-hidden>
            <svg viewBox="0 0 800 240" fill="none" preserveAspectRatio="none" className="pmodal-cover-svg">
              <defs>
                <linearGradient id="pmodal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e1035" />
                  <stop offset="50%" stopColor="#2e1065" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>
              <rect width="800" height="240" fill="url(#pmodal-grad)" />
              <g opacity="0.4" transform="translate(620, 20)">
                <polygon points="60,30 110,60 60,90 10,60" fill="#7c3aed" />
                <polygon points="10,60 60,90 60,150 10,120" fill="#4c1d95" />
                <polygon points="110,60 60,90 60,150 110,120" fill="#6d28d9" />
              </g>
              <g opacity="0.25" transform="translate(520, 90) scale(0.6)">
                <polygon points="60,30 110,60 60,90 10,60" fill="#a855f7" />
                <polygon points="10,60 60,90 60,150 10,120" fill="#6b21a8" />
                <polygon points="110,60 60,90 60,150 110,120" fill="#7e22ce" />
              </g>
            </svg>
          </div>
        )}
        {data.actions.follow && (
          <button
            type="button"
            className="uheart pmodal-heart"
            aria-pressed={data.is_following}
            aria-label={data.is_following ? "Kuzatuvdan chiqarish" : "Kuzatuvga olish"}
            title={data.is_following ? T.portfolio.unfollow : T.portfolio.follow}
            disabled={isPending}
            onClick={() => onFollow?.(!data.is_following)}
          >
            <Heart size={18} aria-hidden />
          </button>
        )}
      </div>

      <div className="pmodal-id-row">
        <div className="pmodal-avatar-box">
          <Avatar user={data} size="xl" card={false} />
        </div>

        <div className="pmodal-id-info">
          <div className="pmodal-id-top">
            <h2 className="pmodal-name">{data.full_name}</h2>
            {data.is_following && (
              <Badge tone="info" dot={false}>
                <UserCheck size={13} /> {T.portfolio.following}
              </Badge>
            )}
          </div>
          <p className="pmodal-specialty">{data.specialty || T.portfolio.developer}</p>
          <div className="pmodal-meta-row">
            {data.location && (
              <span className="pmodal-meta-item">
                <MapPin size={14} className="muted" aria-hidden />
                {data.location}
              </span>
            )}
            <span className="pmodal-meta-item">
              <Calendar size={14} className="muted" aria-hidden />
              {T.portfolio.since(fmtDate(data.experience.since))}
            </span>
          </div>
        </div>

        <div className="pmodal-id-rating">
          <div className="pmodal-rating-badge">
            <span className="pmodal-rating-num">{data.rating ? data.rating.toFixed(1) : "0.0"}</span>
            <Stars value={data.rating} size={15} />
            <span className="pmodal-rating-count">({data.reviews_count} {T.portfolio.stat.rating.toLowerCase()})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Overview({ data }: { data: PortfolioDetail }) {
  const technologies = useMemo(() => {
    const values = data.technologies ?? data.items.flatMap((item) => item.technologies ?? []);
    return [...new Set(values)];
  }, [data]);

  return (
    <div className="pmodal-overview-grid">
      <div className="stack" style={{ gap: 16 }}>
        <section className="card card-pad stack-sm">
          <h3 className="section-title">{T.portfolio.about}</h3>
          <p className={data.bio ? "portfolio-description" : "small muted"}>{data.bio || T.portfolio.aboutEmpty}</p>
        </section>

        <section className="card card-pad stack-sm">
          <h3 className="section-title">{T.portfolio.technologies}</h3>
          {technologies.length ? (
            <div className="row-wrap">
              {technologies.map((technology) => (
                <Badge key={technology} dot={false} tone="violet">
                  {technology}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="small muted">{T.portfolio.technologiesEmpty}</p>
          )}
        </section>

        <section className="card card-pad stack-sm">
          <h3 className="section-title">{T.portfolio.contact}</h3>
          <div className="stack-sm pmodal-contact-list">
            {data.location && (
              <div className="pmodal-contact-item">
                <MapPin size={16} className="muted" aria-hidden />
                <span>{data.location}</span>
              </div>
            )}
            {data.email && (
              <div className="pmodal-contact-item">
                <Mail size={16} className="muted" aria-hidden />
                <span>{data.email}</span>
              </div>
            )}
            {data.telegram_username && (
              <div className="pmodal-contact-item">
                <Send size={16} className="muted" aria-hidden />
                <span>{data.telegram_username}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <div className="card card-pad stack-sm">
          <h3 className="section-title">{T.portfolio.statsTitle}</h3>
          <div className="pmodal-stats-grid">
            <div className="pmodal-stat-box">
              <span className="pmodal-stat-val text-violet">{data.projects_count}</span>
              <span className="pmodal-stat-lbl">{T.portfolio.stat.projects}</span>
            </div>
            <div className="pmodal-stat-box">
              <span className="pmodal-stat-val text-success">{data.tasks_done}</span>
              <span className="pmodal-stat-lbl">{T.portfolio.stat.tasks}</span>
            </div>
            <div className="pmodal-stat-box">
              <span className="pmodal-stat-val text-warning">{data.rating ? data.rating.toFixed(1) : "-"}</span>
              <span className="pmodal-stat-lbl">{T.portfolio.stat.rating}</span>
            </div>
            <div className="pmodal-stat-box">
              <span className="pmodal-stat-val text-info">{T.portfolio.experience(data.experience.months)}</span>
              <span className="pmodal-stat-lbl">{T.portfolio.stat.experience}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Experience({ data }: { data: PortfolioDetail }) {
  const hasHistory = data.years.length > 0 || data.recent_tasks.length > 0;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card card-pad stack-sm">
        <h3 className="section-title">{T.portfolio.stat.experience}</h3>
        <p className="portfolio-description">
          <b>{T.portfolio.experience(data.experience.months)}</b> · {T.portfolio.since(fmtDate(data.experience.since))}
        </p>
      </section>
      {!hasHistory && (
        <div className="card">
          <Empty icon={<Trophy />} title={T.portfolio.experienceEmpty} hint={T.portfolio.experienceEmptyHint} />
        </div>
      )}
      {data.years.length > 0 && (
        <section className="card card-pad stack-sm">
          <h3 className="section-title">{T.portfolio.years}</h3>
          <div className="stack-sm">
            {data.years.map((year) => (
              <div key={year.year} className="list-row" style={{ padding: "8px 0" }}>
                <b style={{ minWidth: 48 }}>{year.year}</b>
                <span className="small muted">{T.portfolio.yearRow(year.projects, year.tasks)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {data.recent_tasks.length > 0 && (
        <section className="card card-pad stack-sm">
          <h3 className="section-title">{T.portfolio.recentTasks}</h3>
          <div className="stack-sm">
            {data.recent_tasks.map((task) => (
              <div key={task.id} className="list-row" style={{ padding: "8px 0" }}>
                <CheckCircle2 size={16} style={{ color: "var(--success)", flex: "none" }} aria-hidden />
                <span className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <span className="ellipsis" style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</span>
                  <span className="small muted ellipsis">{task.project}</span>
                </span>
                {task.completed_at && <span className="small muted nowrap">{fmtDate(task.completed_at)}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Projects({ data, onOpen }: { data: PortfolioDetail; onOpen: (id: number) => void }) {
  if (!data.items.length) {
    return (
      <div className="card">
        <Empty icon={<FolderKanban />} title={T.portfolio.projectsEmpty}
          hint={data.actions.add ? T.portfolio.projectsEmptyOwner : T.portfolio.projectsEmptyOther} />
      </div>
    );
  }
  return (
    <section>
      {!data.actions.add && <p className="small muted">{T.portfolio.rateHint}</p>}
      <div className="portfolio-items">{data.items.map((item) => <ItemCard key={item.id} item={item} onOpen={() => onOpen(item.id)} />)}</div>
    </section>
  );
}

function Reviews({ reviews }: { reviews: PortfolioDeveloperReview[] }) {
  if (!reviews.length) {
    return <div className="card"><Empty icon={<Trophy />} title={T.portfolio.reviewsEmpty} hint={T.portfolio.reviewsEmptyHint} /></div>;
  }
  return (
    <div className="stack-sm">
      {reviews.map((review) => (
        <article key={review.id} className="card card-pad row portfolio-review">
          <Avatar user={review.author} size="lg" />
          <div className="grow stack-sm">
            <div className="row-wrap" style={{ justifyContent: "space-between" }}>
              <div className="stack-sm" style={{ gap: 2 }}>
                <b>{review.author.full_name}</b>
                <span className="small muted">{review.item.title}</span>
              </div>
              <span className="small muted nowrap">{fmtDate(review.created_at)}</span>
            </div>
            <Stars value={review.stars} />
            {review.text && <p className="portfolio-description">{review.text}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

function ItemCard({ item, onOpen }: { item: PortfolioItem; onOpen: () => void }) {
  const period = periodText(item.start_date, item.end_date);
  return (
    <button type="button" className="card clickable portfolio-item-card" onClick={onOpen} style={{ padding: 0, overflow: "hidden" }}>
      {item.cover ? (
        <img src={item.cover} alt={T.portfolio.coverAlt(item.title)} loading="lazy" style={{ width: "100%", height: 128, objectFit: "cover" }} />
      ) : (
        <span role="img" aria-label={T.portfolio.coverEmpty(item.title)} style={{ width: "100%", height: 128, display: "grid", placeItems: "center", background: "var(--surface-2)" }}>
          <Image size={28} className="muted" aria-hidden />
        </span>
      )}
      <span className="stack-sm" style={{ padding: 16, width: "100%", alignItems: "flex-start" }}>
        <span className="row-wrap" style={{ gap: 8 }}>
          <Badge tone={item.is_auto ? "violet" : "info"} dot={false}>{item.is_auto ? T.portfolio.auto : T.portfolio.manual}</Badge>
          {item.project && <CodeTag code={item.project.code} />}
        </span>
        <b className="portfolio-item-title">{item.title}</b>
        {period && <span className="small muted">{period}</span>}
        {!!item.technologies?.length && <span className="row-wrap">{item.technologies.map((technology) => <Badge key={technology} dot={false}>{technology}</Badge>)}</span>}
        <Stars value={item.rating} count={item.reviews_count} size={14} />
        <span className="row-wrap small muted" style={{ gap: 12 }}>
          {item.tasks_done !== null && <span className="row" style={{ gap: 4 }}><CheckCircle2 size={14} /> {T.portfolio.tasksN(item.tasks_done)}</span>}
          {item.videos_count > 0 && <span className="row" style={{ gap: 4 }}><Video size={14} /> {T.portfolio.videosN(item.videos_count)}</span>}
          {item.link && <span className="row" style={{ gap: 4 }}><Link2 size={14} /> {T.portfolio.openLink}</span>}
        </span>
      </span>
    </button>
  );
}
