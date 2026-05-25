# 01c — Design System

**Phase:** 1 — Architecture, Graph Design, Design System (Track B)
**Role:** designer
**Status:** built — Phase 1B deliverable
**Date:** 2026-05-25
**Token source of truth:** `apps/web/app/globals.css`

---

## Carried forward from prior phases

From `00-discovery.md`: seven screens (Dashboard, Return Detail, **Agent Ops View [HERO]**, Escalation Queue, Eval Results, Audit Log, Settings), fifteen agents rendering as graph nodes, a five-way parallel fan-out into the headline Decision Agent, a six-way conditional branch, and one human-in-the-loop checkpoint. From `STACK_CONFIG.md`: CSS custom properties only (no Tailwind utility classes in JSX), Geist + Geist Mono via `next/font`, `@xyflow/react` + `dagre` for the graph, five-level elevation, `--row-h` density token. This design system is the single source of truth for every visual token, primitive, and motion rule that those screens consume.

The accent hue is the lineaiq cyan-blue (`oklch(0.74 0.13 225)`), not the portfolio cobalt. Rationale below in §2. The portfolio's discipline — minimal radius, no shadows on flat surfaces, restraint — is honored; its specific palette is not, because a dark operator console reads better with a luminous cyan signal than a saturated cobalt that fights the dark canvas.

---

## 1. Design Philosophy

### 1.1 Operator-grade density vs SaaS comfort

Most SaaS dashboards are designed to be *non-threatening*: generous whitespace, large rounded cards, soft shadows, one or two numbers per screen, lots of air. That language optimizes for a first-time visitor who must be reassured. Backhaul optimizes for the opposite person — a Returns Ops Lead who lives in this tool eight hours a day and whose job is to move volume. For her, whitespace is latency. Every pixel of padding she has to scan past is a row of returns she is not looking at.

So Backhaul chooses **density**. The tradeoff is explicit and it is a real cost: a dense interface has a steeper first-run learning curve and is less forgiving of a careless layout. We accept that cost because the primary user is not a first-run user — she is an expert operator, and the product's entire pitch ("2 people doing the work of 10") only lands if the tool lets two people *see and act on* a lot at once. A comfortable interface would undercut the thesis.

Density here is not "cram everything in." It is **earned density**: information is packed, but every element is aligned to a 4px grid, every group is separated by a hairline rather than a margin, and hierarchy is carried by weight and color rather than by size and space. The result reads as engineered, not crowded.

### 1.2 The three visual principles

1. **Information density first.** Default to the table, not the card grid. Default to 28px rows, not 56px. Default to a hairline divider, not a 24px gap. When a choice is between showing more and showing it bigger, show more. The density is user-tunable (`--density`) for operators who want to dial it back, but the default is tight.

2. **Signal over decoration.** Color is a language, not a mood. Cyan means *accent / action*. Green means *success / refund / high confidence*. Amber means *warning / repair / mid confidence*. Red means *danger / escalate / failure*. Purple means *AI is reasoning*. A surface never uses color decoratively — if something is colored, it is communicating state. Shadows exist only to lift a thing that genuinely floats above the canvas (popovers, the detail panel, a dragged node); flat surfaces (cards, rows, the sidebar) get a hairline border, never a shadow. This keeps the eye trained: a glow or a shadow always *means* "this is elevated / live / important."

3. **Keyboard-native.** The operator's hands stay on the keyboard. Every action has a key. Focus is always visible (a 2px accent ring). The mouse is a fallback, not the primary input. This is the single clearest "serious tool" tell — a tool you can drive without the mouse is a tool built for people who use it all day.

### 1.3 What "serious tool" means in practice

Three reference points, each contributing something specific:

- **Linear** contributes *keyboard-native rigor and motion restraint*. Linear's interactions are fast, its animations are short and purposeful, its information architecture is uncompromising. Backhaul borrows the keyboard model (cheat sheet, single-key actions, arrow navigation) and the motion ceiling (nothing slow, nothing bouncy).

