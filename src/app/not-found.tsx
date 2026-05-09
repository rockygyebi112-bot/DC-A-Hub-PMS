import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border bg-card p-8 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <FileQuestion className="size-5" aria-hidden />
          </div>
          <div className="flex-1">
            <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
              Page not found
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button render={<Link href="/" />}>Go home</Button>
        </div>
      </div>
    </div>
  );
}
