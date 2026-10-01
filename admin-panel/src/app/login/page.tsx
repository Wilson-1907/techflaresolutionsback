"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Newspaper } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Invalid password");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-deep-blue to-black">
      <div className="w-full max-w-md rounded-2xl border border-gold/20 bg-deep-blue/60 p-8 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gold/20 p-3">
            <Newspaper className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold">TechFlare Solutions Admin Panel</h1>
            <p className="text-sm text-muted">Separate console · publishes to main site</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Admin password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gold/20 bg-black/40 pl-10 pr-4 py-3 outline-none focus:border-gold/50"
                placeholder="Enter panel password"
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold py-3 font-semibold text-black hover:bg-gold/90 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-muted mt-6 text-center">
          Main site: {process.env.NEXT_PUBLIC_MAIN_SITE_URL || "http://localhost:3000"}
        </p>
      </div>
    </div>
  );
}
