"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import {
  EnterpriseSpotlightEntry,
  MediaProgramEntry,
  AbsaOnboardingEntry,
} from "@/lib/types";
import { TABLES, type TableName } from "@/lib/db/tables";
import {
  aggregateAgeBracketByProgram,
  aggregateDisabilityCounts,
  aggregateEpisodeCountsByPeriod,
  aggregateGenderCounts,
  aggregateMediaViewsByPeriod,
  aggregatePlatformViews,
  aggregateRegionCounts,
  totalMediaViews,
} from "@/lib/dashboard/aggregations";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import type { ProgramFilter } from "./program-filter-bar";
import { DashboardSkeleton } from "./dashboard-skeleton";
import {
  countByField,
  type Granularity,
  barChartOption,
  horizontalBarChartOption,
  donutChartOption,
  pieChartOption,
  multiLineChartOption,
  groupedBarChartOption,
} from "./chart-builders";
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
import { GranularityToggle } from "./granularity-toggle";
import { CustomIndicatorCharts } from "./custom-indicator-charts";
import {
  ExecutiveMilestoneView,
  type ProjectBundle,
} from "./executive-milestone-view";
import {
  listActivities,
  listMilestones,
  listProjects,
} from "@/lib/projects/queries";

interface OwnerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-1 h-6 rounded-full bg-srsf-green-500 shrink-0" />
      <h2 className="text-lg font-bold text-foreground">{children}</h2>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

interface Props {
  programFilter: ProgramFilter;
}

