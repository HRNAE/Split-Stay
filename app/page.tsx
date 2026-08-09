import { createClient } from "@/lib/supabase/server";
import ListingCard from "@/components/ListingCard";
import Link from "next/link";

export default async function HomePage() {
  const supabase = createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      {/* Hero — the signature tag motif, oversized */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block price-fob text-xs uppercase tracking-widest text-teal border border-teal/30 rounded-full px-3 py-1 mb-6">
            for students, by students
          </span>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] mb-6">
            Sublet your room.
            <br />
            <span className="text-brass">Split</span> the rent.
          </h1>
          <p className="text-ink/70 text-lg mb-8 max-w-md">
            List a spare room or find one near campus. SplitStay handles the
            booking, the payment, and the payout — you handle the move-in.
          </p>
          <div className="flex gap-3">
            <Link href="#listings" className="btn-primary">
              Browse rooms →
            </Link>
            <Link href="/listings/new" className="btn-secondary">
              List a room
            </Link>
          </div>
        </div>

        {/* Oversized key-tag graphic */}
        <div className="hidden md:flex justify-center">
          <div className="relative w-72 h-72 rotate-3">
            <div className="absolute inset-0 tag-card flex flex-col items-center justify-center gap-2 shadow-xl">
              <div className="tag-hole" style={{ top: 20, left: "50%", transform: "translateX(-50%)" }} />
              <span className="font-display text-3xl font-semibold mt-6">
                SplitStay
              </span>
              <span className="price-fob text-sm text-ink/50">
                one room, half the rent
              </span>
              <div className="mt-4 h-px w-24 bg-line" />
              <span className="price-fob text-xs text-teal mt-2">
                key included
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Listings grid */}
      <section id="listings" className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="font-display text-2xl font-semibold mb-6">
          Open rooms
        </h2>

        {!listings || listings.length === 0 ? (
          <div className="tag-card p-10 text-center text-ink/60">
            <div className="tag-hole" />
            No rooms listed yet. Be the first —{" "}
            <Link href="/listings/new" className="text-teal underline">
              list one
            </Link>
            .
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
