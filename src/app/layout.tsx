import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, Syne } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import { themeScript } from "@/lib/theme/script";
import "./globals.css";

// DM Sans carries both body copy and headings, loaded once. `--font-heading`
// in globals.css aliases `--font-sans` so the UI reads as a single typeface.
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

// CRITICAL: without this, mobile browsers default to rendering at a 980px
// "desktop viewport" and scale the page down to fit. That makes every
// Tailwind responsive variant (sm:, md:, lg:) silently activate on phones,
// breaking every mobile-specific layout. This tells the browser to use the
// device's actual width (e.g. 390px on iPhone 14) so breakpoints work.
// Do NOT set `maximumScale` or `userScalable: false`. Capping zoom violates
// WCAG 1.4.4 (Resize Text) and is an accessibility anti-pattern — users who
// need to zoom must be able to do so without limit.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "DC&A Hub PMS",
  description: "DC&A Hub Project Management System",
  // Point the browser tab icon at our DC&A Hub assets. Without this explicit
  // configuration Next.js falls back to its default favicon.
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png" }],
    shortcut: ["/logo.png"],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${syne.variable} ${dmMono.variable} h-full antialiased`}
    >
      <head>
        {/* Pre-paint theme application. A raw <script> in <head> runs before
            React hydrates and before first paint, avoiding the dark/light
            flash. next/script with beforeInteractive can't be used here
            because React 19 warns when a <script> is rendered inside the
            React tree (in <body>). */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Providers>
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
