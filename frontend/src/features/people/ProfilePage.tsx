import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";

import { useMe } from "@/app/auth";
import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { Stars } from "@/features/portfolio/Stars";
import { TaskTable } from "@/features/tasks/TaskTable";
import { api } from "@/shared/api";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Profile, Project, ProjectStatus, Rating, Task } from "@/shared/types";
import { Badge, Button, Empty, ErrorBox, SkeletonRows } from "@/shared/ui";
import type { Tone } from "@/shared/status";
import { Pagination } from "@/shared/ui/Pagination";

import { ProfileHeader } from "./ProfileHeader";
import { BusinessTripPanel } from "./BusinessTripPanel";

const STATUS_TONE: Record<ProjectStatus, Tone> = { done: "success", active: "info", overdue: "danger" };
const RATINGS_PREVIEW = 5;

/** Mening profilim: tepada sarlavha (rasm, ism, lavozim, bio, "Tahrirlash"), ostida bo'limlar.
 * Har bir ma'lumot bir joyda: ism va bio — sarlavhada, login/Telegram/sana — "Shaxsiy ma'lumotlar"da.
 * Tahrirlash, parol va rejim — Sozlamalarda (`/sozlamalar`). Loyiha/vazifa/reyting bo'limlari rolga qarab chiqadi. */
export default function ProfilePage() {
  const me = useMe();
  const { open } = useModal();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/auth/profile/") });
  const p = q.data;
  const developer = me.role === "developer";
  const ordinary = me.role === "user";
  const myTasks = usePagedList<Task>(["tasks", "mine", "profile"], "/tasks/", { mine: 1 }, developer);
  const myProjects = usePagedList<Project>(["projects", "mine", "profile"], "/projects/", {}, developer);
  const myRatings = usePagedList<Rating>(["portfolio", "ratings", "profile"], "/portfolio/ratings/", { mine: 1 }, ordinary);

  return (
    <div className="stack" style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
      <div className="card card-pad">
        <ProfileHeader
          user={me}
          subtitle={me.department_name || (ordinary ? me.role_label : me.specialty || me.role_label)}
          bio={p?.bio}
          stats={p?.stats && { active: p.stats.active, overdue: p.stats.overdue, review: p.stats.in_review, done: p.stats.done }}
          actions={
            <Link className="btn btn-sm" to="/sozlamalar">
              <Pencil /> {T.profile.edit}
            </Link>
          }
        />
      </div>

      <section className="card card-pad stack" aria-label={T.profile.personalTitle}>
        <h3>{T.profile.personalTitle}</h3>
        {q.isLoading && <SkeletonRows rows={2} />}
        {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
        {p && (
          <dl className="kv">
            <div><dt>{T.profile.login}</dt><dd>{me.username}</dd></div>
            {p.email && <div><dt>{T.settings.email}</dt><dd>{p.email}</dd></div>}
            <div><dt>{T.profile.telegram}</dt><dd>{p.telegram_username || "—"}</dd></div>
            <div><dt>{T.profile.dateJoined}</dt><dd>{fmtDate(p.date_joined)}</dd></div>
          </dl>
        )}
      </section>

      {me.role === "boss" && <BusinessTripPanel />}

      {developer && (
        <section className="card" aria-label={T.profile.myProjects}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myProjects} {myProjects.pagination && <span className="count-pill soft">{myProjects.pagination.count}</span>}
            </h3>
          </div>
          {myProjects.error && <div className="card-pad"><ErrorBox error={myProjects.error} onRetry={() => myProjects.refetch()} /></div>}
          {myProjects.isLoading && <div className="card-pad"><SkeletonRows rows={2} /></div>}
          {myProjects.data && !myProjects.data.length && <Empty title={T.profile.myProjectsEmpty} />}
          {myProjects.data?.map((project) => (
            <button key={project.id} type="button" className="list-row clickable" onClick={() => open({ project: project.id })}>
              <span className="grow stack-sm" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
                <b className="ellipsis">{project.name}</b>
                <span className="small muted">{project.code} · {fmtDate(project.end_date)}</span>
              </span>
              <Badge tone={STATUS_TONE[project.status]}>{T.projects.status[project.status]}</Badge>
            </button>
          ))}
          <Pagination data={myProjects.pagination} page={myProjects.page} onPageChange={myProjects.onPageChange} />
        </section>
      )}

      {developer && (
        <section className="card" aria-label={T.profile.myTasks}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myTasks} {myTasks.data && <span className="count-pill soft">{myTasks.pagination?.count}</span>}
            </h3>
          </div>
          {myTasks.error ? (
            <div className="card-pad">
              <ErrorBox error={myTasks.error} onRetry={() => myTasks.refetch()} />
            </div>
          ) : (
            <TaskTable tasks={myTasks.data} loading={myTasks.isLoading} emptyHint={T.profile.myTasksEmpty} />
          )}
          <Pagination data={myTasks.pagination} page={myTasks.page} onPageChange={myTasks.onPageChange} />
        </section>
      )}

      {developer && p?.portfolio && (
        <section className="card card-pad stack" aria-label={T.profile.myRatings}>
          <div className="row" style={{ gap: 12 }}>
            <h3 className="grow">{T.profile.myRatings}</h3>
            <Button size="sm" onClick={() => open({ portfolio: me.id })}>{T.profile.openPortfolio}</Button>
          </div>
          <div className="row-wrap">
            <Stars value={p.portfolio.rating} count={p.portfolio.rating === null ? undefined : p.portfolio.reviews_count} size={20} />
            <span className="small muted">{T.profile.projectsN(p.portfolio.projects_count)}</span>
          </div>
          {p.portfolio.rating === null && <p className="small muted">{T.profile.developerRatingEmpty}</p>}
          <div>
            <div className="field-label">{T.profile.technologies}</div>
            {p.portfolio.technologies.length ? (
              <div className="chips">
                {p.portfolio.technologies.map((name) => <Badge key={name} dot={false}>{name}</Badge>)}
              </div>
            ) : (
              <p className="small muted">{T.profile.technologiesEmpty}</p>
            )}
          </div>
        </section>
      )}

      {ordinary && (
        <section className="card" aria-label={T.profile.myRatings}>
          <div className="card-head">
            <h3 className="grow">
              {T.profile.myRatings} {myRatings.pagination && <span className="count-pill soft">{myRatings.pagination.count}</span>}
            </h3>
            {(myRatings.pagination?.count ?? 0) > RATINGS_PREVIEW && (
              <Link className="small" to="/baholarim">{T.profile.allRatings}</Link>
            )}
          </div>
          {myRatings.error && <div className="card-pad"><ErrorBox error={myRatings.error} onRetry={() => myRatings.refetch()} /></div>}
          {myRatings.isLoading && <div className="card-pad"><SkeletonRows rows={2} /></div>}
          {myRatings.data && !myRatings.data.length && (
            <Empty
              title={T.profile.myRatingsEmpty}
              hint={T.profile.myRatingsEmptyHint}
              action={<Link className="btn btn-primary" to="/">{T.profile.myRatingsCta}</Link>}
            />
          )}
          {myRatings.data?.slice(0, RATINGS_PREVIEW).map((r) => (
            <button key={r.id} type="button" className="list-row clickable" onClick={() => open({ portfolio: r.developer.id, item: r.item_id })}>
              <span className="grow stack-sm" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
                <b className="ellipsis">{r.item_title}</b>
                <span className="small muted ellipsis">{T.ratings.developer(r.developer.full_name)} · {fmtDate(r.updated_at)}</span>
                {r.text && <span className="small">{r.text}</span>}
              </span>
              <Stars value={r.stars} />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
