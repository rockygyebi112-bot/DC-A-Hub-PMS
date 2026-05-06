/**
 * Centralized, type-safe database table definitions
 * Eliminates magic strings and provides autocomplete for table names
 */

import { ProgramSlug } from "@/lib/types";

/** All database table names as const for type safety */
export const TABLES = {
  // Program entry tables
  enterpriseSpotlight: "enterprise_spotlight_entries",
  virtualUniversity: "virtual_university_entries",
  hangout: "hangout_entries",
  absaOnboarding: "absa_onboarding_entries",
  learnings: "learnings",

  // Reference tables
  programs: "programs",
  indicators: "indicators",
  userProfiles: "user_profiles",
  roles: "roles",
  rolePermissions: "role_permissions",

  // Project tables
  projects: "projects",
  projectMilestones: "project_milestones",
  projectActivities: "project_activities",
  projectActivityUpdates: "project_activity_updates",
  projectActivityAttachments: "project_activity_attachments",
} as const;

/** Type of all table names */
export type TableName = (typeof TABLES)[keyof typeof TABLES];

/** Map program slugs to their entry tables */
export const PROGRAM_TABLE_MAP: Record<ProgramSlug, TableName> = {
  "enterprise-spotlight": TABLES.enterpriseSpotlight,
  "virtual-university": TABLES.virtualUniversity,
  hangout: TABLES.hangout,
  "absa-onboarding": TABLES.absaOnboarding,
  learnings: TABLES.learnings,
};

/**
 * Get the database table name for a program slug
 * @throws Error if slug is not recognized
 */
export function getTableForProgram(slug: ProgramSlug): TableName {
  const table = PROGRAM_TABLE_MAP[slug];
  if (!table) {
    throw new Error(`Unknown program slug: ${slug}`);
  }
  return table;
}

/**
 * Check if a string is a valid program slug
 */
export function isValidProgramSlug(slug: string): slug is ProgramSlug {
  return slug in PROGRAM_TABLE_MAP;
}

/** Date field used for each table's temporal filtering */
export const TABLE_DATE_FIELDS: Record<TableName, string> = {
  [TABLES.enterpriseSpotlight]: "created_at",
  [TABLES.virtualUniversity]: "date_aired",
  [TABLES.hangout]: "date_aired",
  [TABLES.absaOnboarding]: "created_at",
  [TABLES.learnings]: "created_at",
  [TABLES.programs]: "created_at",
  [TABLES.indicators]: "created_at",
  [TABLES.userProfiles]: "created_at",
  [TABLES.roles]: "created_at",
  [TABLES.rolePermissions]: "created_at",
  [TABLES.projects]: "created_at",
  [TABLES.projectMilestones]: "created_at",
  [TABLES.projectActivities]: "created_at",
  [TABLES.projectActivityUpdates]: "created_at",
  [TABLES.projectActivityAttachments]: "created_at",
};

/**
 * Get the date field for a table (for filtering queries)
 */
export function getDateFieldForTable(table: TableName): string {
  return TABLE_DATE_FIELDS[table] ?? "created_at";
}
