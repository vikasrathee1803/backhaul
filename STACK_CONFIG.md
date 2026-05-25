# STACK_CONFIG.md — LineaIQ Shared Stack
# Copy this file to any new project as CLAUDE.md or paste into the project's CLAUDE.md.
# Every section marked [REQUIRED] must be honoured. Sections marked [PATTERN] are
# templates to reuse verbatim; adapt only the domain-specific content inside them.

---

## Stack at a glance

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js App Router | 14.x |
| Language | TypeScript | 5.x (strict) |
| Database / Auth | Supabase (SSR) | ^2 |
| AI | Anthropic SDK | ^0.98 |
| Payments | Stripe | ^22 |
| Charts | Recharts | ^3 |
| Graph / DAG | @xyflow/react + dagre | ^12 / ^0.8 |
| Email | Resend | ^6 |
| Cache / Queue | Upstash Redis + QStash | ^1 / ^2 |
| Analytics | PostHog | ^1 |
| Animations | Framer Motion | ^12 |
| Font | Geist (next/font) | ^1 |
| Icons | Lucide React | ^1 |
| Command palette | cmdk | ^1 |
| Testing | Vitest + Testing Library | latest |

**What this stack does NOT use:**
- Tailwind utility classes in JSX (CSS custom properties only — see Design System)
- Prisma or Drizzle (Supabase JS client directly)
- Redux or Zustand (React state + context)
- Page Router (App Router only)

---

## [REQUIRED] Project structure

```
app/
├── (marketing)/        ← server components, no auth
├── app/                ← authenticated workspace area
│   └── [workspaceSlug]/
├── demo/               ← public demo workspace (no auth)
│   ├── _mock/data.ts   ← all demo data in one file
│   ├── layout.tsx      ← server component wrapping DemoShell
│   └── [page]/page.tsx ← "use client" pages
├── api/                ← route handlers (see API Pattern)
├── auth/               ← login / signup / callback
├── globals.css         ← single source of design tokens
├── layout.tsx          ← root layout (fonts, PostHog, metadata)
├── not-found.tsx       ← branded 404
└── error.tsx           ← global error boundary
components/
├── shared/             ← Sidebar, TopBar, PlanGate, PostHogProvider
└── demo/               ← DemoDetailPanel, DemoShell, Tour
lib/
├── supabase/
│   ├── client.ts       ← browser client (createBrowserClient)
│   ├── server.ts       ← server client (createServerClient + cookies)
│   └── admin.ts        ← service-role client (never expose to browser)
└── auth/
    └── workspace.ts    ← userBelongsToWorkspace, authoriseProjectAccess, safeOrigin
middleware.ts           ← session refresh + route protection
```

---

## [REQUIRED] TypeScript rules

- `strict: true` always. No `any` unless explicitly wrapping an external SDK type.
- Path alias: `@/*` maps to project root. Always use `@/` imports.
- Never use `require()`. ESM only (`import`/`export`).
- Every exported type lives at the top of its file, not in a separate `types/` folder
  unless shared across 3+ files.

---

## [REQUIRED] Design system — CSS custom properties

All colours, radii, shadows, and spacing come from `var(--*)` tokens defined in
`globals.css`. **Never hardcode hex or rgb values in component files.**

### Color tokens

```css
/* Backgrounds — 5 elevation levels */
--bg-0   /* page canvas */
--bg-1   /* sidebar, cards */
--bg-2   /* raised surfaces, inputs */
--bg-3   /* active nav, hover states */
--bg-4   /* dropdowns, popovers */

/* Text — 4 hierarchy levels */
--text-0   /* primary */
--text-1   /* secondary */
--text-2   /* muted */
--text-3   /* placeholder / disabled */

/* Borders */
--border-0  /* subtle */
--border-1  /* default */
--border-2  /* strong */

/* Semantic */
--accent          /* primary CTA colour (cyan-blue) */
--accent-soft     /* tinted bg for accent inputs */
--accent-glow     /* box-shadow glow colour */
--accent-fg       /* text on accent bg */
--success         /* green */
--warn            /* amber */
--danger          /* red */
--ai              /* purple-magenta (AI features only) */

/* System badge colours */
--sys-snowflake  --sys-dbt  --sys-airflow  --sys-tableau  --sys-postgres

/* Plan pill tokens */
--plan-pro-bg     --plan-starter-bg     --plan-free-bg

/* Zone label */
--zone-label  /* muted uppercase nav section labels */
```