- **Vercel dashboard** contributes *the dark, technical palette and monospace-for-data convention*. Vercel makes a dark surface feel premium rather than gloomy, and it uses monospace deliberately for IDs, hashes, and metrics. Backhaul takes both: the OKLch dark theme and the rule that all data (costs, IDs, confidence scores, model names) is set in Geist Mono.

- **Retool** contributes *the dense, panel-and-table operator layout*. Retool tools are unapologetically information-rich, built for internal operators, with tables, side panels, and inspectors as first-class furniture. Backhaul takes the layout DNA: fixed sidebar, sticky top bar, content table, slide-in detail panel, overlaid control panels on the canvas.

What none of them are is *toy-like*. There are no illustrations, no mascots, no celebratory confetti, no oversized friendly empty states. An empty state in Backhaul is a clear instruction, not a cartoon. "Serious" means the tool respects the operator's time and intelligence on every screen.

---

## 2. Color System

The entire palette is expressed in **OKLch** (`oklch(L C H)` — lightness, chroma, hue). This is a deliberate choice over hex/HSL.

### 2.1 Why OKLch

- **Perceptual uniformity.** In OKLch, equal numeric steps in lightness are equal *perceived* steps. The five background elevations (`0.140 → 0.180 → 0.225 → 0.275 → 0.325`) read as evenly spaced because they *are* evenly spaced perceptually. In HSL the same numeric spacing would clump at the dark end and spread at the light end. A dark UI with five elevation levels lives or dies on this.
- **Accessible lightness is the first axis.** Because L is independent of hue and chroma, we can guarantee text contrast by reasoning about L alone. `--text-0` at L=0.97 on `--bg-0` at L=0.140 is a known, large lightness delta regardless of hue. Re-hueing the accent never silently breaks contrast.
- **Constant-lightness semantic colors.** All four primary semantic colors (success, warn, danger, ai) and both confidence/cost ramps sit at roughly the same lightness band (0.68–0.80). They read as equally bright signals at different hues, which is exactly what a signal language needs — no color "shouts" louder than another by accident.
- **Cheap, legible theming.** A light theme is "raise the bg L values, lower the text L values, leave hue and chroma alone." That is the entire light-theme override block in §2.5.

### 2.2 Base token reference (dark theme — default)

| Token | OKLch value | Semantic meaning |
|---|---|---|
| `--bg-0` | `oklch(0.140 0.005 260)` | Page canvas, graph canvas |
| `--bg-1` | `oklch(0.180 0.005 260)` | Sidebar, cards, node fill |
| `--bg-2` | `oklch(0.225 0.006 260)` | Hover, inputs, running-node fill |
| `--bg-3` | `oklch(0.275 0.007 260)` | Active / pressed, selected row |
| `--bg-4` | `oklch(0.325 0.008 260)` | Separator surface, popover bg |
| `--border-0` | `oklch(0.275 0.007 260)` | Subtle border (cards, rows) |
| `--border-1` | `oklch(0.340 0.008 260)` | Default border (inputs, buttons) |
| `--border-2` | `oklch(0.450 0.009 260)` | Strong border (focused, emphasized) |
| `--text-0` | `oklch(0.97 0.005 260)` | Primary text |
| `--text-1` | `oklch(0.78 0.006 260)` | Secondary text |
| `--text-2` | `oklch(0.58 0.006 260)` | Muted text, captions |
| `--text-3` | `oklch(0.42 0.005 260)` | Placeholder, disabled |
| `--accent` | `oklch(0.74 0.13 225)` | Primary action, links, accent border |
| `--accent-soft` | `oklch(0.74 0.13 225 / 0.14)` | Tinted accent background |
| `--accent-glow` | `oklch(0.74 0.13 225 / 0.28)` | Glow / box-shadow color |
| `--accent-fg` | `oklch(0.18 0.04 240)` | Text on accent background |
| `--success` | `oklch(0.74 0.13 160)` | Success, refund, high confidence |
| `--warn` | `oklch(0.80 0.14 78)` | Warning, repair, mid confidence |
| `--danger` | `oklch(0.68 0.16 22)` | Danger, escalate, failure, low confidence |
| `--ai` | `oklch(0.72 0.16 305)` | AI reasoning, refurb disposition |

