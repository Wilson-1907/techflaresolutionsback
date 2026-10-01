const MAIN = "http://localhost:3000";
const ADMIN = "http://localhost:3001";
const KEY = "change-this-admin-api-key-in-production";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function run() {
  console.log("=== Admin ↔ Main site integration test ===\n");

  const pub = await fetch(`${MAIN}/api/news`, { headers: { "User-Agent": UA } });
  const pubData = await pub.json();
  console.log(`[${pub.ok ? "OK" : "FAIL"}] GET public news: ${pubData.articles?.length ?? 0} articles`);

  const create = await fetch(`${MAIN}/api/news`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      "X-Admin-Api-Key": KEY,
    },
    body: JSON.stringify({
      title: "Test Announcement from Admin Panel",
      category: "announcement",
      excerpt: "Integration test article created via admin API bridge.",
      content: "This article was published from the separate admin panel through the secured main site API.",
      authorName: "Admin Panel Test",
      published: true,
    }),
  });
  const created = await create.json();
  console.log(`[${create.ok ? "OK" : "FAIL"}] POST news via API key: ${created.article?.slug || created.error}`);

  const newsroom = await fetch(`${MAIN}/newsroom`, { headers: { "User-Agent": UA } });
  const hasArticle = (await newsroom.text()).includes("Test Announcement from Admin Panel");
  console.log(`[${hasArticle ? "OK" : "FAIL"}] Newsroom shows new article`);

  const login = await fetch(`${ADMIN}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin123" }),
  });
  console.log(`[${login.ok ? "OK" : "FAIL"}] Admin panel login`);

  console.log("\nDone. Admin panel: http://localhost:3001 | Main newsroom: http://localhost:3000/newsroom");
}

run().catch(console.error);
