import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import BookingForm from "@/components/BookingForm";

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const isOwnListing = user?.id === listing.host_id;

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

      <div className="tag-card p-6">
        <div className="tag-hole" />
        <div className="flex items-start justify-between gap-6 flex-wrap mt-2">
          <div>
            <p className="price-fob text-2xl text-teal font-medium">
              ${listing.price_per_night}
              <span className="text-ink/50 font-normal text-base"> / night</span>
            </p>
            <p className="text-sm text-ink/50 mt-1">
              Hosted by {host?.full_name ?? "a SplitStay host"}
            </p>
          </div>

          <div className="w-full sm:w-64">
            {isOwnListing ? (
              <span className="text-sm text-ink/40">This is your listing</span>
            ) : host?.stripe_onboarding_complete ? (
              <BookingForm
                listingId={listing.id}
                pricePerNight={listing.price_per_night}
                isLoggedIn={!!user}
              />
            ) : (
              <span className="text-sm text-ink/40">
                Host is still setting up payouts
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
