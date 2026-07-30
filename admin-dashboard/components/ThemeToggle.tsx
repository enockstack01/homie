"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const COOKIE_NAME = "theme";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year - "until they change it" is the point
const listeners = new Set<() => void>();

function readCookieTheme(): Theme | null {
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)(?:;|$)/);
  return match ? (match[1] as Theme) : null;
}

// No explicit cookie yet -> falls back to the OS-level preference, same signal
// globals.css's `@media (prefers-color-scheme: dark)` block already renders against.
function getSnapshot(): Theme {
  return readCookieTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

// The server can't know a client's cookie or OS preference without more plumbing than
// this is worth - null means "undetermined yet", handled below by reserving the
// button's footprint instead of guessing and risking a flash of the wrong icon.
function getServerSnapshot(): Theme | null {
  return null;
}

function subscribe(onStoreChange: () => void) {
  // Keeps the icon reactive if the OS-level scheme changes live while no explicit
  // cookie is set - applyTheme's own listeners.forEach covers the other case (the
  // user just clicked the toggle).
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", onStoreChange);
  listeners.add(onStoreChange);
  return () => {
    mql.removeEventListener("change", onStoreChange);
    listeners.delete(onStoreChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  listeners.forEach((listener) => listener());
}

const SIZE_CLASSES: Record<"header" | "floating", string> = {
  // Sits inline in app/layout.tsx's authenticated header, next to UserButton - sized to
  // match that header's own compact controls.
  header: "h-8 w-8 text-white/90 hover:bg-white/10",
  // Rendered on its own (app/layout.tsx, signed-out visitors only - the authenticated
  // header has no floating counterpart to collide with) - fixed so it's reachable
  // regardless of scroll position, same spirit as WhatsAppButton's own placement
  // (opposite corner, so the two never overlap).
  floating: "fixed top-4 left-4 z-50 h-10 w-10 border border-border bg-surface text-foreground shadow-md hover:bg-surface-muted sm:top-6 sm:left-6",
};

/**
 * The user's explicit light/dark choice, persisted in a cookie (not just localStorage)
 * so app/layout.tsx - a server component - can read it via next/headers' cookies() and
 * set data-theme on <html> at render time. That's what makes the choice "obeyed across
 * the entire platform": every future page load (any route, fresh tab, hard refresh)
 * already carries the right theme in its very first server-rendered byte, no flash of
 * the other one while client JS catches up. Before any explicit choice, no data-theme
 * attribute is set at all - globals.css's `@media (prefers-color-scheme: dark)` block
 * is what applies then, so a new visitor sees whatever their OS is already set to.
 */
export function ThemeToggle({ variant }: { variant: "header" | "floating" }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const sizeClasses = SIZE_CLASSES[variant];

  if (theme === null) {
    // Reserves the same footprint so nothing shifts once the real icon appears -
    // there's no way to know the effective theme (cookie vs. system preference) until
    // this runs client-side, but a blank button beats a flash of the wrong icon.
    return <span aria-hidden="true" className={`inline-block rounded-full ${sizeClasses}`} />;
  }

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`inline-flex items-center justify-center rounded-full transition-colors ${sizeClasses}`}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8 4a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM5 12a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm12.657-6.657a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0ZM7.464 16.536a1 1 0 0 1 0 1.414l-.707.707a1 1 0 0 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0Zm11.193 1.414a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 1 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414ZM8.879 7.464a1 1 0 0 1-1.415 0l-.707-.707A1 1 0 1 1 8.17 5.343l.707.707a1 1 0 0 1 0 1.414ZM12 20a1 1 0 0 1 1 1v0a1 1 0 1 1-2 0v0a1 1 0 0 1 1-1Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M20.742 13.045a8.088 8.088 0 0 1-2.077.271c-4.476 0-8.101-3.625-8.101-8.101 0-1.194.259-2.328.724-3.349a1 1 0 0 0-1.3-1.35C5.635 2.246 2.5 6.319 2.5 11.101 2.5 16.797 7.203 21.5 12.899 21.5c3.808 0 7.144-2.087 8.907-5.187a1 1 0 0 0-1.064-1.268Z" />
        </svg>
      )}
    </button>
  );
}
