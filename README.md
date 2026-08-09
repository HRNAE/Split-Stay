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

## Week 2 (not yet built)

- Booking UI (date range picker) hitting the `bookings` table
- PaymentIntent with `application_fee_amount` + `transfer_data.destination`
  (the actual split payment)
- Webhook-driven booking confirmation on `payment_intent.succeeded`
  (handler already stubbed in `app/api/stripe/webhook/route.ts`)
- Host/guest booking dashboard views
- Known gaps to call out honestly in interviews: no cancellation/refund
  flow yet, no search/filtering, no reviews

## Why this project

- **Stripe Connect** (not just Checkout) — split payments, host onboarding,
  and webhook-driven state sync are the kind of payment infrastructure
  interviewers actually probe on
- **Postgres exclusion constraint** for double-booking prevention — a
  correctness guarantee enforced by the database, not a race-condition-prone
  application-level check
- **RLS throughout** — every table's access control lives in Postgres
  policies, not scattered `if` checks in route handlers
