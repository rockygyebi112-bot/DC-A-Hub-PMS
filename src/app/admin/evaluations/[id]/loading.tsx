export default function Loading() {
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </header>
      {Array.from({ length: 4 }).map((_, i) => (
        <section key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </section>
      ))}
    </main>
  );
}
