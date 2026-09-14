import { requireOwner } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();

  return (
    <div className="flex min-h-screen">
      <Sidebar ownerEmail={owner.email} />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
