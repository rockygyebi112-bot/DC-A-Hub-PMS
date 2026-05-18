import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import { themeScript } from "@/lib/theme/script";
import "./globals.css";

// Inter — the de-facto enterprise SaaS UI font (Linear, Stripe, Notion).
// Same family for body and headings, loaded ONCE; both CSS variables point
// at the single instance. Previously we instantiated `Inter()` twice which
// downloaded two overlapping weight sets and shipped duplicate WOFF2 files.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  // Multiple CSS variables resolving to the same font instance is supported
  // natively by next/font. `--font-sans` powers body copy, `--font-heading`
  // is referenced by the `.font-heading` utility in globals.css.
  variable: "--font-sans",
});

const dmMono = DM_Mono({
  variable: "--font-geist-mono",
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
      className={`${inter.variable} ${dmMono.variable} h-full antialiased`}
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
