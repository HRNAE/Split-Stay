"use client";

import { useState } from "react";

export default function ConnectStripeButton({ complete }: { complete: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const res = await fetch("/api/stripe/connect-onboarding", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error ?? "Something went wrong starting onboarding.");
    }
  }

  if (complete) {
    return (
      <button onClick={handleClick} className="btn-secondary text-sm" disabled={loading}>
        {loading ? "Loading…" : "View payout settings"}
      </button>
    );
  }

  return (
    <button onClick={handleClick} className="btn-primary" disabled={loading}>
      {loading ? "Redirecting…" : "Connect with Stripe"}
    </button>
  );
}
