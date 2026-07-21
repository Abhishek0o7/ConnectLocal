"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/people");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-semibold text-ink">LocalConnect</h1>
          <p className="text-muted text-sm mt-1">Meet people near you.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            placeholder="Password"
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
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          New here?{" "}
          <Link href="/signup" className="text-primary font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