### 2.3 Backhaul-specific tokens

These are the returns-domain extensions. They are derived from the semantic palette so the signal language stays coherent — a disposition color is never a brand-new hue, it is a reuse of an existing semantic meaning.

**Disposition colors** (one per disposition the Decision Agent can output):

| Token | OKLch value | Disposition | Why this color |
|---|---|---|---|
| `--disposition-refund` | `oklch(0.74 0.13 160)` | Refund | = success green; money returned cleanly |
| `--disposition-replace` | `oklch(0.74 0.13 225)` | Replace | = accent cyan; the standard "make it right" action |
| `--disposition-repair` | `oklch(0.80 0.14 78)` | Repair | = warn amber; partial / conditional path |
| `--disposition-refurb` | `oklch(0.72 0.16 305)` | Refurbish | = ai purple; the value-recovery play, the wedge |
| `--disposition-donate` | `oklch(0.60 0.04 260)` | Donate | muted blue-gray; low-stakes terminal route |
| `--disposition-dispose` | `oklch(0.50 0.02 260)` | Dispose | darker gray; the write-off |
| `--disposition-escalate` | `oklch(0.68 0.16 22)` | Escalate | = danger red; "a human must look at this" |

**Node state colors** (Agent Ops graph) — these reference the base tokens so a theme change carries through:

| Token | Resolves to | Node state |
|---|---|---|
| `--node-idle` / `--node-idle-border` | `--bg-1` / `--border-0` | Not yet run — subdued |
| `--node-running` / `--node-running-border` | `--bg-2` / `--accent` | Currently executing |
| `--node-running-glow` | `--accent-glow` | The running halo |
| `--node-complete` / `--node-complete-border` | `--bg-1` / `--success` | Finished successfully |
| `--node-failed` / `--node-failed-border` | `--bg-1` / `--danger` | Errored |
| `--node-escalated` / `--node-escalated-border` | `--bg-1` / `--warn` | Awaiting human (HITL) |

**Marketplace badge colors** (one per channel):

| Token | OKLch value | Channel |
|---|---|---|
| `--mp-wayfair` | `oklch(0.65 0.18 250)` | Wayfair (purple) |
| `--mp-amazon` | `oklch(0.80 0.14 78)` | Amazon (orange) |
| `--mp-houzz` | `oklch(0.68 0.16 22)` | Houzz (red) |
| `--mp-overstock` | `oklch(0.72 0.14 165)` | Overstock (green) |
| `--mp-shopify` | `oklch(0.74 0.13 160)` | Direct Shopify (green) |

**Confidence meter** — the bar that shows the Decision Agent's self-reported confidence:

| Token | Resolves to | Band |
|---|---|---|
| `--confidence-high` | `--success` | ≥ 0.80 |
| `--confidence-mid` | `--warn` | 0.60 – 0.79 |
| `--confidence-low` | `--danger` | < 0.60 |

**Cost meter** — running cost-per-decision, gated against the brief's economics:

| Token | Resolves to | Threshold |
|---|---|---|
| `--cost-ok` | `--success` | < $0.02 |
| `--cost-warn` | `--warn` | $0.02 – $0.0499 |
| `--cost-danger` | `--danger` | ≥ $0.05 |

The cost thresholds are deliberately stricter than the brief's $0.10 per-run hard ceiling: the cost meter turns amber at $0.02 and red at $0.05 so the operator sees a cost problem *before* it becomes a gate failure. A run that hits $0.10 is already a CI-failing bug; the meter's job is to warn long before then.

### 2.4 Color decision rationale (summary)

