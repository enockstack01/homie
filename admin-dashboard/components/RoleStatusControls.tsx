"use client";

import { useActionState, useRef } from "react";
import type { Role, UserStatus } from "@/lib/types";
import { updateUserRoleAction, updateUserStatusAction, type ActionState } from "@/app/super-admin/actions";

const initialState: ActionState = { ok: false, message: "" };

const ROLES: Role[] = ["member", "org_admin", "platform_admin", "super_admin"];
const STATUSES: UserStatus[] = ["active", "pending", "banned", "deleted"];

// "member" reads as "Organization member" here since every member belongs to an
// organization on this platform (see backend/app/auth.py's role docstring) - there's no
// standing "no organization" account type to distinguish it from anymore, but the plain
// word "member" alone still reads as more generic than what it actually means.
const ROLE_LABELS: Record<Role, string> = {
  member: "Organization member",
  org_admin: "Organization admin",
  platform_admin: "Platform admin",
  super_admin: "Super admin",
};

/** Shared across the flat Users page and each organization's detail page - a
 * super_admin has the same full role/status management power over a user regardless of
 * which list they found them in. */
export function RoleStatusControls({
  userId,
  currentRole,
  currentStatus,
}: {
  userId: string;
  currentRole: Role;
  currentStatus: UserStatus;
}) {
  const [roleState, roleAction] = useActionState(updateUserRoleAction, initialState);
  const [statusState, statusAction] = useActionState(updateUserStatusAction, initialState);
  const roleFormRef = useRef<HTMLFormElement>(null);
  const statusFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-1">
      <form ref={roleFormRef} action={roleAction} className="flex items-center gap-1">
        <input type="hidden" name="user_id" value={userId} />
        <select
          key={currentRole}
          name="role"
          defaultValue={currentRole}
          onChange={() => roleFormRef.current?.requestSubmit()}
          className="rounded border border-border px-1 py-0.5 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </form>
      {roleState.message && (
        <span className={`text-xs ${roleState.ok ? "text-primary" : "text-red-700"}`}>
          {roleState.message}
        </span>
      )}

      <form ref={statusFormRef} action={statusAction} className="flex items-center gap-1">
        <input type="hidden" name="user_id" value={userId} />
        <select
          key={currentStatus}
          name="status"
          defaultValue={currentStatus}
          onChange={(e) => {
            // "deleted" isn't a label here - selecting it permanently removes this
            // person's account and Clerk credential everywhere, right now, with no undo.
            // A plain dropdown auto-submitting that on one accidental click is a real
            // footgun, so it gets its own confirmation instead of the others' silent save.
            if (e.target.value === "deleted") {
              const confirmed = window.confirm(
                "Permanently delete this user? This removes their account and Clerk sign-in/API key everywhere and cannot be undone. Their usage/billing history is kept.",
              );
              if (!confirmed) {
                e.target.value = currentStatus;
                return;
              }
            }
            statusFormRef.current?.requestSubmit();
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
      {statusState.message && (
        <span className={`text-xs ${statusState.ok ? "text-primary" : "text-red-700"}`}>
          {statusState.message}
        </span>
      )}
    </div>
  );
}
