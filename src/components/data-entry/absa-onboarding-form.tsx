"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AbsaOnboardingEntry } from "@/lib/types";
import { getAgeBracket } from "@/lib/utils";
import {
  REGIONS,
  GENDERS,
  EMPLOYMENT_STATUSES,
  DISABILITY_TYPES,
} from "@/lib/constants";
import { useCoreIndicatorOptions } from "@/lib/hooks/use-core-indicator-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CustomFieldsSection } from "@/components/data-entry/custom-fields-section";
import { FormActions } from "@/components/data-entry/form-actions";
import { FormSection } from "@/components/data-entry/form-section";
import { User, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface AbsaOnboardingFormProps {
  editEntry?: AbsaOnboardingEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM = {
  participant_name: "",
  gender: "",
  age: "",
  region: "",
  employment_status: "",
  disability_status: "",
  disability_type: "",
  disability_type_other: "",
  learning: "",
};

export function AbsaOnboardingForm({
  editEntry,
  onSaved,
  onCancel,
}: AbsaOnboardingFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { options: coreOptions } = useCoreIndicatorOptions("absa-onboarding");

  const regionOptions = coreOptions.region ?? [...REGIONS];
  const genderOptions = coreOptions.gender ?? [...GENDERS];
  const employmentOptions = coreOptions.employment_status ?? [...EMPLOYMENT_STATUSES];
  const disabilityStatusOptions = coreOptions.disability_status ?? ["Yes", "No"];
  const disabilityTypeOptions = coreOptions.disability_type ?? [...DISABILITY_TYPES];
  const disabilityTypeSelectOptions =
    form.disability_type === "Other" &&
    !disabilityTypeOptions.includes("Other")
      ? [...disabilityTypeOptions, "Other"]
      : disabilityTypeOptions;

  useEffect(() => {
    if (editEntry) {
      const storedType = editEntry.disability_type ?? "";
      const isPreset =
        !storedType || disabilityTypeOptions.includes(storedType);
      setForm({
        participant_name: editEntry.participant_name,
        gender: editEntry.gender,
        age: editEntry.age?.toString() ?? "",
        region: editEntry.region,
        employment_status: editEntry.employment_status,
        disability_status: editEntry.disability_status,
        disability_type: isPreset ? storedType : "Other",
        disability_type_other: isPreset ? "" : storedType,
        learning: editEntry.learning,
      });
      setCustomFields((editEntry.custom_fields as Record<string, unknown>) ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editEntry]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !form.participant_name.trim()) {
      toast.error("Participant name is required");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setSaving(false);
      return;
    }

    const ageNum = form.age ? parseInt(form.age, 10) : null;
    const resolvedDisabilityType =
      form.disability_type === "Other"
        ? form.disability_type_other.trim()
        : form.disability_type;
    const record = {
      user_id: user.id,
      participant_name: form.participant_name,
      gender: form.gender,
      age: ageNum,
      age_bracket: ageNum ? getAgeBracket(ageNum) : "",
      region: form.region,
      employment_status: form.employment_status,
      disability_status: form.disability_status,
      disability_type:
        form.disability_status === "Yes" ? resolvedDisabilityType || null : null,
      learning: form.learning,
      custom_fields: customFields,
      is_draft: isDraft,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from("absa_onboarding_entries")
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase
        .from("absa_onboarding_entries")
        .insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      isDraft
        ? "Draft saved"
        : editEntry
          ? "Entry updated"
          : "Entry submitted"
    );
    setForm(EMPTY_FORM);
    setCustomFields({});
    onSaved();
  }

  return (
    <div className="space-y-6">
      <FormSection
        title="Participant Information"
        description="Demographic and personal details about the participant."
        icon={User}
      >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Participant Name */}
        <div className="space-y-2">
          <Label htmlFor="participant_name">Participant Name *</Label>
          <Input
            id="participant_name"
            value={form.participant_name}
            onChange={(e) => setField("participant_name", e.target.value)}
            placeholder="Full name"
          />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={form.gender}
            onValueChange={(v) => setField("gender", v ?? "")}
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

        {/* Age */}
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            min={0}
            max={150}
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            placeholder="Age in years"
          />
          {form.age && (
            <p className="text-xs text-muted-foreground">
              Bracket: {getAgeBracket(parseInt(form.age, 10))}
            </p>
          )}
        </div>

        {/* Region */}
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Select
            value={form.region}
            onValueChange={(v) => setField("region", v ?? "")}
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

        {/* Employment Status */}
        <div className="space-y-2">
          <Label htmlFor="employment_status">Employment Status</Label>
          <Select
            value={form.employment_status}
            onValueChange={(v) => setField("employment_status", v ?? "")}
          >
            <SelectTrigger id="employment_status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {employmentOptions.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Disability Status */}
        <div className="space-y-2">
          <Label htmlFor="disability_status">Disability Status</Label>
          <Select
            value={form.disability_status}
            onValueChange={(v) => setField("disability_status", v ?? "")}
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

        {/* Disability Type (conditional) */}
        {form.disability_status === "Yes" && (
          <div className="space-y-2">
            <Label htmlFor="disability_type">Disability Type</Label>
            <Select
              value={form.disability_type}
              onValueChange={(v) => setField("disability_type", v ?? "")}
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
            {form.disability_type === "Other" && (
              <Input
                id="disability_type_other"
                value={form.disability_type_other}
                onChange={(e) =>
                  setField("disability_type_other", e.target.value)
                }
                placeholder="Please specify"
                className="mt-2"
              />
            )}
          </div>
        )}
      </div>
      </FormSection>

      {/* Custom Indicators */}
      <CustomFieldsSection
        programSlug="absa-onboarding"
        values={customFields}
        onChange={setCustomFields}
      />

      <FormSection
        title="Learnings & Insights"
        description="Key takeaways from this onboarding session."
        icon={Lightbulb}
      >
        <div className="space-y-2">
          <Label htmlFor="learning">Learnings</Label>
          <Textarea
            id="learning"
            value={form.learning}
            onChange={(e) => setField("learning", e.target.value)}
            placeholder="Any learnings or insights from this onboarding..."
            rows={3}
          />
        </div>
      </FormSection>

      {/* Action buttons */}
      <FormActions
        saving={saving}
        submitLabel={editEntry ? "Update Entry" : "Submit Entry"}
        onSubmit={() => handleSubmit(false)}
        onSaveDraft={() => handleSubmit(true)}
        onCancel={onCancel}
      />
    </div>
  );
}
