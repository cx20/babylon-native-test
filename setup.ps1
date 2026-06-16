# setup.ps1 - Babylon Native Hello World setup script
#
# Usage:
#   Open PowerShell as Administrator, navigate to this script's directory:
#     Set-ExecutionPolicy Bypass -Scope Process -Force
#     .\setup.ps1
#
# Options:
#   -SkipClone   Skip cloning BabylonNative (if already cloned)
#   -SkipNpm     Skip npm install
#   -SkipCMake   Skip CMake generation (only copy files)

param(
    [switch]$SkipClone,
    [switch]$SkipNpm,
    [switch]$SkipCMake
)

$ErrorActionPreference = "Stop"
$ScriptDir   = $PSScriptRoot
$BabylonDir  = Join-Path $ScriptDir "BabylonNative"
$AppSrc      = Join-Path $ScriptDir "App"
$AppDest     = Join-Path $BabylonDir "Apps\HelloWorld"
$AppsCMake   = Join-Path $BabylonDir "Apps\CMakeLists.txt"
$BuildDir    = Join-Path $BabylonDir "build\win32"

function Write-Step([string]$msg) {
    Write-Host "`n>>> $msg" -ForegroundColor Cyan
}

function Check-Command([string]$cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "Required tool not found: $cmd`nPlease install it and run this script again."
    }
    Write-Host "  [OK] $cmd" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 1. Prerequisites check
# ---------------------------------------------------------------
Write-Step "Checking prerequisites"
Check-Command "git"
Check-Command "node"
Check-Command "npm"

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$cmakeFromVS = $null
if (Test-Path $vswhere) {
    $vsInstalls = & $vswhere -all -products * `
        -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
        -format json 2>$null | ConvertFrom-Json
    if ($vsInstalls) {
        $vs = $vsInstalls | Sort-Object installationVersion -Descending | Select-Object -First 1
        Write-Host "  [OK] Visual Studio $($vs.installationVersion) ($($vs.installationPath))" -ForegroundColor Green
        $cmakeBin = Join-Path $vs.installationPath "Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
        if (Test-Path $cmakeBin) {
            $cmakeFromVS = $cmakeBin
            Write-Host "  [OK] cmake (bundled with VS): $cmakeBin" -ForegroundColor Green
        }
    } else {
        Write-Warning "Visual Studio with C++ tools not found. Build may fail."
    }
} else {
    Write-Warning "vswhere not found. Please verify that Visual Studio is installed."
}

# Resolve cmake command: prefer PATH, fall back to VS-bundled cmake
$cmakeCmd = if (Get-Command "cmake" -ErrorAction SilentlyContinue) { "cmake" } elseif ($cmakeFromVS) { $cmakeFromVS } else { Write-Error "cmake not found." }

# ---------------------------------------------------------------
# 2. Clone BabylonNative repository
# ---------------------------------------------------------------
Write-Step "Cloning BabylonNative"
if ($SkipClone) {
    Write-Host "  -SkipClone specified, skipping." -ForegroundColor Yellow
} elseif (Test-Path $BabylonDir) {
    Write-Host "  $BabylonDir already exists. Skipping clone." -ForegroundColor Yellow
    Write-Host "  (Delete the directory to re-clone)" -ForegroundColor Gray
} else {
    Write-Host "  Cloning with submodules (~1-3 GB). This may take a while..." -ForegroundColor Yellow
    git clone --recurse-submodules https://github.com/BabylonJS/BabylonNative.git $BabylonDir
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone failed." }
    Write-Host "  Clone complete." -ForegroundColor Green
}

# ---------------------------------------------------------------
# 3. npm install (fetch Babylon.js packages)
# ---------------------------------------------------------------
Write-Step "Installing npm packages"
if ($SkipNpm) {
    Write-Host "  -SkipNpm specified, skipping." -ForegroundColor Yellow
} else {
    $appsDir = Join-Path $BabylonDir "Apps"
    if (-not (Test-Path $appsDir)) {
        Write-Error "Apps directory not found: $appsDir`nPlease verify that BabylonNative was cloned correctly."
    }
    Push-Location $appsDir
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "npm install failed." }
    # Cannon.js for the Physics v1 sample
    npm install cannon
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "npm install cannon failed." }
    Pop-Location
    Write-Host "  npm install complete." -ForegroundColor Green
}

# ---------------------------------------------------------------
# 4. Copy HelloWorld files into BabylonNative/Apps/
# ---------------------------------------------------------------
Write-Step "Copying HelloWorld app files"
if (-not (Test-Path $AppDest)) {
    New-Item -ItemType Directory -Path $AppDest | Out-Null
}
Copy-Item -Path "$AppSrc\*" -Destination $AppDest -Recurse -Force
Write-Host "  $AppSrc  ->  $AppDest" -ForegroundColor Green

# ---------------------------------------------------------------
# 5. Register HelloWorld in Apps/CMakeLists.txt
# ---------------------------------------------------------------
Write-Step "Patching Apps/CMakeLists.txt"
if (-not (Test-Path $AppsCMake)) {
    Write-Error "Apps/CMakeLists.txt not found: $AppsCMake"
}
$cmakeContent = Get-Content $AppsCMake -Raw
$entry = @"

if(WIN32 AND NOT WINDOWS_STORE)
    add_subdirectory(HelloWorld)
endif()
"@
if ($cmakeContent -match "add_subdirectory\(HelloWorld\)") {
    Write-Host "  HelloWorld is already registered. Skipping." -ForegroundColor Yellow
} else {
    # Append to end of file
    Add-Content -Path $AppsCMake -Value $entry
    Write-Host "  Added HelloWorld to Apps/CMakeLists.txt." -ForegroundColor Green
}

# ---------------------------------------------------------------
# 6. Generate build system with CMake
# ---------------------------------------------------------------
Write-Step "Generating CMake build system"
if ($SkipCMake) {
    Write-Host "  -SkipCMake specified, skipping." -ForegroundColor Yellow
} else {
    # Pass /utf-8 to work around MSVC C4819 warnings caused by UTF-8 source files
    # on non-UTF-8 system locales (e.g. CP932 on Japanese Windows).
    $cxxFlags = "/DWIN32 /D_WINDOWS /W3 /GR /EHsc /utf-8"
    $cFlags   = "/DWIN32 /D_WINDOWS /W3 /utf-8"
    Write-Host "  $cmakeCmd -B $BuildDir $BabylonDir" -ForegroundColor Gray
    & $cmakeCmd -B $BuildDir $BabylonDir `
        "-DCMAKE_CXX_FLAGS=$cxxFlags" `
        "-DCMAKE_C_FLAGS=$cFlags"
    if ($LASTEXITCODE -ne 0) { Write-Error "CMake generation failed." }
    Write-Host "  CMake complete." -ForegroundColor Green
}

# ---------------------------------------------------------------
# 7. Done
# ---------------------------------------------------------------
Write-Host @"

======================================================
  Setup complete!
======================================================

Build and run in Visual Studio:
  start "$BuildDir\BabylonNative.sln"
  -> Open the solution, set HelloWorld as startup project, then build

Build from command line:
  cmake --build "$BuildDir" --config Debug --target HelloWorld

Executable location:
  $BuildDir\Apps\HelloWorld\Debug\HelloWorld.exe

Source files:
  App\Scripts\hello_world.js  <- Babylon.js scene (edit this)
  App\Win32\main.cpp          <- Win32 host application
  App\CMakeLists.txt          <- CMake configuration

app:///Scripts/ maps to the Scripts/ directory next to the executable.
"@ -ForegroundColor Cyan
