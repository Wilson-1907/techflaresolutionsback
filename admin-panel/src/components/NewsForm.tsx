"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type NewsFormValues = {
  title: string;
  category: string;
  excerpt: string;
  content: string;
  authorName: string;
  published: boolean;
};

const defaultValues: NewsFormValues = {
  title: "",
  category: "announcement",
  excerpt: "",
  content: "",
  authorName: "TechFlare Solutions Admin",
  published: false,
};

interface NewsFormProps {
  initial?: Partial<NewsFormValues>;
  articleId?: string;
  submitLabel?: string;
}

export function NewsForm({ initial, articleId, submitLabel = "Save" }: NewsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<NewsFormValues>({ ...defaultValues, ...initial });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = articleId ? `/api/news/${articleId}` : "/api/news";
    const method = articleId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Failed to save article");
      return;
    }

    router.push("/news");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div>
        <label className="block text-sm font-medium mb-1.5">Title</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-xl border border-gold/20 bg-black/40 px-4 py-3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Category</label>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded-xl border border-gold/20 bg-black/40 px-4 py-3"
        >
          <option value="announcement">Announcement</option>
          <option value="award">Award</option>
          <option value="press_release">Press Release</option>
          <option value="achievement">Achievement</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Excerpt (short summary)</label>
        <textarea
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-gold/20 bg-black/40 px-4 py-3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Full content</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={10}
          className="w-full rounded-xl border border-gold/20 bg-black/40 px-4 py-3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Author name</label>
        <input
          value={form.authorName}
          onChange={(e) => setForm({ ...form, authorName: e.target.value })}
          className="w-full rounded-xl border border-gold/20 bg-black/40 px-4 py-3"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })}
          className="h-4 w-4 accent-gold"
        />
        <span className="text-sm">Publish immediately to main site newsroom</span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gold px-6 py-3 font-semibold text-black hover:bg-gold/90 disabled:opacity-60"
        >
          {loading ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-gold/20 px-6 py-3 text-sm hover:bg-gold/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