OKLch is chosen for perceptual uniformity (even elevation ramp), lightness-first accessibility (text contrast is reasoned about on one axis), and cheap theming. Every Backhaul-specific color is a reuse of a semantic token, never a new hue, so the four-color signal language (cyan/green/amber/red + AI purple) stays the whole vocabulary. The only colors that introduce genuinely new hues are the marketplace badges — and those are *brand* colors (Wayfair purple, Amazon orange) deliberately quarantined to the badge primitive, where they identify a channel and never carry semantic state.

### 2.5 Light theme (deferred to v2; mechanism defined now)

Light theme is a v2 feature, but the *mechanism* is locked now so no component hardcodes a dark assumption. Theme is driven by a `data-theme` attribute on `<html>`; the dark theme is the default `:root`, and `[data-theme="light"]` overrides only the structural tokens (backgrounds, text, borders). Semantic colors (accent, success, warn, danger, ai) and all derived Backhaul tokens are shared across themes — they are tuned to read on both.

```css
[data-theme="light"] {
  --bg-0: oklch(0.985 0.003 260);
  --bg-1: oklch(0.965 0.004 260);
  --bg-2: oklch(0.935 0.005 260);
  --bg-3: oklch(0.900 0.006 260);
  --bg-4: oklch(0.860 0.007 260);
  --border-0: oklch(0.900 0.006 260);
  --border-1: oklch(0.840 0.007 260);
  --border-2: oklch(0.740 0.008 260);
  --text-0: oklch(0.220 0.010 260);
  --text-1: oklch(0.380 0.009 260);
  --text-2: oklch(0.520 0.008 260);
  --text-3: oklch(0.640 0.007 260);
}
```

Toggle:

```ts
function toggleTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "";
  localStorage.setItem("backhaul.theme", theme);
}
```

The toggle lives in Settings. Default and demo theme are always dark — the hero Agent Ops view is designed dark-first.

---

## 3. Typography

### 3.1 Font stack

| Family | Role | Loaded via |
|---|---|---|
| **Geist** | All UI text — labels, body, headings, table cells, buttons | `geist/font/sans` (`next/font`) |
| **Geist Mono** | All data — costs, IDs, model names, confidence scores, hashes, latencies, freight figures | `geist/font/mono` (`next/font`) |

Geist is the entire UI typeface. Geist Mono is reserved, strictly, for *machine values* — anything the system computed or that identifies a record. This is the Vercel convention and it is load-bearing: when an operator sees monospace, she knows she is looking at data, not prose. Mixing them communicates structure for free.

### 3.2 Type scale

The scale is restrained — seven steps, no more — because density is carried by weight and color, not by a wide range of sizes.

| Size | Token class | Use |
|---|---|---|
| **11px** | `.fs-11` | Uppercase labels, badge text, zone labels, table column headers |
| **12px** | `.fs-12` | Table data, dense secondary text, captions |
| **13px** | `.fs-13` | Body text, form values, default UI text |
| **14px** | `.fs-14` | Emphasis, button labels, active-row text |
| **16px** | `.fs-16` | Section headings, panel titles |
| **18px** | `.fs-18` | Sub-page headings (sparingly) |
| **22px** | `.fs-22` | Page titles |
| **28px** | `.fs-28` | KPI numbers (dashboard cards, cost totals) |

### 3.3 Letter-spacing rules

- **Uppercase labels** (11px, used for zone labels, column headers, badge text) get `letter-spacing: +0.4px`. Uppercase at small sizes is unreadable without tracking; +0.4px opens it up just enough.
- **KPI numbers** (28px) get `letter-spacing: -0.02em`. Large numerals look loose at default tracking; a slight negative tightens them into a confident, dense figure.
- Everything else uses the font's default metrics. Do not track body text.

### 3.4 Where Geist Mono is required (non-negotiable)

Set in Geist Mono, always:

- **All costs** — `$0.0082`, `$0.0007`, daily aggregate `$1.42`
- **All IDs** — `RTN-2024-0481`, `ORD-91022`, `run_a8f3c`, `cus_Nf2...`
- **All model names** — `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-7`
- **Confidence scores** — `0.87`, `0.61`
- **Latencies** — `142ms`, `1.4s`
- **Freight / physical figures** — `168 lbs`, freight class `85`, `$42.10` inbound estimate
- **Prompt versions** — `v3`, `decision@v7`
- **Hashes / input fingerprints** in the audit log

