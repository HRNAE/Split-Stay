"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NewListingPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You need to be logged in to list a room.");
      setLoading(false);
      return;
    }

    // Upload photo to Supabase Storage, if provided
    let photo_url: string | null = null;
    if (photoFile) {
      const filePath = `${user.id}/${Date.now()}-${photoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-photos")
        .upload(filePath, photoFile);

      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("listing-photos")
        .getPublicUrl(filePath);
      photo_url = publicUrlData.publicUrl;
    }

    const { data: listing, error: insertError } = await supabase
      .from("listings")
      .insert({
        host_id: user.id,
        title,
        description,
        city,
        price_per_night: Number(price),
        photo_url,
      })
      .select()
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(`/listings/${listing.id}`);
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-semibold mb-2">List a room</h1>
      <p className="text-ink/60 mb-8">
        Takes about a minute. You&apos;ll connect a payout account before your
        first booking is confirmed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input
            className="input-field"
            placeholder="Sunny room near campus, 5 min walk"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Description</label>
          <textarea
            className="input-field min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">City</label>
            <input
              className="input-field"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Price / night ($)
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input-field"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Publishing…" : "Publish listing"}
        </button>
      </form>
    </div>
  );
}
