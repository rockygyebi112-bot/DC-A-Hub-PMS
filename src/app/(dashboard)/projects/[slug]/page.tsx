"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import {
  getProjectBySlug,
  listActivities,
  listMilestones,
} from "@/lib/projects/queries";
import type {
  Project,
  ProjectActivity,
  ProjectMilestone,
} from "@/lib/projects/types";
import {
  computeProgressPercent,
  computeProjectStatus,
} from "@/lib/projects/status";
import { StatusPill } from "@/components/projects/status-pill";
import { ProgramDashboard } from "@/components/programs/program-dashboard";
import { ActivitiesPanel } from "@/components/projects/activities-panel";
import { ProjectOverviewDashboard } from "@/components/projects/project-overview-dashboard";

type Tab = "overview" | "activities" | "program-data";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProject() {
      const p = await getProjectBySlug(slug);
      if (!active) return;

      if (!p) {
        setNotFoundFlag(true);
        setLoading(false);
        return;
      }

      const [ms, acts] = await Promise.all([
        listMilestones(p.id),
        listActivities(p.id),
      ]);
      if (!active) return;

      setProject(p);
      setMilestones(ms);
      setActivities(acts);
      setNotFoundFlag(false);
      setLoading(false);
    }

    void loadProject();

    return () => {
      active = false;
    };
  }, [refreshKey, slug]);

  if (notFoundFlag) notFound();
  if (loading || !project) {
    return <div className="p-4 sm:p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  const status = computeProjectStatus(project, activities);
  const progress = computeProgressPercent(activities);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {project.description}
              </p>
            )}
          </div>
          <StatusPill status={status} />
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden max-w-md">
          <div
            className="h-full bg-primary"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {progress}% complete
        </div>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-border mb-4 pb-0"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
          className={`pb-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === "overview"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Overview
        </button>
        <button
          role="tab"
          aria-selected={tab === "activities"}
          onClick={() => setTab("activities")}
          className={`pb-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            tab === "activities"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Activities
        </button>
        {project.program_slug && (
          <button
            role="tab"
            aria-selected={tab === "program-data"}
            onClick={() => setTab("program-data")}
            className={`pb-2 text-sm font-medium border-b-2 whitespace-nowrap ${
              tab === "program-data"
                ? "border-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            Program Data
          </button>
        )}
      </nav>

      {tab === "overview" ? (
        <ProjectOverviewDashboard
          project={project}
          milestones={milestones}
          activities={activities}
        />
      ) : tab === "activities" ? (
        <ActivitiesPanel
          project={project}
          milestones={milestones}
          activities={activities}
          onChange={refresh}
        />
      ) : project.program_slug ? (
        <ProgramDashboard slug={project.program_slug} showHeading={false} />
      ) : null}
    </div>
  );
}
