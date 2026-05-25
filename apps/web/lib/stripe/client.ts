import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2024-06-20",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get: (_, prop) => getStripe()[prop as keyof Stripe],
});

export const PLANS = {
  free: {
    name: "Demo",
    price: 0,
    priceId: null,
    limits: { returns_per_month: 0, is_real_data: false },
  },
  starter: {
    name: "Starter",
    price: 49,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    limits: { returns_per_month: 500, is_real_data: true },
  },
  pro: {
    name: "Pro",
    price: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    limits: { returns_per_month: -1, is_real_data: true },
  },
  enterprise: {
    name: "Enterprise",
    price: null,
    priceId: null,
    limits: { returns_per_month: -1, is_real_data: true },
  },
} as const;

export type Plan = keyof typeof PLANS;
export const PLAN_ORDER: Record<Plan, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
