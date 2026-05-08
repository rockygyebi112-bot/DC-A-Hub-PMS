import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { updatePhase } from "@/lib/workspace/actions";
import { getPhase } from "@/lib/workspace/queries";

export default async function WorkspacePhasePage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>;
}) {
  const { id, phaseId } = await params;
  const phase = await getPhase(phaseId);

  async function save(formData: FormData) {
    "use server";
    await updatePhase(phaseId, formData);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <PageHeader
        title={phase.name}
        subtitle="Edit phase details and dates."
        action={
          <Button variant="ghost" size="sm" render={<Link href={`/workspace/projects/${id}`} />}>
            Back to project
          </Button>
        }
      />

      <SectionCard title="Phase details">
        <form action={save} className="space-y-4">
          <Input name="name" defaultValue={phase.name} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="start_date" type="date" defaultValue={phase.start_date ?? ""} />
            <Input name="end_date" type="date" defaultValue={phase.end_date ?? ""} />
          </div>
          <Textarea
            name="description"
            defaultValue={phase.description ?? ""}
            placeholder="Phase notes"
            rows={5}
          />
          <Button type="submit">Save phase</Button>
        </form>
      </SectionCard>
    </main>
  );
}

