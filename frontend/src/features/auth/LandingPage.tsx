import { Building2, CheckCircle, History, KanbanSquare, Moon, Sparkles, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { T } from "@/shared/text";
import { Button } from "@/shared/ui";

const FEATURE_ICONS: Record<string, ReactNode> = {
  board: <KanbanSquare size={24} color="var(--primary)" />,
  orders: <Building2 size={24} color="var(--success)" />,
  review: <CheckCircle size={24} color="var(--warning)" />,
  history: <History size={24} color="var(--info)" />,
};

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light")
  );
  
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* brauzer xotirasi yopiq bo'lishi mumkin */
    }
  };

  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">{T.nav.skipContent}</a>
      <header className="landing-header">
        <Link to="/" className="brand landing-brand">
          <span className="brand-mark"><Sparkles /></span>
          <span className="brand-copy"><strong>{T.app}</strong><span>{T.nav.workspace}</span></span>
        </Link>
        <nav className="landing-nav" aria-label={T.nav.menu}>
          <Button variant="ghost" className="landing-theme" onClick={toggleTheme} aria-label={T.nav.theme} title={T.nav.theme} aria-pressed={theme === "dark"}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          <Link to="/kirish" className="btn btn-ghost">{T.landing.login}</Link>
          <Link to="/royxatdan-otish" className="btn btn-primary">{T.landing.register}</Link>
        </nav>
      </header>

      <main id="landing-main" className="landing-main" tabIndex={-1}>
        <section className="landing-hero">
          <span className="landing-eyebrow">{T.landing.eyebrow}</span>
          <h1>{T.landing.title}</h1>
          <p>{T.landing.subtitle}</p>
          <div className="landing-actions">
            <Link to="/royxatdan-otish" className="btn btn-primary btn-lg">{T.landing.register}</Link>
            <Link to="/kirish" className="btn btn-lg">{T.landing.login}</Link>
          </div>
        </section>

        <section className="landing-feature-section" aria-labelledby="landing-features-title">
          <h2 id="landing-features-title">{T.landing.featuresTitle}</h2>
          <div className="landing-features">
          {T.landing.features.map((f) => (
            <article key={f.key} className="landing-feature">
              <div className="landing-feature-icon">{FEATURE_ICONS[f.key]}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        &copy; {new Date().getFullYear()} {T.app}. {T.landing.footer}
      </footer>
    </div>
  );
}
