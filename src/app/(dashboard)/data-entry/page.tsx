"use client";

import { useState, useCallback } from "react";
import { ProgramSlug } from "@/lib/types";
import { ProgramSelector } from "@/components/data-entry/program-selector";
import { EnterpriseSpotlightForm } from "@/components/data-entry/enterprise-spotlight-form";
import { MediaProgramForm } from "@/components/data-entry/media-program-form";
import { AbsaOnboardingForm } from "@/components/data-entry/absa-onboarding-form";
import { LearningsForm } from "@/components/data-entry/learnings-form";
import { RecentEntriesTable } from "@/components/data-entry/recent-entries-table";
import { BulkUpload } from "@/components/data-entry/bulk-upload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

const PROGRAM_LABELS: Record<ProgramSlug, string> = {
  "enterprise-spotlight": "Enterprise Spotlight",
  "virtual-university": "Virtual University",
  "hangout": "Hangout",
  "absa-onboarding": "ABSA Onboarding",
  learnings: "Learnings",
};

export default function DataEntryPage() {
  const [selectedProgram, setSelectedProgram] = useState<ProgramSlug | null>(
    null
  );
  const [editEntry, setEditEntry] = useState<Record<string, unknown> | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setEditEntry(null);
  }, []);

  const handleEdit = useCallback((entry: Record<string, unknown>) => {
    setEditEntry(entry);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCancel = useCallback(() => {
    setEditEntry(null);
  }, []);

  function renderForm() {
    switch (selectedProgram) {
      case "enterprise-spotlight":
        return (
          <EnterpriseSpotlightForm
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "virtual-university":
        return (
          <MediaProgramForm
            tableName="virtual_university_entries"
            programSlug="virtual-university"
            programLabel="Virtual University"
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "hangout":
        return (
          <MediaProgramForm
            tableName="hangout_entries"
            programSlug="hangout"
            programLabel="Hangout"
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "absa-onboarding":
        return (
          <AbsaOnboardingForm
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "learnings":
        return (
          <LearningsForm
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Data Entry</h1>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single Entry</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          {!selectedProgram ? (
            <ProgramSelector onSelect={setSelectedProgram} />
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-srsf-green-100 text-srsf-green-800 hover:bg-srsf-green-100">
                        {PROGRAM_LABELS[selectedProgram]}
                      </Badge>
                      <Badge variant="outline">
                        {editEntry ? "Editing entry" : "New entry"}
                      </Badge>
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">
                        {editEntry
                          ? "Update and resubmit your entry"
                          : "Fill out the form below"}
                      </h2>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProgram(null);
                      setEditEntry(null);
                    }}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to programs
                  </Button>
                </div>
              </div>

              {renderForm()}

              <div className="space-y-3">
                <h3 className="text-base font-semibold">Recent Entries</h3>
                <RecentEntriesTable
                  programSlug={selectedProgram}
                  refreshKey={refreshKey}
                  onEdit={handleEdit}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bulk">
          <BulkUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}
