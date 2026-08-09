import Link from "next/link";
import Image from "next/image";

type Listing = {
  id: string;
  title: string;
  city: string;
  price_per_night: number;
  photo_url: string | null;
};

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/listings/${listing.id}`} className="tag-card block overflow-hidden">
      <div className="tag-hole" />
      <div className="relative h-40 w-full bg-line/40">
        {listing.photo_url ? (
          <Image
            src={listing.photo_url}
            alt={listing.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-ink/30 font-display text-sm">
            no photo
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-lg leading-snug mb-1">
          {listing.title}
        </h3>
        <p className="text-sm text-ink/60 mb-3">{listing.city}</p>
        <p className="price-fob text-teal font-medium">
          ${listing.price_per_night}
          <span className="text-ink/50 font-normal"> / night</span>
        </p>
      </div>
    </Link>
  );
}
