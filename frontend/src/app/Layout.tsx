import { ArrowLeft, Bell, LogOut, Menu, Moon, Search, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import SearchPalette from "@/features/search/SearchPalette";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import { Avatar } from "@/shared/ui";

import { useAuth, useMe } from "./auth";
import { ModalHost } from "./modals";
import { navFor, pageTitle } from "./nav";
import { useCounters } from "./queries";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* brauzer xotirasi yopiq bo'lishi mumkin */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      /* e'tiborsiz */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))] as const;
}

export default function Layout() {
  const me = useMe();
  const { logout } = useAuth();
  const counters = useCounters(me);
  const meta = useMeta();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const groups = navFor(me.role);
  const home = me.role === "department" ? "/buyurtmalar" : "/";
  const isHome = location.pathname === home;

  return (
    <div className="app">
      <div className={`sidebar-backdrop ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label={T.nav.menu}>
        <Link to={home} className="brand" style={{ color: "var(--text)" }}>
          <span className="brand-mark">
            <Sparkles />
          </span>
          {T.app}
        </Link>
        <nav className="nav">
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group-title">{g.title}</div>
              {g.items.map((item) => {
                const count = item.counter ? counters[item.counter] : 0;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
                    <item.icon />
                    <span className="grow ellipsis">{item.label}</span>
                    {count > 0 && (
                      <span className={`count-pill ${item.counter === "notifications" ? "danger" : ""}`}>{count}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="me">
          <Link to="/profil" className="grow" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", minWidth: 0 }}>
            <Avatar user={me} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 650 }}>
                {me.full_name}
              </div>
              <div className="me-role ellipsis">{me.department_name || meta.label("roles", me.role)}</div>
            </div>
          </Link>
          <button className="icon-btn" onClick={logout} title={T.nav.logout} aria-label={T.nav.logout}>
            <LogOut />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMenuOpen(true)} aria-label={T.nav.menu}>
            <Menu />
          </button>
          {!isHome && (
            <button className="icon-btn" onClick={() => navigate(-1)} aria-label={T.common.back} title={T.common.back}>
              <ArrowLeft />
            </button>
          )}
          <h1 className="ellipsis" style={{ fontSize: 17 }}>
            {pageTitle(location.pathname, me.role)}
          </h1>
          <div className="spacer" />
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Search />
            <span className="grow ellipsis hide-sm" style={{ textAlign: "left" }}>
              {T.nav.searchPlaceholder}
            </span>
            <kbd className="hide-sm">Ctrl K</kbd>
          </button>
          <button className="icon-btn" onClick={toggleTheme} title={T.nav.theme} aria-label={T.nav.theme}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <Link to="/bildirishnomalar" className="icon-btn" aria-label={T.nav.notifications} title={T.nav.notifications}>
            <Bell />
            {counters.notifications > 0 && <span className="bell-dot">{counters.notifications}</span>}
          </Link>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>

      <ModalHost />
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
