"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", gap: 16,
      background: "var(--bg-0)", color: "var(--text-0)",
    }}>
      <p style={{ color: "var(--danger)" }}>Something went wrong.</p>
      <p style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-geist-mono)" }}>
        {error.message}
      </p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
