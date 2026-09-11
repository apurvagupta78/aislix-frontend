import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";
import { AdminShell } from "@/components/admin/AdminShell";

/** Self-contained admin page — gate, nav and content (works with flat route tree). */
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PlatformAdminGate>
      <AdminShell title={title} description={description} actions={actions}>
        {children}
      </AdminShell>
    </PlatformAdminGate>
  );
}
