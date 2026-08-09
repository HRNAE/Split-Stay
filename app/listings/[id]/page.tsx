import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { notFound } from "next/navigation";

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*, profiles!listings_host_id_fkey(full_name, stripe_onboarding_complete)")
    .eq("id", params.id)
    .single();

  if (!listing) notFound();

  const host = listing.profiles as unknown as {
    full_name: string | null;
    stripe_onboarding_complete: boolean;
  } | null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="relative h-72 w-full rounded-tag overflow-hidden bg-line/40 mb-6">
        {listing.photo_url ? (
          <Image src={listing.photo_url} alt={listing.title} fill className="object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-ink/30 font-display">
            no photo
          </div>
        )}
      </div>

      <h1 className="font-display text-3xl font-semibold mb-1">{listing.title}</h1>
      <p className="text-ink/60 mb-6">{listing.city}</p>

      <p className="mb-8 leading-relaxed">{listing.description}</p>

      <div className="tag-card p-6 flex items-center justify-between">
        <div className="tag-hole" />
        <div>
          <p className="price-fob text-2xl text-teal font-medium mt-2">
            ${listing.price_per_night}
            <span className="text-ink/50 font-normal text-base"> / night</span>
          </p>
          <p className="text-sm text-ink/50 mt-1">
            Hosted by {host?.full_name ?? "a SplitStay host"}
          </p>
        </div>

        {host?.stripe_onboarding_complete ? (
          <button className="btn-primary" disabled title="Booking flow ships in week 2">
            Book this room
          </button>
        ) : (
          <span className="text-sm text-ink/40 max-w-[160px] text-right">
            Host is still setting up payouts
          </span>
        )}
      </div>
    </div>
  );
}
