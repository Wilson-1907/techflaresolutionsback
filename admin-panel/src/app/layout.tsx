import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechFlare Solutions Admin Panel",
  description: "Separate admin console for TechFlare Solutions — news, CRM, projects, and operations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
