<#
.SYNOPSIS
    Builds xGIS.AddIn in Release configuration and packages the result into dist/,
    ready to hand to an end user - they only need ArcGIS Pro installed, nothing else
    (no Visual Studio, no .NET SDK, no source code).

.EXAMPLE
    .\scripts\build-release.ps1
#>
param(
    [string]$MSBuildPath = "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$sln = Join-Path $repoRoot "xGIS.sln"

if (-not (Test-Path $MSBuildPath)) {
    throw "MSBuild.exe not found at '$MSBuildPath'. Pass -MSBuildPath, or install Visual Studio 2022 with the .NET desktop development workload."
}

Write-Host "Building xGIS.AddIn (Release|x64)..." -ForegroundColor Cyan
& $MSBuildPath $sln /p:Configuration=Release /p:Platform=x64 /nologo /v:minimal
if ($LASTEXITCODE -ne 0) {
    throw "Build failed (exit code $LASTEXITCODE)."
}

$builtAddin = Join-Path $repoRoot "src\xGIS.AddIn\bin\x64\Release\net8.0-windows\xGIS.AddIn.esriAddinX"
if (-not (Test-Path $builtAddin)) {
    throw "Expected build output not found: $builtAddin"
}

# Single-sourced from Config.daml's AddInInfo/@version and @id rather than duplicated here.
[xml]$daml = Get-Content (Join-Path $repoRoot "src\xGIS.AddIn\Config.daml")
$version = $daml.ArcGIS.AddInInfo.version
if (-not $version) { $version = "0.0.0" }
$addinId = $daml.ArcGIS.AddInInfo.id
if (-not $addinId) {
    throw "Config.daml's AddInInfo has no id - Uninstall.bat needs it to find the right AssemblyCache folder."
}

$distDir = Join-Path $repoRoot "dist\xGIS-$version"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Copy-Item $builtAddin (Join-Path $distDir "xGIS.AddIn.esriAddinX") -Force
Copy-Item (Join-Path $repoRoot "INSTALL.md") (Join-Path $distDir "INSTALL.md") -Force

$templatesDir = Join-Path $repoRoot "scripts\installer-templates"
Copy-Item (Join-Path $templatesDir "Install.bat") (Join-Path $distDir "Install.bat") -Force

# Uninstall.bat needs the add-in's fixed GUID to find its AssemblyCache folder - templated
# rather than hardcoded so it can never drift out of sync with Config.daml.
$uninstallTemplate = Get-Content (Join-Path $templatesDir "Uninstall.bat") -Raw
$uninstallTemplate.Replace("__ADDIN_ID__", $addinId) |
    Set-Content (Join-Path $distDir "Uninstall.bat") -NoNewline

Write-Host ""
Write-Host "Packaged xGIS $version -> $distDir" -ForegroundColor Green
Write-Host "Hand the whole '$distDir' folder to anyone with ArcGIS Pro installed - see INSTALL.md inside it."
Write-Host "Run Install.bat to silently register the add-in and launch ArcGIS Pro; Uninstall.bat to remove it."
