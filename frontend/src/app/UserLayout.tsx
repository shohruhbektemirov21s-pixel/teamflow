import { LogOut, Moon, Settings, Sparkles, Star, Sun, User, Users } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { T } from "@/shared/text";
import { Avatar } from "@/shared/ui";

import { useAuth, useMe } from "./auth";
import { useTheme } from "@/shared/theme";
import { ModalHost } from "./modals";

/** Oddiy foydalanuvchi: tepada panel, kompyuterda chap menyu, telefonda pastki menyu (Dasturchilar · Mening baholarim · Profil). */
export default function UserLayout() {
  const me = useMe();
  const { logout } = useAuth();
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="ushell">
      <a className="skip-link" href="#main-content">{T.nav.skipContent}</a>
      <header className="ubar">
        <Link to="/" className="ubar-brand"><Sparkles size={22} aria-hidden /> {T.app}</Link>
        <span className="grow" />
        <button type="button" className="btn btn-ghost" onClick={toggleTheme} aria-label={T.nav.theme} title={T.nav.theme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Link to="/profil" className="ubar-me" aria-label={T.user.userMenu}>
          <Avatar user={me} size="lg" card={false} />
          <span className="ubar-name ellipsis">{me.first_name || me.full_name}</span>
        </Link>
        <Link to="/sozlamalar" className="btn btn-ghost" aria-label={T.settings.open} title={T.settings.open}>
          <Settings size={18} />
        </Link>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          <LogOut size={16} /> <span className="ubar-logout">{T.nav.logout}</span>
        </button>
      </header>
      <div className="ubody">
        <nav className="utabs" aria-label={T.user.menu}>
          <NavLink to="/" end className="utab"><Users size={20} aria-hidden /><span>{T.user.navDevelopers}</span></NavLink>
          <NavLink to="/baholarim" className="utab"><Star size={20} aria-hidden /><span>{T.user.navReviews}</span></NavLink>
          <NavLink to="/profil" className="utab"><User size={20} aria-hidden /><span>{T.user.navProfile}</span></NavLink>
        </nav>
        <main id="main-content" className="umain" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ModalHost />
    </div>
  );
}
