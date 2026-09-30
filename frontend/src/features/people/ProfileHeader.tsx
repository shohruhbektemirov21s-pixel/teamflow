import type { ReactNode } from "react";

import { useModal } from "@/app/modals";
import { T } from "@/shared/text";
import { Avatar, Badge } from "@/shared/ui";

export interface ProfileStats {
  active: number;
  overdue: number;
  review: number;
  done: number;
}

/**
 * Profil sarlavhasi — o'z profilim (`/profil`) va xodim oynasida (PersonModal) bir xil ko'rinish:
 * avatar, ism, lavozim/bo'lim va (dasturchi bo'lsa) 4 ta ko'rsatkich. `actions` — o'z profilimda rasm tugmalari.
 */
export function ProfileHeader({ user, subtitle, stats, actions }: { user: { id: number; full_name: string; avatar?: string | null }; subtitle: string; stats?: ProfileStats | null; actions?: ReactNode }) {
  const { open } = useModal();
  const avatar = user.avatar;
  return (
    <div className="stack-sm" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12 }}>
        {avatar ? (
          // Rasm bosilsa — Telegram kabi katta ko'rinishda ochiladi
          <button type="button" className="avatar-btn" aria-label={T.people.photoOpen} onClick={() => open({ photo: user.id, name: user.full_name, src: avatar })}>
            <Avatar user={user} size="lg" />
          </button>
        ) : (
          <Avatar user={user} size="lg" />
        )}
        <div className="grow">
          <h2 style={{ margin: 0 }}>{user.full_name}</h2>
          <div className="small muted">{subtitle}</div>
          {actions && <div className="row-wrap" style={{ marginTop: 8 }}>{actions}</div>}
        </div>
      </div>
      {stats && (
        <div className="row-wrap" aria-label={T.profile.stats}>
          <Badge tone="info">{T.people.activeN(stats.active)}</Badge>
          <Badge tone="danger">{T.people.overdueN(stats.overdue)}</Badge>
          <Badge tone="violet">{T.people.reviewN(stats.review)}</Badge>
          <Badge tone="success">{T.people.doneN(stats.done)}</Badge>
        </div>
      )}
    </div>
  );
}
