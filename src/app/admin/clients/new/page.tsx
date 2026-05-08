import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/admin/forms/client-form";
import { PageHeader } from "@/components/admin/ui/page-header";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="New client"
        subtitle="Create the organization record used by admin and project views."
        action={
          <Button variant="ghost" size="sm" render={<Link href="/admin/clients" />}>
            Back to clients
          </Button>
        }
      />
      <ClientForm mode="create" />
    </div>
  );
}
