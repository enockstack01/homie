@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "ADDIN_FILE="
for %%f in ("%SCRIPT_DIR%*.esriAddinX") do set "ADDIN_FILE=%%f"

if not defined ADDIN_FILE (
    echo Could not find an .esriAddinX file next to this script.
    pause
    exit /b 1
)

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-ItemProperty 'HKLM:\SOFTWARE\ESRI\ArcGISPro' -ErrorAction SilentlyContinue).InstallDir"`) do set "PRO_DIR=%%i"

if not defined PRO_DIR (
    echo Could not find an ArcGIS Pro installation. Install ArcGIS Pro first, then run this again.
    pause
    exit /b 1
)

tasklist /FI "IMAGENAME eq ArcGISPro.exe" 2>NUL | find /I "ArcGISPro.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo Please close ArcGIS Pro, then run this installer again.
    pause
    exit /b 1
)

echo Installing xGIS into ArcGIS Pro...
"%PRO_DIR%bin\RegisterAddIn.exe" "%ADDIN_FILE%" /s
if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
)

echo Done. Launching ArcGIS Pro...
start "" "%PRO_DIR%bin\ArcGISPro.exe"
