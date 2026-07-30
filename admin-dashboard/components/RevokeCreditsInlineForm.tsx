"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface ActionState {
  ok: boolean;
  message: string;
}

const initialState: ActionState = { ok: false, message: "" };

/** Removes a specified amount of credits from a user's or organization's balance - the
 * inverse of GrantCreditsInlineForm. Shared between the flat Users page, the flat
 * Organizations page, and an organization's detail page. */
export function RevokeCreditsInlineForm({
  action,
  targetId,
  hiddenFieldName,
  currentBalance,
  label = "Revoke credits",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  targetId: string;
  hiddenFieldName: "user_id" | "org_id";
  currentBalance: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  if (currentBalance <= 0) return null;

  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
    >
      <input type="hidden" name={hiddenFieldName} value={targetId} />
      <label className="text-sm">
        Credits to revoke (max {currentBalance.toLocaleString()})
        <input
          ref={amountRef}
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max={currentBalance}
          defaultValue={currentBalance}
          required
          autoFocus
          className="mt-1 block w-full rounded border border-border bg-surface px-2 py-1 focus:border-primary focus:outline-none"
        />
      </label>
      <label className="text-sm">
        Note (optional)
        <input
          name="note"
          type="text"
          className="mt-1 block w-full rounded border border-border bg-surface px-2 py-1 focus:border-primary focus:outline-none"
          placeholder="e.g. chargeback, policy violation"
        />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => {
            const amount = Number(amountRef.current?.value ?? "0");
            if (
              window.confirm(
                `Revoke ${amount.toLocaleString()} credits (of ${currentBalance.toLocaleString()} available)? This cannot be undone.`,
              )
            ) {
              formRef.current?.requestSubmit();
            }
          }}
        >
          {pending ? "Revoking..." : "Confirm revoke"}
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
