import { X } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { T } from "../text";

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  headerExtra?: ReactNode;
  size?: "sm" | "md" | "lg";
  onClose: () => void;
  /** Saqlanmagan o'zgarish bo'lsa, tashqariga bosganda yopilmaydi va Esc so'raydi. */
  dirty?: boolean;
  footer?: ReactNode;
  /** Boshqa modal ustida ochiladi: qoraroq fon (foydalanuvchi istisnosi, 2026-10-06). */
  stacked?: boolean;
  /** Ustida boshqa modal ochiq: bu oyna bosilmaydi va fokus olmaydi. */
  covered?: boolean;
  children: ReactNode;
}

// Ochiq dialoglar tartibi: Esc/Tab faqat eng ustidagisiga tegishli.
const dialogStack: { node: HTMLElement | null }[] = [];

/**
 * Dialog xatti-harakati (Modal va rasm ko'rish oynasi uchun umumiy): ochilganda fokus ichkariga, Esc yopadi,
 * Tab dialogdan chiqmaydi, orqa sahifa aylanmaydi; yopilganda fokus avvalgi joyiga qaytadi.
 */
export function useDialogBehavior(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const token = { node };
    dialogStack.push(token);
    const first = node?.querySelector<HTMLElement>("[autofocus], input, textarea, select, button:not([data-close])");
    (first ?? node)?.focus();
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        escRef.current();
      }
      if (e.key === "Tab" && node) {
        const items = node.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const firstEl = items[0]!;
        const lastEl = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      dialogStack.splice(dialogStack.indexOf(token), 1);
      if (!dialogStack.length) document.body.style.overflow = "";
      previous?.focus?.();
      // Avvalgi element o'sha paytda bosilmaydigan (inert) bo'lgan bo'lsa — fokus ostdagi oynaga qaytadi.
      const below = dialogStack[dialogStack.length - 1]?.node;
      if (below && !below.contains(document.activeElement)) below.focus();
    };
  }, [ref]);
}

/**
 * Yagona modal komponenti (CLAUDE.md, 4-bo'lim): tepada sarlavha va ✕, o'rtada aylanuvchi tarkib,
 * pastda doim ko'rinadigan tugmalar paneli. Esc yopadi, fokus modal ichida qoladi va yopilganda qaytadi.
 */
export function Modal({ title, subtitle, headerExtra, size = "md", onClose, dirty, footer, stacked, covered, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const tryClose = () => {
    if (dirtyRef.current && !window.confirm(T.common.unsaved)) return;
    closeRef.current();
  };
  const tryCloseRef = useRef(tryClose);
  tryCloseRef.current = tryClose;

  useDialogBehavior(ref, () => tryCloseRef.current());

  return createPortal(
    <div
      className={`overlay ${stacked ? "overlay-stacked" : ""}`}
      inert={covered}
      aria-hidden={covered || undefined}
      onMouseDown={(e) => e.target === e.currentTarget && !dirtyRef.current && tryClose()}
    >
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <div className="grow stack-sm">
            <div className="modal-title" id={titleId}>
              {title}
            </div>
            {subtitle && <div className="row-wrap">{subtitle}</div>}
          </div>
          {headerExtra}
          <button className="icon-btn" onClick={tryClose} aria-label={T.common.close} data-close>
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
