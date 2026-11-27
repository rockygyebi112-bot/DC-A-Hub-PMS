import "server-only";

import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getProjectRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { unescoDashboardSlugs } from "./routes";

export function isUnescoProject(projectId: string) {
  return projectId === process.env.UNESCO_PROJECT_ID;
}

export const getUnescoDashboardAccess = cache(async (projectId: string) => {
  if (!isUnescoProject(projectId)) return { status: "missing" } as const;

  const user = await getSessionUser();
  if (!user) return { status: "signed-out" } as const;
  if (!user.isActive) return { status: "denied" } as const;
  const projectRole = await getProjectRole(user.userId, projectId);
  if (!projectRole) return { status: "denied" } as const;

  const sb = await createClient();
  // The existing evaluation/dashboard reporting policies use this same check.
  const { data: canReport, error } = await sb.rpc("can_access_project", { p_project_id: projectId });
  if (error || !canReport) return { status: "denied" } as const;

  return { status: "member", allowed: unescoDashboardSlugs, projectRole, userId: user.userId } as const;
});
