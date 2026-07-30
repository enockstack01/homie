export interface AddinRelease {
  version: string;
  /** Direct GitHub Releases asset URL - the download route redirects here rather than
   * proxying the bytes through this server. */
  downloadUrl: string;
  fileName: string;
}

const RELEASES_REPO = process.env.ADDIN_RELEASES_REPO || "enockstack01/homie";

/**
 * Finds the ArcGIS Pro Add-in installer by asking GitHub's Releases API for this repo's
 * latest release, rather than reading a local `dist/` folder.
 *
 * Building the .esriAddinX requires the ArcGIS Pro SDK and full desktop MSBuild
 * (scripts/build-release.ps1), which only ever runs on a Windows dev machine with ArcGIS
 * Pro installed - never on wherever this Next.js app happens to be hosted. Once this app
 * moved off that same Windows machine onto Render, a local relative path to `dist/` had
 * nothing to read. GitHub Releases is the artifact store instead: publish
 * `xGIS-<version>-installer.zip` (produced by build-release.ps1) as a Release asset on
 * this repo, and this app just needs network access to github.com, no shared filesystem.
 */
export async function findLatestAddinRelease(): Promise<AddinRelease | null> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" }, next: { revalidate: 300 } },
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    // 404 means no release has been published yet - not an error, just nothing to offer.
    return null;
  }

  const release = await response.json();
  const asset = (release.assets as Array<{ name: string; browser_download_url: string }>)?.find(
    (a) => a.name.endsWith(".zip"),
  );
  if (!asset) return null;

  return {
    version: String(release.tag_name).replace(/^v/, ""),
    downloadUrl: asset.browser_download_url,
    fileName: asset.name,
  };
}
