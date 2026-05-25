"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboardNav({ onHelp }: { onHelp?: () => void } = {}) {
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Skip if focus is in a text input / textarea / contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "d": case "D": router.push("/demo/dashboard"); break;
        case "a": case "A": router.push("/demo/agent-ops"); break;
        case "e": case "E": router.push("/demo/escalations"); break;
        case "v": case "V": router.push("/demo/evals"); break;
        case "l": case "L": router.push("/demo/audit"); break;
        case "s": case "S": router.push("/demo/settings"); break;
        case "?": onHelp?.(); break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router, onHelp]);
}
