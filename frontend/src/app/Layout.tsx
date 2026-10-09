import { ArrowLeft, Bell, LogOut, Menu, Moon, Search, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import SearchPalette from "@/features/search/SearchPalette";
import { useMeta } from "@/shared/meta";
import { T } from "@/shared/text";
import { Avatar } from "@/shared/ui";

import { useAuth, useMe } from "./auth";
import { ModalHost, useModal } from "./modals";
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
  const { open } = useModal();
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
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const groups = navFor(me.role);
  const home = "/"; // hamma rolda bosh sahifa — Bosh panel (Boshqarmada o'z buyurtmalari)
  const isHome = location.pathname === home;

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        {T.nav.skipContent}
      </a>
      <button
        type="button"
        className={`sidebar-backdrop ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-label={T.nav.closeMenu}
        aria-hidden={!menuOpen}
        tabIndex={menuOpen ? 0 : -1}
      />
      <aside id="app-sidebar" className={`sidebar ${menuOpen ? "open" : ""}`} aria-label={T.nav.menu}>
        <Link to={home} className="brand">
          <span className="brand-mark">
            <Sparkles />
          </span>
          <span className="brand-copy">
            <strong>{T.app}</strong>
            <span>{T.nav.workspace}</span>
          </span>
        </Link>
        <nav className="nav" aria-label={T.nav.menu}>
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
          <Link to="/profil" className="me-link grow">
            <Avatar user={me} />
            <div className="grow me-copy">
              <div className="me-name ellipsis">{me.full_name}</div>
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
          <button
            className="icon-btn mobile-only"
            onClick={() => setMenuOpen(true)}
            aria-label={T.nav.openMenu}
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
          >
            <Menu />
          </button>
          {!isHome && (
            <button className="icon-btn" onClick={() => navigate(-1)} aria-label={T.common.back} title={T.common.back}>
              <ArrowLeft />
            </button>
          )}
          <div className="topbar-title">
            <span className="topbar-eyebrow">{T.nav.workspace}</span>
            <h1 className="ellipsis">{pageTitle(location.pathname, me.role)}</h1>
          </div>
          <div className="spacer" />
          <button type="button" className="search-trigger" aria-label={T.nav.searchPlaceholder} onClick={() => setSearchOpen(true)}>
            <Search />
            <span className="grow ellipsis hide-sm" style={{ textAlign: "left" }}>
              {T.nav.searchPlaceholder}
            </span>
            <kbd className="hide-sm">Ctrl K</kbd>
          </button>
          <button className="icon-btn" onClick={toggleTheme} title={T.nav.theme} aria-label={T.nav.theme} aria-pressed={theme === "dark"}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <button className="icon-btn" onClick={() => open({ notifications: true })} aria-label={T.nav.notifications} title={T.nav.notifications}>
            <Bell />
            {counters.notifications > 0 && <span className="bell-dot">{counters.notifications}</span>}
          </button>
        </header>
        <main id="main-content" className="page" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <ModalHost />
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
