@echo off
setlocal

rem Substituted by build-release.ps1 from Config.daml's AddInInfo/@id - the AssemblyCache
rem folder ArcGIS Pro deploys an add-in into is named after this fixed GUID, stable across
rem versions/reinstalls, so this is the same thing ArcGIS Pro's own Add-In Manager ->
rem Remove button deletes under the hood.
set "ADDIN_ID=__ADDIN_ID__"
set "CACHE_DIR=%LOCALAPPDATA%\ESRI\ArcGISPro\AssemblyCache\%ADDIN_ID%"

tasklist /FI "IMAGENAME eq ArcGISPro.exe" 2>NUL | find /I "ArcGISPro.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo Please close ArcGIS Pro before uninstalling xGIS.
    pause
    exit /b 1
)

if exist "%CACHE_DIR%" (
    rmdir /s /q "%CACHE_DIR%"
    echo xGIS has been uninstalled.
) else (
    echo xGIS does not appear to be installed for this user.
)
pause
