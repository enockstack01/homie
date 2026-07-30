import { ZipArchive } from "archiver";
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
      "No Add-in build is available yet. Ask whoever runs the Homie platform to publish one (scripts/build-release.ps1).",
      { status: 404 },
    );
  }

  // Bundle the esriAddinX with Install.bat/Uninstall.bat/INSTALL.md into one zip rather
  // than shipping the bare .esriAddinX - Install.bat is what makes install actually
  // one-click (silent RegisterAddIn.exe + relaunch ArcGIS Pro), not Esri's own
  // click-through Add-In Installation Utility that opening the bare file triggers.
  const zipBuffer = await buildReleaseZip(release);
  const zipFileName = `xGIS-${release.version}-installer.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFileName}"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}

async function buildReleaseZip(release: Awaited<ReturnType<typeof findLatestAddinRelease>>): Promise<Buffer> {
  if (!release) throw new Error("release must not be null");

  return new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    archive.file(release.filePath, { name: release.fileName });
    if (release.installScriptPath) archive.file(release.installScriptPath, { name: "Install.bat" });
    if (release.uninstallScriptPath) archive.file(release.uninstallScriptPath, { name: "Uninstall.bat" });
    if (release.installMdPath) archive.file(release.installMdPath, { name: "INSTALL.md" });

    archive.finalize();
  });
}
