import fs from "fs/promises";
import path from "path";

export interface AddinRelease {
  version: string;
  filePath: string;
  fileName: string;
  /** Present when scripts/build-release.ps1 emitted them alongside the .esriAddinX -
   * silently registers the add-in and launches ArcGIS Pro / removes it, so the download
   * route can bundle them into one zip instead of shipping the bare .esriAddinX. */
  installScriptPath: string | null;
  uninstallScriptPath: string | null;
  /** Also copied by build-release.ps1; bundled into the zip purely as reference reading,
   * not required for the install itself (Install.bat needs no docs to run). */
  installMdPath: string | null;
}

/**
 * Finds the ArcGIS Pro Add-in package that scripts/build-release.ps1 (in the repo root,
 * a sibling of this Next.js app) produces at dist/xGIS-<version>/xGIS.AddIn.esriAddinX.
 * Reading it from there directly - rather than copying it into this app's own tree -
 * means a fresh `build-release.ps1` run is immediately what gets served, no separate
 * sync step to forget.
 *
 * This only works because, on this deployment, the Next.js app and the Add-in's build
 * output happen to live on the same Windows machine. A real multi-machine production
 * deployment (Next.js hosted separately from wherever MSBuild/ArcGIS Pro SDK runs) would
 * need to swap this for a proper artifact store (e.g. a release uploaded to cloud
 * storage) instead of a local relative path.
 */
export async function findLatestAddinRelease(): Promise<AddinRelease | null> {
  const distDir = path.join(process.cwd(), "..", "dist");

  let entries: string[];
  try {
    entries = await fs.readdir(distDir);
  } catch {
    return null;
  }

  const versionDirs = entries.filter((e) => e.startsWith("xGIS-")).sort().reverse();
  for (const dir of versionDirs) {
    const fileName = "xGIS.AddIn.esriAddinX";
    const filePath = path.join(distDir, dir, fileName);
    try {
      await fs.access(filePath);
    } catch {
      continue;
    }

    const installScriptPath = path.join(distDir, dir, "Install.bat");
    const uninstallScriptPath = path.join(distDir, dir, "Uninstall.bat");
    const installMdPath = path.join(distDir, dir, "INSTALL.md");
    return {
      version: dir.replace(/^xGIS-/, ""),
      filePath,
      fileName,
      installScriptPath: (await fileExists(installScriptPath)) ? installScriptPath : null,
      uninstallScriptPath: (await fileExists(uninstallScriptPath)) ? uninstallScriptPath : null,
      installMdPath: (await fileExists(installMdPath)) ? installMdPath : null,
    };
  }
  return null;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
