# Installing xGIS

xGIS is an ArcGIS Pro Add-in - it runs directly inside ArcGIS Pro itself (not a
separate app), so it has full, in-process access to your live map and project.

## Requirements

- ArcGIS Pro 3.6 or later, already installed.
- An xGIS API key from your admin, and the URL of your organization's xGIS backend
  gateway (see `backend/README.md` if you're the one running it) - the Add-in itself
  never holds an Anthropic key or talks to Anthropic directly, so without these it
  installs fine but can't actually chat.
- Nothing else. No Visual Studio, no .NET SDK, no source code - those are only needed
  to *build* xGIS from source (see `docs/SETUP.md`), not to install and use it.

## Install

1. Get `xGIS.AddIn.esriAddinX` (from the `dist/xGIS-<version>/` folder if you built it
   yourself via `scripts/build-release.ps1`, or from wherever it was shared with you).
2. Close ArcGIS Pro if it's open.
3. Double-click `xGIS.AddIn.esriAddinX`. This launches Esri's own
   **Add-In Installation Utility** - the same mechanism ArcGIS Pro uses for any add-in.
   Review the publisher info and click **Install**.
4. Open ArcGIS Pro and open (or create) any project. You should see an **xGIS** tab on
   the ribbon.
5. Click **Settings** on the xGIS tab: paste your **xGIS API key** (ask your xGIS admin
   for one - it's not something you generate yourself, and it's not an Anthropic key),
   pick a model (Opus for reliability, Sonnet/Haiku for speed and cost), set the
   **Backend URL** to wherever your organization's xGIS gateway is deployed (defaults to
   `http://127.0.0.1:8000`, for local/dev use only), and click **Save**. The key is
   stored in Windows Credential Manager, not in any project or config file.
6. Click **xGIS Chat** to open the chat panel and start typing what you want done. The
   status line after each reply shows your remaining credit balance - if a request is
   rejected for insufficient balance, ask your admin for a top-up.

## Updating

Repeat the install steps with a newer `xGIS.AddIn.esriAddinX` - it replaces the
previous version in place. Your saved API key and settings are unaffected (they live in
Windows Credential Manager / `%LOCALAPPDATA%\xGIS\settings.json`, not in the add-in
package itself).

## Uninstalling

In ArcGIS Pro: **Add-In Manager** (Project tab → Add-In Manager, or Settings → Add-In
Manager) → find **xGIS** → **Uninstall**. Your saved API key stays in Windows Credential
Manager unless you also remove it there (Control Panel → Credential Manager → Windows
Credentials → look for `xGIS:ApiKey`).
