import { LogOut, Moon, Sparkles, Star, Sun, User, Users } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { T } from "@/shared/text";
import { Avatar } from "@/shared/ui";

import { useAuth, useMe } from "./auth";
import { useTheme } from "./Layout";
import { ModalHost } from "./modals";
import "./user-shell.css";

/** Oddiy foydalanuvchi: tepada panel, kompyuterda chap menyu, telefonda pastki menyu (Dasturchilar · Mening baholarim · Profil). */
export default function UserLayout() {
  const me = useMe();
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="ux-shell">
      <a className="skip-link" href="#main-content">{T.nav.skipContent}</a>
      <header className="ux-bar">
        <Link to="/" className="ux-brand">
          <span className="brand-mark" style={{ width: 36, height: 36, borderRadius: 11 }}>
            <Sparkles size={18} aria-hidden />
          </span>
          <span className="ux-brand-text">
            <strong>{T.app}</strong>
            <span>{T.user.roleLabel}</span>
          </span>
        </Link>
        <span className="grow" />
        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={T.nav.theme} title={T.nav.theme} aria-pressed={theme === "dark"}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/profil" className="ux-me" aria-label={T.user.userMenu}>
          <Avatar user={me} size="sm" card={false} />
          <span className="ux-me-text">
            <span className="ux-me-name">{me.full_name}</span>
            <span className="ux-me-role">{T.user.roleLabel}</span>
          </span>
        </Link>
        <button type="button" className="ux-logout" onClick={logout} title={T.nav.logout}>
          <LogOut size={16} aria-hidden />
          <span>{T.nav.logout}</span>
        </button>
      </header>
      <div className="ux-body">
        <nav className="ux-nav" aria-label={T.user.menu}>
          <NavLink to="/" end className="ux-link"><Users aria-hidden /><span>{T.user.navDevelopers}</span></NavLink>
          <NavLink to="/baholarim" className="ux-link"><Star aria-hidden /><span>{T.user.navReviews}</span></NavLink>
          <NavLink to="/profil" className="ux-link"><User aria-hidden /><span>{T.user.navProfile}</span></NavLink>
        </nav>
        <main key={pathname} id="main-content" className="ux-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ModalHost />
    </div>
  );
}
