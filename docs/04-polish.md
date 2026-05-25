# Phase 4 — Agent Ops View Polish

**Status:** Complete  
**Date:** 2026-05-25  
**Gate:** `tsc --noEmit` → 0 errors

---

## What Was Built

Phase 4 delivers the in-app Agent Ops view to demo-quality: live graph execution with node state animations, a rich decision drawer, keyboard navigation, drift monitoring, and prompt version comparison. A non-technical viewer can watch 60 seconds and understand what the product does.

---

## Polish Checklist

### GraphCanvas (live node state updates — CRITICAL FIX)

- [x] Separated dagre layout computation (stable, `useMemo` with empty deps — runs once) from state sync (`useEffect` calling `setNodes`/`setEdges` whenever props change)
- [x] Node state transitions (idle → running → complete) propagate in real time without layout recomputation
- [x] Edge `animated` and `style` properties sync on every `graphEdges` prop change
- [x] `node-activate` CSS animation fires on running state (0.3s ease)
- [x] `boxShadow` glow on running nodes (`0 0 12px <borderColor>`)
- [x] Cost meter and eval accuracy badge in top-right Panel
- [x] MiniMap with per-node state color
- [x] `fitView` with 0.15 padding on mount

### DecisionDrawer (full decision data)

- [x] `activeReturnId?: string` prop — looks up matching return from `DEMO_RETURNS`
- [x] `onOverride?: (returnId, disposition, reason) => void` prop
- [x] Disposition badge — colored per-disposition (refund/warn, replace/accent, repair/teal, refurbish/green, donate/purple, dispose/danger, escalate/orange)
- [x] Confidence meter — 4px progress bar, green ≥ 80% / warn below
- [x] Reasoning block — left-bordered with disposition color
- [x] Candidate dispositions — ranked list with score bars and color-coded badges
- [x] Override UI — expand/collapse, disposition selector (pill buttons), reason textarea, submit confirmation ("Override submitted — added to eval dataset")
- [x] Prompt version shown in stats grid
- [x] Escape key closes drawer

### Mock Data

- [x] `ReturnDecision.prompt_version: string` added
- [x] `ReturnDecision.candidate_dispositions: Array<{disposition, score, reason}>` added
- [x] `ReturnDecision.escalation_reason?: string` added
- [x] `ReturnItem.escalation_reason?: string` added
- [x] All 6 decided/escalated returns populated with realistic 3-item candidate arrays

### Keyboard Navigation

- [x] `hooks/useKeyboardNav.ts` — `D` Dashboard, `A` Agent Ops, `E` Escalations, `V` Evals, `L` Audit, `S` Settings, `?` help modal
- [x] `components/shared/KeyboardHelpModal.tsx` — modal with all shortcuts + Esc to close
- [x] `DemoShell.tsx` wired: `useKeyboardNav({ onHelp })` + `<KeyboardHelpModal>` conditional render
- [x] Inputs/textareas excluded from key capture

### Agent Ops Page

- [x] `activeReturnId="RTN-2024-001"` wired into `DecisionDrawer`
- [x] `onOverride` console logger wired (Phase 5: POST to `/api/graph/override`)
- [x] Drift indicator panel — shows after run completes, 7-day delta accuracy + cost, no-drift green dot
- [x] Prompt A/B comparison panel — decision_v1 (100%) vs v0 (91%) side-by-side

### Eval Results Page

- [x] Updated to real Phase 3 test counts: 76/76 passing
- [x] Per-agent rows use actual test counts (5/6/6/9/7/10/9/7/7/7/3)
- [x] Failing cases section shows "76/76 tests passing — all clear" when empty
- [x] KPI: "all clear" label when 0 failures

### Empty / Loading / Error States

- [x] Graph idle state: hint overlay ("Click a node to inspect · Press Run triage to animate")
- [x] Run triage button: disabled + spinner when running
- [x] Stream state pill: Ready / Streaming… / Run complete with animated dot
- [x] Node counter: `X/10 nodes · $0.00XX` during run
- [x] DecisionDrawer: only shows decision section when `decision_agent` selected and decision data available

---

## Performance

- GraphCanvas layout runs once (useMemo with `[]`). 20-node graph animates smooth at 60fps.
- State sync via `useEffect` + `setNodes` avoids layout recompute on every animation frame.
- All demo data is module-level constants (no fetching, no loading states).

---

## Files Changed

| File | Change |
|---|---|
| `components/agent-ops/GraphCanvas.tsx` | useMemo+useEffect fix for live node state |
| `components/agent-ops/DecisionDrawer.tsx` | Full decision data, confidence bar, candidates, override UI |
| `app/demo/_mock/data.ts` | Added `prompt_version`, `candidate_dispositions`, `escalation_reason` |
| `app/demo/agent-ops/page.tsx` | activeReturnId wired, drift indicator, prompt A/B panel |
| `app/demo/evals/page.tsx` | Real 76/76 test counts, all-clear empty state |
| `hooks/useKeyboardNav.ts` | NEW — global keyboard shortcuts |
| `components/shared/KeyboardHelpModal.tsx` | NEW — keyboard shortcut reference modal |
| `components/demo/DemoShell.tsx` | Wired useKeyboardNav + KeyboardHelpModal |

---

## Gate Commands

```
tsc --noEmit   → 0 errors
```

---

## Phase 5 Preview

Phase 5 deploys the system:
- Vercel for the Next.js app
- Render for the Python agent service
- Neon Postgres, Upstash Redis
- Braintrust configured, Sentry configured
- README: 90-second pitch, demo gif, architecture diagram, "why not NAVI/Loop/Fini" section
- Run-locally instructions, eval results screenshot, cost analytics screenshot
