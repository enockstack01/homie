import type { Account } from "./lib/api";

export type View = "dashboard" | "map";

interface Props {
  view: View;
  onViewChange: (view: View) => void;
  account: Account | null;
  onSignIn: () => void;
}

export function TopNav({ view, onViewChange, account, onSignIn }: Props) {
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
          <div className="account-pill" title={account.email ?? undefined}>
            <span className="account-avatar">{(account.email ?? "?")[0]?.toUpperCase()}</span>
            {account.email ?? "Signed in"}
          </div>
        ) : (
          <button className="secondary" onClick={onSignIn}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
