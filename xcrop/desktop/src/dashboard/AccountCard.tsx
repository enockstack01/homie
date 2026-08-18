import type { Account } from "../lib/api";

interface Props {
  account: Account;
  onSignOut: () => void;
}

// Only rendered once an account is loaded (see DashboardView, which shows SettingsPanel's
// API key form instead while signed out) - unlike the old browser sign-in flow this
// replaced, there's no separate "connect" step to render here.
export function AccountCard({ account, onSignOut }: Props) {
  return (
    <div className="card account-card">
      <div className="signed-in-badge">
        <span className="account-avatar">{(account.email ?? "?")[0]?.toUpperCase()}</span>
        <div>
          <div className="stat-line">
            <strong>{account.email ?? "Connected"}</strong>
          </div>
          <div className="hint">
            {account.organization_name ?? "No organization"} · {account.credit_balance.toFixed(2)} credits
          </div>
        </div>
      </div>
      <button className="ghost" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
