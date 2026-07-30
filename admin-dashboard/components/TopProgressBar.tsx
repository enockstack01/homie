"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * App Router gives no built-in "navigation started" event (unlike the old Pages Router's
 * router events) - the only reliable signal that a navigation actually FINISHED is
 * pathname/searchParams changing. So navigation START is inferred here instead, from the
 * same same-origin same-tab left-click a real navigation would come from (a browser
 * back/forward press fires `popstate` instead, so that's covered separately) - this is
 * the same technique NProgress-style top-loaders for the App Router use, since there's no
 * lower-level hook available to build it on.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigationKey = `${pathname}?${searchParams.toString()}`;
  const prevKeyRef = useRef(navigationKey);

  useEffect(() => {
    if (prevKeyRef.current === navigationKey) return;
    prevKeyRef.current = navigationKey;

    if (rampRef.current) {
      clearInterval(rampRef.current);
      rampRef.current = null;
    }
    setProgress(100);
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  }, [navigationKey]);

  useEffect(() => {
    const start = () => {
      if (rampRef.current) return; // already ramping - don't restart a fresh 0%
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setVisible(true);
      setProgress(15);
      // Slows down as it approaches 90% and never reaches 100% on its own - only the
      // pathname/searchParams effect above (a real, confirmed navigation) does that, so
      // the bar never lies about being "done" while the new page is still loading.
      rampRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + (90 - p) * 0.15 : p));
      }, 200);
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.hasAttribute("download") || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;

      start();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", start);
    };
  }, []);

  useEffect(
    () => () => {
      if (rampRef.current) clearInterval(rampRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    },
    [],
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-[3px]" aria-hidden="true">
      <div
        className="h-full bg-accent shadow-[0_0_8px_var(--color-accent)]"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          transition: "width 200ms ease-out, opacity 200ms ease-out",
        }}
      />
    </div>
  );
}
