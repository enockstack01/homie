"use client";

import { useActionState, useRef } from "react";
import type { UserStatus } from "@/lib/types";
import { updateMemberStatusAction, type ActionState } from "./actions";

const initialState: ActionState = { ok: false, message: "" };

const STATUSES: UserStatus[] = ["active", "pending", "banned"];

/** An org_admin's status power over their own members - deliberately narrower than
 * super_admin's RoleStatusControls: no "deleted" here (that's a real, irreversible,
 * platform-wide account deletion reserved for the platform admin), and this only ever
 * targets confirmed members of this org_admin's own organization (enforced server-side
 * too, not just by what's rendered here). Banning blocks the account without detaching
 * them from the org the way the "Remove" button does - their balance and membership stay
 * intact, just unusable until reinstated back to active. */
export function MemberStatusControl({
  memberId,
  currentStatus,
}: {
  memberId: string;
  currentStatus: UserStatus;
}) {
  const [state, formAction] = useActionState(updateMemberStatusAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-1">
      <form ref={formRef} action={formAction} className="flex items-center gap-1">
        <input type="hidden" name="user_id" value={memberId} />
        <select
          key={currentStatus}
          name="status"
          defaultValue={currentStatus}
          onChange={(e) => {
            if (e.target.value === "banned") {
              const confirmed = window.confirm(
                "Ban this member? They'll be blocked from chatting until you set them back to active - their balance and org membership stay intact.",
              );
              if (!confirmed) {
                e.target.value = currentStatus;
                return;
              }
            }
            formRef.current?.requestSubmit();
          }}
          className="rounded border border-border px-1 py-0.5 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </form>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</span>
      )}
    </div>
  );
}
