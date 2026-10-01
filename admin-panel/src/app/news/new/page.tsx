import { NewsForm } from "@/components/NewsForm";

export default function NewNewsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">New article</h1>
      <p className="text-muted mb-8">This will be sent to the main TechFlare Solutions site when saved.</p>
      <NewsForm submitLabel="Create article" />
    </div>
  );
}
