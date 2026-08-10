import { auth } from "@clerk/nextjs/server";

export class BackendError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Calls the Homie FastAPI gateway from a Server Component/Action, attaching the signed-in
 * user's Clerk session token. Auth *and* admin-role enforcement both live in the backend
 * (see backend/app/auth.py) - this dashboard never re-implements that check, it just
 * surfaces a 403 as BackendError so pages can render "access denied" instead of crashing.
 */
export async function callBackend<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    throw new BackendError(401, "Not signed in");
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured (see .env.local.example)");
  }

  const method = init?.method?.toUpperCase() ?? "GET";
  const fetchInit: RequestInit = {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  };

  // Render's free tier spins the backend down after idle and briefly answers with a
  // 502/503/504 from its edge while the service cold-starts. Retrying is only safe for
  // reads (GET) - mutating calls surface the error immediately rather than risk a
  // duplicate side effect if the origin actually received the first attempt.
  const maxAttempts = method === "GET" ? 3 : 1;
  let response: Response;
  for (let attempt = 1; ; attempt++) {
    response = await fetch(`${backendUrl}${path}`, fetchInit);
    const isTransientGatewayError = [502, 503, 504].includes(response.status);
    if (!isTransientGatewayError || attempt >= maxAttempts) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => null);
      const detail = body?.detail ?? body?.message;
      if (typeof detail === "string" && detail) {
        throw new BackendError(response.status, detail);
      }
    }
    // Non-JSON error bodies (e.g. an infrastructure/proxy error page) aren't safe
    // or useful to render as-is, so fall back to a short, generic message.
    throw new BackendError(response.status, response.statusText || "The backend is unreachable");
  }

  return response.json() as Promise<T>;
}
