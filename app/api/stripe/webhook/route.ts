import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Stripe from "stripe";

// Stripe requires the raw request body (unparsed) to verify the webhook
// signature, so this route must NOT run through Next's default JSON body
// parsing — reading req.text() below gives us the raw bytes.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${message}`);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // Service-role client: this handler runs with no logged-in user, so RLS
  // (which relies on auth.uid()) would block every write. Stripe's verified
  // signature above is what authorizes these writes instead of a user session.
  const supabase = createServiceRoleClient();

  switch (event.type) {
    // Fires whenever a Connect account's status changes — including the
    // moment a host finishes (or fails) Express onboarding.
    case "account.updated": {
      const account = event.data.object as Stripe.Account;

      const onboardingComplete =
        account.details_submitted && account.charges_enabled;

      const { error } = await supabase
        .from("profiles")
        .update({ stripe_onboarding_complete: !!onboardingComplete })
        .eq("stripe_account_id", account.id);

      if (error) {
        console.error("Failed to update onboarding status:", error.message);
      }
      break;
    }

    // Wired up in week 2, once bookings + PaymentIntents exist:
    // confirms a booking as soon as the guest's payment succeeds.
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;

      const { error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("stripe_payment_intent_id", intent.id);

      if (error) {
        console.error("Failed to confirm booking:", error.message);
      }
      break;
    }

    default:
      // Unhandled event types are expected — Stripe sends many event
      // categories we don't need to react to.
      break;
  }

  return NextResponse.json({ received: true });
}
