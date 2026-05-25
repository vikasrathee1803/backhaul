"use client";

import React, { useState, useEffect } from "react";

export interface TopBarProps {
  workspaceName?: string;
  title?: string;
  plan?: string;
  breadcrumb?: { label: string; href?: string }[];
  userEmail?: string;
  actions?: React.ReactNode;
  onCommandOpen?: () => void;
}

const SearchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const PLACEHOLDERS = [
  "Search returns, SKUs, decisions…",
  "Find RTN-2024-001…",
  "Search by customer or marketplace…",
];

export function TopBar({ workspaceName, title, plan, breadcrumb, userEmail, actions, onCommandOpen }: TopBarProps) {
  const resolvedWorkspace = workspaceName ?? breadcrumb?.[0]?.label ?? "";
  const resolvedTitle = title ?? (breadcrumb && breadcrumb.length > 1
    ? breadcrumb[breadcrumb.length - 1].label
    : breadcrumb?.[0]?.label ?? "");

  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("backhaul.theme") as "dark" | "light" | null;
      setTheme(stored ?? "dark");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next === "light" ? "light" : "";
    if (typeof window !== "undefined") {
      localStorage.setItem("backhaul.theme", next);
    }
    setTheme(next);
  }

  const initials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "OP";

  return (
    <>
      <header style={{
        height: 36,
        flexShrink: 0,
        borderBottom: "1px solid var(--border-0)",
        background: "var(--bg-0)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}>
        {/* Workspace pill + page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
          {resolvedWorkspace && (
            <span style={{
              display: "inline-flex", alignItems: "center", height: 22, padding: "0 10px",
              borderRadius: 999, background: "var(--bg-2)", border: "1px solid var(--border-0)",
              fontSize: 11.5, fontWeight: 500, color: "var(--text-1)", whiteSpace: "nowrap",
            }}>{resolvedWorkspace}</span>
          )}
          {resolvedTitle && resolvedTitle !== resolvedWorkspace && (
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-0)", whiteSpace: "nowrap" }}>
              {resolvedTitle}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Command palette / search */}
        <button
          onClick={onCommandOpen}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            height: 32, padding: "0 8px 0 10px",
            background: "var(--accent-soft)", border: "1px solid oklch(0.74 0.13 225 / 0.3)",
            borderRadius: 6, color: "var(--text-2)",
            minWidth: 280, cursor: "pointer",
            transition: "border-color 0.12s",
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.74 0.13 225 / 0.55)"}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.74 0.13 225 / 0.3)"}
        >
          <SearchIcon />
          <div style={{ flex: 1, position: "relative", height: 16, overflow: "hidden" }}>
            {PLACEHOLDERS.map((p, i) => (
              <span key={p} style={{
                position: "absolute", inset: 0, fontSize: 12.5, color: "var(--text-1)",
                opacity: i === phIdx ? 1 : 0,
                transform: i === phIdx ? "translateY(0)" : "translateY(-4px)",
                transition: "opacity 0.32s ease, transform 0.32s ease",
              }}>{p}</span>
            ))}
          </div>
          <span className="kbd">⌘K</span>
        </button>

        {/* Extra actions */}
        {actions}

        {/* Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {plan === "pro" && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: "2px 7px",
              borderRadius: 999, background: "var(--plan-pro-bg)", color: "var(--accent)",
            }}>PRO</span>
          )}

          <div style={{ position: "relative", marginLeft: 4 }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "linear-gradient(135deg, oklch(0.7 0.13 30), oklch(0.62 0.14 350))",
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "oklch(0.18 0.04 20)",
                cursor: "pointer",
              }}
            >
              {initials}
            </button>

            {menuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 49 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div style={{
                  position: "absolute", right: 0, top: 34,
                  width: 220, zIndex: 50,
                  background: "var(--bg-2)", border: "1px solid var(--border-1)",
                  borderRadius: 8, boxShadow: "var(--shadow-pop)", overflow: "hidden",
                }}>
                  {userEmail && (
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-0)" }}>
                      <p style={{ fontSize: 12, color: "var(--text-0)", margin: 0, fontWeight: 500 }}>{userEmail}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-3)", margin: "2px 0 0" }}>Returns Ops Lead</p>
                    </div>
                  )}
                  <button
                    onClick={toggleTheme}
                    style={{ display: "block", width: "100%", padding: "9px 14px", textAlign: "left", fontSize: 12.5, color: "var(--text-1)", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    Theme: {theme === "dark" ? "Dark ●" : "Light ○"}
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setShortcutsOpen(true); }}
                    style={{ display: "block", width: "100%", padding: "9px 14px", textAlign: "left", fontSize: 12.5, color: "var(--text-1)", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    Keyboard shortcuts
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Shortcuts modal */}
      {shortcutsOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }}
            onClick={() => setShortcutsOpen(false)}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 420, background: "var(--bg-1)", border: "1px solid var(--border-1)",
            borderRadius: 12, boxShadow: "var(--shadow-pop)", zIndex: 61, padding: 20,
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>Keyboard shortcuts</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px", fontSize: 12.5 }}>
              {[
                ["Open command palette", "⌘K"],
                ["Dashboard", "G D"],
                ["Agent Ops", "G O"],
                ["Escalations", "G E"],
                ["Evals", "G V"],
                ["Audit Log", "G A"],
                ["Settings", "G S"],
              ].map(([label, k]) => (
                <React.Fragment key={label}>
                  <span style={{ color: "var(--text-1)" }}>{label}</span>
                  <span className="kbd">{k}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
