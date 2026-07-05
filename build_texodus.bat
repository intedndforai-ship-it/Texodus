@echo off
setlocal
echo ===================================================
echo     Texodus Executable Builder
echo ===================================================
echo.

:: Check if Visual Studio C++ Build Tools are installed
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VC_WORKLOAD=Microsoft.VisualStudio.Component.VC.Tools.x86.x64"

if exist "%VSWHERE%" (
    "%VSWHERE%" -latest -products * -requires %VC_WORKLOAD% -property installationPath >nul 2>&1
    if not errorlevel 1 (
        goto :build
    )
)

echo [ERROR] The required Microsoft C++ Build Tools are NOT installed!
echo.
echo Please follow these steps to install them:
echo 1. Open the folder: e:\texodux\
echo 2. Double-click the file named "vs_buildtools.exe"
echo 3. When the Visual Studio Installer opens, check the box for:
echo    "Desktop development with C++"
echo 4. Click "Install" and wait for it to fully complete.
echo.
echo Once the installation is finished, run this build_texodus.bat file again.
pause
exit /b 1

:build
set PATH=%PATH%;%USERPROFILE%\.cargo\bin;%USERPROFILE%\.bun\bin

echo Starting the application build process. This will take a few minutes...
call npm run tauri build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo SUCCESS! The .exe file was generated successfully.
    echo You can find it in: %~dp0src-tauri\target\release\bundle\nsis\
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo BUILD FAILED. Please review the errors above.
    echo ===================================================
)
pause
