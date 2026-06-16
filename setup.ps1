# setup.ps1 - Babylon Native Hello World セットアップスクリプト
#
# 実行方法:
#   PowerShell を管理者で開き、このスクリプトのディレクトリで:
#     Set-ExecutionPolicy Bypass -Scope Process -Force
#     .\setup.ps1
#
# オプション:
#   -SkipClone   BabylonNative のクローンをスキップ (既にある場合)
#   -SkipNpm     npm install をスキップ
#   -SkipCMake   CMake 実行をスキップ (ファイルのコピーのみ)

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
        Write-Error "必要なツールが見つかりません: $cmd`nインストールしてから再実行してください。"
    }
    Write-Host "  [OK] $cmd" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 1. 前提条件チェック
# ---------------------------------------------------------------
Write-Step "前提条件の確認"
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
            Write-Host "  [OK] cmake (VS 付属): $cmakeBin" -ForegroundColor Green
        }
    } else {
        Write-Warning "Visual Studio (C++ ツール付き) が見つかりません。ビルド時にエラーが出る可能性があります。"
    }
} else {
    Write-Warning "vswhere が見つかりません。Visual Studio がインストールされているか確認してください。"
}

# cmake コマンドの解決: PATH 上になければ VS 付属を使用
$cmakeCmd = if (Get-Command "cmake" -ErrorAction SilentlyContinue) { "cmake" } elseif ($cmakeFromVS) { $cmakeFromVS } else { Write-Error "cmake が見つかりません。" }

# ---------------------------------------------------------------
# 2. BabylonNative リポジトリのクローン
# ---------------------------------------------------------------
Write-Step "BabylonNative のクローン"
if ($SkipClone) {
    Write-Host "  -SkipClone が指定されたためスキップします。" -ForegroundColor Yellow
} elseif (Test-Path $BabylonDir) {
    Write-Host "  $BabylonDir は既に存在します。クローンをスキップします。" -ForegroundColor Yellow
    Write-Host "  (再クローンするにはディレクトリを削除してください)" -ForegroundColor Gray
} else {
    Write-Host "  サブモジュール含め約 1~3 GB のクローンになります。時間がかかります..." -ForegroundColor Yellow
    git clone --recurse-submodules https://github.com/BabylonJS/BabylonNative.git $BabylonDir
    if ($LASTEXITCODE -ne 0) { Write-Error "git clone に失敗しました。" }
    Write-Host "  クローン完了。" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 3. npm install (Babylon.js パッケージの取得)
# ---------------------------------------------------------------
Write-Step "npm パッケージのインストール"
if ($SkipNpm) {
    Write-Host "  -SkipNpm が指定されたためスキップします。" -ForegroundColor Yellow
} else {
    $appsDir = Join-Path $BabylonDir "Apps"
    if (-not (Test-Path $appsDir)) {
        Write-Error "Apps ディレクトリが見つかりません: $appsDir`nBabylonNative が正しくクローンされているか確認してください。"
    }
    Push-Location $appsDir
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "npm install に失敗しました。" }
    # 物理演算サンプル用 Cannon.js
    npm install cannon
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "npm install cannon に失敗しました。" }
    Pop-Location
    Write-Host "  npm install 完了。" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 4. HelloWorld ファイルを BabylonNative/Apps/ にコピー
# ---------------------------------------------------------------
Write-Step "HelloWorld アプリファイルのコピー"
if (-not (Test-Path $AppDest)) {
    New-Item -ItemType Directory -Path $AppDest | Out-Null
}
Copy-Item -Path "$AppSrc\*" -Destination $AppDest -Recurse -Force
Write-Host "  $AppSrc  ->  $AppDest" -ForegroundColor Green

# ---------------------------------------------------------------
# 5. Apps/CMakeLists.txt に HelloWorld を追加
# ---------------------------------------------------------------
Write-Step "Apps/CMakeLists.txt のパッチ"
if (-not (Test-Path $AppsCMake)) {
    Write-Error "Apps/CMakeLists.txt が見つかりません: $AppsCMake"
}
$cmakeContent = Get-Content $AppsCMake -Raw
$entry = @"

if(WIN32 AND NOT WINDOWS_STORE)
    add_subdirectory(HelloWorld)
endif()
"@
if ($cmakeContent -match "add_subdirectory\(HelloWorld\)") {
    Write-Host "  HelloWorld は既に登録されています。スキップします。" -ForegroundColor Yellow
} else {
    # ファイル末尾に追記
    Add-Content -Path $AppsCMake -Value $entry
    Write-Host "  Apps/CMakeLists.txt に HelloWorld を追加しました。" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 6. CMake でビルドシステムを生成
# ---------------------------------------------------------------
Write-Step "CMake ビルドシステムの生成"
if ($SkipCMake) {
    Write-Host "  -SkipCMake が指定されたためスキップします。" -ForegroundColor Yellow
} else {
    # 日本語 Windows (CP932) 環境でのビルドエラー対策:
    # BabylonNative のソースは UTF-8 だが MSVC のデフォルトコードページが CP932 のため
    # C4819 警告 -> /WX でエラー昇格する。/utf-8 で解決する。
    # VS デフォルトフラグ (/DWIN32 /D_WINDOWS /W3 /GR /EHsc) に /utf-8 を追加して渡す。
    $cxxFlags = "/DWIN32 /D_WINDOWS /W3 /GR /EHsc /utf-8"
    $cFlags   = "/DWIN32 /D_WINDOWS /W3 /utf-8"
    Write-Host "  $cmakeCmd -B $BuildDir $BabylonDir" -ForegroundColor Gray
    & $cmakeCmd -B $BuildDir $BabylonDir `
        "-DCMAKE_CXX_FLAGS=$cxxFlags" `
        "-DCMAKE_C_FLAGS=$cFlags"
    if ($LASTEXITCODE -ne 0) { Write-Error "CMake の生成に失敗しました。" }
    Write-Host "  CMake 完了。" -ForegroundColor Green
}

# ---------------------------------------------------------------
# 7. 完了メッセージ
# ---------------------------------------------------------------
Write-Host @"

======================================================
  セットアップ完了!
======================================================

Visual Studio でビルドして実行:
  start "$BuildDir\BabylonNative.sln"
  -> ソリューションを開き HelloWorld をスタートアップに設定してビルド

コマンドラインでビルド:
  cmake --build "$BuildDir" --config Debug --target HelloWorld

実行ファイルの場所:
  $BuildDir\Apps\HelloWorld\Debug\HelloWorld.exe

ソースファイル:
  App\Scripts\hello_world.js  <- Babylon.js シーン (ここを編集)
  App\Win32\main.cpp          <- Win32 ホストアプリ
  App\CMakeLists.txt          <- CMake 設定

app:///Scripts/ は実行ファイルと同じディレクトリの Scripts/ に対応します。
"@ -ForegroundColor Cyan
