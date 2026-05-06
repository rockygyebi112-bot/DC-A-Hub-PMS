"use client";

import { useEffect, useState } from "react";
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
import { ProjectOverviewDashboard } from "@/components/projects/project-overview-dashboard";

interface Props {
  slug: string;
}

export function EmbeddedProjectOverview({ slug }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMissing(false);

    (async () => {
      const p = await getProjectBySlug(slug);
      if (!active) return;
      if (!p) {
        setMissing(true);
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
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="h-32 rounded-lg border border-border bg-muted/40 animate-pulse" />
    );
  }

  if (missing || !project) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }

  return (
    <ProjectOverviewDashboard
      project={project}
      milestones={milestones}
      activities={activities}
    />
  );
}