Prose — reasoning text, customer comms drafts, escalation summaries — is Geist (sans), because it is language, not data.

---

## 4. Spacing & Layout

### 4.1 Grid

**4px base unit.** Every margin, padding, gap, and dimension is a multiple of 4px. The gap utilities (`.gap-1` … `.gap-8`) encode 4 / 8 / 12 / 16 / 24 / 32px. This single rule is what makes density read as engineered rather than crowded — nothing is ever 1px off a rhythm.

### 4.2 Frame dimensions

| Element | Spec |
|---|---|
| **Sidebar** | 232px fixed width; `--bg-1`; full height; 1px right border `--border-0` |
| **Content area** | `max-width: 1320px`; `margin: 0 auto`; `padding: 24px 28px 40px` |
| **TopBar** | 36px height; sticky `top: 0`; `z-index: 30`; `--bg-1`; 1px bottom border |
| **Detail panel** (Return Detail, Decision drawer) | 380px fixed, right-anchored; `top: 36px` (sits below the TopBar); full remaining height; `--bg-1`; 1px left border; `--shadow-2` (it floats over content) |
| **Agent Ops graph canvas** | Remaining space after the 232px sidebar; full viewport height below TopBar; `--bg-0`; `BackgroundVariant.Dots` |
| **Row height** | `--row-h: calc(28px * var(--density))` — every table/list row uses this, never a hardcoded height |

### 4.3 Density token

`--density` defaults to `1` and is exposed as a control in Settings (Compact `0.9` / Default `1` / Comfortable `1.15`). Only `--row-h` is derived from it in v1; the token is reserved so future density-sensitive measures (padding scales) can hang off the same dial. Changing density never reflows the layout frame — only the rows breathe.

---

## 5. Component Primitives

For each: visual spec, state variants, when to use, when **not** to use.

### 5.1 Card
- **Visual:** `background: var(--bg-1)`; `border: 1px solid var(--border-0)`; `border-radius: var(--radius-lg)` (12px); **no shadow**.
- **States:** static. A clickable card gets `cursor: pointer` and a `--border-1` border on hover; no lift, no scale.
- **Use for:** data containers — KPI cards, the freight-economics block, the marketplace config viewer panel.
- **Do NOT use for:** UI chrome (toolbars, the sidebar, the top bar). Those are surfaces, not cards. A card is a *content* container; chrome uses raw `--bg-1` with borders, no radius.

### 5.2 Button variants

| Variant | Height | Background | Border | Text | Use |
|---|---|---|---|---|---|
| `.btn` | 28px | `--bg-2` | 1px `--border-1` | `--text-0` | Default action |
| `.btn-sm` | 24px | `--bg-2` | 1px `--border-1` | `--text-0` | Inline / table-row actions |
| `.btn-lg` | 36px | `--bg-2` | 1px `--border-1` | `--text-0` | Primary screen CTA (Run triage) |
| `.btn-ghost` | inherits | transparent | none | `--text-1` | Tertiary / icon buttons |
| `.btn-primary` | inherits | `--accent` | none | `--accent-fg` | The one primary action per context |
| `.btn-danger` | inherits | transparent | 1px `--danger` | `--danger` | Destructive (reset seed data) |

- **Shared:** `border-radius: var(--radius-sm)` (6px); 13px Geist; 600 weight on primary/lg; `0 12px` horizontal padding; transition `120ms ease-out` on background/border only.
- **States:** hover lightens background one step; `:active` drops to `--bg-3`; `:focus-visible` shows the `.focus-ring`; `:disabled` → 0.45 opacity, no pointer.
- **Do NOT:** stack two `.btn-primary` in the same group — there is one primary action per context.

