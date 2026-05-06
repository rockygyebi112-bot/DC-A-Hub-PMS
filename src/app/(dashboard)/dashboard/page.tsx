"use client";

import { useState } from "react";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { DeliveryDashboard } from "@/components/dashboard/portfolio/portfolio-dashboard";
import {
  ProgramFilterBar,
  type ProgramFilter,
} from "@/components/dashboard/program-filter-bar";

const PROGRAM_LABELS: Record<ProgramFilter, string> = {
  "virtual-university": "Virtual University",
  hangout: "Hangout",
  "enterprise-spotlight": "Enterprise Spotlight",
  "absa-onboarding": "ABSA Onboarding",
  "nkabom-collaborative": "Nkabom Collaborative",
};

const PROJECT_FILTERS: ProgramFilter[] = [
  "enterprise-spotlight",
  "absa-onboarding",
  "nkabom-collaborative",
];

export default function DashboardPage() {
  const [programFilter, setProgramFilter] =
    useState<ProgramFilter>("virtual-university");

  const isProject = PROJECT_FILTERS.includes(programFilter);
  const label = PROGRAM_LABELS[programFilter];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {label} Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isProject
            ? "Delivery health and M&E for this project"
            : "Monitoring & evaluation for this program"}
        </p>
      </div>

      <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-2.5 bg-background/85 backdrop-blur-md border-b border-border/50">
        <ProgramFilterBar active={programFilter} onChange={setProgramFilter} />
      </div>

      {isProject && (
        <DeliveryDashboard programSlug={programFilter} />
      )}

      <ExecutiveDashboard programFilter={programFilter} />
    </div>
  );
}
