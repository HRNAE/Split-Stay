# SplitStay

A peer-to-peer marketplace for student subleases and coliving. Hosts list
spare rooms, guests book and pay through the platform, and SplitStay takes a
small cut automatically via **Stripe Connect**.

This repo covers **Week 1** of a 2-week build: data model, auth, listing
CRUD with photo upload, and Stripe Connect host onboarding. Booking +
payment collection (Week 2) builds directly on top of what's here.

## Stack

- **Next.js 14** (App Router) + Tailwind CSS
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Stripe Connect** (Express accounts) — marketplace payouts

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   Next.js   │◄────►│     Supabase      │      │   Stripe    │
│  App Router │      │  Postgres + Auth  │      │   Connect   │
│             │      │  + Storage + RLS  │      │             │
└──────┬──────┘      └──────────────────┘      └──────┬──────┘
       │                                               │
       │  POST /api/stripe/connect-onboarding          │
       ├──────────────────────────────────────────────►│
       │            (creates Express account,           │
       │             returns onboarding URL)            │
       │                                                │
       │◄───────────────────── redirect to Stripe ──────┤
       │                                                │
       │         host completes KYC on Stripe           │
       │                                                │
       │◄──── webhook: account.updated ─────────────────┤
       │  (POST /api/stripe/webhook, signature-verified)│
       │  updates profiles.stripe_onboarding_complete   │
       └────────────────────────────────────────────────┘
```

## Data model

- `profiles` — one row per user, auto-created on signup via a Postgres
  trigger; stores the Stripe Connect account id once a host onboards
- `listings` — rooms/subleases, RLS-scoped so hosts can only edit their own
- `bookings` — date-range reservations. Uses a Postgres **exclusion
  constraint** (`exclude using gist`) on `(listing_id, date_range)` so two
  overlapping bookings for the same listing can never both exist — enforced
  at the database level, not just checked in application code. This is the
  Week 2 double-booking-prevention piece, schema'd out now.

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com),
   then in the SQL Editor run, in order:
   - `supabase/schema.sql`
   - Create a **public** bucket named `listing-photos` (Storage > New bucket)
   - `supabase/storage.sql`

3. **Create a Stripe account** (test mode) at
   [dashboard.stripe.com](https://dashboard.stripe.com). Under
   **Connect > Settings**, enable Express accounts.

4. **Copy env vars**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
     `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Project Settings > API
   - `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — from Stripe
     Dashboard > Developers > API keys (test mode)
   - `STRIPE_WEBHOOK_SECRET` — see step 5

5. **Forward Stripe webhooks locally** (install the
   [Stripe CLI](https://stripe.com/docs/stripe-cli) first):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.

6. **Run it**
   ```bash
   npm run dev
   ```

## Try the onboarding flow end-to-end

1. Sign up at `/signup`
2. Go to `/dashboard`, click **Connect with Stripe**
3. Complete Stripe's test-mode onboarding (use
   [Stripe's test data](https://stripe.com/docs/connect/testing) — e.g.
   `000000000` for SSN, any future date for DOB)
4. You're redirected back to `/dashboard` — within a few seconds the
   `account.updated` webhook flips `stripe_onboarding_complete` to `true`
5. List a room at `/listings/new` with a photo — it uploads to Supabase
   Storage and appears on the homepage

## Week 1 checklist

- [x] Supabase schema (`profiles`, `listings`, `bookings`) + RLS
- [x] Auth (email/password) with auto-created profile on signup
- [x] Listing CRUD + photo upload to Supabase Storage
- [x] Stripe Connect Express onboarding (create account → Account Link →
      redirect → webhook confirms `charges_enabled`)
- [x] Signature-verified webhook handler

## Week 2 checklist

- [x] Booking UI (date range picker) on the listing page
- [x] Atomic booking creation via a Postgres RPC (`create_booking`) —
      the gist exclusion constraint from Week 1 rejects overlapping dates
      at the database level, and the API route surfaces that as a clean
      409 instead of a race condition two guests could both "win"
- [x] Stripe PaymentIntent as a **destination charge**:
      `application_fee_amount` (platform's cut) stays with SplitStay,
      the rest transfers to the host's connected account automatically
- [x] Stripe Elements (`PaymentElement`) checkout UI
- [x] Webhook-driven booking confirmation on `payment_intent.succeeded`,
      and automatic cleanup (`payment_intent.payment_failed` /
      `.canceled` → booking marked `cancelled`, freeing the dates)
- [x] Dashboard views: "My trips" (guest) and "Bookings on your listings"
      (host)

### Extra setup for Week 2

1. Run `supabase/week2.sql` in the Supabase SQL Editor (creates the
   `create_booking` function)
2. `npm install` again to pick up `@stripe/stripe-js` and
   `@stripe/react-stripe-js`
3. If you already created a **production** webhook endpoint in the Stripe
   Dashboard, add two more events to it: `payment_intent.payment_failed`
   and `payment_intent.canceled` (locally, `stripe listen` forwards every
   event by default, so no change needed there)

### Try it end-to-end

1. As one account, list a room and finish Stripe Connect onboarding
   (Week 1 flow)
2. Log in as a **different** account (Stripe won't let you pay yourself),
   open that listing, pick check-in/check-out dates
3. Click **Continue to payment**, use Stripe's test card `4242 4242 4242
   4242`, any future expiry, any CVC
4. Watch your `stripe listen` terminal — you'll see `payment_intent.succeeded`
   fire, which flips the booking to `confirmed`
5. Check `/dashboard` on both accounts — the guest sees it under "My
   trips", the host sees it under "Bookings on your listings"
6. To test the double-booking guard: open the same listing in two browser
   tabs (or two accounts) and try to book the same dates in both — the
   second one gets rejected with "These dates are no longer available"

## Known gaps (Week 3+ / honest interview answers)

- No cancellation/refund flow after a booking is confirmed
- No search or filtering on the listings grid
- No reviews/ratings
- No email notifications on booking confirmation
- Pending bookings that a guest abandons mid-checkout (never submits
  payment) will sit as `pending` until Stripe eventually expires the
  PaymentIntent and fires `payment_intent.canceled` — a background job to
  expire stale pending bookings proactively would tighten this up

## Why this project

- **Stripe Connect** (not just Checkout) — split payments, host onboarding,
  and webhook-driven state sync are the kind of payment infrastructure
  interviewers actually probe on
- **Postgres exclusion constraint** for double-booking prevention — a
  correctness guarantee enforced by the database, not a race-condition-prone
  application-level check
- **RLS throughout** — every table's access control lives in Postgres
  policies, not scattered `if` checks in route handlers
