export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="w-full max-w-md px-4 sm:px-8 py-8 relative z-10">{children}</div>
    </div>
  );
}
