supabase/storage.sql-- ============================================================================
-- SplitStay database schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- Needed for the date-range overlap constraint (btree_gist gives us
-- exclusion constraints on non-range types combined with a range type)
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- profiles: one row per authenticated user, extends auth.users
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  stripe_account_id text, -- Stripe Connect Express account id, once onboarded
  stripe_onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- listings: rooms/subleases posted by hosts
-- ----------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  city text not null,
  address_line text, -- kept private, only shown after booking (kept simple: shown to host + confirmed guest in app logic)
  price_per_night numeric(10,2) not null check (price_per_night > 0),
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;

create policy "active listings are viewable by everyone"
  on public.listings for select
  using (is_active = true or host_id = auth.uid());

create policy "hosts can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = host_id);

create policy "hosts can update their own listings"
  on public.listings for update
  using (auth.uid() = host_id);

create policy "hosts can delete their own listings"
  on public.listings for delete
  using (auth.uid() = host_id);

-- ----------------------------------------------------------------------------
-- bookings: a guest reserving a listing for a date range
-- ----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  date_range daterange not null,
  total_amount numeric(10,2) not null check (total_amount > 0),
  platform_fee numeric(10,2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),

  -- THE KEY LINE: a Postgres exclusion constraint that makes double-booking
  -- physically impossible at the database level, not just checked in app code.
  -- Two CONFIRMED or PENDING bookings for the same listing can never have
  -- overlapping date ranges — the insert/update itself fails with 23P01.
  exclude using gist (
    listing_id with =,
    date_range with &&
  ) where (status in ('pending', 'confirmed'))
);

alter table public.bookings enable row level security;

create policy "guests can view their own bookings"
  on public.bookings for select
  using (auth.uid() = guest_id);

create policy "hosts can view bookings on their listings"
  on public.bookings for select
  using (
    exists (
      select 1 from public.listings
      where listings.id = bookings.listing_id
      and listings.host_id = auth.uid()
    )
  );

create policy "guests can insert their own bookings"
  on public.bookings for insert
  with check (auth.uid() = guest_id);

-- Only the server (using the service role key, which bypasses RLS) updates
-- booking status — this happens inside the Stripe webhook handler once
-- payment_intent.succeeded fires, so guests can't mark their own booking
-- "confirmed" without actually paying.

-- ----------------------------------------------------------------------------
-- Helpful indexes
-- ----------------------------------------------------------------------------
create index listings_city_idx on public.listings (city) where is_active = true;
create index bookings_listing_idx on public.bookings (listing_id);
create index bookings_guest_idx on public.bookings (guest_id);
