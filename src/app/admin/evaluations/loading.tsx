export default function Loading() {
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="h-7 w-52 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </header>
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </main>
  );
}
