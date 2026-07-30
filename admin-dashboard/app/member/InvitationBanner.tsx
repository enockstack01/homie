"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { acceptInvitationAction, declineInvitationAction } from "./actions";

export function InvitationBanner({ organizationName }: { organizationName: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  if (resolved) {
    return message ? <p className="text-sm text-foreground/50">{message}</p> : null;
  }

  return (
    <div className="rounded-md border border-info/30 bg-info/5 p-4 text-foreground">
      <p className="font-medium text-info">You&apos;ve been invited to join {organizationName}</p>
      <p className="mb-3 text-sm text-foreground/70">
        An organization admin added you as a member. Accept to join and start receiving
        credits from their pool, or decline if this wasn&apos;t expected.
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await acceptInvitationAction();
              setMessage(result.message);
              if (result.ok) setResolved(true);
            })
          }
        >
          {pending ? "Working..." : "Accept"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await declineInvitationAction();
              setMessage(result.message);
              if (result.ok) setResolved(true);
            })
          }
        >
          Decline
        </Button>
      </div>
      {message && !resolved && <p className="mt-2 text-sm text-red-700">{message}</p>}
    </div>
  );
}
