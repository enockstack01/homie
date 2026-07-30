"use server";

import { redirect } from "next/navigation";
import { callBackend } from "@/lib/backend";

export interface ActionState {
  ok: boolean;
  message: string;
}

export async function registerOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Organization name is required." };

  try {
    await callBackend("/v1/register-organization", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to register organization." };
  }

  // Outside the try/catch on purpose - redirect() throws internally (NEXT_REDIRECT) and
  // that throw must propagate, not get caught as a real error above. The new
  // organization's own org_id is shown right away on /org-admin (see MyOrganization),
  // no separate confirmation screen needed here.
  redirect("/org-admin");
}

export async function joinOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) return { ok: false, message: "Organization ID is required." };

  try {
    await callBackend("/v1/join-organization", {
      method: "POST",
      body: JSON.stringify({ org_id: orgId }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to join organization." };
  }

  // Outside the try/catch on purpose - redirect() throws internally (NEXT_REDIRECT) and
  // that throw must propagate, not get caught as a real error above. Lands on /member,
  // not /org-admin - joining never promotes the caller (see backend's join_organization).
  redirect("/member");
}
