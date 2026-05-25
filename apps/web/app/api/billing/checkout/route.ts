import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getStripe, PLANS } from "@/lib/stripe/client";

function safeOrigin(request: NextRequest): string {
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await request.json() as { plan: "starter" | "pro" };
  const planConfig = PLANS[plan];
  if (!planConfig?.priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("owner_id", user.id)
    .single();

  const stripe = getStripe();
  const origin = safeOrigin(request);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: workspace?.stripe_customer_id ?? undefined,
    customer_email: workspace?.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: planConfig.priceId as string, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    success_url: `${origin}/app?checkout=success`,
    cancel_url: `${origin}/pricing`,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
