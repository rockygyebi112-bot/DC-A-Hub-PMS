import type { Metadata } from "next";
import { Inter, DM_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

// Inter — the de-facto enterprise SaaS UI font (Linear, Stripe, Notion).
// We use the same family for body and headings to unify the visual system.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const interHeading = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700", "800"],
  variable: "--font-heading",
});

const dmMono = DM_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

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
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${interHeading.variable} ${dmMono.variable} h-full antialiased`}
    >
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
