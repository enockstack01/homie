# xGIS setup

This is the **developer** setup (building from source). If you just want to *use* xGIS,
see `../INSTALL.md` instead — end users only need ArcGIS Pro installed and the packaged
`.esriAddinX`, nothing on this page.

## Prerequisites (in order)

1. **.NET 8 SDK** — `winget install Microsoft.DotNet.SDK.8`
2. **Visual Studio 2022** (≥17.13) with the **.NET desktop development** workload —
   `winget install Microsoft.VisualStudio.2022.Community`
3. **ArcGIS Pro SDK for .NET VSIX** *(optional)* — in Visual Studio: Extensions → Manage
   Extensions → Online → search "ArcGIS Pro SDK" → install `Esri.ArcGISProSDKTemplates`.
   Not required to build or run this project (it references the Pro install's DLLs
   directly - see below - and every file was hand-authored, not wizard-generated); it
   only adds the Add-in/DockPane *New Item* templates and `Config.daml` designer/
   IntelliSense, useful if you're adding new dockpanes/buttons by hand later.
4. **WebView2 Runtime ≥132** — check with `winget list Microsoft.EdgeWebView2Runtime`;
   install with `winget install Microsoft.EdgeWebView2Runtime` if missing.
5. **ArcGIS Pro 3.6+** — already required to run/debug the add-in at all.

## First build

1. Open `xGIS.sln` in Visual Studio and press **F5**. The Pro SDK's debug profile
   (`Properties/launchSettings.json`) launches `ArcGISPro.exe` with the add-in deployed
   to your user AddIns folder automatically.

There is **no NuGet package for the ArcGIS Pro 3.x/.NET 8 SDK** (confirmed: the only
package published under `Esri.ArcGISPro.Extensions` on nuget.org tops out at the old
2.9.x/.NET Framework generation). The real mechanism, verified against Esri's own
`arcgis-pro-sdk-community-samples` repo, is direct `<Reference>`/`HintPath` entries
against the DLLs inside the local ArcGIS Pro install — see `src/Directory.Build.props`,
shared by both projects. `xGIS.AddIn.csproj` additionally imports
`Esri.ProApp.SDK.Desktop.targets` from the local Pro install to package the `.esriAddinX`
and deploy it.

### Building outside Visual Studio (CLI)

`xGIS.AddIn.csproj` **cannot be built with `dotnet build`/`dotnet test`** — the packaging
step in `Esri.ProApp.SDK.Desktop.targets` uses `CodeTaskFactory`, which only the
full-framework MSBuild that ships with Visual Studio supports (`dotnet build` uses the
.NET Core MSBuild and fails with `MSB4801`/`MSB4036`). Use the real MSBuild instead:

```powershell
& "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" `
    xGIS.sln /p:Configuration=Debug /p:Platform=x64
```

Note the packaged `.esriAddinX` is deployed via `RegisterAddIn.exe`, which is only on
`PATH` inside a Visual Studio developer environment. If that step logs
"not recognized" (CLI build outside VS), copy the freshly built file over the deployed
copy yourself:

```powershell
Copy-Item ".\src\xGIS.AddIn\bin\x64\Debug\net8.0-windows\xGIS.AddIn.esriAddinX" `
    "$env:USERPROFILE\Documents\ArcGIS\AddIns\ArcGISPro\{9113466a-6607-4ac3-a6f0-18f2829b89da}\xGIS.AddIn.esriAddinX" -Force
```

ArcGIS Pro must be closed when you overwrite that file, and reopened afterward to pick
up the change — it reads `Config.daml` straight out of the `.esriAddinX` (a zip) at
startup, no unzip step needed.

### Running the unit tests from the CLI

Because `xGIS.AddIn.Tests` project-references `xGIS.AddIn`, `dotnet test`/`dotnet build`
on the test project hits the same `CodeTaskFactory` wall via the transitive build of
`xGIS.AddIn`. Build once with the real MSBuild above, then run the already-built test DLL
directly with `dotnet vstest` (which doesn't try to rebuild):

```powershell
dotnet vstest .\src\xGIS.AddIn.Tests\bin\x64\Debug\net8.0-windows\xGIS.AddIn.Tests.dll
```

The Add-in has **no Anthropic SDK dependency at all** - it talks to the backend gateway
(`../backend/`) over plain HTTP/JSON (`Agent/ClaudeAgentService.cs`), and the gateway is
the only thing that ever holds a real Anthropic key. See `docs/ARCHITECTURE.md`'s "Why no
Anthropic SDK" section if you're wondering where that went - it used to be here, along
with an `AssemblyLoadContext` isolation workaround for a `System.Text.Json` version
conflict, both removed once the SDK itself was.

### A gotcha already solved for you

**`global.json` pins the .NET SDK to 8.0.x.** If Visual Studio ever brings in a newer SDK
side-by-side (it did here — 17.14 installs a .NET 9 SDK alongside), MSBuild picks the
newest installed SDK by default, which can resolve transitive package versions differently
than intended. Don't remove `global.json` without re-verifying a build.

## Packaging a release

```powershell
.\scripts\build-release.ps1
```

Builds Release|x64 and copies the resulting `.esriAddinX` (plus `INSTALL.md`) into
`dist\xGIS-<version>\` — the version comes from `Config.daml`'s `AddInInfo/@version`,
bump that when releasing. `dist/` is gitignored; hand the folder itself to whoever needs
it (see `../INSTALL.md` for what they do with it).

The script also zips those files into `dist\xGIS-<version>-installer.zip`. **Publish that
zip as a GitHub Release on this repo, tagged `v<version>`** — the admin dashboard's
download button (`admin-dashboard/lib/addinRelease.ts`) reads the latest Release via
GitHub's API and redirects users there, since the dashboard runs on Render, not this
machine. Nobody gets a working download link until a Release with a `.zip` asset exists.

## xGIS API key

The Add-in's Settings window stores a **Clerk Machine secret key** (`ak_...`) via
`Config/CredentialStore` (Windows Credential Manager) - see `docs/ARCHITECTURE.md`'s "Why
no Anthropic SDK" section for what that actually is and why. The real Anthropic key lives
only in the backend gateway's `.env` (never in this project). `CredentialStore.GetApiKey()`
falls back to the `XGIS_API_KEY` environment variable for local dev only.

If you ever paste a live key/secret into a chat, terminal history, or any tool that logs
input, treat it as compromised and rotate it at the source (Anthropic Console, Clerk
dashboard, or MongoDB Atlas, whichever it was).

## Smoke test

Open a project with a sample feature layer (e.g., a roads layer), open the **xGIS Chat**
dockpane from the ribbon (xGIS tab), and try, in order:

1. "What layers are in this map?" — validates `list_layers` and basic wiring.
2. "Zoom to the roads layer." — validates the mapping-tool path, no confirmation modal.
3. "Buffer the roads layer by 500 meters and add it as a new layer." — validates the
   curated `buffer_layer` wrapper; output should land in the project's default
   geodatabase without a confirmation prompt (additive, in-sandbox).
4. Something that reads as destructive (e.g. "delete the field I just added") — confirms
   the Allow/Deny modal actually appears and Deny actually blocks execution.
5. Inspect `%LOCALAPPDATA%\xGIS\logs\xgis-<date>.jsonl` afterward — every tool call,
   its resolved input, and its result should be there.
