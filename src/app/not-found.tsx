import Link from "next/link";
import { ArrowLeft, Compass, FileQuestion, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div
        aria-hidden
        className="mb-6 grid size-20 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-card"
      >
        <FileQuestion className="size-9" strokeWidth={1.5} />
      </div>

      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Error 404
      </p>
      <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        We can&apos;t find that page
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, has moved, or
        you may not have access. Try one of the options below.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button render={<Link href="/" />}>
          <LayoutDashboard className="size-4" aria-hidden />
          Go home
        </Button>
        <Button variant="outline" render={<Link href="/portal" />}>
          <Compass className="size-4" aria-hidden />
          Browse portal
        </Button>
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
      </div>
    </div>
  );
}
