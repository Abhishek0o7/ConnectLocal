"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is required, there's no session yet.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink mb-2">Check your email</h1>
          <p className="text-muted text-sm">
            We sent a confirmation link to <span className="text-ink">{email}</span>. Click it to
            activate your account, then log in.
          </p>
          <Link href="/login" className="text-primary text-sm font-medium mt-6 inline-block">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
          <p className="text-muted text-sm mt-1">Join people near you.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white border border-hairline rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white border border-hairline rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            placeholder="Password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white border border-hairline rounded-xl px-4 py-3 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-red text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white rounded-full py-3 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
