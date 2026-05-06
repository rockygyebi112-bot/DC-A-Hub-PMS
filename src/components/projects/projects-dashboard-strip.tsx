"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listActivities, listProjects } from "@/lib/projects/queries";
import type { Project, ProjectActivity } from "@/lib/projects/types";
import { ProjectCard } from "./project-card";

export function ProjectsDashboardStrip() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activitiesByProject, setActivitiesByProject] = useState<
    Record<string, ProjectActivity[]>
  >({});

  useEffect(() => {
    (async () => {
      const ps = await listProjects();
      setProjects(ps);
      const entries = await Promise.all(
        ps.map(async (p) => [p.id, await listActivities(p.id)] as const),
      );
      setActivitiesByProject(Object.fromEntries(entries));
    })();
  }, []);

  if (projects.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Link
          href="/projects"
          className="text-sm text-primary hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {projects.slice(0, 3).map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            activities={activitiesByProject[p.id] ?? []}
            variant="compact"
          />
        ))}
      </div>
    </section>
  );
}
