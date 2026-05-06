// Re-exports from the canonical feature module.
// This file exists for backward compatibility during the clean-architecture
// migration. New code should import from `@/features/projects` directly.

export type {
  ActivityStatus,
  ActivityPriority,
  ProjectStatusOverride,
  ComputedProjectStatus,
  Project,
  ProjectMilestone,
  ProjectActivity,
  ProjectActivityUpdate,
  ProjectActivityAttachment,
} from "@/features/projects";

export {
  getChildren,
  isParent,
  getLeafActivities,
  computeActivityPercent,
  computeProjectStatus,
  computeProgressPercent,
  normalizePercentComplete,
  countOverdue,
  countNeedsAttention,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/features/projects";

export {
  listProjects,
  getProjectBySlug,
  listMilestones,
  listActivities,
  listUpdates,
  listAttachments,
} from "@/features/projects";

export {
  createProject,
  updateProject,
  createMilestone,
  deleteMilestone,
  createActivity,
  deleteActivity,
  updateActivity,
  postActivityUpdate,
  uploadAttachment,
  deleteAttachment,
  getAttachmentPublicUrl,
  getAttachmentSignedUrl,
} from "@/features/projects";

export { useProjects } from "@/features/projects";
export { useProjectActivities } from "@/features/projects";
export { useProjectActivitiesMap } from "@/features/projects";
