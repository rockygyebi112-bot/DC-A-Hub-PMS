/**
 * Reusable demographic fields component
 * Eliminates duplication between enterprise-spotlight-form and absa-onboarding-form
 */

"use client";

import { useMemo } from "react";
import {
  REGIONS,
  GENDERS,
  DISABILITY_TYPES,
} from "@/lib/constants";
import { useCoreIndicatorOptions } from "@/lib/hooks/use-core-indicator-options";
import {
  mergeOptionLists,
  buildDisabilityTypeOptions,
  resolveDisabilityType,
} from "@/lib/forms/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { getAgeBracket } from "@/lib/utils";

export interface DemographicFieldValues {
  region: string;
  gender: string;
  age: string;
  disability_status: string;
  disability_type: string;
  disability_type_other: string;
}

interface DemographicFieldsProps {
  programSlug: string;
  values: DemographicFieldValues;
  onChange: (field: keyof DemographicFieldValues, value: string) => void;
  /** Optional fields to hide */
  hiddenFields?: Array<keyof DemographicFieldValues>;
  /** Number of columns in the grid (1 or 2) */
  columns?: 1 | 2;
}

/**
 * Reusable demographic fields: region, gender, age, disability status/type
 * Uses core indicator options for dynamic option lists
 */
export function DemographicFields({
  programSlug,
  values,
  onChange,
  hiddenFields = [],
  columns = 2,
}: DemographicFieldsProps) {
  const { options: coreOptions } = useCoreIndicatorOptions(programSlug);

  // Merge static and dynamic options
  const regionOptions = useMemo(
    () => mergeOptionLists(REGIONS, coreOptions.region),
    [coreOptions.region]
  );
  const genderOptions = useMemo(
    () => mergeOptionLists(GENDERS, coreOptions.gender),
    [coreOptions.gender]
  );
  const disabilityStatusOptions = useMemo(
    () => mergeOptionLists(["Yes", "No"], coreOptions.disability_status),
    [coreOptions.disability_status]
  );
  const disabilityTypeOptions = useMemo(
    () => mergeOptionLists(DISABILITY_TYPES, coreOptions.disability_type),
    [coreOptions.disability_type]
  );

  const disabilityTypeSelectOptions = useMemo(
    () => buildDisabilityTypeOptions(disabilityTypeOptions, values.disability_type),
    [disabilityTypeOptions, values.disability_type]
  );

  const isFieldVisible = (field: keyof DemographicFieldValues) =>
    !hiddenFields.includes(field);

  const ageNum = values.age ? parseInt(values.age, 10) : null;
  const ageBracket = ageNum ? getAgeBracket(ageNum) : null;

  return (
    <div className={`grid gap-5 ${columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
      {isFieldVisible("region") && (
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Select
            value={values.region}
            onValueChange={(v) => onChange("region", v ?? "")}
          >
            <SelectTrigger id="region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {regionOptions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isFieldVisible("gender") && (
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={values.gender}
            onValueChange={(v) => onChange("gender", v ?? "")}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isFieldVisible("age") && (
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            min={0}
            max={150}
            value={values.age}
            onChange={(e) => onChange("age", e.target.value)}
            placeholder="Age in years"
          />
          {ageBracket && (
            <p className="text-xs text-muted-foreground">
              Bracket: {ageBracket}
            </p>
          )}
        </div>
      )}

      {isFieldVisible("disability_status") && (
        <div className="space-y-2">
          <Label htmlFor="disability_status">Disability Status</Label>
          <Select
            value={values.disability_status}
            onValueChange={(v) => onChange("disability_status", v ?? "")}
          >
            <SelectTrigger id="disability_status">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {disabilityStatusOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isFieldVisible("disability_type") && values.disability_status === "Yes" && (
        <div className="space-y-2">
          <Label htmlFor="disability_type">Disability Type</Label>
          <Select
            value={values.disability_type}
            onValueChange={(v) => onChange("disability_type", v ?? "")}
          >
            <SelectTrigger id="disability_type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {disabilityTypeSelectOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {values.disability_type === "Other" && (
            <Input
              id="disability_type_other"
              value={values.disability_type_other}
              onChange={(e) => onChange("disability_type_other", e.target.value)}
              placeholder="Please specify"
              className="mt-2"
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hook to extract resolved disability type for submission
 */
export function useResolvedDisabilityType(
  formType: string,
  formOther: string,
  disabilityStatus: string
): string | null {
  return resolveDisabilityType(formType, formOther, disabilityStatus);
}
