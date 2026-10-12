import { useState } from "react";
import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";

import { useModal } from "@/app/modals";
import { usePagedList } from "@/app/queries";
import { Stars } from "@/features/portfolio/Stars";
import { fmtDate } from "@/shared/format";
import { T } from "@/shared/text";
import type { Me, Profile, Rating } from "@/shared/types";
import { Avatar, Empty, ErrorBox, SkeletonRows, Tabs } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

type TabKey = "general" | "ratings";

/** Oddiy foydalanuvchi profili: dasturchi profili (Portfolio modali) bilan bir xil sarlavha
 * (cover, avatar, ism, rol, bio) va ikki tab: Umumiy · Mening baholarim.
 * Yangi ma'lumot yoki flow yo'q: tahrirlash — `/sozlamalar`, baho bosilsa — mavjud portfolio oynasi. */
export function UserProfile({ me, profile, loading, error, onRetry }: { me: Me; profile?: Profile; loading: boolean; error: unknown; onRetry: () => void }) {
  const { open } = useModal();
  const [tab, setTab] = useState<TabKey>("general");
  const ratings = usePagedList<Rating>(["portfolio", "ratings", "profile"], "/portfolio/ratings/", { mine: 1 }, true);
  const count = ratings.pagination?.count;

  return (
    <div className="pf" style={{ maxWidth: 800, width: "100%", margin: "0 auto" }}>
      <header className="pf-head">
        <div className="pf-cover ucover-5" aria-hidden />
        <div className="pf-id">
          {me.avatar ? (
            <button type="button" className="avatar-btn pf-avatar" aria-label={T.people.photoOpen} onClick={() => open({ photo: me.id, name: me.full_name, src: me.avatar! })}>
              <Avatar user={me} size="xl" card={false} />
            </button>
          ) : (
            <span className="pf-avatar"><Avatar user={me} size="xl" card={false} /></span>
          )}
          <div className="pf-name">
            <h2 className="pf-title">{me.full_name}</h2>
            <span className="muted">{me.role_label}</span>
            {profile?.bio && <p style={{ margin: "8px 0 0", overflowWrap: "anywhere" }}>{profile.bio}</p>}
          </div>
          <Link className="btn btn-sm" to="/sozlamalar"><Pencil /> {T.profile.edit}</Link>
        </div>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "general", label: T.profile.tabGeneral },
          { key: "ratings", label: <>{T.profile.tabRatings}{count !== undefined && <span className="count-pill soft">{count}</span>}</> },
        ]}
      />

      {tab === "general" && (
        <section className="card card-pad stack" aria-label={T.profile.personalTitle}>
          <h3>{T.profile.personalTitle}</h3>
          {loading && <SkeletonRows rows={2} />}
          {!!error && <ErrorBox error={error} onRetry={onRetry} />}
          {profile && (
            <dl className="kv">
              <div><dt>{T.profile.login}</dt><dd>{me.username}</dd></div>
              {profile.email && <div><dt>{T.settings.email}</dt><dd>{profile.email}</dd></div>}
              <div><dt>{T.profile.telegram}</dt><dd>{profile.telegram_username || "—"}</dd></div>
              <div><dt>{T.profile.dateJoined}</dt><dd>{fmtDate(profile.date_joined)}</dd></div>
            </dl>
          )}
        </section>
      )}

      {tab === "ratings" && (
        <section className="card" aria-label={T.profile.myRatings}>
          {ratings.error && <div className="card-pad"><ErrorBox error={ratings.error} onRetry={() => ratings.refetch()} /></div>}
          {ratings.isLoading && <div className="card-pad"><SkeletonRows rows={2} /></div>}
          {ratings.data && !ratings.data.length && (
            <Empty
              title={T.profile.myRatingsEmpty}
              hint={T.profile.myRatingsEmptyHint}
              action={<Link className="btn btn-primary" to="/">{T.profile.myRatingsCta}</Link>}
            />
          )}
          {ratings.data?.map((r) => (
            <button key={r.id} type="button" className="list-row clickable" onClick={() => open({ portfolio: r.developer.id, item: r.item_id })}>
              <span className="grow stack-sm" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
                <b className="ellipsis">{r.item_title}</b>
                <span className="small muted ellipsis">{T.ratings.developer(r.developer.full_name)} · {fmtDate(r.updated_at)}</span>
                {r.text && <span className="small">{r.text}</span>}
              </span>
              <Stars value={r.stars} />
            </button>
          ))}
          <Pagination data={ratings.pagination} page={ratings.page} onPageChange={ratings.onPageChange} />
        </section>
      )}
    </div>
  );
}
