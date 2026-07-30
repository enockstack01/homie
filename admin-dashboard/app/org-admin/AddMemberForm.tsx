"use client";

import { useActionState, useState } from "react";
import { addMemberAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

export function AddMemberForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addMemberAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
      >
        Add member
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-end gap-2 rounded-md border border-border bg-surface p-3">
      <label className="text-sm">
        Member email
        <input
          name="email"
          type="email"
          required
          autoFocus
          placeholder="member@example.com"
          className="mt-1 block w-64 rounded border border-border px-2 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-md px-3 py-1.5 text-sm text-foreground/60 hover:bg-surface-muted"
      >
        Cancel
      </button>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
