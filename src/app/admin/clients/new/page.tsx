import Link from "next/link";
import { ClientForm } from "@/components/admin/forms/client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New client</h1>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
