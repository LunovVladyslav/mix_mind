@echo off
title MixMind MultiFX — VST3 Installer
color 0B

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   MixMind MultiFX — VST3 Installer  ║
echo  ╚══════════════════════════════════════╝
echo.

:: Check if running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Administrator rights required!
    echo.
    echo  This window will now reopen as Administrator...
    echo  Please click YES in the UAC dialog.
    echo.
    timeout /t 2 /nobreak >nul
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set "SRC=c:\Users\vlady\Desktop\MixMind\vst-multiefx\build\MixMindMultiFX_artefacts\Release\VST3\MixMind MultiFX.vst3"
set "DST=C:\Program Files\Common Files\VST3\MixMind MultiFX.vst3"

echo  Installing MixMind MultiFX to:
echo  %DST%
echo.

if not exist "%SRC%\Contents\x86_64-win\MixMind MultiFX.vst3" (
    echo  ERROR: Built plugin not found at:
    echo  %SRC%
    echo.
    echo  Please build the plugin first.
    pause
    exit /b 1
)

robocopy "%SRC%" "%DST%" /E /IS /IT /NP /NFL /NDL
set RCCODE=%errorlevel%

:: Robocopy codes 0-7 = success (bitmask: 1=copied, 2=extras, 4=mismatch)
:: Only 8+ means actual errors
if %RCCODE% lss 8 (
    echo.
    echo  Plugin installed successfully!
    echo.
    echo  NEXT STEPS:
    echo  1. Close Ableton Live (if open^)
    echo  2. Reopen Ableton Live
    echo  3. Go to Preferences - Plugins - Rescan
    echo  4. Find "MixMind MultiFX" in your plugin list
    echo.
) else (
    echo.
    echo  ERROR: Installation failed (robocopy code %RCCODE%^)
    echo.
)

pause
