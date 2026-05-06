// Domain
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
} from "./domain/types";

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
} from "./domain/status";

// Data
export {
  listProjects,
  getProjectBySlug,
  listMilestones,
  listActivities,
  listUpdates,
  listAttachments,
} from "./data/queries";

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
} from "./data/mutations";

// Hooks
export { useProjects } from "./hooks/use-projects";
export { useProjectActivities } from "./hooks/use-project-activities";
export { useProjectActivitiesMap } from "./hooks/use-project-activities-map";
