// Mirrors xcrop/orchestrator/app/homie_client.py and src/xGIS.AddIn/Agent/ClaudeAgentService.cs's
// reason for existing: backend/app/routes/chat.py's gateway holds the only real Anthropic
// key and meters usage against the signed-in account's credit balance - this app must
// never call Anthropic directly, or AI usage here would be unbilled and unaudited against
// the same account the rest of the Homie platform tracks. The API key itself is supplied
// by the browser on every request (see app/page.tsx) and only ever forwarded server-side
// to this same Homie gateway - it's never persisted here.

const HOMIE_API_BASE = process.env.HOMIE_API_BASE || "https://homie-platform.onrender.com";

export class HomieApiError extends Error {
  constructor(
    public status: number,
    detail: string,
  ) {
    super(detail);
  }
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface ChatResponse {
  message: { content: AnthropicContentBlock[] };
  deducted_credits: number;
  remaining_credits: number;
}

/** Calls the same /v1/chat gateway xcrop and Homie GIS use - request/response shape
 * mirrors Anthropic's Messages API (see backend/app/routes/chat.py). Returns the
 * concatenated text of every text content block, since this app only ever asks for a
 * single structured-JSON text reply, never tool use. */
export async function homieChat(apiKey: string, system: string, userMessage: string): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch(`${HOMIE_API_BASE}/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        system,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    throw new HomieApiError(503, `Couldn't reach the Homie backend at ${HOMIE_API_BASE}: ${String(err)}`);
  }

  if (!response.ok) {
    let detail = await response.text();
    try {
      detail = JSON.parse(detail).detail ?? detail;
    } catch {
      // Non-JSON error body - use the raw text as-is.
    }
    throw new HomieApiError(response.status, detail);
  }

  return response.json();
}

export function extractText(response: ChatResponse): string {
  return response.message.content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
}
