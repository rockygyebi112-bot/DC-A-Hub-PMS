"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FormSection } from "@/components/data-entry/form-section";
import type { Indicator } from "@/lib/types";
import { SlidersHorizontal } from "lucide-react";

interface CustomFieldsSectionProps {
  programSlug: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function CustomFieldsSection({
  programSlug,
  values,
  onChange,
}: CustomFieldsSectionProps) {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // Get program id from slug
      const { data: program } = await supabase
        .from("programs")
        .select("id")
        .eq("slug", programSlug)
        .single();
      if (!program) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("indicators")
        .select("*")
        .eq("program_id", program.id)
        .eq("is_core", false)
        .eq("is_active", true)
        .order("sort_order");
      setIndicators((data as Indicator[]) ?? []);
      setLoading(false);
    }
    load();
  }, [programSlug]);

  if (loading || indicators.length === 0) return null;

  function setValue(indicatorName: string, value: unknown) {
    onChange({ ...values, [indicatorName]: value });
  }

  return (
    <FormSection
      title="Additional Indicators"
      description="Optional custom fields configured for this program."
      icon={SlidersHorizontal}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {indicators.map((ind) => (
          <div key={ind.id} className="space-y-2">
            <Label>{ind.name}</Label>
            {ind.data_type === "numeric" ? (
              <Input
                type="number"
                value={(values[ind.name] as string) ?? ""}
                onChange={(e) => setValue(ind.name, e.target.value)}
                placeholder={ind.manual_entry ? "Enter value" : "0"}
              />
            ) : (
              <Select
                value={(values[ind.name] as string) ?? ""}
                onValueChange={(v) => setValue(ind.name, v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select ${ind.name.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {ind.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </FormSection>
  );
}
