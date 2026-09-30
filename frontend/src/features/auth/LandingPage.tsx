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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      <header style={{ display: "flex", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 18 }}>
          <Sparkles color="var(--primary)" />
          {T.app}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Button variant="ghost" onClick={toggleTheme} aria-label={T.nav.theme} title={T.nav.theme}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          <Link to="/kirish" className="btn btn-ghost">{T.landing.login}</Link>
          <Link to="/royxatdan-otish" className="btn btn-primary">{T.landing.register}</Link>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "80px 20px" }}>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 24, lineHeight: 1.1, maxWidth: 640 }}>
          {T.landing.title}
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--muted)", maxWidth: 600, marginBottom: 40 }}>
          {T.landing.subtitle}
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/royxatdan-otish" className="btn btn-primary btn-lg">{T.landing.register}</Link>
          <Link to="/kirish" className="btn btn-lg">{T.landing.login}</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24, marginTop: 80, maxWidth: 1040, width: "100%" }}>
          {T.landing.features.map((f) => (
            <div key={f.key} style={{ padding: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", textAlign: "left", boxShadow: "var(--shadow)" }}>
              <div style={{ marginBottom: 16 }}>{FEATURE_ICONS[f.key]}</div>
              <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 600 }}>{f.title}</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: "32px", textAlign: "center", color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        &copy; {new Date().getFullYear()} {T.app}. {T.landing.footer}
      </footer>
    </div>
  );
}
