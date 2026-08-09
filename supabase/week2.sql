-- ============================================================================
-- Week 2 additions — run this in Supabase SQL Editor after schema.sql
-- ============================================================================

-- create_booking: wraps the booking insert in a function so the API route
-- gets a clean, predictable error it can branch on, instead of parsing raw
-- Postgres exception text. The exclusion constraint from schema.sql
-- (bookings_listing_id_date_range_excl) still does the actual overlap
-- prevention — this function just gives it a friendly interface.
create or replace function public.create_booking(
  p_listing_id uuid,
  p_guest_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_amount numeric,
  p_platform_fee numeric
)
returns public.bookings
language plpgsql
security definer -- runs as the function owner so it can bypass RLS's
                  -- insert check safely, since we pass p_guest_id explicitly
                  -- and the API route already verified auth.uid() = p_guest_id
                  -- before calling this
as $$
declare
  v_booking public.bookings;
begin
  -- Defense in depth: this function is security definer (runs with elevated
  -- privileges), so even though our API route checks this before calling,
  -- we also refuse to let anyone book on behalf of a different user if this
  -- function is ever called directly via RPC.
  if p_guest_id <> auth.uid() then
    raise exception 'guest_id must match the authenticated user' using errcode = '42501';
  end if;

  if p_end_date <= p_start_date then
    raise exception 'end_date must be after start_date' using errcode = '22007';
  end if;

  insert into public.bookings (
    listing_id, guest_id, date_range, total_amount, platform_fee, status
  )
  values (
    p_listing_id,
    p_guest_id,
    daterange(p_start_date, p_end_date, '[)'), -- half-open range: end date is checkout day, not booked
    p_total_amount,
    p_platform_fee,
    'pending'
  )
  returning * into v_booking;

  return v_booking;
exception
  when exclusion_violation then
    -- This is the double-booking case: the gist exclusion constraint from
    -- schema.sql rejected the insert because the date range overlaps an
    -- existing pending/confirmed booking on this listing.
    raise exception 'These dates are no longer available' using errcode = '23P01';
end;
$$;

-- Let authenticated users call it (the function body still checks dates
-- and relies on the caller having already verified guest_id = auth.uid())
grant execute on function public.create_booking to authenticated;
