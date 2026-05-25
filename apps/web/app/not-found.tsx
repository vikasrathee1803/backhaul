import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", gap: 16,
      background: "var(--bg-0)", color: "var(--text-0)",
    }}>
      <span style={{
        fontFamily: "var(--font-geist-mono)", fontSize: 48,
        fontWeight: 700, color: "var(--text-3)",
      }}>404</span>
      <p style={{ color: "var(--text-2)" }}>Page not found.</p>
      <Link href="/demo" style={{ color: "var(--accent)" }}>← Go to dashboard</Link>
    </div>
  );
}
