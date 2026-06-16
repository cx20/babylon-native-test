# babylon-native-test

A collection of [Babylon Native](https://github.com/BabylonJS/BabylonNative) samples running on Win32, including physics simulations and raymarching shaders.

## Features

- **Marbles** — Port of [webgl-physics-examples/marbles](https://github.com/cx20/webgl-physics-examples). Iridescent GLTF spheres simulated with Havok Physics v2, rendered with a 3-camera split viewport and PBR materials.
- **Physics v2 (Havok)** — 150 colorful boxes falling with Havok Physics v2. Requires the V8 build (WASM SIMD).
- **Physics v1 (Cannon.js)** — 150 colorful boxes falling with Cannon.js (pure JS). Works with both Chakra and V8 builds.
- **Raymarching** — Enhanced organic life-form shader ported from the Babylon.js Playground.

## Prerequisites

- **Windows 10/11** (x64)
- **Visual Studio 2022** with "Desktop development with C++" workload
- **CMake 3.18+** (bundled with Visual Studio is fine)
- **Git** with long path support recommended
- **Node.js 18+** and **npm**

## Setup

```powershell
# Clone this repository
git clone https://github.com/cx20/babylon-native-test.git
cd babylon-native-test

# Run the setup script (clones BabylonNative, installs npm packages, runs CMake)
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup.ps1
```

The script performs the following steps:
1. Verifies prerequisites (git, node, npm, Visual Studio)
2. Clones `BabylonJS/BabylonNative` with submodules (~1–3 GB)
3. Runs `npm install` to fetch Babylon.js bundles (babylonjs, babylonjs-gui, babylonjs-loaders, @babylonjs/havok, cannon)
4. Copies the `App/` folder into `BabylonNative/Apps/HelloWorld/`
5. Patches `BabylonNative/Apps/CMakeLists.txt` to include HelloWorld
6. Runs `cmake -B BabylonNative/build/win32 BabylonNative`

### Skip flags

| Flag | Description |
|---|---|
| `-SkipClone` | Skip `git clone` if BabylonNative is already present |
| `-SkipNpm` | Skip `npm install` |
| `-SkipCMake` | Skip CMake generation (only copy files) |

## Build (default — Chakra JS engine)

```powershell
cmake --build BabylonNative\build\win32 --config Debug --target HelloWorld
```

Or open `BabylonNative\build\win32\BabylonNative.sln` in Visual Studio, set **HelloWorld** as the startup project, and build.

Executable: `BabylonNative\build\win32\Apps\HelloWorld\Debug\HelloWorld.exe`

> **Note:** The Marbles and Havok Physics v2 samples require the V8 build (see below). The Chakra build supports Physics v1 (Cannon.js) and Raymarching.

## Build (V8 JS engine — required for Havok Physics / WASM)

Havok Physics v2 uses WebAssembly SIMD, which is only supported in the V8 build.

### 1. Generate the V8 build

```powershell
cmake -B BabylonNative\build\win32_v8 BabylonNative `
    -DNAPI_JAVASCRIPT_ENGINE=V8
cmake --build BabylonNative\build\win32_v8 --config Debug --target HelloWorld
```

### 2. Copy V8 runtime DLLs

After building, copy the V8 DLLs from NuGet into the output directory.
NuGet packages are downloaded automatically during the CMake build; find them in the NuGet cache:

```
%USERPROFILE%\.nuget\packages\bcg.v8.redist.win-x64\<version>\runtimes\win-x64\native\
```

Copy the following files next to the executable (`build\win32_v8\Apps\HelloWorld\Debug\`):

| File | Approx. size |
|---|---|
| `v8.dll` | ~24 MB |
| `v8_libbase.dll` | ~2 MB |
| `v8_libplatform.dll` | ~500 KB |
| `icudt*.dll` (ICU data) | ~27 MB |
| `zlib.dll` | ~100 KB |

### 3. Run

```
BabylonNative\build\win32_v8\Apps\HelloWorld\Debug\HelloWorld.exe
```

## Scene switching

Open [App/Win32/main.cpp](App/Win32/main.cpp) and enable only one block at a time in `LoadScripts()`:

```cpp
// [A] Marbles (Havok Physics v2 + GLTF spheres) — currently active
g_runtime->LoadScript("app:///Scripts/babylonjs.loaders.js");
g_runtime->LoadScript("app:///Scripts/HavokPhysics_compat.js");
g_runtime->LoadScript("app:///Scripts/HavokPhysics_wasm_b64.js");
g_runtime->LoadScript("app:///Scripts/marbles.js");

// [B] Physics v2 (Havok) — colorful box drop
// g_runtime->LoadScript("app:///Scripts/HavokPhysics_compat.js");
// g_runtime->LoadScript("app:///Scripts/HavokPhysics_wasm_b64.js");
// g_runtime->LoadScript("app:///Scripts/physics_havok.js");

// [C] Physics v1 (Cannon.js) — colorful box drop
// g_runtime->LoadScript("app:///Scripts/cannon.js");
// g_runtime->LoadScript("app:///Scripts/physics.js");

// [D] Raymarching — organic life-form shader
// g_runtime->LoadScript("app:///Scripts/raymarching.js");
```

After editing, rebuild and run.

## Directory structure

```
babylon-native-test/
├── setup.ps1                  # Setup script
├── App/
│   ├── CMakeLists.txt         # CMake configuration for HelloWorld
│   ├── Win32/
│   │   └── main.cpp           # Win32 host application
│   └── Scripts/
│       ├── hello_world.js     # Simple "Hello World" scene
│       ├── raymarching.js     # Organic life-form raymarching shader
│       ├── physics.js         # Physics v1 — Cannon.js box drop
│       ├── physics_havok.js   # Physics v2 — Havok box drop (V8 only)
│       ├── marbles.js         # Marbles scene (V8 only)
│       ├── HavokPhysics_compat.js    # Patched Havok UMD bundle
│       ├── HavokPhysics_wasm_b64.js  # WASM binary embedded as base64
│       ├── textures/
│       │   ├── environment.env
│       │   ├── papermillSpecularHDR.env
│       │   └── grass.jpg
│       └── models/
│           └── IridescenceMetallicSpheres/
│               └── glTF/
│                   ├── IridescenceMetallicSpheres.gltf
│                   ├── IridescenceMetallicSpheres.bin
│                   └── textures/
│                       └── guides.png
└── BabylonNative/             # Cloned by setup.ps1 (not committed)
```

## Babylon Native compatibility notes

The following changes were required when porting browser-based Babylon.js code to Babylon Native:

### Engine creation
```js
// Browser
const engine = new BABYLON.Engine(canvas);
// Babylon Native
const engine = new BABYLON.NativeEngine();
```

### Camera input
```js
// Browser
camera.attachControl(canvas, true);
// Babylon Native (no canvas argument)
camera.attachControl(true);
```

### Havok Physics / WebAssembly (V8 build only)

Havok Physics v2 uses WebAssembly SIMD and only works in the V8 build. Two additional issues arise in Babylon Native's V8 embedding:

1. **`TextDecoder` encoding** — Babylon Native's C++ polyfill overrides V8's built-in and only supports UTF-8. `new TextDecoder("utf-16le")` throws. Fixed with a try-catch wrapper in `HavokPhysics_compat.js`.

2. **`WebAssembly.instantiate` Promise never resolves** — Microtasks are drained at render frame boundaries, so background WASM compilation Promises get stuck if the render loop hasn't started yet. Two fixes applied in `marbles.js` and `physics_havok.js`:
   - Start `NativeEngine` and `runRenderLoop` *before* calling `HavokPhysics()`.
   - Patch `WebAssembly.instantiate` to use the synchronous `new WebAssembly.Module()` + `new WebAssembly.Instance()` API, then wrap the result in `Promise.resolve()`.

## License

MIT
