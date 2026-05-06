"use client";

import type { FC } from "react";
import { PROGRAMS } from "@/lib/constants";
import { EnterpriseSpotlightDashboard } from "@/components/dashboard/enterprise-spotlight-dashboard";
import { MediaProgramDashboard } from "@/components/dashboard/media-program-dashboard";
import { AbsaOnboardingDashboard } from "@/components/dashboard/absa-onboarding-dashboard";

interface ProgramDashboardProps {
  slug: string;
  /**
   * When true (default), renders a heading using the program's name from
   * `PROGRAMS`. Pass `false` when embedding inside another page (e.g. the
   * project detail "Program Data" tab) that provides its own heading.
   */
  showHeading?: boolean;
}

const PROGRAM_NAMES: Record<string, string> = {
  "enterprise-spotlight": "Enterprise Spotlight",
  "virtual-university": "Virtual University",
  hangout: "Hangout",
  "absa-onboarding": "ABSA Onboarding",
};

export const ProgramDashboard: FC<ProgramDashboardProps> = ({
  slug,
  showHeading = true,
}) => {
  const heading =
    PROGRAMS.find((p) => p.slug === slug)?.name ?? PROGRAM_NAMES[slug] ?? slug;

  return (
    <div className="space-y-8">
      {showHeading && (
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
      )}
      {slug === "enterprise-spotlight" && <EnterpriseSpotlightDashboard />}
      {slug === "virtual-university" && (
        <MediaProgramDashboard
          tableName="virtual_university_entries"
          programSlug="virtual-university"
          programLabel="Virtual University"
        />
      )}
      {slug === "hangout" && (
        <MediaProgramDashboard
          tableName="hangout_entries"
          programSlug="hangout"
          programLabel="Hangout"
        />
      )}
      {slug === "absa-onboarding" && <AbsaOnboardingDashboard />}
    </div>
  );
};
