"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#b91c1c" }}>
          Application error
        </h1>
        <p style={{ marginTop: 4, color: "#475569", fontSize: 14 }}>
          The error details below are exposed temporarily for debugging.
        </p>
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f1f5f9",
            color: "#0f172a",
            borderRadius: 8,
            fontSize: 12,
            overflow: "auto",
          }}
        >
{`Message: ${error?.message ?? "(no message)"}
Name:    ${error?.name ?? "(no name)"}
Digest:  ${error?.digest ?? "(no digest)"}
Stack:   ${error?.stack ?? "(no stack)"}`}
        </pre>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
