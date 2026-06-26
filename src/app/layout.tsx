import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TechFlare API",
  description: "Unified backend for TechFlare Solutions — main, admin, and finance apps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