### Radius tokens

```
--radius-sm: 6px   --radius: 8px   --radius-lg: 12px   --radius-xl: 16px
```

### Shadow tokens

```
--shadow-1   /* card shadow */
--shadow-2   /* elevated panel */
--shadow-pop /* popovers, modals */
```

### Density

```css
--density: 1             /* user-settable multiplier */
--row-h: calc(28px * var(--density))   /* use for table rows */
```

### Light theme

`[data-theme="light"]` overrides all `--bg-*`, `--text-*`, and `--border-*` tokens.
Semantic and accent tokens are shared across themes. To toggle:

```ts
function toggleTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "";
  localStorage.setItem("app.theme", theme);
}
```

---

## [REQUIRED] Utility CSS classes

Use these class names instead of writing the same inline styles repeatedly.

| Class | What it does |
|---|---|
| `.card` | bg-1, border-0, radius-lg, standard card surface |
| `.btn` | Base button (28px, bg-2, border-0, radius-sm) |
| `.btn-sm` | 24px height variant |
| `.btn-lg` | 36px height variant |
| `.btn-ghost` | Transparent background |
| `.btn-primary` | Accent background + accent-fg text |
| `.btn-ai` | Gradient border (ai → accent) |
| `.badge` | Inline monospace chip (20px, Geist Mono, 11px) |
| `.pill` | Rounded status indicator (22px, 11.5px) |
| `.mono` | Geist Mono font |
| `.kbd` | Keyboard key indicator |
| `.scroll` | Custom scrollbar (opt-in) |
| `.row` | `display:flex; flex-direction:row` |
| `.col` | `display:flex; flex-direction:column` |
| `.gap-1/2/3/4/6/8` | 4/8/12/16/24/32px gap |
| `.text-0/1/2/3` | var(--text-*) color |
| `.text-accent` | var(--accent) color |
| `.text-ai` | var(--ai) color |
| `.divider-v` | Vertical 1px separator |
| `.divider-h` | Horizontal 1px separator |
| `.focus-ring` | Accessible 2px focus outline |
| `.ai-text` | Shimmer gradient text for AI labels |
| `.ai-glow` | Drop-shadow on AI icons |

### Animations available via CSS class

| Class / keyframe | Use |
|---|---|
| `fade-up` | Page entrance (opacity + translateY) |
| `panel-slide-in` | Right panel slide in |
| `scan-pulse` | Skeleton loading |
| `pulse-dot` | Live indicator dot |
| `ai-shimmer` | AI loading shimmer |
| `flow-dash` / `dash-flow` | Animated SVG graph edges |

---

## [PATTERN] Supabase client setup

### Browser client (`lib/supabase/client.ts`)

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### Server client (`lib/supabase/server.ts`)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Component — safe to ignore */ }
        },
      },
    },
  );
}
```

### Admin client (`lib/supabase/admin.ts`) — server only

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
```

---

## [PATTERN] Middleware

```ts
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/", "/auth", "/pricing", "/demo", "/api/billing/webhook"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (s) => s.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + "/"))
    || pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  if (!isPublic && !user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

---

## [PATTERN] Workspace authorisation (`lib/auth/workspace.ts`)

Use these guards in every API route that touches workspace-scoped data.

```ts
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ORIGINS = [
  "https://yourdomain.com",
  "https://www.yourdomain.com",
  "https://yourdomain.vercel.app",
  "http://localhost:3000",
];

export async function userBelongsToWorkspace(
  userId: string, workspaceId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return !!data;
}

export async function authoriseProjectAccess(
  userId: string, projectId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects").select("workspace_id").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const ok = await userBelongsToWorkspace(userId, project.workspace_id);
  return ok ? project.workspace_id : null;
}

export function safeOrigin(requestOrigin: string | null): string {
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return ALLOWED_ORIGINS[0];  // production domain
}
```

---

## [PATTERN] API route — authenticated + workspace-guarded

```ts
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { userBelongsToWorkspace } from "@/lib/auth/workspace";

