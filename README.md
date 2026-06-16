# Babylon Native - Win32 Hello World

[Babylon Native](https://github.com/BabylonJS/BabylonNative) を使った Win32 デスクトップアプリのサンプルです。  
青いボックスが回転するシンプルな 3D シーンを D3D11 で描画します。

## 構成

```
App/
├── Win32/main.cpp          Win32 ホストアプリ (C++)
├── Scripts/hello_world.js  Babylon.js シーン (JavaScript)
└── CMakeLists.txt          ビルド設定
setup.ps1                   セットアップスクリプト
```

## セットアップ

**前提条件**

- Visual Studio 2022 以降（C++ デスクトップ開発ワークロード）
- Git / Node.js (npm)

**手順**

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1
```

スクリプトが以下を自動実行します：

1. BabylonNative リポジトリをサブモジュールごとクローン（約 1〜3 GB）
2. `npm install` で Babylon.js パッケージを取得
3. `App/` を `BabylonNative/Apps/HelloWorld/` にコピー
4. CMake でビルドシステムを生成

## ビルドと実行

```powershell
# Debug
cmake --build BabylonNative\build\win32 --config Debug --target HelloWorld

# Release
cmake --build BabylonNative\build\win32 --config Release --target HelloWorld
```

実行ファイル：

```
BabylonNative\build\win32\Apps\HelloWorld\Debug\HelloWorld.exe
BabylonNative\build\win32\Apps\HelloWorld\Release\HelloWorld.exe
```

## シーンのカスタマイズ

[App/Scripts/hello_world.js](App/Scripts/hello_world.js) を編集してビルドし直すだけでシーンを変更できます。  
`app:///Scripts/` は実行ファイルと同じディレクトリの `Scripts/` フォルダに対応しています。

## 仕組み

| クラス | 役割 |
|---|---|
| `Babylon::Embedding::Runtime` | JavaScript エンジン (Chakra) を管理するプロセス単位のオブジェクト |
| `Babylon::Embedding::View` | Win32 HWND にアタッチして D3D11 でレンダリング |

JavaScript 側では `new BABYLON.NativeEngine()` を使い、通常の Babylon.js と同じ API でシーンを構築できます。
