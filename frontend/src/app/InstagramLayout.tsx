import { Home, Search, Heart, PlusSquare } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useMe } from "./auth";
import { Avatar } from "@/shared/ui";
import { ModalHost } from "./modals";

export default function InstagramLayout() {
  const me = useMe();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      maxWidth: "480px",
      margin: "0 auto",
      backgroundColor: "var(--bg)",
      borderLeft: "1px solid var(--bord)",
      borderRight: "1px solid var(--bord)",
      position: "relative"
    }}>
      {/* Top Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--bord)",
        backgroundColor: "var(--bg)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}>
        <div style={{ fontFamily: "cursive", fontSize: 24, fontWeight: "bold" }}>
          TeamFlow
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Heart size={24} />
          <MessageCircleIcon />
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }} tabIndex={-1} id="main-content">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "12px 0",
        borderTop: "1px solid var(--bord)",
        backgroundColor: "var(--bg)",
        position: "sticky",
        bottom: 0,
        zIndex: 10
      }}>
        <Link to="/" style={{ color: isActive("/") ? "var(--fg)" : "var(--mut)" }}>
          <Home size={28} strokeWidth={isActive("/") ? 2.5 : 2} />
        </Link>
        <Link to="/" style={{ color: isActive("/") ? "var(--fg)" : "var(--mut)" }}>
          <Search size={28} strokeWidth={isActive("/") ? 2.5 : 2} />
        </Link>
        <Link to="/" style={{ color: isActive("/yangi") ? "var(--fg)" : "var(--mut)" }}>
          <PlusSquare size={28} strokeWidth={isActive("/yangi") ? 2.5 : 2} />
        </Link>
        <Link to="/profil" style={{ color: isActive("/profil") ? "var(--fg)" : "var(--mut)" }}>
          <div style={{ 
            borderRadius: "50%", 
            border: isActive("/profil") ? "2px solid var(--fg)" : "2px solid transparent",
            padding: 2
          }}>
            <Avatar user={me} />
          </div>
        </Link>
      </nav>
      
      <ModalHost />
    </div>
  );
}

function MessageCircleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
}
