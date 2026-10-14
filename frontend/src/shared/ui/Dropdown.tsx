import { Check, ChevronDown } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

export interface DropdownOption<V extends string> {
  value: V;
  label: string;
}

interface DropdownProps<V extends string> {
  value: V;
  options: DropdownOption<V>[];
  onChange: (value: V) => void;
  /** Ekran o'qigich uchun nom (tugmada ko'rinadigan matn alohida: `prefix` + tanlangan variant). */
  ariaLabel: string;
  /** Tugmada tanlangan variant oldida chiqadigan so'z, masalan "Saralash:". */
  prefix?: string;
  icon?: ReactNode;
  className?: string;
}

/**
 * Brauzerning o'z `<select>` menyusi o'rniga — loyiha uslubidagi ochiluvchi ro'yxat (tanlanganda belgi bilan).
 * Klaviatura: ↑ ↓ Home End tanlaydi, Enter/Space qabul qiladi, Esc yopadi (fokus tugmaga qaytadi), Tab yopadi.
 * Tashqariga bosilsa yopiladi.
 */
export function Dropdown<V extends string>({ value, options, onChange, ariaLabel, prefix, icon, className = "" }: DropdownProps<V>) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [active, setActive] = useState(selectedIndex);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();
  const optionId = (index: number) => `${uid}-option-${index}`;
  const current = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };

  const onTriggerKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  };
  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActive((i) => Math.min(last, i + 1)); break;
      case "ArrowUp": event.preventDefault(); setActive((i) => Math.max(0, i - 1)); break;
      case "Home": event.preventDefault(); setActive(0); break;
      case "End": event.preventDefault(); setActive(last); break;
      case "Enter":
      case " ": event.preventDefault(); choose(active); break;
      case "Escape": event.preventDefault(); event.stopPropagation(); close(); break;
      case "Tab": close(false); break;
    }
  };

  return (
    <div className={`dd ${className}`.trim()} ref={root}>
      <button
        ref={trigger}
        type="button"
        className="input dd-trigger"
        aria-label={`${ariaLabel}: ${current?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onTriggerKey}
      >
        {icon}
        <span className="dd-label">{prefix ? `${prefix} ${current?.label ?? ""}` : current?.label}</span>
        <ChevronDown size={16} className="dd-chevron" aria-hidden />
      </button>
      {open && (
        <ul
          ref={list}
          className="dd-menu"
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              className={`dd-option${index === active ? " active" : ""}${option.value === value ? " selected" : ""}`}
              onPointerEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
