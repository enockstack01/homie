"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  invalidateAnthropicApiKeyAction,
  setAnthropicApiKeyAction,
  type ActionState,
} from "../actions";

const initialState: ActionState = { ok: false, message: "" };

/** The single key this gateway calls Anthropic with - not a per-user Homie key. Unlike a
 * Clerk-issued key, there's no "rotate" API on Anthropic's side, so "invalidate" here is
 * a local kill switch (clears the stored key) rather than a real remote revocation.
 *
 * readOnly is true for a platform_admin viewer - they can still see/copy the key
 * (viewing was never restricted), just not change or invalidate it. The backend enforces
 * this independently (set_anthropic_api_key/invalidate_anthropic_api_key both require
 * true super_admin - see app/auth.py's require_super_admin), so hiding the buttons here
 * is a convenience, not the actual access control. */
export function AnthropicKeyManager({
  currentKey,
  readOnly = false,
}: {
  currentKey: string | null;
  readOnly?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [changing, setChanging] = useState(false);
  const [setState, setFormAction, setPending] = useActionState(setAnthropicApiKeyAction, initialState);
  const [invalidateState, invalidateFormAction, invalidatePending] = useActionState(
    invalidateAnthropicApiKeyAction,
    initialState,
  );
  const invalidateFormRef = useRef<HTMLFormElement>(null);

  // Adjusting state during render (React's own documented alternative to an Effect here -
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // instead of a useEffect keyed on `setState`: closes the "changing" form the moment the
  // save action succeeds, without the extra render pass an Effect would cost.
  const [prevSetState, setPrevSetState] = useState(setState);
  if (setState !== prevSetState) {
    setPrevSetState(setState);
    if (setState.ok) setChanging(false);
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-sm font-medium">Anthropic API key</p>
      <p className="mb-3 text-xs text-foreground/50">
        The single key this gateway uses to call Anthropic on every user&apos;s behalf -
        not a per-user Homie key. No chat request on the platform can succeed without one.
      </p>

      {currentKey && !changing && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-surface-muted px-2 py-1 text-xs">
            {revealed ? currentKey : "•".repeat(24)}
          </code>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)}>
            {revealed ? "Hide" : "Show"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(currentKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          {!readOnly && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setChanging(true)}>
              Change
            </Button>
          )}
          {!readOnly && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={invalidatePending}
              onClick={() => {
                if (
                  window.confirm(
                    "Invalidate the Anthropic API key? Every chat request on the entire platform will start failing until a super_admin sets a new one. This cannot be undone.",
                  )
                ) {
                  invalidateFormRef.current?.requestSubmit();
                }
              }}
            >
              {invalidatePending ? "Invalidating..." : "Invalidate"}
            </Button>
          )}
        </div>
      )}

      {!currentKey && !changing && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-red-700">
            No key configured - every chat request will fail until one is set.
          </p>
          {!readOnly && (
            <Button type="button" variant="primary" size="sm" onClick={() => setChanging(true)}>
              Set key
            </Button>
          )}
        </div>
      )}

      {readOnly && (
        <p className="mt-2 text-xs text-foreground/40">
          Only a super_admin can change or invalidate this key.
        </p>
      )}

      {!readOnly && changing && (
        <form action={setFormAction} className="flex flex-col gap-2">
          <input
            name="api_key"
            type="text"
            placeholder="sk-ant-..."
            required
            autoFocus
            spellCheck={false}
            className="rounded border border-border bg-surface px-2 py-1 font-mono text-xs focus:border-primary focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={setPending}>
              {setPending ? "Saving..." : "Save new key"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setChanging(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <form ref={invalidateFormRef} action={invalidateFormAction} className="hidden" />

      {setState.message && (
        <p className={`mt-2 text-xs ${setState.ok ? "text-primary" : "text-red-700"}`}>{setState.message}</p>
      )}
      {invalidateState.message && (
        <p className={`mt-2 text-xs ${invalidateState.ok ? "text-primary" : "text-red-700"}`}>
          {invalidateState.message}
        </p>
      )}
    </div>
  );
}
