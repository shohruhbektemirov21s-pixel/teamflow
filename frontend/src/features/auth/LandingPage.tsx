import { Building2, CheckCircle, History, KanbanSquare, Moon, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { T } from "@/shared/text";
import { Button } from "@/shared/ui";

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (document.documentElement.dataset.theme as any) || "light"
  );
  
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", color: "var(--text)" }}>
      <header style={{ display: "flex", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 18 }}>
          <Sparkles color="var(--primary)" />
          {T.app}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Button variant="ghost" onClick={toggleTheme}>
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          <Link to="/kirish"><Button variant="ghost">Kirish</Button></Link>
          <Link to="/royxatdan-otish"><Button variant="primary">Boshlash</Button></Link>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "80px 20px" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: 800, letterSpacing: "-1px", marginBottom: 24, lineHeight: 1.1 }}>
          Jamoangiz bir joyda <br/> ishlaydigan platforma
        </h1>
        <p style={{ fontSize: "1.2rem", color: "var(--muted)", maxWidth: 600, marginBottom: 40 }}>
          Loyiha oching, jamoani mutaxassisligi bo'yicha yig'ing, vazifalarni bering va hammasini bitta tizimda kuzatib boring.
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <Link to="/royxatdan-otish"><Button variant="primary" style={{ padding: "0 24px", height: 48, fontSize: 16 }}>Bepul boshlash</Button></Link>
          <Link to="/kirish"><Button style={{ padding: "0 24px", height: 48, fontSize: 16 }}>Hisobga kirish</Button></Link>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", marginTop: 80, maxWidth: 1000 }}>
          {[
            { icon: <KanbanSquare size={24} color="var(--primary)" />, title: "Kanban doska", desc: "Vazifalarni ustunlar bo'ylab sudrab o'tkazing va oson boshqaring." },
            { icon: <Building2 size={24} color="var(--success)" />, title: "Boshqarmalar bilan ishlash", desc: "Buyurtmalar qabul qiling va ularni loyihaga aylantiring." },
            { icon: <CheckCircle size={24} color="var(--attention)" />, title: "Admin tekshiruvi", desc: "Bajarilgan ishlar ro'yxatda tekshiruv navbatiga tushadi." },
            { icon: <History size={24} color="var(--danger)" />, title: "O'zgarmas tarix", desc: "Kim qachon nima qilgani doimiy tarixda qoladi." },
          ].map(f => (
            <div key={f.title} style={{ width: 280, padding: 24, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, textAlign: "left", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 600 }}>{f.title}</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: "32px", textAlign: "center", color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        &copy; {new Date().getFullYear()} {T.app}. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
