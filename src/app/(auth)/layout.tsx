export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-bg min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Subtle grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Skip-link target — the global a11y skip-to-content anchor lives in
          src/app/layout.tsx and points at #main-content. Without this id,
          screen-reader users on login / forgot-password / reset-password
          would activate the link and find no destination. */}
      <main
        id="main-content"
        className="w-full max-w-md px-4 sm:px-8 py-8 relative z-10"
      >
        {children}
      </main>
    </div>
  );
}
