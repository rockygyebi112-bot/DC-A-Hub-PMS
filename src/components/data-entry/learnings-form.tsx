"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LearningEntry, Program } from "@/lib/types";
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
import { FormActions } from "@/components/data-entry/form-actions";
import { FormSection } from "@/components/data-entry/form-section";
import { Lightbulb, FileText } from "lucide-react";
import { toast } from "sonner";
import { LEARNING_CATEGORIES } from "@/lib/constants";

interface LearningsFormProps {
  editEntry?: LearningEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM = {
  program_id: "",
  category: "",
  title: "",
  description: "",
  learning_date: "",
};

export function LearningsForm({
  editEntry,
  onSaved,
  onCancel,
}: LearningsFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase
        .from("programs")
        .select("*")
        .order("name");
      if (data) setPrograms(data);
    }
    loadPrograms();
  }, [supabase]);

  useEffect(() => {
    if (editEntry) {
      setForm({
        program_id: editEntry.program_id,
        category: editEntry.category,
        title: editEntry.title,
        description: editEntry.description,
        learning_date: editEntry.learning_date ?? "",
      });
    }
  }, [editEntry]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.program_id) {
      toast.error("Please select a program");
      return;
    }
    if (!form.category) {
      toast.error("Please select a category");
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

    const record = {
      user_id: user.id,
      program_id: form.program_id,
      category: form.category,
      title: form.title,
      description: form.description,
      learning_date: form.learning_date || null,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from("learnings")
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase.from("learnings").insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editEntry ? "Learning updated" : "Learning submitted");
    setForm(EMPTY_FORM);
    onSaved();
  }

  return (
    <div className="space-y-6">
      <FormSection
        title="Learning Details"
        description="Which program, when it happened, and a short title."
        icon={Lightbulb}
      >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Program */}
        <div className="space-y-2">
          <Label htmlFor="program_id">Program *</Label>
          <Select
            value={form.program_id}
            onValueChange={(v) => setField("program_id", v ?? "")}
          >
            <SelectTrigger id="program_id">
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={form.category}
            onValueChange={(v) => setField("category", v ?? "")}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {LEARNING_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Learning Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Short descriptive title"
          />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="learning_date">Date of Learning</Label>
          <Input
            id="learning_date"
            type="date"
            value={form.learning_date}
            onChange={(e) => setField("learning_date", e.target.value)}
          />
        </div>
      </div>
      </FormSection>

      <FormSection
        title="Description"
        description="Describe the learning in detail."
        icon={FileText}
      >
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Describe the learning in detail..."
            rows={5}
          />
        </div>
      </FormSection>

      <FormActions
        saving={saving}
        submitLabel={editEntry ? "Update Learning" : "Submit Learning"}
        onSubmit={handleSubmit}
        onCancel={onCancel}
      />
    </div>
  );
}