### 5.3 Badge
- **Visual:** Geist **Mono**; 20px height; `0 6px` padding; 11px font; `border-radius: var(--radius-sm)`; `--bg-2` background, 1px `--border-0`, `--text-1`.
- **Use for:** status, disposition (colored variant below), marketplace (colored variant below), model name, prompt version, any short machine value that labels a row.
- **Do NOT:** put prose in a badge or use it as a button.

### 5.4 Pill
- **Visual:** 22px height; fully rounded (`border-radius: 999px`); `0 8px` padding; 11.5px; usually carries a leading `pulse-dot`.
- **Use for:** *live* status indicators — "Running" / "Connected" / "Awaiting human" on the Agent Ops view and the run-status control.
- **Do NOT:** use for static labels (that is a badge). A pill implies liveness.

### 5.5 Disposition badge
- A `.badge` tinted by `--disposition-*`: text and 1px border in the disposition color, background the same color at ~14% alpha.
- One variant per disposition: **refund** (success), **replace** (accent), **repair** (warn), **refurbish** (ai), **donate** (muted), **dispose** (darker muted), **escalate** (danger).
- **Use for:** the current disposition on a return row, in the decision drawer, on a complete node's left stripe.

### 5.6 Marketplace badge
- A `.badge` tinted by `--mp-*`. Channel name in the channel's brand color, 14%-alpha background.
- **Use for:** identifying a return's channel of origin in the queue, return detail, audit log.
- **Do NOT:** read state into these colors — Houzz red does not mean "danger," it means "Houzz."

### 5.7 Confidence meter
- **Visual:** a horizontal bar, **56px wide × 5px tall**, `border-radius: 3px`, track `--bg-3`, fill width = confidence × 56px. Fill color is `--confidence-high/mid/low` by band. The numeric value sits to the right in Geist Mono 12px (`0.87`).
- **Use for:** the Decision Agent's confidence on the return row, decision drawer, escalation queue.

### 5.8 Cost meter
- **Visual:** inline `$0.0082` in Geist Mono, color `--cost-ok/warn/danger` by threshold. On increment, a brief `cost-tick` pulse (yellow flash) draws the eye to the change.
- **Use for:** per-decision cost everywhere; the running run-total in the Agent Ops top-right; the daily aggregate on the Dashboard.

### 5.9 Node card (Agent Ops)
- **Visual:** **220px wide**; `--bg-1` base; 1px border whose color is the node-state token; **3px left stripe** (disposition color when the node is the Decision node and complete, else the state color); state icon top-right; agent name in Geist Mono 13px; model badge; on complete, latency + cost in mono `--text-3`.
- **State variants:** see §6.2 in full.
- **Use for:** every one of the 15 graph nodes.

### 5.10 Decision drawer
- **Visual:** right panel, 380px, `--bg-1`, 1px left border, `--shadow-2`, slides in via `panel-slide-in`.
- **Contents, top to bottom:** disposition badge + confidence meter (header row); reasoning text (Geist, `--text-1`); cost breakdown (mono, per-node lines summing to the run total); prompt version badge + model badge; **Override** button (`.btn` full-width) that opens the override capture.
- **Use for:** clicking any node in Agent Ops, or the decision record on Return Detail.

---

## 6. Agent Ops View Design Spec (the centerpiece)

The Agent Ops view is the screen the demo lives or dies on. Its job: a non-technical viewer watching for 60 seconds understands the product. The design goal is *legible motion* — the graph must visibly **execute**, not blink to done.

### 6.1 Canvas
- Fills the viewport right of the 232px sidebar, below the 36px TopBar.
- Background `--bg-0` with `@xyflow/react` `BackgroundVariant.Dots` — a faint dot grid that gives spatial depth without competing with the nodes.
- Pan/zoom enabled; fit-view on load; nodes laid out by dagre, never hand-placed.

### 6.2 Node states and their visual representation

