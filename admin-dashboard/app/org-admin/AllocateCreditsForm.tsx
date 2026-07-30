"use client";

import { useActionState, useState } from "react";
import { allocateCreditsAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

export function AllocateCreditsForm({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(allocateCreditsAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-3 py-1 text-sm font-medium hover:bg-surface-muted"
      >
        Allocate
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <input type="hidden" name="user_id" value={memberId} />
      <label className="text-sm">
        Credits from org pool
        <input
          name="credits"
          type="number"
          step="1"
          min="1"
          required
          autoFocus
          className="mt-1 block w-full rounded border border-border px-2 py-1"
        />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Allocating..." : "Confirm"}
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
