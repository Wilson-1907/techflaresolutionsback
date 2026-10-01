"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NewsForm, type NewsFormValues } from "@/components/NewsForm";

export default function EditNewsPage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<Partial<NewsFormValues>>();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/news/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.article) {
          setInitial({
            title: data.article.title,
            category: data.article.category,
            excerpt: data.article.excerpt,
            content: data.article.content,
            authorName: data.article.authorName || "",
            published: data.article.published,
          });
        } else {
          setError("Article not found");
        }
      })
      .catch(() => setError("Failed to load article"));
  }, [id]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!initial) return <p className="text-muted">Loading...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Edit article</h1>
      <p className="text-muted mb-8">Changes sync to the main site newsroom.</p>
      <NewsForm initial={initial} articleId={id} submitLabel="Update article" />
    </div>
  );
}
