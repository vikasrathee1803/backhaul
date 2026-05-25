import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  return supabase.auth.getUser();
}

async function getWorkspace(userId: string) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  return supabase.from("workspaces").select("*").eq("owner_id", userId).single();
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:       { label: "Demo",       color: "var(--text-3)" },
  starter:    { label: "Starter",    color: "oklch(0.72 0.16 145)" },
  pro:        { label: "Pro",        color: "var(--accent)" },
  enterprise: { label: "Enterprise", color: "var(--ai)" },
};

export default async function AppDashboard() {
  const { data: { user }, error } = await getSession();
  if (error || !user) redirect("/auth/login");

  const { data: workspace } = await getWorkspace(user.id);
  const plan = workspace?.plan ?? "free";
  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const processed = workspace?.returns_processed_month ?? 0;
  const limit = workspace?.returns_limit ?? 0;
  const limitLabel = limit === -1 ? "Unlimited" : limit === 0 ? "Demo only" : String(limit);
  const usagePct = limit > 0 ? Math.min((processed / limit) * 100, 100) : 0;

  const displayName = user.user_metadata?.full_name ?? user.email ?? "there";
  const firstName = displayName.split(" ")[0];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-0)", color: "var(--text-0)", fontFamily: "var(--font-sans)" }}>
      {/* Top nav */}
      <header style={{ borderBottom: "1px solid var(--border-0)", padding: "0 28px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, var(--accent), var(--ai))", display: "grid", placeItems: "center" }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>Backhaul</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: planInfo.color, background: "var(--bg-2)", border: "1px solid var(--border-1)", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {planInfo.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/app/settings" style={{ fontSize: 12.5, color: "var(--text-2)", textDecoration: "none" }}>Settings</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ fontSize: 12.5, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sign out</button>
          </form>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
          Welcome back, {firstName}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 40px" }}>
          Here&apos;s a summary of your Backhaul workspace.
        </p>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Returns this month", value: String(processed), sub: `of ${limitLabel}` },
            { label: "Current plan", value: planInfo.label, sub: plan === "free" ? "Demo mode" : "Active subscription" },
            { label: "Workspace", value: workspace?.name ?? "My Workspace", sub: user.email ?? "" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-0)", marginBottom: 2 }}>{stat.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Usage bar (only for paid plans with a limit) */}
        {limit > 0 && (
          <div style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 12, padding: "18px 20px", marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Monthly usage</span>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>{processed} / {limit} returns</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${usagePct}%`, background: usagePct > 90 ? "var(--danger)" : "var(--accent)", borderRadius: 99, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        {/* Quick links */}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>Get started</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 40 }}>
          {[
            { title: "View live demo", desc: "Explore the full returns triage system on fixture data.", href: "/demo/dashboard", cta: "Open demo →" },
            { title: "Manage billing", desc: "Upgrade your plan or manage your subscription.", href: "/app/settings", cta: "Go to settings →" },
            { title: "Pricing plans", desc: "Compare Starter, Pro, and Enterprise features.", href: "/pricing", cta: "See pricing →" },
          ].map((card) => (
            <div key={card.title} style={{ background: "var(--bg-1)", border: "1px solid var(--border-0)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)", marginBottom: 6 }}>{card.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 14 }}>{card.desc}</div>
              <Link href={card.href} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>{card.cta}</Link>
            </div>
          ))}
        </div>

        {/* Upgrade prompt for free plan */}
        {plan === "free" && (
          <div style={{ background: "linear-gradient(120deg, oklch(0.74 0.13 225 / 0.08), oklch(0.72 0.16 305 / 0.05))", border: "1px solid oklch(0.74 0.13 225 / 0.3)", borderRadius: 14, padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-0)", marginBottom: 4 }}>Ready to go live?</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 420 }}>
                Connect real marketplace data and process actual returns. Starter starts at $49/mo — 14-day free trial, no credit card required upfront.
              </div>
            </div>
            <Link href="/pricing" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-fg)", background: "var(--accent)", textDecoration: "none", padding: "10px 20px", borderRadius: 8, whiteSpace: "nowrap" }}>
              View plans →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
