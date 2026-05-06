"use client";

export type ProgramFilter =
  | "virtual-university"
  | "hangout"
  | "enterprise-spotlight"
  | "absa-onboarding"
  | "nkabom-collaborative";

const PROGRAM_OPTIONS: { value: ProgramFilter; label: string }[] = [
  { value: "virtual-university", label: "Virtual University" },
  { value: "hangout", label: "Hangout" },
];

const PROJECT_OPTIONS: { value: ProgramFilter; label: string }[] = [
  { value: "enterprise-spotlight", label: "Enterprise Spotlight" },
  { value: "absa-onboarding", label: "ABSA Onboarding" },
  { value: "nkabom-collaborative", label: "Nkabom Collaborative" },
];

export const ALL_OPTIONS = [...PROGRAM_OPTIONS, ...PROJECT_OPTIONS];

interface ProgramFilterBarProps {
  active: ProgramFilter;
  onChange: (filter: ProgramFilter) => void;
}

export function ProgramFilterBar({ active, onChange }: ProgramFilterBarProps) {
  return (
    <>
      {/* Mobile: native grouped select */}
      <div className="sm:hidden w-full">
        <select
          value={active}
          onChange={(e) => onChange(e.target.value as ProgramFilter)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <optgroup label="Programs">
            {PROGRAM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Projects">
            {PROJECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Desktop: grouped tab strip */}
      <div className="hidden sm:flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-muted rounded-lg">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
            Programs
          </span>
          {PROGRAM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                active === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-muted rounded-lg">
          <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
            Projects
          </span>
          {PROJECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                active === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