export function ExecutiveDashboard({ programFilter }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [esEntries, setEsEntries] = useState<EnterpriseSpotlightEntry[]>([]);
  const [vuEntries, setVuEntries] = useState<MediaProgramEntry[]>([]);
  const [hangoutEntries, setHangoutEntries] = useState<MediaProgramEntry[]>([]);
  const [absaEntries, setAbsaEntries] = useState<AbsaOnboardingEntry[]>([]);
  const [projectBundles, setProjectBundles] = useState<ProjectBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const periodLabel = granularity === "week" ? "Weekly" : granularity === "quarter" ? "Quarterly" : "Monthly";
  const supabase = createClient();

  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      const buildQuery = (table: TableName) => {
        const isMediaTable =
          table === TABLES.virtualUniversity || table === TABLES.hangout;
        const dateField = isMediaTable ? "date_aired" : "created_at";
        const upperBound = to
          ? isMediaTable
            ? to
            : `${to}T23:59:59`
          : undefined;

        let q = supabase
          .from(table)
          .select("*")
          .eq("is_draft", false)
          .order(dateField, { ascending: false });
        if (from) q = q.gte(dateField, from);
        if (upperBound) q = q.lte(dateField, upperBound);
        return q;
      };

      const [esRes, vuRes, hangoutRes, absaRes] = await Promise.all([
        buildQuery(TABLES.enterpriseSpotlight),
        buildQuery(TABLES.virtualUniversity),
        buildQuery(TABLES.hangout),
        buildQuery(TABLES.absaOnboarding),
      ]);

      setEsEntries((esRes.data as EnterpriseSpotlightEntry[]) ?? []);
      setVuEntries((vuRes.data as MediaProgramEntry[]) ?? []);
      setHangoutEntries((hangoutRes.data as MediaProgramEntry[]) ?? []);
      setAbsaEntries((absaRes.data as AbsaOnboardingEntry[]) ?? []);
      setLoading(false);
    }
    loadAll();
  }, [supabase, from, to]);

  useEffect(() => {
    let active = true;

    async function loadProjectBundles() {
      const client = createClient();
      const projects = await listProjects();
      const { data: owners } = await client
        .from("user_profiles")
        .select("id, full_name, email");

      const ownerNames = Object.fromEntries(
        ((owners ?? []) as OwnerProfile[]).map((owner) => [
          owner.id,
          owner.full_name || owner.email || "Unassigned",
        ]),
      );

      const bundles = await Promise.all(
        projects.map(async (project) => {
          const [milestones, activities] = await Promise.all([
            listMilestones(project.id),
            listActivities(project.id),
          ]);
          return {
            project,
            milestones,
            activities,
            ownerNames,
          };
        }),
      );

      if (active) {
        setProjectBundles(bundles);
      }
    }

    void loadProjectBundles();

    return () => {
      active = false;
    };
  }, []);

  // ─── KPI values ───────────────────────────────────────────────

  const totalApplications = esEntries.length;
  const totalVuEpisodes = vuEntries.length;
  const totalHangoutEpisodes = hangoutEntries.length;
  const totalAbsaParticipants = absaEntries.length;

  // ─── Trend calculations (only when date range set) ────────────

  const trendInputs = useMemo(
    () => [
      { key: "es", table: TABLES.enterpriseSpotlight, from, to },
      { key: "vu", table: TABLES.virtualUniversity, from, to },
      { key: "hangout", table: TABLES.hangout, from, to },
      { key: "absa", table: TABLES.absaOnboarding, from, to },
    ],
    [from, to]
  );
  const trends = usePreviousPeriodCounts(trendInputs);

  // ─── Show/hide based on program filter ────────────────────────

  const showES = programFilter === "enterprise-spotlight";
  const showVU = programFilter === "virtual-university";
  const showHangout = programFilter === "hangout";
  const showABSA = programFilter === "absa-onboarding";
  const showMedia = showVU || showHangout;

  // ─── Demographics: Gender (cross-program) ─────────────────────

  const genderCounts = useMemo(
    () =>
      aggregateGenderCounts({
        esEntries,
        vuEntries,
        hangoutEntries,
        absaEntries,
        showES,
        showVU,
        showHangout,
        showABSA,
      }),
    [esEntries, vuEntries, hangoutEntries, absaEntries, showES, showVU, showHangout, showABSA]
  );

  // ─── Demographics: Age Bracket (grouped bar by program) ───────

  const ageBracketByProgram = useMemo(
    () =>
      aggregateAgeBracketByProgram({
        esEntries,
        vuEntries,
        hangoutEntries,
        absaEntries,
        showES,
        showVU,
        showHangout,
        showABSA,
      }),
    [esEntries, vuEntries, hangoutEntries, absaEntries, showES, showVU, showHangout, showABSA]
  );

  // ─── Demographics: Disability (ES + ABSA combined) ────────────

  const disabilityCounts = useMemo(
    () => aggregateDisabilityCounts(esEntries, absaEntries, showES, showABSA),
    [esEntries, absaEntries, showES, showABSA]
  );

  // ─── Geographic: Region (horizontal bar) ──────────────────────

  const regionCounts = useMemo(
    () => aggregateRegionCounts(esEntries, absaEntries, showES, showABSA),
    [esEntries, absaEntries, showES, showABSA]
  );

  const uniqueRegionCount = Object.keys(regionCounts).length;

  // ─── Enterprise Spotlight specifics ───────────────────────────

  const esRegistrationCounts = useMemo(
    () => (showES ? countByField(esEntries, "business_registered") : {}),
    [esEntries, showES]
  );
  const esSectorCounts = useMemo(
    () => (showES ? countByField(esEntries, "business_sector") : {}),
    [esEntries, showES]
  );

  // ─── Media Programs: Monthly views (dual-line) ────────────────

  const mediaMonthlyViews = useMemo(
    () =>
      aggregateMediaViewsByPeriod(
        vuEntries,
        hangoutEntries,
        granularity,
        showVU,
        showHangout
      ),
    [vuEntries, hangoutEntries, showVU, showHangout, granularity]
  );

  // ─── Media Programs: Monthly episodes (grouped bar) ───────────

  const mediaMonthlyEpisodes = useMemo(
    () =>
      aggregateEpisodeCountsByPeriod(
        vuEntries,
        hangoutEntries,
        granularity,
        showVU,
        showHangout
      ),
    [vuEntries, hangoutEntries, showVU, showHangout, granularity]
  );

  // ─── Media Programs: Views per platform (stacked bar) ─────────

  const mediaPlatformViews = useMemo(
    () => aggregatePlatformViews(vuEntries, hangoutEntries, showVU, showHangout),
    [vuEntries, hangoutEntries, showVU, showHangout]
  );

  // ─── ABSA: Region breakdown ───────────────────────────────────

  const absaRegionCounts = useMemo(
    () => (showABSA ? countByField(absaEntries, "region") : {}),
    [absaEntries, showABSA]
  );

  // ─── Export data (flattened summary) ──────────────────────────

  const exportData = useMemo(() => {
    const rows: Record<string, string | number>[] = [];
    if (showES) {
      for (const e of esEntries) {
        rows.push({
          program: "Enterprise Spotlight",
          name: e.applicant_name,
          region: e.region,
          gender: e.gender,
          age_bracket: e.age_bracket,
          date: e.created_at.slice(0, 10),
        });
      }
    }
    if (showVU) {
      for (const e of vuEntries) {
        rows.push({
          program: "Virtual University",
          name: e.episode_title,
          region: "",
          gender: "",
          age_bracket: "",
          date: e.created_at.slice(0, 10),
          views: totalMediaViews(e),
        });
      }
    }
    if (showHangout) {
      for (const e of hangoutEntries) {
        rows.push({
          program: "Hangout",
          name: e.episode_title,
          region: "",
          gender: "",
          age_bracket: "",
          date: e.created_at.slice(0, 10),
          views: totalMediaViews(e),
        });
      }
    }
    if (showABSA) {
      for (const e of absaEntries) {
        rows.push({
          program: "ABSA Onboarding",
          name: e.participant_name,
          region: e.region,
          gender: e.gender,
          age_bracket: e.age_bracket,
          date: e.created_at.slice(0, 10),
        });
      }
    }
    return rows;
  }, [esEntries, vuEntries, hangoutEntries, absaEntries, showES, showVU, showHangout, showABSA]);

  // ─── Render ───────────────────────────────────────────────────

  // Reusable chart card wrapper class - consistent with KPI cards
  const chartCard = "rounded-xl border border-border/60 bg-white p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 ease-out";
  if (loading) {
    return <DashboardSkeleton kpis={4} charts={4} />;
  }

  return (
    <div className="space-y-8">
      {/* Date range + Export (program filter is now lifted to the page level) */}
      <div className="flex flex-wrap items-end justify-end gap-3">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onClear={() => {
            setFrom("");
            setTo("");
          }}
        />
        <ExportButton
          data={exportData}
          filename="executive-dashboard-export"
          columns={[
            { key: "program", label: "Program" },
            { key: "name", label: "Name" },
            { key: "region", label: "Region" },
            { key: "gender", label: "Gender" },
            { key: "age_bracket", label: "Age Bracket" },
            { key: "date", label: "Date" },
            { key: "views", label: "Views" },
          ]}
        />
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {showES && (
          <KpiCard
            label="Total Applications"
            value={totalApplications}
            trend={trends["es"]}
            accent="green"
            colorAccent="#3B6D11"
          />
        )}
        {showVU && (
          <KpiCard
            label="VU Episodes"
            value={totalVuEpisodes}
            trend={trends["vu"]}
            accent="blue"
            colorAccent="#6B2D7B"
          />
        )}
        {showHangout && (
          <KpiCard
            label="Hangout Episodes"
            value={totalHangoutEpisodes}
            trend={trends["hangout"]}
            accent="purple"
            colorAccent="#6B2D7B"
          />
        )}
        {showABSA && (
          <KpiCard
            label="ABSA Participants"
            value={totalAbsaParticipants}
            trend={trends["absa"]}
            accent="amber"
            colorAccent="#3B6D11"
          />
        )}
        {(showES || showABSA) && (
          <KpiCard
            label="Regions Represented"
            value={uniqueRegionCount}
            accent="teal"
            colorAccent="#0d9488"
          />
        )}
      </div>

      <ExecutiveMilestoneView bundles={projectBundles} />

      {/* Demographics Section — only programs/projects with participant-level M&E data */}
      {(showES || showVU || showHangout || showABSA) && (
        <section>
          <SectionHeading>Demographics</SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={chartCard}>
              <EChart option={donutChartOption(genderCounts, "Gender Distribution", isDark)} />
            </div>
            <div className={chartCard}>
              <EChart
                option={groupedBarChartOption(ageBracketByProgram, "Age Bracket by Program", isDark)}
              />
            </div>
            {(showES || showABSA) && (
              <div className={chartCard}>
                <EChart
                  option={donutChartOption(disabilityCounts, "Disability Status", isDark)}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Geographic Section */}
      {(showES || showABSA) && (
        <section>
          <SectionHeading>Geographic</SectionHeading>
          <div className={chartCard}>
            <EChart
              option={horizontalBarChartOption(regionCounts, "Regional Representation", isDark)}
              height={Math.max(320, Object.keys(regionCounts).length * 40 + 90)}
            />
          </div>
        </section>
      )}

      {/* Enterprise Spotlight — project activity progress */}
      {/* Enterprise Spotlight Specifics */}
      {showES && (
        <section>
          <SectionHeading>Business Information</SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={chartCard}>
              <EChart
                option={pieChartOption(esRegistrationCounts, "Business Registration Status", isDark)}
              />
            </div>
            <div className={chartCard}>
              <EChart
                option={horizontalBarChartOption(esSectorCounts, "Business Sector", isDark)}
                height={Math.max(300, Object.keys(esSectorCounts).length * 40 + 90)}
              />
            </div>
          </div>
          <div className="mt-4">
            <CustomIndicatorCharts
              programSlug="enterprise-spotlight"
              entries={esEntries as unknown as Record<string, unknown>[]}
              showOnExecutiveOnly
            />
          </div>
        </section>
      )}

      {/* Media Programs Section (VU + Hangout) */}
      {showMedia && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="w-1 h-6 rounded-full bg-srsf-green-500 shrink-0" />
              <h2 className="text-lg font-bold text-foreground">Media Programs</h2>
            </div>
            <GranularityToggle value={granularity} onChange={setGranularity} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={chartCard}>
              <EChart
                option={
                  mediaMonthlyViews.length > 0
                    ? multiLineChartOption(mediaMonthlyViews, `${periodLabel} Views Trend`, isDark)
                    : barChartOption({}, `${periodLabel} Views Trend`, isDark)
                }
              />
            </div>
            <div className={chartCard}>
              <EChart
                option={
                  mediaMonthlyEpisodes.length > 0
                    ? groupedBarChartOption(mediaMonthlyEpisodes, `${periodLabel} Episodes Aired`, isDark)
                    : barChartOption({}, `${periodLabel} Episodes Aired`, isDark)
                }
              />
            </div>
            <div className={chartCard}>
              <EChart
                option={barChartOption(mediaPlatformViews, "Views per Platform", isDark)}
              />
            </div>
          </div>
          {showVU && (
            <div className="mt-4">
              <CustomIndicatorCharts
                programSlug="virtual-university"
                entries={vuEntries as unknown as Record<string, unknown>[]}
                showOnExecutiveOnly
              />
            </div>
          )}
          {showHangout && (
            <div className="mt-4">
              <CustomIndicatorCharts
                programSlug="hangout"
                entries={hangoutEntries as unknown as Record<string, unknown>[]}
                showOnExecutiveOnly
              />
            </div>
          )}
        </section>
      )}

      {/* Nkabom Collaborative — surface project activity progress */}

      {/* ABSA Onboarding — project activity progress */}

      {/* ABSA Section */}
      {showABSA && (
        <section>
          <SectionHeading>ABSA Onboarding</SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={chartCard}>
              <EChart
                option={horizontalBarChartOption(absaRegionCounts, "Region Breakdown", isDark)}
                height={320}
              />
            </div>
          </div>
          <div className="mt-4">
            <CustomIndicatorCharts
              programSlug="absa-onboarding"
              entries={absaEntries as unknown as Record<string, unknown>[]}
              showOnExecutiveOnly
            />
          </div>
        </section>
      )}
    </div>
  );
}
