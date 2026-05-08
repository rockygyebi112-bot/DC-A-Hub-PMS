"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

export function ListSearch({
  placeholder = "Search...",
  paramName = "q",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [value, setValue] = useState(params.get(paramName) ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (!value) next.delete(paramName);
      else next.set(paramName, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 h-8 w-64"
      />
    </div>
  );
}
