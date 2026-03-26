/**
 * Stripe (Visa) integration - Checkout session, webhook
 * Docs: https://stripe.com/docs
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 */

import Stripe from "stripe";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";

type StripeCheckoutParams = {
  amountCents: number;
  currency?: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
};

type StripeWebhookResult =
  | { type: string; data: { object: object } }
  | null;

function getStripe(): Stripe | null {
  if (!STRIPE_SECRET) return null;
  return new Stripe(STRIPE_SECRET);
}

/**
 * Create Stripe Checkout Session - returns URL to redirect
 */
export async function createStripeCheckout(params: StripeCheckoutParams): Promise<{ url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: params.currency || "vnd",
            product_data: {
              name: `Đơn hàng ${params.orderId}`,
              metadata: params.metadata || {},
            },
            unit_amount: params.amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { orderId: params.orderId, ...params.metadata },
    });

    if (session.url) return { url: session.url };
  } catch (err) {
    console.error("Stripe checkout error:", err);
  }
  return null;
}

/**
 * Verify Stripe webhook signature and construct event
 */
export async function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string
): Promise<StripeWebhookResult> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const stripe = getStripe();
  if (!webhookSecret || !stripe) return null;

  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    return { type: event.type, data: { object: event.data.object as object } };
  } catch (err) {
    console.error("Stripe webhook verify error:", err);
    return null;
  }
}
