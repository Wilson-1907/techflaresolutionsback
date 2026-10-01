import { AdminShell } from "@/components/AdminShell";

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
