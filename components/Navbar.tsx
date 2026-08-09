import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import SignOutButton from "./SignOutButton";

export default function Navbar({ user }: { user: User | null }) {
  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Split<span className="text-brass">Stay</span>
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium hover:text-teal">
                My stays
              </Link>
              <Link href="/listings/new" className="btn-secondary text-sm">
                List a room
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium hover:text-teal">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
