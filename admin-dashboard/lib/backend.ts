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

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new BackendError(response.status, body || response.statusText);
  }

  return response.json() as Promise<T>;
}
