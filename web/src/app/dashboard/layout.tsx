import { requireOwner } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getNavSetupStatus } from "@/lib/dashboard-data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  const setup = await getNavSetupStatus(owner.businessId);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        ownerEmail={owner.email}
        classesConfigured={setup.classesConfigured}
        resourcesConfigured={setup.resourcesConfigured}
        locale={owner.locale}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
