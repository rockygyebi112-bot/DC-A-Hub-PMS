import { notFound } from "next/navigation";
import { PROGRAMS } from "@/lib/constants";
import { ProgramDashboard } from "@/components/programs/program-dashboard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProgramPage({ params }: Props) {
  const { slug } = await params;
  const program = PROGRAMS.find((p) => p.slug === slug);

  if (!program) {
    notFound();
  }

  return <ProgramDashboard slug={slug} />;
}
