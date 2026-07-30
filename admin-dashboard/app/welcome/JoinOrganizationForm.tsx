"use client";

import { useActionState } from "react";
import { joinOrganizationAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

export function JoinOrganizationForm() {
  const [state, formAction, pending] = useActionState(joinOrganizationAction, initialState);

  return (
    <form action={formAction} className="mt-auto flex flex-col gap-2">
      <input
        name="org_id"
        type="text"
        placeholder="Organization ID (e.g. acme_surveys_ab12cd)"
        required
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Requesting..." : "Request to join"}
      </button>
      {!state.ok && state.message && <p className="text-xs text-red-700">{state.message}</p>}
    </form>
  );
}
