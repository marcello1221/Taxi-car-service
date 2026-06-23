import Stripe from 'stripe';
import type { PaymentProvider } from '@taxi/shared';

export interface PaymentResult {
  success: boolean;
  provider: PaymentProvider;
  intentId?: string;
  clientSecret?: string;
  error?: string;
}

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export async function createPaymentIntent(
  amountUsd: number,
  metadata: Record<string, string>
): Promise<PaymentResult> {
  const amountCents = Math.round(amountUsd * 100);
  const stripe = getStripe();

  if (!stripe) {
    return {
      success: true,
      provider: 'stripe',
      intentId: `demo_stripe_${Date.now()}`,
      clientSecret: 'demo_secret',
    };
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata,
      payment_method_types: ['card'],
      automatic_payment_methods: { enabled: false },
    });
    return {
      success: true,
      provider: 'stripe',
      intentId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
    };
  } catch (err) {
    return { success: false, provider: 'stripe', error: String(err) };
  }
}

export async function capturePayment(intentId: string, amountUsd: number): Promise<boolean> {
  const stripe = getStripe();
  if (stripe && !intentId.startsWith('demo_')) {
    try {
      await stripe.paymentIntents.capture(intentId, {
        amount_to_capture: Math.round(amountUsd * 100),
      });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
