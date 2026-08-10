<#
.SYNOPSIS
    Compiles the orchestrator into a standalone Windows executable
    (dist/xcrop-orchestrator.exe) via PyInstaller, so the packaged desktop app doesn't
    require Python on the end user's machine at all - see run_server.py for why this
    goes through uvicorn.run() with the app already imported rather than the
    `uvicorn app.main:app` CLI form used in dev.

.EXAMPLE
    .\build.ps1
#>
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "No .venv found at $python - run: python -m venv .venv; .venv\Scripts\pip install -r requirements.txt -r requirements-dev.txt"
}

# --collect-all for anything with C extensions, dynamic imports, or its own resource
# files (shapely bundles GEOS as a native DLL; the rest do enough import-time magic that
# PyInstaller's static analysis alone has missed pieces of them before) - cheaper to be
# generous here than to debug a "works from source, breaks once frozen" failure later.
& $python -m PyInstaller --noconfirm --onefile --name xcrop-orchestrator `
    --icon "$root\..\desktop\build\icon.ico" `
    --collect-all uvicorn `
    --collect-all shapely `
    --collect-all pydantic `
    --collect-all pydantic_core `
    --collect-all fastapi `
    --collect-all starlette `
    --collect-all anyio `
    --collect-all httpx `
    --collect-all httpcore `
    --hidden-import app.main `
    --distpath "$root\dist" `
    --workpath "$root\build" `
    --specpath "$root" `
    "$root\run_server.py"

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed (exit code $LASTEXITCODE)."
}

Write-Host "Built: $root\dist\xcrop-orchestrator.exe" -ForegroundColor Green
