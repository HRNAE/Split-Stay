"use client";

import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe-client";
import CheckoutForm from "./CheckoutForm";
import { differenceInCalendarDays } from "date-fns";

export default function BookingForm({
  listingId,
  pricePerNight,
  isLoggedIn,
}: {
  listingId: string;
  pricePerNight: number;
  isLoggedIn: boolean;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nights =
    startDate && endDate
      ? differenceInCalendarDays(new Date(endDate), new Date(startDate))
      : 0;

  async function handleContinueToPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nights < 1) {
      setError("Check-out must be after check-in.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, startDate, endDate }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setClientSecret(data.clientSecret);
    setTotalAmount(data.totalAmount);
  }

  if (!isLoggedIn) {
    return (
      <p className="text-sm text-ink/50 max-w-[200px] text-right">
        <a href="/login" className="text-teal underline">
          Log in
        </a>{" "}
        to book this room
      </p>
    );
  }

  // Once we have a clientSecret, hand off to Stripe Elements to collect
  // card details and confirm the PaymentIntent.
  if (clientSecret) {
    return (
      <Elements stripe={getStripe()} options={{ clientSecret }}>
        <CheckoutForm totalAmount={totalAmount!} nights={nights} />
      </Elements>
    );
  }

  return (
    <form onSubmit={handleContinueToPayment} className="space-y-3">
      <div className="flex gap-2">
        <div>
          <label className="text-xs font-medium block mb-1">Check-in</label>
          <input
            type="date"
            required
            className="input-field text-sm"
            value={startDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Check-out</label>
          <input
            type="date"
            required
            className="input-field text-sm"
            value={endDate}
            min={startDate || new Date().toISOString().split("T")[0]}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {nights > 0 && (
        <p className="price-fob text-sm text-ink/60">
          {nights} night{nights > 1 ? "s" : ""} · ${(nights * pricePerNight).toFixed(2)} total
        </p>
      )}

      {error && <p className="text-sm text-rust">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Checking availability…" : "Continue to payment"}
      </button>
    </form>
  );
}
