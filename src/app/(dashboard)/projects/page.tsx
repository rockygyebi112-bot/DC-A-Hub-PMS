"use client";

import { useMemo, useState } from "react";
import {
  useProjects,
  useProjectActivitiesMap,
  computeProjectStatus,
  type ComputedProjectStatus,
} from "@/features/projects";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { Button } from "@/components/ui/button";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { useUser } from "@/hooks/use-user";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  "All",
  "Not Started",
  "In Progress",
  "At Risk",
  "Blocked",
  "Done",
] as const;
type FilterKey = typeof FILTERS[number];

const FILTER_TO_STATUS: Record<FilterKey, ComputedProjectStatus | null> = {
  All: null,
  "Not Started": "not_started",
  "In Progress": "in_progress",
  "At Risk": "at_risk",
  Blocked: "blocked",
  Done: "done",
};

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const { isMELManager } = useUser();
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjects();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const {
    activitiesMap,
    loading: activitiesLoading,
    error: activitiesError,
    refresh: refreshActivities,
  } = useProjectActivitiesMap(projectIds);

  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("All");

  const loading = projectsLoading || activitiesLoading;
  const error = projectsError ?? activitiesError;

  const refresh = () =>
    Promise.all([refreshProjects(), refreshActivities()]);

  const filteredProjects = useMemo(() => {
    const target = FILTER_TO_STATUS[filter];
    if (!target) return projects;
    return projects.filter(
      (p) => computeProjectStatus(p, activitiesMap[p.id] ?? []) === target,
    );
  }, [projects, activitiesMap, filter]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Projects</h1>
        {isMELManager && (
          <Button
            onClick={() => setShowNew(true)}
            size="sm"
            className="bg-srsf-green-600 hover:bg-srsf-green-700 text-white w-full sm:w-auto"
          >
            <Plus className="size-3.5 mr-1.5" />
            New project
          </Button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors",
              filter === f
                ? "border-srsf-green-600 bg-srsf-green-600 text-white"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <AsyncBoundary
        loading={loading}
        error={error}
        onRetry={refresh}
        empty={!loading && filteredProjects.length === 0}
        loadingFallback={<ProjectGridSkeleton />}
        emptyFallback={
          <div className="text-sm text-muted-foreground py-8">
            {projects.length === 0
              ? "No projects yet."
              : "No projects match this filter."}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              activities={activitiesMap[p.id] ?? []}
            />
          ))}
        </div>
      </AsyncBoundary>

      <ProjectFormModal
        open={showNew}
        onOpenChange={setShowNew}
        onSaved={refresh}
      />
    </div>
  );
}
