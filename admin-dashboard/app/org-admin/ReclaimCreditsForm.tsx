"use client";

import { useActionState, useRef, useState } from "react";
import { reclaimCreditsAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

export function ReclaimCreditsForm({ memberId, memberBalance }: { memberId: string; memberBalance: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reclaimCreditsAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const creditsRef = useRef<HTMLInputElement>(null);

  if (memberBalance <= 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        Reclaim
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <input type="hidden" name="user_id" value={memberId} />
      <label className="text-sm">
        Credits back to org pool (max {memberBalance.toLocaleString()})
        <input
          ref={creditsRef}
          name="credits"
          type="number"
          step="1"
          min="1"
          max={memberBalance}
          defaultValue={memberBalance}
          required
          autoFocus
          className="mt-1 block w-full rounded border border-border px-2 py-1"
        />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const credits = Number(creditsRef.current?.value ?? "0");
            if (
              window.confirm(
                `Reclaim ${credits.toLocaleString()} credits from this member back into the organization's pool?`,
              )
            ) {
              formRef.current?.requestSubmit();
            }
          }}
          className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          {pending ? "Reclaiming..." : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1 text-sm text-foreground/60 hover:bg-surface-muted"
        >
          Cancel
        </button>
      </div>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
