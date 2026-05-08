import { ClientForm } from "@/components/admin/forms/client-form";
import { PageHeader } from "@/components/admin/ui/page-header";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New client"
        subtitle="Create the organization record used by admin and project views."
        backFallbackHref="/admin/clients"
      />
      <ClientForm mode="create" />
    </div>
  );
}
