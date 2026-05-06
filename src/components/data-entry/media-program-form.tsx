"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MediaProgramEntry } from "@/lib/types";
import { PLATFORMS, GENDERS, AGE_BRACKETS } from "@/lib/constants";
import { useCoreIndicatorOptions } from "@/lib/hooks/use-core-indicator-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomFieldsSection } from "@/components/data-entry/custom-fields-section";
import { FormActions } from "@/components/data-entry/form-actions";
import { FormSection } from "@/components/data-entry/form-section";
import { Film, BarChart3, Users, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MediaProgramFormProps {
  tableName: "virtual_university_entries" | "hangout_entries";
  programSlug: string;
  programLabel: string;
  editEntry?: MediaProgramEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

interface PlatformMetrics {
  views: string;
  shares: string;
  saves: string;
  likes: string;
}

const EMPTY_METRICS: PlatformMetrics = {
  views: "",
  shares: "",
  saves: "",
  likes: "",
};

const METRIC_FIELDS = ["views", "shares", "saves", "likes"] as const;

function sumCountMap(counts: Record<string, string>): number {
  return Object.values(counts).reduce(
    (sum, value) => sum + (parseInt(value, 10) || 0),
    0
  );
}

export function MediaProgramForm({
  tableName,
  programSlug,
  programLabel,
  editEntry,
  onSaved,
  onCancel,
}: MediaProgramFormProps) {
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [dateAired, setDateAired] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformMetrics, setPlatformMetrics] = useState<
    Record<string, PlatformMetrics>
  >({
    Facebook: { ...EMPTY_METRICS },
    YouTube: { ...EMPTY_METRICS },
  });
  const [genderCounts, setGenderCounts] = useState<Record<string, string>>({});
  const [ageBracketCounts, setAgeBracketCounts] = useState<
    Record<string, string>
  >({});
  const [learning, setLearning] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { options: coreOptions } = useCoreIndicatorOptions(programSlug);

  const genderOptions = coreOptions.gender ?? [...GENDERS];
  const ageBracketOptions = coreOptions.age_bracket ?? [...AGE_BRACKETS];
  const selectedPlatformTotals = selectedPlatforms.reduce(
    (sum, platform) =>
      sum +
      Object.values(platformMetrics[platform] ?? EMPTY_METRICS).reduce(
        (innerSum, value) => innerSum + (parseInt(value, 10) || 0),
        0
      ),
    0
  );
  const audienceTotal = sumCountMap(genderCounts) + sumCountMap(ageBracketCounts);

  useEffect(() => {
    if (editEntry) {
      setEpisodeTitle(editEntry.episode_title);
      setDateAired(editEntry.date_aired ?? "");
      setSelectedPlatforms(editEntry.platforms);
      const metricsState: Record<string, PlatformMetrics> = {
        Facebook: { ...EMPTY_METRICS },
        YouTube: { ...EMPTY_METRICS },
      };
      for (const p of PLATFORMS) {
        const key = p.toLowerCase() as "facebook" | "youtube";
        const m = editEntry.metrics[key];
        if (m) {
          metricsState[p] = {
            views: m.views?.toString() ?? "",
            shares: m.shares?.toString() ?? "",
            saves: m.saves?.toString() ?? "",
            likes: m.likes?.toString() ?? "",
          };
        }
      }
      setPlatformMetrics(metricsState);
      const gc: Record<string, string> = {};
      for (const [k, v] of Object.entries(editEntry.demographics.gender ?? {})) {
        gc[k] = v.toString();
      }
      setGenderCounts(gc);
      const ac: Record<string, string> = {};
      for (const [k, v] of Object.entries(
        editEntry.demographics.age_brackets ?? {}
      )) {
        ac[k] = v.toString();
      }
      setAgeBracketCounts(ac);
      setLearning(editEntry.learning);
      setCustomFields((editEntry.custom_fields as Record<string, unknown>) ?? {});
    }
  }, [editEntry]);

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  function setMetric(
    platform: string,
    field: keyof PlatformMetrics,
    value: string
  ) {
    setPlatformMetrics((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !episodeTitle.trim()) {
      toast.error("Episode title is required");
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

    const metrics: Record<
      string,
      { views: number; shares: number; saves: number; likes: number }
    > = {};
    for (const p of selectedPlatforms) {
      const pm = platformMetrics[p];
      metrics[p.toLowerCase()] = {
        views: parseInt(pm.views, 10) || 0,
        shares: parseInt(pm.shares, 10) || 0,
        saves: parseInt(pm.saves, 10) || 0,
        likes: parseInt(pm.likes, 10) || 0,
      };
    }

    const demographics = {
      gender: Object.fromEntries(
        Object.entries(genderCounts)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, parseInt(v, 10) || 0])
      ),
      age_brackets: Object.fromEntries(
        Object.entries(ageBracketCounts)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, parseInt(v, 10) || 0])
      ),
    };

    const record = {
      user_id: user.id,
      episode_title: episodeTitle,
      date_aired: dateAired || null,
      platforms: selectedPlatforms,
      metrics,
      demographics,
      learning,
      custom_fields: customFields,
      is_draft: isDraft,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from(tableName)
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase.from(tableName).insert(record));
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
    setEpisodeTitle("");
    setDateAired("");
    setSelectedPlatforms([]);
    setPlatformMetrics({
      Facebook: { ...EMPTY_METRICS },
      YouTube: { ...EMPTY_METRICS },
    });
    setGenderCounts({});
    setAgeBracketCounts({});
    setLearning("");
    setCustomFields({});
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Platforms
          </p>
          <p className="mt-2 text-2xl font-semibold">{selectedPlatforms.length}</p>
          <p className="text-sm text-muted-foreground">
            Choose only the channels you are reporting on.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Metrics Entered
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {selectedPlatformTotals.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Combined engagement values entered so far.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Audience Count
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {audienceTotal.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground">
            Total audience figures captured across the demographics blocks.
          </p>
        </div>
      </div>

      <FormSection
        title="Episode Information"
        description="Start with the core details, then pick the platforms you have numbers for."
        icon={Film}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="episode_title">Episode Title *</Label>
            <Input
              id="episode_title"
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              placeholder="Episode title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date_aired">Date Aired</Label>
            <Input
              id="date_aired"
              type="date"
              value={dateAired}
              onChange={(e) => setDateAired(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Label>Platforms</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  selectedPlatforms.includes(platform)
                    ? "border-srsf-green-500 bg-srsf-green-50 text-srsf-green-900"
                    : "border-border/70 bg-background hover:border-srsf-green-300 hover:bg-muted/40"
                )}
              >
                <span className="text-sm font-medium">{platform}</span>
                <span className="text-xs text-muted-foreground">
                  {selectedPlatforms.includes(platform) ? "Selected" : "Tap to add"}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Leave a platform unselected if you do not have its numbers yet.
          </p>
        </div>
      </FormSection>

      {selectedPlatforms.length > 0 && (
        <FormSection
          title="Platform Metrics"
          description="Enter only the counts you have. Empty fields are treated as zero."
          icon={BarChart3}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {selectedPlatforms.map((platform) => (
              <div
                key={platform}
                className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold">{platform}</h4>
                    <p className="text-xs text-muted-foreground">
                      Keep this card focused on one channel at a time.
                    </p>
                  </div>
                  <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    Total{" "}
                    {Object.values(platformMetrics[platform] ?? EMPTY_METRICS)
                      .reduce(
                        (sum, value) => sum + (parseInt(value, 10) || 0),
                        0
                      )
                      .toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {METRIC_FIELDS.map((field) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs capitalize">{field}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={platformMetrics[platform]?.[field] ?? ""}
                        onChange={(e) => setMetric(platform, field, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      )}

      <FormSection
        title="Audience Demographics"
        description="Capture the audience mix if it is available from your reporting tools."
        icon={Users}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">Gender</h4>
                <p className="text-xs text-muted-foreground">
                  Enter counts only for the groups your report includes.
                </p>
              </div>
              <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                Total {sumCountMap(genderCounts).toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {genderOptions.map((g) => (
                <div key={g} className="space-y-1">
                  <Label className="text-xs">{g}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={genderCounts[g] ?? ""}
                    onChange={(e) =>
                      setGenderCounts((prev) => ({
                        ...prev,
                        [g]: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold">Age Bracket</h4>
                <p className="text-xs text-muted-foreground">
                  Add only the age ranges you can confirm.
                </p>
              </div>
              <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                Total {sumCountMap(ageBracketCounts).toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {ageBracketOptions.map((ab) => (
                <div key={ab} className="space-y-1">
                  <Label className="text-xs">{ab}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={ageBracketCounts[ab] ?? ""}
                    onChange={(e) =>
                      setAgeBracketCounts((prev) => ({
                        ...prev,
                        [ab]: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      <CustomFieldsSection
        programSlug={programSlug}
        values={customFields}
        onChange={setCustomFields}
      />

      <FormSection
        title="Learnings & Insights"
        description={`Key takeaways from this ${programLabel} episode.`}
        icon={Lightbulb}
      >
        <div className="space-y-2">
          <Label htmlFor="learning">Learnings</Label>
          <Textarea
            id="learning"
            value={learning}
            onChange={(e) => setLearning(e.target.value)}
            placeholder={`Any learnings or insights from this ${programLabel} episode...`}
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
