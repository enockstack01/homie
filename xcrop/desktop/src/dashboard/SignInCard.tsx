import type { Account } from "../lib/api";

interface Props {
  account: Account | null;
  onSignIn: () => void;
}

export function SignInCard({ account, onSignIn }: Props) {
  if (account) {
    return (
      <div className="card signin-card">
        <div className="signed-in-badge">
          <span className="account-avatar">{(account.email ?? "?")[0]?.toUpperCase()}</span>
          <div>
            <div className="stat-line">
              <strong>{account.email ?? "Signed in"}</strong>
            </div>
            <div className="hint">
              {account.organization_name ?? "No organization"} · {account.credit_balance.toFixed(2)} credits
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card signin-card">
      <div className="signin-copy">
        <h2>Sign in to your Homie account</h2>
        <p>Enables AI explanations and chat. Opens a sign-in page in your browser - no key to copy or paste.</p>
      </div>
      <button onClick={onSignIn}>Sign in with Homie</button>
    </div>
  );
}
