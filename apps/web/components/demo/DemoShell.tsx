"use client";

import { Sidebar } from "@/components/shared/Sidebar";

export function DemoShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <Sidebar pathPrefix="/demo" />
      <main style={{
        flex: 1,
        marginLeft: 232,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100vh",
      }}>
        {children}
      </main>
    </div>
  );
}