export async function POST(req: NextRequest, { params }: { params: { workspaceId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await userBelongsToWorkspace(user.id, params.workspaceId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // your handler logic
}
```

---

## [PATTERN] Claude AI call — server-side, user-initiated only

**Rule: never auto-trigger Anthropic API calls. Every call must start from a user button click.**

```ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// In your API route handler:
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",                // current default — check STACK_CONFIG for latest
  max_tokens: 800,                            // keep lean; increase only when output is genuinely long
  system: "Your system prompt here.",
  messages: [{ role: "user", content: userPrompt }],
});
const text = (message.content[0] as Anthropic.TextBlock).text;
```

**Model IDs (current as of 2026-05):**
- Default / general: `claude-sonnet-4-6`
- Cheap / fast / short tasks: `claude-haiku-4-5-20251001`
- Complex reasoning: `claude-opus-4-7`

---

## [PATTERN] Stripe — checkout + portal

```ts
// checkout route — use safeOrigin() for redirect URLs
import Stripe from "stripe";
import { safeOrigin } from "@/lib/auth/workspace";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const origin = safeOrigin(req.headers.get("origin"));
const session = await stripe.checkout.sessions.create({
  customer_email: user.email,
  success_url: `${origin}/app/${workspaceSlug}?checkout=success`,
  cancel_url:  `${origin}/pricing`,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
});
```

---

## [PATTERN] Shared layout components

### Sidebar props

```ts
interface SidebarProps {
  workspaceSlug: string;
  workspaceName: string;
  plan: string;           // "pro" | "starter" | "free" — drives colored plan pill
  projectId?: string;     // active project for deep links
  pathPrefix?: string;    // defaults to /app/${workspaceSlug}; use "/demo" for demo
}
```

### TopBar props

```ts
interface TopBarProps {
  workspaceName?: string;   // shows as pill on the left
  title?: string;           // page title next to the pill
  plan?: string;            // "free" shows Upgrade menu item in avatar dropdown
  breadcrumb?: { label: string; href?: string }[];  // legacy — kept for backward compat
  userEmail?: string;       // shows avatar with initials + dropdown menu
  actions?: React.ReactNode;  // rendered between search bar and avatar
  onCommandOpen?: () => void; // called when search bar is clicked
}
```

Usage:
```tsx
<TopBar workspaceName={ws.name} title="Dashboard" plan={ws.plan}
  userEmail={user.email}
  actions={<Link href="/executive" className="btn btn-sm">Executive view →</Link>}
/>
```

---

## [PATTERN] Demo workspace

### Mock data file (`app/demo/_mock/data.ts`)

Single file. Export typed constants only — no functions, no async. Example shape:

```ts
export const DEMO_WORKSPACE = {
  id: "demo", name: "Acme Analytics", slug: "demo", plan: "pro",
  nodes_count: 312, ai_queries_today: 47,
};

export const DEMO_PROJECT = { id: "proj-1", name: "core-warehouse", ... };
export const DEMO_AI_INSIGHTS: Node[] = [...];
export const DEMO_GOVERNANCE_ITEMS: GovernanceItem[] = [...];
export const DEMO_PROJECTS: Project[] = [...];
```

### Demo layout pattern

```
app/demo/layout.tsx      ← server component (no "use client")
  └── DemoShell          ← client component (TourProvider + TourTrigger)
       └── Sidebar + <main>{children}</main>
```

`layout.tsx` must remain a server component so Next.js can stream it.
`DemoShell` is the client boundary.

### Demo page pattern

```tsx
"use client";

import { useState } from "react";
import { TopBar } from "@/components/shared/TopBar";
import { DemoDetailPanel, xyzToDetail, type DemoDetailItem } from "@/components/demo/DemoDetailPanel";
import { DEMO_WORKSPACE } from "../_mock/data";

export default function DemoPage() {
  const [detail, setDetail] = useState<DemoDetailItem | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar workspaceName={DEMO_WORKSPACE.name} title="Page name" plan={DEMO_WORKSPACE.plan} />
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 28px 40px" }}>
          {/* content — make rows/cards clickable with onClick={() => setDetail(xyzToDetail(item))} */}
        </div>
      </div>
      <DemoDetailPanel item={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
```

---

## [PATTERN] DemoDetailPanel — detail item types

```ts
type DetailKind = "node" | "governance" | "pipeline" | "doc" | "insight" | "member" | "search-result";

interface DemoDetailItem {
  kind: DetailKind;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  meta?: { label: string; value: string }[];
  summary?: string;
  risks?: { level: string; text: string }[];
  suggestions?: string[];
  related?: { label: string; href: string }[];
}
```

Mapping helpers: `nodeToDetail`, `governanceToDetail`, `pipelineToDetail`, `insightToDetail`
— import from `@/components/demo/DemoDetailPanel`.

---

## [PATTERN] Self-guided product tour

The tour system lives in `components/demo/Tour.tsx`. It needs no configuration per-page.

**To add a tour stop to any element:**
1. Add `data-tour="tour-STEP-NAME"` to the element you want spotlighted.
2. Add a matching step to the `STEPS` array in `Tour.tsx`:
```ts
{
  target: "tour-STEP-NAME",
  title: "Short heading",
  body: "1–2 sentence explanation of what this does.",
  placement: "right",  // top | bottom | left | right | center
  hint: "(optional) small italic note at the base",
  cta: true,  // only on the final step — shows signup link
}
```

`TourTrigger` is already mounted by `DemoShell` on all demo pages. No further wiring needed.

---

## [PATTERN] Error boundaries

Create these files. Their content is boilerplate — swap the copy only.

```
app/error.tsx            ← global boundary ("use client")
app/not-found.tsx        ← 404 page
app/app/error.tsx        ← authenticated area boundary
app/app/loading.tsx      ← skeleton for server-side pages
app/demo/error.tsx       ← demo boundary
```

Error boundary shape:
```tsx
"use client";
export default function SomeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { ... }
```

---

## [REQUIRED] Inline CSS rules

- All styles go in `style={{}}` props. No separate CSS files except `globals.css`.
- Use `var(--token-name)` for every colour, border, radius, shadow.
- Never write `px` values inline unless they are one-off layout values (padding, gap, width)
  that genuinely do not belong in a token.
- For `oklch()` colours used only once (e.g. a specific glow), write them inline.
  If used in 2+ places, extract to a CSS token.

---

## [REQUIRED] Security rules

1. Every API route that reads or writes workspace data must call `userBelongsToWorkspace`.
2. Every Stripe `success_url` / `cancel_url` / `return_url` must be built with `safeOrigin()`.
3. Validate user-supplied string lengths before passing to Anthropic: `MAX = 4000` chars.
4. Never import `lib/supabase/admin.ts` in a client component or a `"use client"` file.
5. Never commit `.env`, `.env.local`, `*.p8`, or `serviceAccountKey.json`.
6. Never auto-trigger Claude API calls. All AI calls must start from a user button click.

---

## [REQUIRED] Environment variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Upstash (if using Redis/QStash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=

# Resend (if using email)
RESEND_API_KEY=

# PostHog (optional)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

---

## [REQUIRED] Build rules

- Run `npx tsc --noEmit` after every file change. Zero errors before committing.
- Run `npm run build` before marking any phase complete. All routes must compile.
- Fix TypeScript errors immediately — never suppress with `// @ts-ignore`.
- Every demo page must have a pre-filled default state. No blank inputs, no "coming soon".
- Every Claude API call must have a loading state + error state with retry.

---

## New app checklist

Copy this to the top of your session when starting a new app.

- [ ] Copy `lib/supabase/` (client, server, admin)
- [ ] Copy `lib/auth/workspace.ts` — update `ALLOWED_ORIGINS`
- [ ] Copy `middleware.ts` — update `PUBLIC_PREFIXES`
- [ ] Copy `globals.css` — update `--accent` hue if the new app has a different brand colour
- [ ] Copy `components/shared/Sidebar.tsx` + `TopBar.tsx` — update `ZONES` nav items
- [ ] Copy error boundary files — update copy
- [ ] Create `app/demo/_mock/data.ts` with domain-specific mock data
- [ ] Copy `components/demo/DemoDetailPanel.tsx` — update `DetailKind` union + mapper functions
- [ ] Copy `components/demo/DemoShell.tsx` — no changes needed
- [ ] Copy `components/demo/Tour.tsx` — update `STEPS` array for new domain
- [ ] Update `ALLOWED_ORIGINS` in `workspace.ts` and `safeOrigin()` for new domain
- [ ] Fill `.env.local` from the template above
- [ ] `npx tsc --noEmit` → clean
- [ ] `npm run build` → clean
