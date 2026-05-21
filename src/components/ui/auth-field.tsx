import { Label } from "@/components/ui/label";

interface AuthFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

/**
 * Label + input pair for auth forms. Real-case label (not uppercase),
 * consistent spacing. The input element is passed as children and must
 * carry an `id` matching `htmlFor`.
 */
export function AuthField({ label, htmlFor, children }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
