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

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim();
  const adminUsername = String(formData.get("admin_username") ?? "").trim();
  const adminPassword = String(formData.get("admin_password") ?? "");

  if (!name) return { ok: false, message: "Organization name is required." };
  if (!adminEmail) return { ok: false, message: "Admin email is required." };
  // admin_password is intentionally not required here - the backend only needs it when
  // admin_email has no existing Homie account; if one already exists, that account just
  // gets made this org's admin instead (see linked_existing_account in the response).

  try {
    const result = await callBackend<{ linked_existing_account: boolean }>(
      "/v1/super-admin/organizations",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          admin_email: adminEmail,
          admin_username: adminUsername || null,
          admin_password: adminPassword || null,
        }),
      },
    );
    revalidatePath("/super-admin/organizations");
    return {
      ok: true,
      message: result.linked_existing_account
        ? `Created "${name}" - the existing account ${adminEmail} is now its admin.`
        : `Created "${name}" - admin can now sign in as ${adminEmail}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to create organization." };
  }
}

export async function renameOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };

  try {
    await callBackend(`/v1/super-admin/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    revalidatePath(`/super-admin/organizations/${orgId}`);
    revalidatePath("/super-admin/organizations");
    return { ok: true, message: "Renamed." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Rename failed." };
  }
}

export async function fundOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const amount = Number(formData.get("amount_usd_received") ?? "");
  const note = String(formData.get("payment_note") ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid, positive USD amount." };
  }

  try {
    const result = await callBackend<{ new_balance: number }>(
      `/v1/super-admin/organizations/${orgId}/grant-credits`,
      { method: "POST", body: JSON.stringify({ amount_usd_received: amount, payment_note: note }) },
    );
    revalidatePath("/super-admin/organizations");
    revalidatePath(`/super-admin/organizations/${orgId}`);
    revalidatePath("/super-admin/credit-transactions");
    revalidatePath("/org-admin");
    return { ok: true, message: `New pool balance: ${result.new_balance.toLocaleString()} credits.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Grant failed." };
  }
}

export async function revokeOrganizationCreditsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid, positive number of credits." };
  }

  try {
    const result = await callBackend<{ new_balance: number }>(
      `/v1/super-admin/organizations/${orgId}/revoke-credits`,
      { method: "POST", body: JSON.stringify({ amount, note }) },
    );
    revalidatePath("/super-admin/organizations");
    revalidatePath(`/super-admin/organizations/${orgId}`);
    revalidatePath("/super-admin/credit-transactions");
    revalidatePath("/org-admin");
    return { ok: true, message: `Revoked. New pool balance: ${result.new_balance.toLocaleString()} credits.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Revoke failed." };
  }
}

export async function grantUserCreditsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const amount = Number(formData.get("amount_usd_received") ?? "");
  const note = String(formData.get("payment_note") ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid, positive USD amount." };
  }

  try {
    const result = await callBackend<{ new_balance: number }>(
      `/v1/super-admin/users/${userId}/grant-credits`,
      { method: "POST", body: JSON.stringify({ amount_usd_received: amount, payment_note: note }) },
    );
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/credit-transactions");
    revalidatePath("/member");
    return { ok: true, message: `New balance: ${result.new_balance.toLocaleString()} credits.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Grant failed." };
  }
}

export async function revokeUserCreditsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid, positive number of credits." };
  }

  try {
    const result = await callBackend<{ new_balance: number }>(
      `/v1/super-admin/users/${userId}/revoke-credits`,
      { method: "POST", body: JSON.stringify({ amount, note }) },
    );
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/organizations");
    revalidatePath("/super-admin/credit-transactions");
    revalidatePath("/org-admin");
    revalidatePath("/member");
    return { ok: true, message: `Revoked. New balance: ${result.new_balance.toLocaleString()} credits.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Revoke failed." };
  }
}

export async function issueUserApiKeyAction(
  _prev: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const userId = String(formData.get("user_id") ?? "");
  try {
    const result = await callBackend<{ api_key: string }>(
      `/v1/super-admin/users/${userId}/issue-api-key`,
      { method: "POST" },
    );
    revalidatePath("/super-admin/users");
    revalidatePath("/member");
    return { ok: true, message: "Issued.", apiKey: result.api_key };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to issue API key." };
  }
}

export async function viewUserApiKeyAction(userId: string): Promise<{ api_key: string | null }> {
  return callBackend<{ api_key: string | null }>(`/v1/super-admin/users/${userId}/api-key`);
}

export async function updateUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");

  try {
    await callBackend(`/v1/super-admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/organizations"); // promoting to org_admin can auto-create one
    revalidatePath("/org-admin");
    revalidatePath("/member");
    return { ok: true, message: `Role set to ${role}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to change role." };
  }
}

export async function updateUserStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");

  try {
    await callBackend(`/v1/super-admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/organizations");
    revalidatePath("/org-admin");
    revalidatePath("/member");
    return { ok: true, message: `Status set to ${status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to change status." };
  }
}

export async function updateModelPricingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const pricingId = String(formData.get("pricing_id") ?? "");
  const inputRate = formData.get("anthropic_input_per_m");
  const outputRate = formData.get("anthropic_output_per_m");
  const markup = formData.get("markup_multiplier");
  const isActive = formData.get("is_active");

  const body: Record<string, number | boolean> = {};
  if (inputRate) body.anthropic_input_per_m = Number(inputRate);
  if (outputRate) body.anthropic_output_per_m = Number(outputRate);
  if (markup) body.markup_multiplier = Number(markup);
  if (isActive !== null) body.is_active = isActive === "true";

  try {
    await callBackend(`/v1/super-admin/model-pricing/${pricingId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    revalidatePath("/super-admin/resources");
    return { ok: true, message: "Updated." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Update failed." };
  }
}

export async function setAnthropicApiKeyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const apiKey = String(formData.get("api_key") ?? "").trim();
  if (!apiKey) return { ok: false, message: "Enter a key." };

  try {
    await callBackend("/v1/super-admin/anthropic-api-key", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    });
    revalidatePath("/super-admin/resources");
    return { ok: true, message: "Saved - new chat requests will use this key immediately." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to save key." };
  }
}

export async function invalidateAnthropicApiKeyAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await callBackend("/v1/super-admin/anthropic-api-key/invalidate", { method: "POST" });
    revalidatePath("/super-admin/resources");
    return { ok: true, message: "Invalidated - chat requests will fail until a new key is set." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to invalidate." };
  }
}
