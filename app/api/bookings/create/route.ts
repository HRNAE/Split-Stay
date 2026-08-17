import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import { differenceInCalendarDays, parseISO } from "date-fns";

export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { listingId, startDate, endDate } = await req.json();

  if (!listingId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing booking details" }, { status: 400 });
  }

  const nights = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
  if (nights < 1) {
    return NextResponse.json(
      { error: "Check-out must be at least one night after check-in" },
      { status: 400 }
    );
  }

  // Fetch listing + host's Connect account. We need the host to have
  // finished onboarding (charges_enabled) before we can split a payment
  // to them — otherwise Stripe will reject the PaymentIntent.
  const { data: listing } = await supabase
    .from("listings")
    .select("id, price_per_night, host_id, profiles!listings_host_id_fkey(stripe_account_id, stripe_onboarding_complete)")
    .eq("id", listingId)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const host = listing.profiles as unknown as {
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean;
  } | null;

  if (!host?.stripe_account_id || !host.stripe_onboarding_complete) {
    return NextResponse.json(
      { error: "This host hasn't finished setting up payouts yet" },
      { status: 400 }
    );
  }

  if (listing.host_id === user.id) {
    return NextResponse.json({ error: "You can't book your own listing" }, { status: 400 });
  }

  const totalAmount = Number((nights * listing.price_per_night).toFixed(2));
  const platformFee = Number((totalAmount * PLATFORM_FEE_PERCENT).toFixed(2));

  // Atomic insert via the create_booking() Postgres function. If another
  // guest already holds these dates, the gist exclusion constraint rejects
  // this at the database level and we surface a clean 409 — no race
  // condition where two people both see "available" and both pay.
  const { data: booking, error: bookingError } = await supabase.rpc("create_booking", {
    p_listing_id: listingId,
    p_guest_id: user.id,
    p_start_date: startDate,
    p_end_date: endDate,
    p_total_amount: totalAmount,
    p_platform_fee: platformFee,
  });

  if (bookingError) {
    const unavailable = bookingError.code === "23P01";
    return NextResponse.json(
      { error: unavailable ? "These dates are no longer available" : bookingError.message },
      { status: unavailable ? 409 : 400 }
    );
  }

  // Destination charge: the guest pays the full total_amount, Stripe splits
  // it — application_fee_amount stays with the platform, the rest transfers
  // straight to the host's connected account. Amounts are in cents.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(totalAmount * 100),
    currency: "usd",
    application_fee_amount: Math.round(platformFee * 100),
    transfer_data: {
      destination: host.stripe_account_id,
    },
    metadata: {
      booking_id: booking.id,
      listing_id: listingId,
      guest_id: user.id,
    },
  });

  // Attach the PaymentIntent id so the webhook can find this booking later
  const serviceClient = createServiceRoleClient();
  const { error: updateError } = await serviceClient
    .from("bookings")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", booking.id);

  if (updateError) {
    // Payment intent was created but we couldn't link it — cancel it so we
    // don't leave an orphaned intent a guest could still pay against.
    await stripe.paymentIntents.cancel(paymentIntent.id);
    return NextResponse.json({ error: "Failed to set up payment" }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    bookingId: booking.id,
    totalAmount,
    nights,
  });
}
