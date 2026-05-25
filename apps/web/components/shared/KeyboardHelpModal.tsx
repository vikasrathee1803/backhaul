"use client";

import { useEffect } from "react";

const SHORTCUTS = [
  { key: "D", desc: "Returns queue" },
  { key: "A", desc: "Agent Ops view" },
  { key: "E", desc: "Escalations" },
  { key: "V", desc: "Eval results" },
  { key: "L", desc: "Audit log" },
  { key: "S", desc: "Settings" },
  { key: "?", desc: "This help" },
  { key: "Esc", desc: "Close drawer / modal" },
];

export function KeyboardHelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 90 }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "var(--bg-1)", border: "1px solid var(--border-1)",
        borderRadius: "var(--radius)", padding: "24px 28px", zIndex: 91,
        minWidth: 320, boxShadow: "var(--shadow-pop)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-0)", marginBottom: 16 }}>
          Keyboard shortcuts
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}
            >
              <span style={{ fontSize: 12.5, color: "var(--text-1)" }}>{s.desc}</span>
              <kbd style={{
                fontFamily: "var(--font-geist-mono)", fontSize: 11, fontWeight: 600,
                padding: "2px 7px", borderRadius: 4,
                background: "var(--bg-3)", border: "1px solid var(--border-1)",
                color: "var(--text-0)",
              }}>
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: "100%", height: 32,
            background: "var(--bg-3)", border: "1px solid var(--border-1)",
            borderRadius: 5, fontSize: 12.5, color: "var(--text-1)", cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </>
  );
}
