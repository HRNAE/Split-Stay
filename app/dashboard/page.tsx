import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import ConnectStripeButton from "@/components/ConnectStripeButton";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: listings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("stripe_onboarding_complete")
      .eq("id", user.id)
      .single(),
    supabase
      .from("listings")
      .select("*")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl font-semibold mb-8">My stays</h1>

      {/* Payout status card — this is the Stripe Connect centerpiece */}
      <div className="tag-card p-6 mb-10 flex items-center justify-between flex-wrap gap-4">
        <div className="tag-hole" />
        <div className="mt-2">
          <h2 className="font-display text-lg font-semibold mb-1">
            Payout account
          </h2>
          {profile?.stripe_onboarding_complete ? (
            <p className="text-sm text-teal font-medium">
              ✓ Connected — you can receive bookings
            </p>
          ) : (
            <p className="text-sm text-ink/60 max-w-sm">
              Connect a Stripe account so guests can pay you directly.
              SplitStay takes a small platform fee automatically — you never
              have to invoice anyone.
            </p>
          )}
        </div>
        <ConnectStripeButton complete={!!profile?.stripe_onboarding_complete} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">Your listings</h2>
        <Link href="/listings/new" className="btn-secondary text-sm">
          + New listing
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="tag-card p-10 text-center text-ink/60">
          <div className="tag-hole" />
          You haven&apos;t listed a room yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
