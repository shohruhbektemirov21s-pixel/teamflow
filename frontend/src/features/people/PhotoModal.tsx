import { X } from "lucide-react";
import { useRef } from "react";
import { createPortal } from "react-dom";

import { useModal } from "@/app/modals";
import { T } from "@/shared/text";
import { useDialogBehavior } from "@/shared/ui";

/**
 * Modal: profil rasmini ko'rish (Telegram kabi — to'q fon, rasm markazda, tepada ism va ✕).
 * Xodim oynasidan ochilsa uning o'rnini egallaydi (modal ustida modal yo'q), "Orqaga" qaytaradi.
 */
export default function PhotoModal({ src, name }: { src: string; name: string }) {
  const { close } = useModal();
  const ref = useRef<HTMLDivElement>(null);
  useDialogBehavior(ref, close);
  // Manba faqat o'zimizning rasm manzili bo'lishi mumkin (tarix holati orqali boshqa URL kelmasin)
  const safe = src.startsWith("/api/avatars/") ? src : null;

  return createPortal(
    <div
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={T.people.photoOf(name)}
      ref={ref}
      tabIndex={-1}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="photo-viewer-bar">
        <span className="grow ellipsis">{name}</span>
        <button className="icon-btn" onClick={close} aria-label={T.common.close} data-close>
          <X />
        </button>
      </div>
      {safe && <img src={safe} alt={T.people.photoOf(name)} />}
    </div>,
    document.body,
  );
}
