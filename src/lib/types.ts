export type UserStatus = "pending" | "active" | "inactive" | "rejected";

export type AppModule =
  | "executive_dashboard"
  | "program_dashboards"
  | "data_entry"
  | "indicators"
  | "learnings"
  | "settings"
  | "projects";

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  module: AppModule;
  allowed: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface Program {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

// ============================================
// INDICATORS
// ============================================

export interface Indicator {
  id: string;
  program_id: string;
  name: string;
  data_type: "numeric" | "categorical";
  options: string[];
  is_core: boolean;
  show_on_executive: boolean;
  manual_entry: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ============================================
// PROGRAM ENTRIES
// ============================================

export interface EnterpriseSpotlightEntry {
  id: string;
  user_id: string;
  applicant_name: string;
  region: string;
  gender: string;
  age: number | null;
  age_bracket: string;
  disability_status: string;
  disability_type: string | null;
  ownership_type: string;
  business_longevity: number | null;
  business_size: string;
  funding_status: string;
  business_registered: string;
  business_sector: string;
  custom_fields: Record<string, unknown>;
  learning: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface MediaProgramEntry {
  id: string;
  user_id: string;
  episode_title: string;
  date_aired: string | null;
  platforms: string[];
  metrics: {
    facebook?: { views: number; shares: number; saves: number; likes: number };
    youtube?: { views: number; shares: number; saves: number; likes: number };
  };
  demographics: {
    gender: Record<string, number>;
    age_brackets: Record<string, number>;
  };
  custom_fields: Record<string, unknown>;
  learning: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface AbsaOnboardingEntry {
  id: string;
  user_id: string;
  participant_name: string;
  gender: string;
  age: number | null;
  age_bracket: string;
  region: string;
  employment_status: string;
  disability_status: string;
  disability_type: string | null;
  custom_fields: Record<string, unknown>;
  learning: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningEntry {
  id: string;
  user_id: string;
  program_id: string;
  category: string;
  title: string;
  description: string;
  learning_date: string | null;
  created_at: string;
  updated_at: string;
  program?: Program;
}

// Slug to table name mapping
export type ProgramSlug =
  | "enterprise-spotlight"
  | "virtual-university"
  | "hangout"
  | "absa-onboarding"
  | "learnings";

export const PROGRAM_TABLE_MAP: Record<ProgramSlug, string> = {
  "enterprise-spotlight": "enterprise_spotlight_entries",
  "virtual-university": "virtual_university_entries",
  "hangout": "hangout_entries",
  "absa-onboarding": "absa_onboarding_entries",
  "learnings": "learnings",
};

