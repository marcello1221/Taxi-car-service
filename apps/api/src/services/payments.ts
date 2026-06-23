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
  provider: PaymentProvider,
  amountUsd: number,
  metadata: Record<string, string>
): Promise<PaymentResult> {
  const amountCents = Math.round(amountUsd * 100);

  switch (provider) {
    case 'stripe':
      return createStripePayment(amountCents, metadata);
    case 'tabapay':
      return createTabapayPayment(amountCents, metadata);
    case 'currencycloud':
      return createCurrencyCloudPayment(amountUsd, metadata);
    default:
      return { success: false, provider, error: 'Unknown provider' };
  }
}

async function createStripePayment(
  amountCents: number,
  metadata: Record<string, string>
): Promise<PaymentResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { success: true, provider: 'stripe', intentId: `demo_stripe_${Date.now()}`, clientSecret: 'demo_secret' };
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata,
      automatic_payment_methods: { enabled: true },
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

async function createTabapayPayment(
  amountCents: number,
  metadata: Record<string, string>
): Promise<PaymentResult> {
  const clientId = process.env.TABAPAY_CLIENT_ID;
  const clientSecret = process.env.TABAPAY_CLIENT_SECRET;
  const baseUrl = process.env.TABAPAY_API_URL || 'https://api.tabapay.com/v1';

  if (!clientId || !clientSecret) {
    return {
      success: true,
      provider: 'tabapay',
      intentId: `demo_tabapay_${Date.now()}`,
      clientSecret: 'demo_tabapay_token',
    };
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: 'USD',
        type: 'pull',
        reference: metadata.rideId,
      }),
    });

    const data = await res.json() as { transactionID?: string; error?: string };
    if (!res.ok) {
      return { success: false, provider: 'tabapay', error: data.error || 'Tabapay error' };
    }

    return {
      success: true,
      provider: 'tabapay',
      intentId: data.transactionID,
    };
  } catch (err) {
    return { success: false, provider: 'tabapay', error: String(err) };
  }
}

async function createCurrencyCloudPayment(
  amountUsd: number,
  metadata: Record<string, string>
): Promise<PaymentResult> {
  const loginId = process.env.CURRENCYCLOUD_LOGIN_ID;
  const apiKey = process.env.CURRENCYCLOUD_API_KEY;
  const env = process.env.CURRENCYCLOUD_ENV || 'sandbox';
  const baseUrl =
    env === 'production'
      ? 'https://api.currencycloud.com'
      : 'https://devapi.currencycloud.com';

  if (!loginId || !apiKey) {
    return {
      success: true,
      provider: 'currencycloud',
      intentId: `demo_cc_${Date.now()}`,
    };
  }

  try {
    const authRes = await fetch(`${baseUrl}/v2/authenticate/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: loginId, api_key: apiKey }),
    });
    const authData = await authRes.json() as { auth_token?: string };
    if (!authData.auth_token) {
      return { success: false, provider: 'currencycloud', error: 'Auth failed' };
    }

    const paymentRes = await fetch(`${baseUrl}/v2/payments/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': authData.auth_token,
      },
      body: JSON.stringify({
        currency: 'USD',
        amount: amountUsd.toFixed(2),
        reason: `Taxi ride ${metadata.rideId}`,
        reference: metadata.rideId,
      }),
    });

    const paymentData = await paymentRes.json() as { id?: string; error_code?: string };
    if (!paymentRes.ok) {
      return { success: false, provider: 'currencycloud', error: paymentData.error_code };
    }

    return {
      success: true,
      provider: 'currencycloud',
      intentId: paymentData.id,
    };
  } catch (err) {
    return { success: false, provider: 'currencycloud', error: String(err) };
  }
}

export async function capturePayment(
  provider: PaymentProvider,
  intentId: string,
  amountUsd: number
): Promise<boolean> {
  if (provider === 'stripe' && getStripe() && !intentId.startsWith('demo_')) {
    try {
      await getStripe()!.paymentIntents.capture(intentId, {
        amount_to_capture: Math.round(amountUsd * 100),
      });
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
