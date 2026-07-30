"use server";

import { revalidatePath } from "next/cache";
import { callBackend } from "@/lib/backend";

export interface ActionState {
  ok: boolean;
  message: string;
}

export async function acceptInvitationAction(): Promise<ActionState> {
  try {
    const result = await callBackend<{ organization_name: string }>("/v1/my-invitation/accept", {
      method: "POST",
    });
    revalidatePath("/member");
    revalidatePath("/org-admin");
    return { ok: true, message: `You've joined ${result.organization_name}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to accept invitation." };
  }
}

export async function declineInvitationAction(): Promise<ActionState> {
  try {
    await callBackend("/v1/my-invitation/decline", { method: "POST" });
    revalidatePath("/member");
    revalidatePath("/org-admin");
    return { ok: true, message: "Invitation declined." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to decline invitation." };
  }
}

export async function viewMyApiKeyAction(): Promise<{ api_key: string | null }> {
  return callBackend<{ api_key: string | null }>("/v1/my-api-key");
}

/** Self-service, every role alike - which active model the caller's own API key uses for
 * every future /v1/chat call (see backend/app/routes/chat.py's handle_chat_request,
 * which derives the model from the account, never from the request). */
export async function setMyModelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const modelId = String(formData.get("model_id") ?? "");
  if (!modelId) return { ok: false, message: "Choose a model." };

  try {
    const result = await callBackend<{ display_name: string }>("/v1/my-model", {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    });
    revalidatePath("/member");
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/account");
    return { ok: true, message: `Now using ${result.display_name}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to change model." };
  }
}

export interface ApiKeyActionState extends ActionState {
  apiKey?: string;
}

/** Self-service issue/rotate - works for every role (member, org_admin, super_admin
 * alike), since it's always scoped to the caller's own account server-side. No target
 * id is needed (unlike the admin-facing issue actions), but useActionState still
 * requires this (prevState, formData) shape. */
export async function issueMyApiKeyAction(
  _prev: ApiKeyActionState,
  _formData: FormData,
): Promise<ApiKeyActionState> {
  try {
    const result = await callBackend<{ api_key: string }>("/v1/my-api-key/issue", { method: "POST" });
    revalidatePath("/member");
    revalidatePath("/org-admin");
    revalidatePath("/super-admin/account");
    return { ok: true, message: "Issued.", apiKey: result.api_key };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to issue API key." };
  }
}
