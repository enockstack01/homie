import { useEffect, useRef, useState } from "react";
import type { Account } from "./lib/api";

export type View = "dashboard" | "map";

interface Props {
  view: View;
  onViewChange: (view: View) => void;
  account: Account | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function TopNav({ view, onViewChange, account, onSignIn, onSignOut }: Props) {
  return (
    <header className="top-nav">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        xcrop
      </div>

      <nav className="top-nav-tabs">
        <button
          className={view === "dashboard" ? "top-nav-tab active" : "top-nav-tab"}
          onClick={() => onViewChange("dashboard")}
        >
          Dashboard
        </button>
        <button className={view === "map" ? "top-nav-tab active" : "top-nav-tab"} onClick={() => onViewChange("map")}>
          Map
        </button>
      </nav>

      <div className="top-nav-spacer" />

      <div className="top-nav-account">
        {account ? (
          <AccountMenu account={account} onSignOut={onSignOut} />
        ) : (
          <button className="secondary" onClick={onSignIn}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}

function AccountMenu({ account, onSignOut }: { account: Account; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Closes on an outside click or Escape - the same "click-away" contract as the
  // Run detail modal (see app.css's .run-detail-backdrop), just without a full-screen
  // backdrop since this is a small anchored popover, not a modal.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const initial = (account.email ?? "?")[0]?.toUpperCase();

  return (
    <div className="account-menu-wrap" ref={wrapRef}>
      <button
        className="account-pill"
        title={account.email ?? undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="account-avatar">{initial}</span>
        {account.email ?? "Signed in"}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-header">
            <span className="account-avatar">{initial}</span>
            <div>
              <div className="account-menu-email">{account.email ?? "Signed in"}</div>
              <div className="account-menu-sub">
                {account.organization_name ?? "No organization"} · {account.credit_balance.toFixed(2)} credits
              </div>
            </div>
          </div>
          <div className="account-menu-divider" />
          <button
            className="ghost account-menu-signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
