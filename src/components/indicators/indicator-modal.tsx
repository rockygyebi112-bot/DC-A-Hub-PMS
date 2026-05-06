"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Indicator } from "@/lib/types";

interface IndicatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  editIndicator?: Indicator | null;
  indicatorCount: number;
  onSaved: () => void;
}

export function IndicatorModal({
  open,
  onOpenChange,
  programId,
  editIndicator,
  indicatorCount,
  onSaved,
}: IndicatorModalProps) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<"numeric" | "categorical">("numeric");
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");
  const [showOnExecutive, setShowOnExecutive] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editIndicator) {
      setName(editIndicator.name);
      setDataType(editIndicator.data_type);
      setOptions(editIndicator.options ?? []);
      setShowOnExecutive(editIndicator.show_on_executive);
      setManualEntry(editIndicator.manual_entry);
    } else {
      setName("");
      setDataType("numeric");
      setOptions([]);
      setShowOnExecutive(false);
      setManualEntry(false);
    }
    setNewOption("");
  }, [editIndicator, open]);

  function addOption() {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) {
      toast.error("Option already exists");
      return;
    }
    setOptions((prev) => [...prev, trimmed]);
    setNewOption("");
  }

  function removeOption(opt: string) {
    setOptions((prev) => prev.filter((o) => o !== opt));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Indicator name is required");
      return;
    }
    if (dataType === "categorical" && options.length < 2) {
      toast.error("Categorical indicators need at least 2 options");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const record = {
      program_id: programId,
      name: name.trim(),
      data_type: dataType,
      options: dataType === "categorical" ? options : [],
      show_on_executive: showOnExecutive,
      manual_entry: manualEntry,
      ...(editIndicator ? {} : { sort_order: indicatorCount + 1, is_core: false, is_active: true }),
    };

    let error;
    if (editIndicator) {
      ({ error } = await supabase
        .from("indicators")
        .update(record)
        .eq("id", editIndicator.id));
    } else {
      ({ error } = await supabase.from("indicators").insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editIndicator ? "Indicator updated" : "Indicator added");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editIndicator ? "Edit Indicator" : "Add Indicator"}
          </DialogTitle>
          <DialogDescription>
            {editIndicator
              ? "Update this indicator's settings."
              : "Add a custom indicator to this program."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="indicator-name">Indicator Name *</Label>
            <Input
              id="indicator-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Income Level"
              disabled={editIndicator?.is_core}
            />
          </div>

          {/* Data Type */}
          <div className="space-y-2">
            <Label htmlFor="data-type">Data Type</Label>
            <Select
              value={dataType}
              onValueChange={(v) => setDataType((v ?? "numeric") as "numeric" | "categorical")}
              disabled={editIndicator?.is_core}
            >
              <SelectTrigger id="data-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="categorical">Categorical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categorical Options */}
          {dataType === "categorical" && (
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Add option..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={addOption}
                  className="shrink-0 h-8 w-8"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {options.map((opt) => (
                    <span
                      key={opt}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                    >
                      {opt}
                      <button
                        type="button"
                        onClick={() => removeOption(opt)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-ed" className="text-sm font-normal">
                Show on Executive Dashboard
              </Label>
              <Switch
                id="show-ed"
                checked={showOnExecutive}
                onCheckedChange={setShowOnExecutive}
                size="sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="manual-entry" className="text-sm font-normal">
                Manual value entry
              </Label>
              <Switch
                id="manual-entry"
                checked={manualEntry}
                onCheckedChange={setManualEntry}
                size="sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-srsf-green-500 hover:bg-srsf-green-600"
          >
            {saving ? "Saving..." : editIndicator ? "Update" : "Add Indicator"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
