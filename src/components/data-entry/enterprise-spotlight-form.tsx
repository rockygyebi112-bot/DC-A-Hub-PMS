"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { EnterpriseSpotlightEntry } from "@/lib/types";
import { getAgeBracket } from "@/lib/utils";
import {
  REGIONS,
  GENDERS,
  DISABILITY_TYPES,
  OWNERSHIP_TYPES,
  BUSINESS_SIZES,
  FUNDING_STATUSES,
  BUSINESS_SECTORS,
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
import { User, Briefcase, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface EnterpriseSpotlightFormProps {
  editEntry?: EnterpriseSpotlightEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

function mergeOptionLists(
  defaults: readonly string[],
  dynamic?: string[]
): string[] {
  return Array.from(new Set([...(dynamic ?? []), ...defaults]));
}

const EMPTY_FORM = {
  applicant_name: "",
  region: "",
  gender: "",
  age: "",
  disability_status: "",
  disability_type: "",
  disability_type_other: "",
  ownership_type: "",
  business_longevity: "",
  business_size: "",
  funding_status: "",
  business_registered: "",
  business_sector: "",
  learning: "",
};

export function EnterpriseSpotlightForm({
  editEntry,
  onSaved,
  onCancel,
}: EnterpriseSpotlightFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { options: coreOptions } = useCoreIndicatorOptions("enterprise-spotlight");

  const regionOptions = mergeOptionLists(REGIONS, coreOptions.region);
  const genderOptions = mergeOptionLists(GENDERS, coreOptions.gender);
  const ownershipOptions = mergeOptionLists(
    OWNERSHIP_TYPES,
    coreOptions.ownership_type
  );
  const businessSizeOptions = mergeOptionLists(
    BUSINESS_SIZES,
    coreOptions.business_size
  );
  const fundingStatusOptions = mergeOptionLists(
    FUNDING_STATUSES,
    coreOptions.funding_status
  );
  const businessSectorOptions = mergeOptionLists(
    BUSINESS_SECTORS,
    coreOptions.business_sector
  );
  const disabilityStatusOptions = mergeOptionLists(
    ["Yes", "No"],
    coreOptions.disability_status
  );
  const disabilityTypeOptions = mergeOptionLists(
    DISABILITY_TYPES,
    coreOptions.disability_type
  );
  const disabilityTypeSelectOptions =
    form.disability_type === "Other" &&
    !disabilityTypeOptions.includes("Other")
      ? [...disabilityTypeOptions, "Other"]
      : disabilityTypeOptions;
  const businessRegisteredOptions = mergeOptionLists(
    ["Yes", "No"],
    coreOptions.registration_status
  );

  useEffect(() => {
    if (editEntry) {
      // If the stored disability_type doesn't match any preset option, treat it as "Other"
      const storedType = editEntry.disability_type ?? "";
      const isPreset =
        !storedType || disabilityTypeOptions.includes(storedType);
      setForm({
        applicant_name: editEntry.applicant_name,
        region: editEntry.region,
        gender: editEntry.gender,
        age: editEntry.age?.toString() ?? "",
        disability_status: editEntry.disability_status,
        disability_type: isPreset ? storedType : "Other",
        disability_type_other: isPreset ? "" : storedType,
        ownership_type: editEntry.ownership_type,
        business_longevity: editEntry.business_longevity?.toString() ?? "",
        business_size: editEntry.business_size,
        funding_status: editEntry.funding_status,
        business_registered: editEntry.business_registered,
        business_sector: editEntry.business_sector,
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
    if (!isDraft && !form.applicant_name.trim()) {
      toast.error("Applicant name is required");
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
    // When "Other" is picked, use the free-text value; otherwise use the selected option
    const resolvedDisabilityType =
      form.disability_type === "Other"
        ? form.disability_type_other.trim()
        : form.disability_type;
    const record = {
      user_id: user.id,
      applicant_name: form.applicant_name,
      region: form.region,
      gender: form.gender,
      age: ageNum,
      age_bracket: ageNum ? getAgeBracket(ageNum) : "",
      disability_status: form.disability_status,
      disability_type:
        form.disability_status === "Yes" ? resolvedDisabilityType || null : null,
      ownership_type: form.ownership_type,
      business_longevity: form.business_longevity
        ? parseInt(form.business_longevity, 10)
        : null,
      business_size: form.business_size,
      funding_status: form.funding_status,
      business_registered: form.business_registered,
      business_sector: form.business_sector,
      learning: form.learning,
      custom_fields: customFields,
      is_draft: isDraft,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from("enterprise_spotlight_entries")
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase
        .from("enterprise_spotlight_entries")
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
        title="Applicant Information"
        description="Personal details of the applicant"
        icon={User}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="applicant_name">Applicant Name *</Label>
            <Input
              id="applicant_name"
              value={form.applicant_name}
              onChange={(e) => setField("applicant_name", e.target.value)}
              placeholder="Full name"
            />
          </div>
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

      <FormSection
        title="Business Information"
        description="Details about the applicant's business"
        icon={Briefcase}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="ownership_type">Ownership Type</Label>
            <Select
              value={form.ownership_type}
              onValueChange={(v) => setField("ownership_type", v ?? "")}
            >
              <SelectTrigger id="ownership_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ownershipOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_longevity">
              Business Longevity (years)
            </Label>
            <Input
              id="business_longevity"
              type="number"
              min={0}
              value={form.business_longevity}
              onChange={(e) => setField("business_longevity", e.target.value)}
              placeholder="Years in operation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_size">Business Size</Label>
            <Select
              value={form.business_size}
              onValueChange={(v) => setField("business_size", v ?? "")}
            >
              <SelectTrigger id="business_size">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {businessSizeOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="funding_status">Funding Status</Label>
            <Select
              value={form.funding_status}
              onValueChange={(v) => setField("funding_status", v ?? "")}
            >
              <SelectTrigger id="funding_status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {fundingStatusOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_registered">Business Registered</Label>
            <Select
              value={form.business_registered}
              onValueChange={(v) => setField("business_registered", v ?? "")}
            >
              <SelectTrigger id="business_registered">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {businessRegisteredOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business_sector">Business Sector</Label>
            <Select
              value={form.business_sector}
              onValueChange={(v) => setField("business_sector", v ?? "")}
            >
              <SelectTrigger id="business_sector">
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {businessSectorOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      <CustomFieldsSection
        programSlug="enterprise-spotlight"
        values={customFields}
        onChange={setCustomFields}
      />

      <FormSection
        title="Learnings & Insights"
        description="Optional observations captured from this application"
        icon={Lightbulb}
      >
        <div className="space-y-2">
          <Label htmlFor="learning" className="sr-only">
            Learnings
          </Label>
          <Textarea
            id="learning"
            value={form.learning}
            onChange={(e) => setField("learning", e.target.value)}
            placeholder="Any learnings or insights from this application..."
            rows={3}
          />
        </div>
      </FormSection>

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
