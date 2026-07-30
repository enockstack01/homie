import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findLatestAddinRelease } from "@/lib/addinRelease";
import { BackendError, callBackend } from "@/lib/backend";
import type { Me } from "@/lib/types";

/**
 * Gated the same way every other page's data is: real auth (Clerk session) plus a
 * status check against the backend, not just "is this URL guessable" - a banned/pending
 * account shouldn't be able to fetch the installer just because they found this path,
 * even though the download *link* itself is already hidden from them on /member and
 * /org-admin.
 *
 * Redirects to the GitHub Release asset rather than proxying the zip's bytes through this
 * server - the auth/status check above still gates whether a browser ever gets that
 * redirect at all, and GitHub's CDN serves the actual download.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Not signed in.", { status: 401 });
  }

  let me: Me;
  try {
    me = await callBackend<Me>("/v1/me");
  } catch (err) {
    if (err instanceof BackendError) {
      return new NextResponse(err.message, { status: err.status });
    }
    throw err;
  }

  if (me.status !== "active") {
    return new NextResponse(
      `Your account status is "${me.status}" - it must be active to download the Add-in.`,
      { status: 403 },
    );
  }

  const release = await findLatestAddinRelease();
  if (!release) {
    return new NextResponse(
      "No Add-in build is available yet. Ask whoever runs the Homie platform to publish one (scripts/build-release.ps1, then a GitHub Release).",
      { status: 404 },
    );
  }

  return NextResponse.redirect(release.downloadUrl);
}
