"use client";

import { useActionState } from "react";
import type { ModelPricing } from "@/lib/types";
import { updateModelPricingAction, type ActionState } from "../actions";

const initialState: ActionState = { ok: false, message: "" };

export function ModelPricingRow({
  model,
  minimumMarkupMultiplier,
  readOnly = false,
}: {
  model: ModelPricing;
  minimumMarkupMultiplier: number;
  /** True for a platform_admin viewer - changing the rate card is the one thing they
   * can't do (enforced server-side by require_super_admin on PATCH /model-pricing/{id});
   * this just shows the same numbers as plain text instead of an editable form. */
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateModelPricingAction, initialState);

  if (readOnly) {
    return (
      <tr className="border-b border-border/60 align-top last:border-0">
        <td className="px-4 py-3">
          <div className="font-medium">{model.display_name}</div>
          <div className="text-xs text-foreground/40">{model.model_id}</div>
        </td>
        <td className="px-4 py-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-foreground/70">
            <dt className="text-foreground/50">Input $/M</dt>
            <dd className="tabular-nums">{model.anthropic_input_per_m}</dd>
            <dt className="text-foreground/50">Output $/M</dt>
            <dd className="tabular-nums">{model.anthropic_output_per_m}</dd>
            <dt className="text-foreground/50">Markup ×</dt>
            <dd className="tabular-nums">{model.markup_multiplier.toFixed(4)}</dd>
            <dt className="text-foreground/50">Active</dt>
            <dd>{model.is_active ? "Yes" : "No"}</dd>
          </dl>
          <p className="mt-2 text-[11px] text-foreground/40">
            Only a super_admin can change platform resource pricing.
          </p>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60 align-top last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium">{model.display_name}</div>
        <div className="text-xs text-foreground/40">{model.model_id}</div>
      </td>
      <td className="px-4 py-3">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="pricing_id" value={model.id} />
          <label className="flex items-center gap-2 text-xs text-foreground/50">
            Input $/M
            <input
              name="anthropic_input_per_m"
              type="number"
              step="0.01"
              defaultValue={model.anthropic_input_per_m}
              className="w-20 rounded border border-border px-1 py-0.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground/50">
            Output $/M
            <input
              name="anthropic_output_per_m"
              type="number"
              step="0.01"
              defaultValue={model.anthropic_output_per_m}
              className="w-20 rounded border border-border px-1 py-0.5 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground/50">
            Markup ×
            <input
              name="markup_multiplier"
              type="number"
              step="0.0001"
              min={minimumMarkupMultiplier}
              defaultValue={model.markup_multiplier}
              className="w-20 rounded border border-border px-1 py-0.5 text-sm"
            />
          </label>
          <p className="text-[11px] text-foreground/40">
            Min {minimumMarkupMultiplier.toFixed(4)}× - this is a multiplier on cost, not a
            margin percentage. It yields a 40% margin (profit / billed price), not a 40%
            markup - lower is rejected.
          </p>
          <label className="flex items-center gap-2 text-xs text-foreground/50">
            {/* FormData.get() returns the first same-named field present, and an
                unchecked checkbox submits nothing at all - so the checkbox must come
                before the hidden fallback for both checked and unchecked to read back
                the right value. */}
            <input
              type="checkbox"
              name="is_active"
              value="true"
              defaultChecked={model.is_active}
              className="rounded border-border"
            />
            <input type="hidden" name="is_active" value="false" />
            Active
          </label>
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          {state.message && (
            <p className={`text-xs ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</p>
          )}
        </form>
      </td>
    </tr>
  );
}
