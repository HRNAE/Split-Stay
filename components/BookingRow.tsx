const STATUS_STYLES: Record<string, string> = {
  pending: "text-brass bg-brass/10",
  confirmed: "text-teal bg-teal/10",
  cancelled: "text-ink/40 bg-ink/5",
};

type Booking = {
  id: string;
  date_range: string; // Postgres daterange comes back as a string like ["2026-08-10","2026-08-14")
  total_amount: number;
  status: "pending" | "confirmed" | "cancelled";
  listings: {
    title: string;
    city?: string;
    price_per_night?: number;
  } | null;
};

function formatDateRange(range: string) {
  // Postgres daterange text format: ["2026-08-10","2026-08-14")
  const match = range.match(/\[?"?(\d{4}-\d{2}-\d{2})"?,\s*"?(\d{4}-\d{2}-\d{2})"?\)?\]?/);
  if (!match) return range;
  const [, start, end] = match;
  return `${start} → ${end}`;
}

export default function BookingRow({
  booking,
  perspective,
}: {
  booking: Booking;
  perspective: "guest" | "host";
}) {
  return (
    <div className="tag-card p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="tag-hole" />
      <div className="pl-2">
        <p className="font-medium">{booking.listings?.title ?? "Listing"}</p>
        <p className="text-sm text-ink/50 price-fob">
          {formatDateRange(booking.date_range)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="price-fob text-sm">${booking.total_amount}</span>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            STATUS_STYLES[booking.status] ?? ""
          }`}
        >
          {perspective === "host" && booking.status === "pending"
            ? "awaiting payment"
            : booking.status}
        </span>
      </div>
    </div>
  );
}
