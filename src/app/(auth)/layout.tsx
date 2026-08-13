import Image from "next/image";
import { AuthStage } from "@/components/ui/auth-stage";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <AuthStage />

      {/* The only logo on the page. The photograph used to carry a second,
          burned-in copy in its bottom-right corner; the asset is now cropped
          above it. */}
      <header className="relative z-10 px-6 pt-8 sm:px-10 lg:px-14">
        <Image
          src="/logo.png"
          alt="DC&A Hub"
          width={640}
          height={322}
          priority
          className="h-11 w-auto"
        />
      </header>

      {/* Skip-link target — the global skip-to-content anchor in
          src/app/layout.tsx points at #main-content. */}
      <main
        id="main-content"
        className="relative z-10 flex flex-1 items-center px-6 py-12 sm:px-10 lg:justify-end lg:px-14"
      >
        {children}
      </main>

      {/* white/70, not /55: this is 12px text over a photograph, so contrast
          has to hold against the brightest patch the image can put behind it.
          /55 measured 4.40:1 in that worst case — just under AA. */}
      <footer className="relative z-10 px-6 pb-8 text-xs text-white/70 sm:px-10 lg:px-14">
        <p>
          {`© ${new Date().getFullYear()} DC&A Hub · Monitoring, evaluation and research`}
        </p>
      </footer>
    </div>
  );
}
