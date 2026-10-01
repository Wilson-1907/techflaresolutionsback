"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

type Article = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  published: boolean;
  publishedAt: string;
};

export default function NewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/news");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to load articles");
      return;
    }
    setArticles(data.articles || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(article: Article) {
    await fetch(`/api/news/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !article.published }),
    });
    load();
  }

  async function deleteArticle(id: string) {
    if (!confirm("Delete this article from the main site?")) return;
    await fetch(`/api/news/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">News & Announcements</h1>
          <p className="text-muted mt-1">Articles sync to the main site newsroom when published.</p>
        </div>
        <Link
          href="/news/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-black"
        >
          <Plus className="h-4 w-4" /> New article
        </Link>
      </div>

      {loading && <p className="text-muted">Loading...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && articles.length === 0 && (
        <div className="rounded-2xl border border-gold/15 bg-deep-blue/30 p-8 text-center text-muted">
          No articles yet. Create your first announcement.
        </div>
      )}

      <div className="space-y-4">
        {articles.map((article) => (
          <div
            key={article.id}
            className="rounded-2xl border border-gold/15 bg-deep-blue/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase text-gold font-semibold">{article.category}</span>
                {article.published ? (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Live</span>
                ) : (
                  <span className="text-xs bg-white/10 text-muted px-2 py-0.5 rounded-full">Draft</span>
                )}
              </div>
              <h2 className="font-bold">{article.title}</h2>
              <p className="text-sm text-muted mt-1 line-clamp-2">{article.excerpt}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => togglePublish(article)}
                className="rounded-lg border border-gold/20 p-2 hover:bg-gold/10"
                title={article.published ? "Unpublish" : "Publish"}
              >
                {article.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-green-400" />}
              </button>
              <Link
                href={`/news/${article.id}/edit`}
                className="rounded-lg border border-gold/20 p-2 hover:bg-gold/10"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                onClick={() => deleteArticle(article.id)}
                className="rounded-lg border border-red-500/30 p-2 hover:bg-red-500/10 text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
