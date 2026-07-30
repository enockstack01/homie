"use client";

import { useActionState, useState } from "react";
import { createOrganizationAction, type ActionState } from "../actions";

const initialState: ActionState = { ok: false, message: "" };

export function CreateOrganizationForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
      >
        New organization
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex max-w-md flex-col gap-3 rounded-md border border-border bg-surface p-4"
    >
      <label className="text-sm">
        Organization name
        <input
          name="name"
          type="text"
          required
          autoFocus
          className="mt-1 block w-full rounded border border-border px-2 py-1"
        />
      </label>

      <p className="text-xs text-foreground/50">
        If this email already has a Homie account, that account becomes this
        org&apos;s admin - username/password are ignored. Otherwise, a new Clerk
        sign-in is created with them, ready to use immediately.
      </p>

      <label className="text-sm">
        Admin email
        <input
          name="admin_email"
          type="email"
          required
          className="mt-1 block w-full rounded border border-border px-2 py-1"
        />
      </label>
      <label className="text-sm">
        Admin username (only used if creating a new account)
        <input
          name="admin_username"
          type="text"
          className="mt-1 block w-full rounded border border-border px-2 py-1"
        />
      </label>
      <label className="text-sm">
        Admin password (only used if creating a new account)
        <input
          name="admin_password"
          type="password"
          minLength={8}
          className="mt-1 block w-full rounded border border-border px-2 py-1"
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create organization"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-foreground/60 hover:bg-surface-muted"
        >
          Cancel
        </button>
      </div>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-primary" : "text-red-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
