/**
 * Shared form types and utilities
 * Centralizes form-related type definitions to avoid duplication
 */

import { REGIONS, GENDERS, DISABILITY_TYPES } from "@/lib/constants";

/** Common demographic fields used across multiple forms */
export interface DemographicFields {
  region: string;
  gender: string;
  age: string;
  age_bracket: string;
  disability_status: string;
  disability_type: string;
  disability_type_other: string;
}

/** Empty state for demographic fields */
export const EMPTY_DEMOGRAPHICS: DemographicFields = {
  region: "",
  gender: "",
  age: "",
  age_bracket: "",
  disability_status: "",
  disability_type: "",
  disability_type_other: "",
};

/** Entry types that include demographic fields */
export interface EntryWithDemographics {
  region?: string;
  gender?: string;
  age?: number | null;
  age_bracket?: string;
  disability_status?: string;
  disability_type?: string | null;
}

/** Configuration for option merging */
export interface OptionConfig {
  defaults: readonly string[];
  dynamic?: string[];
}

/**
 * Merge default and dynamic options, removing duplicates
 */
export function mergeOptionLists(
  defaults: readonly string[],
  dynamic?: string[]
): string[] {
  return Array.from(new Set([...(dynamic ?? []), ...defaults]));
}

/**
 * Resolve disability type value, handling "Other" option
 */
export function resolveDisabilityType(
  formType: string,
  formOther: string,
  disabilityStatus: string
): string | null {
  if (disabilityStatus !== "Yes") return null;
  return formType === "Other" ? formOther.trim() || null : formType || null;
}

/**
 * Determine if stored disability type is a preset option
 */
export function isPresetDisabilityType(
  storedType: string | null | undefined,
  options: string[]
): boolean {
  return !storedType || options.includes(storedType);
}

/**
 * Get the display value for disability type (handles "Other" case)
 */
export function getDisabilityTypeDisplay(
  storedType: string | null | undefined,
  options: string[]
): { type: string; other: string } {
  const isPreset = isPresetDisabilityType(storedType, options);
  return {
    type: isPreset ? (storedType ?? "") : "Other",
    other: isPreset ? "" : (storedType ?? ""),
  };
}

/**
 * Build disability type options, adding "Other" if needed
 */
export function buildDisabilityTypeOptions(
  options: string[],
  currentType: string
): string[] {
  if (currentType === "Other" && !options.includes("Other")) {
    return [...options, "Other"];
  }
  return options;
}
