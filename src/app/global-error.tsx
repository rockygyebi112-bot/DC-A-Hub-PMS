"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary above the root layout. Cannot rely on the design
 * system (no layout available), so render minimal inline-styled HTML and never
 * expose error internals — only the Next.js digest for log correlation.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", { digest: error?.digest, message: error?.message });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "calc(100% - 32px)",
            padding: 32,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, color: "#475569", fontSize: 14 }}>
            An unexpected error occurred. Please try again. If the problem
            persists, contact support with the reference below.
          </p>
          {error?.digest ? (
            <p
              style={{
                marginTop: 12,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #0f172a",
                background: "#0f172a",
                color: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            {/* global-error renders above the root layout, so next/link is
                unavailable here. This is the documented Next.js pattern. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                color: "#0f172a",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
