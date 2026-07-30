"use server";

import { revalidatePath } from "next/cache";
import { callBackend } from "@/lib/backend";

export interface ActionState {
  ok: boolean;
  message: string;
}

export interface ApiKeyActionState extends ActionState {
  apiKey?: string;
}

export async function addMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Email is required." };

  try {
    const result = await callBackend<{
      already_a_member?: boolean;
      invited_existing_account?: boolean;
      pending_invite?: boolean;
    }>("/v1/org-admin/members", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/users");

    let message: string;
    if (result.already_a_member) {
      message = `${email} is already a member of this organization.`;
    } else if (result.invited_existing_account) {
      message = `Invited ${email} (they already have a Homie account) - they'll see this invite next time they sign in and can accept or decline it.`;
    } else if (result.pending_invite) {
      message = `Invited ${email} - once they sign up, they'll see this invite and can accept or decline it.`;
    } else {
      message = `Invited ${email} - they'll see this invite next time they sign in.`;
    }
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to add member." };
  }
}

export async function allocateCreditsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const credits = Number(formData.get("credits") ?? "");

  if (!Number.isFinite(credits) || credits <= 0) {
    return { ok: false, message: "Enter a valid, positive number of credits." };
  }

  try {
    const result = await callBackend<{ organization_balance: number; member_balance: number }>(
      `/v1/org-admin/members/${userId}/allocate-credits`,
      { method: "POST", body: JSON.stringify({ credits }) },
    );
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/organizations");
    revalidatePath("/member");
    return {
      ok: true,
      message: `Allocated. Member balance: ${result.member_balance.toLocaleString()}, org pool: ${result.organization_balance.toLocaleString()}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Allocation failed." };
  }
}

export async function reclaimCreditsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const credits = Number(formData.get("credits") ?? "");

  if (!Number.isFinite(credits) || credits <= 0) {
    return { ok: false, message: "Enter a valid, positive number of credits." };
  }

  try {
    const result = await callBackend<{ organization_balance: number; member_balance: number }>(
      `/v1/org-admin/members/${userId}/reclaim-credits`,
      { method: "POST", body: JSON.stringify({ credits }) },
    );
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/organizations");
    revalidatePath("/member");
    return {
      ok: true,
      message: `Reclaimed. Member balance: ${result.member_balance.toLocaleString()}, org pool: ${result.organization_balance.toLocaleString()}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Reclaim failed." };
  }
}

export async function updateMemberStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");

  try {
    await callBackend(`/v1/org-admin/members/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/organizations");
    return { ok: true, message: `Status set to ${status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to change status." };
  }
}

export async function issueMemberApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const userId = String(formData.get("user_id") ?? "");
  try {
    const result = await callBackend<{ api_key: string }>(
      `/v1/org-admin/members/${userId}/issue-api-key`,
      { method: "POST" },
    );
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/users");
    revalidatePath("/member");
    return { ok: true, message: "Issued.", apiKey: result.api_key };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to issue API key." };
  }
}

export async function viewMemberApiKeyAction(userId: string): Promise<{ api_key: string | null }> {
  return callBackend<{ api_key: string | null }>(`/v1/org-admin/members/${userId}/api-key`);
}

export async function updateProfitMarginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const marginPercent = Number(formData.get("margin_percent") ?? "");
  if (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 100) {
    return { ok: false, message: "Enter a margin between 0 and 100." };
  }

  try {
    await callBackend("/v1/org-admin/organization/profit-margin", {
      method: "PATCH",
      body: JSON.stringify({ margin_percent: marginPercent }),
    });
    revalidatePath("/org-admin");
    return { ok: true, message: `Margin set to ${marginPercent}%.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to set margin." };
  }
}

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  try {
    await callBackend(`/v1/org-admin/members/${userId}`, { method: "DELETE" });
    revalidatePath("/org-admin");
    return { ok: true, message: "Removed from organization." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to remove member." };
  }
}
