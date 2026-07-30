"use client";

import { useActionState } from "react";
import { updateProfitMarginAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

export function ProfitMarginForm({ currentMarginPercent }: { currentMarginPercent: number }) {
  const [state, formAction, pending] = useActionState(updateProfitMarginAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        Margin (%)
        <input
          name="margin_percent"
          type="number"
          min={0}
          max={100}
          step="0.1"
          defaultValue={currentMarginPercent}
          required
          className="mt-1 block w-28 rounded border border-border px-2 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
