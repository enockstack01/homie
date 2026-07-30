"use client";

import { useActionState, useRef } from "react";
import type { AvailableModel } from "@/lib/types";
import { setMyModelAction, type ActionState } from "@/app/member/actions";

const initialState: ActionState = { ok: false, message: "" };

/** Which active model the account's own API key uses for every future chat request - see
 * backend/app/routes/chat.py's handle_chat_request, which derives the model from this
 * account-level choice, never from anything the client sends. Shared across the member,
 * org-admin, and super-admin "My Account" pages since every role picks their own model
 * the same self-service way. */
export function ModelSelector({
  currentModelId,
  availableModels,
}: {
  currentModelId: string | null;
  availableModels: AvailableModel[];
}) {
  const [state, formAction] = useActionState(setMyModelAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  if (availableModels.length === 0) {
    return (
      <p className="text-xs text-foreground/50">
        No models are available on this platform yet - ask a super_admin to activate one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <form ref={formRef} action={formAction} className="flex items-center gap-2">
        <select
          key={currentModelId ?? "none"}
          name="model_id"
          defaultValue={currentModelId ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none"
        >
          {!currentModelId && (
            <option value="" disabled>
              Choose a model...
            </option>
          )}
          {availableModels.map((m) => (
            <option key={m.model_id} value={m.model_id}>
              {m.display_name} - {m.billed_input_credits_per_m.toLocaleString()}/{" "}
              {m.billed_output_credits_per_m.toLocaleString()} credits per 1M in/out tokens
            </option>
          ))}
        </select>
      </form>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</span>
      )}
      {!currentModelId && !state.message && (
        <span className="text-xs text-red-700">
          Choose a model before chatting - requests fail without one.
        </span>
      )}
    </div>
  );
}
