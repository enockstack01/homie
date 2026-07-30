"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface ActionState {
  ok: boolean;
  message: string;
}

const initialState: ActionState = { ok: false, message: "" };

/** Generic "grant USD -> credits" inline form, shared by super-admin (funding an org, or
 * a user's own balance directly as a support override) and reused wherever a grant needs
 * a USD amount + note. */
export function GrantCreditsInlineForm({
  action,
  targetId,
  label,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  targetId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
    >
      <input type="hidden" name="org_id" value={targetId} />
      <input type="hidden" name="user_id" value={targetId} />
      <label className="text-sm">
        Amount received (USD)
        <input
          name="amount_usd_received"
          type="number"
          step="0.01"
          min="0.01"
          required
          className="mt-1 block w-full rounded border border-border bg-surface px-2 py-1 focus:border-primary focus:outline-none"
        />
      </label>
      <label className="text-sm">
        Payment note
        <input
          name="payment_note"
          type="text"
          className="mt-1 block w-full rounded border border-border bg-surface px-2 py-1 focus:border-primary focus:outline-none"
          placeholder="e.g. invoice #4021"
        />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Granting..." : "Confirm grant"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
