"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Slim top progress bar that animates whenever the route changes.
 *
 * Next.js App Router doesn't expose `routeChangeStart` events, so we
 * approximate by watching `usePathname` + `useSearchParams`: each time
 * either changes we run a fast progress animation (0 → 90% in ~250ms)
 * and then settle to 100% on the next paint. Lightweight, no deps.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const isFirst = useRef(true);

  useEffect(() => {
    // Skip the very first render — we don't want a flash on initial load.
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    // Reset prior animation
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    // We're deliberately syncing UI state to external (router) changes
    // here — that's the supported use of useEffect for this kind of
    // top-of-page progress indicator.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    setProgress(15);
    timers.current.push(window.setTimeout(() => setProgress(45), 60));
    timers.current.push(window.setTimeout(() => setProgress(75), 160));
    timers.current.push(window.setTimeout(() => setProgress(92), 260));
    timers.current.push(
      window.setTimeout(() => {
        setProgress(100);
        timers.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 220),
        );
      }, 380),
    );

    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_rgba(37,99,235,0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}
