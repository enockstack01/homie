"use client";

import { useActionState, useState } from "react";
import { renameOrganizationAction, type ActionState } from "../../actions";

const initialState: ActionState = { ok: false, message: "" };

export function RenameOrganizationForm({ orgId, currentName }: { orgId: string; currentName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(renameOrganizationAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-foreground/50 underline underline-offset-2 hover:text-foreground"
      >
        Rename
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="org_id" value={orgId} />
      <input
        name="name"
        type="text"
        defaultValue={currentName}
        autoFocus
        required
        className="rounded border border-border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
      >
        {pending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-foreground/50 hover:text-foreground"
      >
        Cancel
      </button>
      {state.message && !state.ok && <span className="text-xs text-red-700">{state.message}</span>}
    </form>
  );
}
