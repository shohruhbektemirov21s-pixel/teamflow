import { Star } from "lucide-react";
import type { KeyboardEvent } from "react";

import { T } from "@/shared/text";

/** Reyting ko'rinishi: 5 ta yulduz + son (faqat rangga tayanilmaydi — raqam ham yoziladi). */
export function Stars({ value, count, size = 16 }: { value: number | null; count?: number; size?: number }) {
  if (value === null) return <span className="small muted">{T.portfolio.noRating}</span>;
  const filled = Math.round(value);
  return (
    <span className="stars-row" title={T.portfolio.starsOf(value)}>
      <span className="stars" role="img" aria-label={T.portfolio.starsOf(value)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={size} className={i <= filled ? "filled" : ""} aria-hidden />
        ))}
      </span>
      <b className="stars-value">{value.toFixed(1)}</b>
      {count !== undefined && <span className="small muted">({T.portfolio.reviewsN(count)})</span>}
    </span>
  );
}

/** Baho tanlash: 5 ta tugma (radio guruh), strelkalar bilan ham ishlaydi. */
export function StarInput({ value, onChange, invalid }: { value: number; onChange: (v: number) => void; invalid?: boolean }) {
  const onKey = (e: KeyboardEvent) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, value + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, value - 1) : null;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next - 1])?.focus();
  };
  return (
    <div className="row-wrap" style={{ gap: 12 }}>
      <div className={`star-input ${invalid ? "invalid" : ""}`} role="radiogroup" aria-label={T.portfolio.yourStars} onKeyDown={onKey}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={T.portfolio.starN(i)}
            tabIndex={value === i || (!value && i === 1) ? 0 : -1}
            onClick={() => onChange(i)}
          >
            <Star size={28} className={i <= value ? "filled" : ""} aria-hidden />
          </button>
        ))}
      </div>
      {value > 0 && <span className="small" style={{ fontWeight: 600 }}>{T.portfolio.starLabels[value]}</span>}
    </div>
  );
}
