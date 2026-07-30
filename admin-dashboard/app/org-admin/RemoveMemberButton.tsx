"use client";

import { useActionState } from "react";
import { removeMemberAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

export function RemoveMemberButton({ memberId, label = "Remove" }: { memberId: string; label?: string }) {
  const [state, formAction, pending] = useActionState(removeMemberAction, initialState);

  if (state.ok) {
    return <span className="text-xs text-foreground/40">Removed.</span>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "..." : label}
      </button>
      {state.message && <p className="text-xs text-red-700">{state.message}</p>}
    </form>
  );
}
