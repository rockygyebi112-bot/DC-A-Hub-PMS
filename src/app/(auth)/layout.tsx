import { AuthBrandPanel } from "@/components/ui/auth-brand-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AuthBrandPanel />
      {/* Skip-link target — the global skip-to-content anchor in
          src/app/layout.tsx points at #main-content. */}
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center bg-background px-6 py-12 sm:px-10"
      >
        {children}
      </main>
    </div>
  );
}
