"use client";

import { useState } from "react";
import { JoinOrganizationForm } from "./JoinOrganizationForm";
import { RegisterOrganizationForm } from "./RegisterOrganizationForm";

type Choice = "create" | "join" | null;

const TAB_BASE =
  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors";
const TAB_ACTIVE = "bg-primary text-white";
const TAB_INACTIVE = "bg-surface-muted text-foreground/60 hover:text-foreground";

/**
 * Every brand-new signup lands here with exactly two ways forward - there's no standing
 * "no organization" account type on this platform (see backend/app/auth.py's role
 * docstring). Deliberately not two separate routes (the old /sign-up/individual vs
 * /sign-up/organization split that used to live here caused real bugs with Clerk's own
 * multi-step navigation) - both choices are plain forms on this one page, so there's
 * nothing for any redirect logic to lose track of.
 */
export function WelcomeChooser() {
  const [choice, setChoice] = useState<Choice>(null);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setChoice("create")}
          className={`${TAB_BASE} ${choice === "create" ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          Create an organization
        </button>
        <button
          type="button"
          onClick={() => setChoice("join")}
          className={`${TAB_BASE} ${choice === "join" ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          Join an organization
        </button>
      </div>

      {choice === null && (
        <p className="text-center text-xs text-foreground/50">
          Pick one to continue.
        </p>
      )}
      {choice === "create" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground/50">
            You&apos;ll be its first admin - allocate credits out to your team from
            here, and set your own profit margin if you want to.
          </p>
          <RegisterOrganizationForm />
        </div>
      )}
      {choice === "join" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground/50">
            Ask whoever runs your organization&apos;s Homie account for its
            organization ID - you&apos;ll show up on their dashboard right away, and
            they&apos;ll approve you from there.
          </p>
          <JoinOrganizationForm />
        </div>
      )}
    </div>
  );
}