| State | Fill | Border | Icon (top-right) | Text | Extra |
|---|---|---|---|---|---|
| **idle** | `--bg-1` | `--border-0` | none | agent name `--text-2` | subdued; the resting graph |
| **running** | `--bg-2` | `--accent` | animated `pulse-dot` | agent name `--text-0` | `box-shadow: 0 0 0 3px var(--node-running-glow)`; entered via `node-activate` |
| **complete** | `--bg-1` | `--success` | checkmark | name `--text-0`; latency + cost `--text-3` mono | 3px left stripe in the disposition color; entered via `node-complete-flash` |
| **failed** | `--bg-1` | `--danger` | X | name `--text-0`; error summary `--text-2` | entered via `node-failed-flash` |
| **escalated** | `--bg-1` | `--warn` | hourglass | "Awaiting human" `--warn` | this is the HITL checkpoint node |

The running glow is the single most important visual: it is the "this node is thinking right now" signal, and because Claude calls take a beat, the glow + pulse-dot is what makes latency read as *work happening* rather than lag (Risk #2 mitigation from discovery).

### 6.3 Edge states

| State | Stroke | Opacity | Dash | Animation |
|---|---|---|---|---|
| **inactive** | `--border-1` | 0.3 | static dashes | none |
| **active** | `--accent` | 1.0 | flowing | `edge-fire` (burst then settle to `dash-flow`) |
| **complete** | `--success` | 0.4 | static dashes | none |

When control flow passes an edge, it fires (`edge-fire`, 600ms): a bright burst travels the edge, then it settles into the steady `dash-flow` march while the downstream node is running, then goes `complete` (dim green) once that node finishes. The eye follows the fire from node to node — that traveling highlight *is* the story of the graph executing.

### 6.4 Layout
- dagre `rankdir: "LR"`, `ranksep: 120`, `nodesep: 60`. Left-to-right matches reading order: Intake on the left, the five fan-out agents stacked in the middle, Decision as the fan-in, the six branch targets, then the comms/audit tail on the right.

### 6.5 Panels overlaid on the canvas

| Position | Contents |
|---|---|
| **Top-left** | Run controls — `Run triage` (`.btn-lg .btn-primary`) + a run-status `.pill` (`Idle` / `Running` with pulse-dot / `Complete`) |
| **Top-right** | Cost meter (running run total, big, mono) + eval status badge (`46/50 passing`) |
| **Bottom-left** | Legend — the five node states with their swatches |
| **Bottom-right** | `@xyflow/react` Minimap |

Panels are `--bg-1` cards with `--shadow-2` (they float over the canvas), 1px `--border-0`, sized to content, never blocking the central flow.

### 6.6 Decision drawer
- Overlays the canvas from the right (the §5.10 primitive). Opens when a node is clicked, populated from that node's persisted `decision_steps` record so it works in live and replay modes identically. `Escape` closes it.

---

## 7. Keyboard Navigation Spec

Keyboard-native is principle #3; this is the contract.

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Focus next / previous interactive element |
| `Arrow keys` | Navigate table rows (up/down) and graph nodes (spatial) |
| `Enter` / `Space` | Activate the focused element |
| `Escape` | Close drawer / modal; clear selection |
| `R` | Run triage (from Dashboard; focus-independent global) |
| `E` | Go to Escalation Queue |
| `O` | Open Agent Ops View |
| `?` | Show the keyboard shortcut cheat sheet |

**Within the graph canvas:**

| Key | Action |
|---|---|
| `+` / `-` | Zoom in / out |
| `0` | Fit view |
| `Arrow keys` | Pan the canvas (when no node is focused) / move node focus (when a node is focused) |

Global single-key actions (`R`, `E`, `O`, `?`) are suppressed while a text input is focused, so typing a search term never fires a navigation. Every focusable element shows the `.focus-ring` (2px accent outline) — focus is never invisible.

---

## 8. Empty / Loading / Error States

Every screen implements all three. No blank white (or blank dark) expanse, ever.

- **Loading.** A `scan-pulse` skeleton that mirrors the loaded layout — skeleton rows at `--row-h`, skeleton KPI blocks at the card's size. **No spinners.** The skeleton tells the operator *what is coming* and where, so the screen feels like it is filling in rather than stalling. The Agent Ops graph is the exception that proves the rule: it renders immediately in the idle state and streams events in, with a `connecting…` pill (pulse-dot) until the stream opens.
- **Empty.** Icon + heading + one line of subtext + a CTA button. Always actionable. Examples from discovery: Dashboard empty → "No returns in queue. Seed fixtures or import a channel." + seed CTA. Escalation Queue empty → "Queue clear. Nothing awaiting review." (a *healthy* state — phrased as good news, no alarming CTA). Eval Results empty → "No eval runs yet. Run the suite to populate." + run CTA.
- **Error.** A banner pinned to the top of the content area (`--danger` border, `--bg-1`, retry button) — **partial data still shows below it where available.** A KPI fetch failure degrades the cards to `—` without blanking the returns table. A decision-record failure on Return Detail does not blank the order context. Errors never take the whole screen hostage.

---

## 9. Motion Guidelines

Motion is restrained and purposeful — Linear's lesson. It communicates state change, never decorates.

- **Duration ceiling: 320ms.** Nothing animates longer. The one exception is the Agent Ops `edge-fire` at 600ms, which is intentionally slower because it *is* the content being watched.
- **Easing:** `cubic-bezier(0.2, 0.7, 0.3, 1)` for panels and drawers (a confident, slightly-overshooting-but-not-bouncy ease-out); `ease-out` for data updates.
- **Data changes: instant.** A table cell updating its value does not transition — a number that fades in reads as slow. Only the cost meter gets a deliberate `cost-tick` flash, because the *fact of incrementing* is information.
- **Structure changes** (drawer open/close, panel reveal): **220ms**.
- **Page transitions:** `fade-up` at **320ms** (opacity + small translateY).
- **Agent Ops specifics:** node state transitions **150ms** (snappy — the graph is busy and many nodes change quickly); edge fire **600ms total** (burst ~200ms, settle ~400ms).

`prefers-reduced-motion` is honored: transitions collapse to near-instant and the looping graph animations (`dash-flow`, `pulse-dot`, `ai-shimmer`) hold a static state. Liveness is then carried by color and the running glow alone — the screen stays legible, just still.

---

## Anti-Drift Checklist (Phase 1B boundary)

1. **Deliverable doc written?** Yes — `C:\Users\test\Backhaul\docs\01c-design-system.md` (this file) + `apps/web/app/globals.css`.
2. **BUILD_LEDGER updated?** Phase 1B rows move `planned → built` (design system doc, globals.css, component primitives, node state designs, keyboard nav spec).
3. **Gate commands?** N/A for a CSS/docs deliverable; globals.css is consumed by the Phase 2A Next.js scaffold where typecheck/lint/build first apply.
4. **Deferred items logged?** Light theme deferred to v2 (mechanism defined). Density-derived padding scales reserved, not built.
5. **Assumptions?** Accent stays lineaiq cyan (not portfolio cobalt) — logged here in §2 rationale; to mirror into ASSUMPTIONS.md.
6. **Re-read discovery — anything unaccounted for?** All seven screens have primitives; all five node states + escalated map to tokens; all six dispositions + five marketplaces have badge tokens; cost/confidence meters defined.
7. **Prior phase commitments carried forward?** Geist + Geist Mono, CSS-custom-properties-only, `@xyflow/react`+dagre, `--row-h` density, 5-level elevation — all honored from STACK_CONFIG.
8. **Per-agent artifacts?** N/A to design phase (Phase 3).
9. **Decision audit row shape?** N/A to design phase; the decision drawer renders the audit fields (agent, prompt version, reasoning, confidence, cost, latency).
10. **Graph topology doc matches?** Node-state designs cover all 15 nodes and the HITL checkpoint from the topology sketch.
11. **Agent Ops renders every node?** Node-card primitive + five state designs cover the full node set.
12. **Cost per run under $0.10?** Cost meter encodes a stricter warn/danger ramp ($0.02 / $0.05) to surface drift before the gate.
