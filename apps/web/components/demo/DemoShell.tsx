"use client";

import { useState } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { KeyboardHelpModal } from "@/components/shared/KeyboardHelpModal";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";

export function DemoShell({ children }: { children: React.ReactNode }) {
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  useKeyboardNav({ onHelp: () => setShowKeyboardHelp(true) });

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

      {showKeyboardHelp && (
        <KeyboardHelpModal onClose={() => setShowKeyboardHelp(false)} />
      )}
    </div>
  );
}
