"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

export interface ApiKeyActionState {
  ok: boolean;
  message: string;
  apiKey?: string;
}

const initialIssueState: ApiKeyActionState = { ok: false, message: "" };
const noopIssueAction = async (): Promise<ApiKeyActionState> => initialIssueState;

/**
 * Unlike a typical "shown once at creation" secret, Clerk lets a Machine's key be
 * re-fetched any time after issuance (verified directly against the API before relying
 * on it) - so the key is always visible to the account holder and to admins, not just at
 * the moment it was issued. This shows either a "View API key" button (fetches on
 * demand) or, if none exists yet, an "Issue API key" button - both land on the same
 * masked-by-default reveal display, matching the Settings window's PasswordBox+Show
 * pattern in the ArcGIS Pro Add-in itself.
 *
 * issueAction is optional: a member viewing their own key can't self-issue one (that's
 * deliberately admin-only - see routes/super_admin.py/org_admin.py), so their page omits
 * it and this just shows a plain "ask your admin" message instead of an issue button.
 */
export function ApiKeyDisplay({
  targetId,
  hasApiKeyInitially,
  viewAction,
  issueAction,
}: {
  targetId: string;
  hasApiKeyInitially: boolean;
  viewAction: (targetId: string) => Promise<{ api_key: string | null }>;
  issueAction?: (prev: ApiKeyActionState, formData: FormData) => Promise<ApiKeyActionState>;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewPending, startViewTransition] = useTransition();
  const [viewError, setViewError] = useState<string | null>(null);
  const [issueState, issueFormAction, issuePending] = useActionState(
    issueAction ?? noopIssueAction,
    initialIssueState,
  );

  const activeKey = issueState.apiKey ?? key;

  if (activeKey) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <code className="rounded bg-surface-muted px-2 py-1 text-xs">
            {revealed ? activeKey : "•".repeat(24)}
          </code>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)}>
            {revealed ? "Hide" : "Show"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              // Copies the underlying value regardless of the mask/reveal toggle - the
              // key is already in memory once viewed, so there's no reason to force a
              // reveal click first just to copy it.
              await navigator.clipboard.writeText(activeKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        {issueAction && (
          <form action={issueFormAction}>
            <input type="hidden" name="user_id" value={targetId} />
            <Button type="submit" variant="ghost" size="sm" disabled={issuePending} className="!px-0 text-xs">
              {issuePending ? "Re-issuing..." : "Issue a new key (invalidates this one)"}
            </Button>
          </form>
        )}
      </div>
    );
  }

  if (hasApiKeyInitially) {
    return (
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={viewPending}
          onClick={() =>
            startViewTransition(async () => {
              setViewError(null);
              try {
                const result = await viewAction(targetId);
                if (result.api_key) {
                  setKey(result.api_key);
                  setRevealed(true);
                } else {
                  setViewError("No key found - it may have been issued to a different account.");
                }
              } catch (err) {
                setViewError(err instanceof Error ? err.message : "Failed to load API key.");
              }
            })
          }
        >
          {viewPending ? "Loading..." : "View API key"}
        </Button>
        {viewError && <p className="text-xs text-red-700">{viewError}</p>}
      </div>
    );
  }

  if (!issueAction) {
    return <p className="text-xs text-foreground/50">Not issued yet - ask your admin.</p>;
  }

  return (
    <form action={issueFormAction} className="flex flex-col gap-1">
      <input type="hidden" name="user_id" value={targetId} />
      <Button type="submit" variant="secondary" size="sm" disabled={issuePending}>
        {issuePending ? "Issuing..." : "Issue API key"}
      </Button>
      {!issueState.ok && issueState.message && <p className="text-xs text-red-700">{issueState.message}</p>}
    </form>
  );
}
