"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarProps {
  pathPrefix?: string; // defaults to "/demo"
}

// ── SVG icons ────────────────────────────────────────────────────────────────
const icons: Record<string, React.ReactNode> = {
  home: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 6.8L8 2l6 4.8V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M6 15V9h4v6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  queue: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="7" width="12" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="11" width="8" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg>,
  graph: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="13" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="13" cy="12" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7.5L11 4.5M5 8.5L11 11.5" stroke="currentColor" strokeWidth="1.4"/></svg>,
  escalate: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="13" r="1.5" fill="currentColor"/></svg>,
  eval: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  doc: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2h6l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M10 2v4h4M6 9h4M6 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  settings: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.7 3.3l-1.06 1.06M4.36 11.64L3.3 12.7M12.7 12.7l-1.06-1.06M4.36 4.36L3.3 3.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  chevronDown: <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// ── 3-zone nav structure ──────────────────────────────────────────────────────
const ZONES = [
  {
    id: "operations",
    label: "OPERATIONS",
    items: [
      { id: "dashboard",   label: "Returns Queue",  icon: "queue",    path: (prefix: string) => `${prefix}/dashboard` },
    ],
  },
  {
    id: "intelligence",
    label: "INTELLIGENCE",
    items: [
      { id: "agent-ops",   label: "Agent Ops",      icon: "graph",    path: (prefix: string) => `${prefix}/agent-ops` },
      { id: "escalations", label: "Escalations",    icon: "escalate", path: (prefix: string) => `${prefix}/escalations` },
      { id: "evals",       label: "Evals",          icon: "eval",     path: (prefix: string) => `${prefix}/evals` },
    ],
  },
  {
    id: "records",
    label: "RECORDS",
    items: [
      { id: "audit",       label: "Audit Log",      icon: "doc",      path: (prefix: string) => `${prefix}/audit` },
      { id: "settings",    label: "Settings",       icon: "settings", path: (prefix: string) => `${prefix}/settings` },
    ],
  },
] as const;

interface NavItemProps {
  label: string;
  icon: string;
  href: string;
  active: boolean;
}

function NavItem({ label, icon, href, active }: NavItemProps) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "0 8px",
        height: 28,
        borderRadius: 6,
        background: active ? "var(--bg-3)" : "transparent",
        color: active ? "var(--text-0)" : "var(--text-1)",
        border: "none",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        position: "relative",
        transition: "background 0.1s",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {active && (
        <span style={{
          position: "absolute", left: -10, top: 6, bottom: 6, width: 2,
          background: "var(--accent)", borderRadius: 2,
          boxShadow: "0 0 8px var(--accent-glow)",
        }} />
      )}
      <span style={{ color: active ? "var(--accent)" : "var(--text-2)", flexShrink: 0, display: "flex", alignItems: "center" }}>
        {icons[icon]}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </Link>
  );
}

export function Sidebar({ pathPrefix }: SidebarProps) {
  const pathname = usePathname();
  const prefix = pathPrefix ?? "/demo";

  const workspaceName = "Cymax Returns";
  const plan = "pro";
  const initials = workspaceName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const planPill = ({
    pro:     { bg: "var(--plan-pro-bg)",     fg: "var(--accent)",  label: "PRO"     },
    starter: { bg: "var(--plan-starter-bg)", fg: "var(--success)", label: "STARTER" },
    free:    { bg: "var(--plan-free-bg)",    fg: "var(--text-2)",  label: "FREE"    },
  } as Record<string, { bg: string; fg: string; label: string }>)[plan]
    ?? { bg: "var(--bg-3)", fg: "var(--text-2)", label: plan.toUpperCase() };

  return (
    <aside style={{
      width: 232,
      flexShrink: 0,
      background: "var(--bg-1)",
      borderRight: "1px solid var(--border-0)",
      display: "flex",
      flexDirection: "column",
      padding: "10px 12px",
      gap: 0,
      height: "100vh",
      position: "fixed",
      left: 0,
      top: 0,
      zIndex: 40,
      overflowY: "auto",
      overflowX: "hidden",
    }}>
      {/* Workspace badge */}
      <button
        style={{
          height: 40, padding: "0 8px", borderRadius: 8,
          background: "var(--bg-2)", border: "1px solid var(--border-0)",
          width: "100%", color: "var(--text-0)", cursor: "pointer",
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent), oklch(0.55 0.15 260))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "oklch(0.15 0.02 240)",
        }}>{initials}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1, gap: 0, overflow: "hidden" }}>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.15, color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
            {workspaceName}
          </span>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
            padding: "1px 6px", borderRadius: 999, marginTop: 2,
            background: planPill.bg, color: planPill.fg, alignSelf: "flex-start",
          }}>{planPill.label}</span>
        </div>
        <span style={{ color: "var(--text-2)", display: "flex", alignItems: "center", flexShrink: 0 }}>{icons.chevronDown}</span>
      </button>

      {/* Zone-based nav */}
      {ZONES.map((zone, zi) => (
        <div key={zone.id} style={{ marginTop: zi === 0 ? 8 : 12, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{
            padding: "0 8px", fontSize: 10, fontWeight: 700,
            letterSpacing: 0.8, color: "var(--zone-label)", textTransform: "uppercase",
          }}>{zone.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {zone.items.map((item) => {
              const href = item.path(prefix);
              const active = pathname === href || (href !== `${prefix}/dashboard` && pathname.startsWith(href + "/")) || (href === `${prefix}/dashboard` && pathname === href);
              return <NavItem key={item.id} label={item.label} icon={item.icon} href={href} active={active} />;
            })}
          </div>
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* Footer: Backhaul brand */}
      <div style={{
        padding: "10px 8px 4px",
        borderTop: "1px solid var(--border-0)",
        marginTop: 8,
      }}>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--font-geist-mono)" }}>
          Backhaul v0.1 — demo mode
        </div>
      </div>
    </aside>
  );
}
