"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { INDICATOR_PROGRAMS } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { IndicatorsTable } from "@/components/indicators/indicators-table";
import { IndicatorModal } from "@/components/indicators/indicator-modal";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { Indicator, Program } from "@/lib/types";

export default function IndicatorsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeSlug, setActiveSlug] = useState(INDICATOR_PROGRAMS[0].slug);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndicator, setEditIndicator] = useState<Indicator | null>(null);

  const supabase = createClient();

  // Load programs once
  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase.from("programs").select("*").order("name");
      setPrograms((data as Program[]) ?? []);
    }

    void loadPrograms();
  }, [supabase]);

  const activeProgram = programs.find((p) => p.slug === activeSlug);

  const loadIndicators = useCallback(async () => {
    if (!activeProgram) return;
    setLoading(true);
    const { data } = await supabase
      .from("indicators")
      .select("*")
      .eq("program_id", activeProgram.id)
      .eq("is_active", true)
      .order("sort_order");
    setIndicators((data as Indicator[]) ?? []);
    setLoading(false);
  }, [activeProgram, supabase]);

  useEffect(() => {
    loadIndicators();
  }, [loadIndicators]);

  function handleEdit(indicator: Indicator) {
    setEditIndicator(indicator);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditIndicator(null);
    setModalOpen(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicators Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure core and custom indicators per program.
          </p>
        </div>
        <Button
          onClick={handleAdd}
          className="bg-srsf-green-500 hover:bg-srsf-green-600"
          disabled={!activeProgram}
        >
          <Plus className="size-4 mr-1.5" />
          Add Indicator
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total Indicators" value={indicators.length} accent="purple" />
        <KpiCard
          label="Core Indicators"
          value={indicators.filter((i) => i.is_core).length}
          accent="green"
        />
        <KpiCard
          label="On Exec Dashboard"
          value={indicators.filter((i) => i.show_on_executive).length}
          accent="blue"
        />
      </div>

      <Tabs value={activeSlug} onValueChange={setActiveSlug}>
        <TabsList>
          {INDICATOR_PROGRAMS.map((p) => (
            <TabsTrigger key={p.slug} value={p.slug}>
              {p.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {INDICATOR_PROGRAMS.map((p) => (
          <TabsContent key={p.slug} value={p.slug}>
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <IndicatorsTable
                indicators={indicators}
                loading={loading}
                onEdit={handleEdit}
                onRefresh={loadIndicators}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {activeProgram && (
        <IndicatorModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          programId={activeProgram.id}
          editIndicator={editIndicator}
          indicatorCount={indicators.length}
          onSaved={loadIndicators}
        />
      )}
    </div>
  );
}
