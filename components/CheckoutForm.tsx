"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

export default function CheckoutForm({
  totalAmount,
  nights,
}: {
  totalAmount: number;
  nights: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required", // stay on page instead of bouncing to a return_url
    });

    setLoading(false);

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      return;
    }

    // Payment succeeded on Stripe's side. The booking's status flips to
    // "confirmed" in our DB via the payment_intent.succeeded webhook —
    // that's the source of truth, this is just immediate UI feedback.
    setSucceeded(true);
  }

  if (succeeded) {
    return (
      <div className="text-center py-4">
        <p className="text-teal font-medium mb-1">✓ Payment sent</p>
        <p className="text-sm text-ink/60">
          Your booking will confirm within a few seconds.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement />

      {error && <p className="text-sm text-rust">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="btn-primary w-full"
      >
        {loading ? "Processing…" : `Pay $${totalAmount.toFixed(2)} for ${nights} night${nights > 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
