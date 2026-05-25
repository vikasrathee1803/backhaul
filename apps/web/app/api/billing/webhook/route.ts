import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig!, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    const priceId = sub.items.data[0]?.price.id ?? "";

    let plan: string = "free";
    for (const [key, cfg] of Object.entries(PLANS)) {
      if (cfg.priceId === priceId) { plan = key; break; }
    }

    const limits = PLANS[plan as keyof typeof PLANS]?.limits;
    await supabase.from("workspaces").update({
      plan,
      stripe_subscription_id: sub.id,
      returns_limit: limits?.returns_per_month ?? 0,
    }).eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await supabase.from("workspaces").update({
      plan: "free",
      stripe_subscription_id: null,
      returns_limit: 0,
    }).eq("stripe_customer_id", sub.customer as string);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const customerId = session.customer as string;
    if (userId && customerId) {
      await supabase.from("workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("owner_id", userId);
    }
  }

  return NextResponse.json({ received: true });
}
