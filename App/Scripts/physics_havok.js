// =============================================================
// 物理演算サンプル (Physics v2 / Havok) - V8 ビルド向け
// NativeEngine を先に起動してイベントループを回し、
// HavokPhysics の Promise を解決させる
// =============================================================

var _t0 = Date.now();
function perfLog(label) {
    BABYLON.Tools.Log("[PERF JS] " + (Date.now() - _t0) + " ms  " + label);
}

var BOX_COUNT = 150;
var PALETTE = [
    new BABYLON.Color3(1.00, 0.42, 0.42),
    new BABYLON.Color3(0.31, 0.80, 0.77),
    new BABYLON.Color3(1.00, 0.90, 0.27),
    new BABYLON.Color3(0.61, 0.36, 0.90),
    new BABYLON.Color3(0.97, 0.50, 0.00),
    new BABYLON.Color3(0.26, 0.38, 0.93),
    new BABYLON.Color3(0.18, 0.78, 0.33),
    new BABYLON.Color3(0.97, 0.15, 0.52),
];

perfLog("Script start");

// -------------------------------------------------------
// base64 → ArrayBuffer
// -------------------------------------------------------
function base64ToArrayBuffer(b64) {
    var binaryString = atob(b64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

if (typeof WebAssembly === "undefined") {
    BABYLON.Tools.Error("[Havok] WebAssembly is NOT available");
} else {
    perfLog("WebAssembly available - decoding WASM from base64...");
    var wasmBuffer = base64ToArrayBuffer(HAVOK_WASM_BASE64);
    perfLog("WASM decoded (" + Math.round(wasmBuffer.byteLength / 1024) + " KB)");

    // -------------------------------------------------------
    // NativeEngine + プレースホルダーシーンを先に起動
    // → レンダーループが回ることで Havok Promise が解決できる
    // -------------------------------------------------------
    var engine = new BABYLON.NativeEngine();
    perfLog("NativeEngine created");

    var activeScene = new BABYLON.Scene(engine);
    activeScene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.12, 1.0);
    new BABYLON.FreeCamera("_initCam", new BABYLON.Vector3(0, 0, -1), activeScene);

    var physicsScene = null;

    engine.runRenderLoop(function () {
        if (physicsScene) {
            physicsScene.render();
        } else {
            activeScene.render();
        }
    });
    perfLog("Render loop started - waiting for Havok init...");

    // WebAssembly.instantiate を同期版にパッチ
    // Babylon Native の V8 ではバックグラウンドコンパイルの Promise が
    // 解決されないため、同期 API (new WebAssembly.Module / Instance) に置き換える
    (function () {
        var orig = WebAssembly.instantiate;
        WebAssembly.instantiate = function (source, imports) {
            try {
                var mod = (source instanceof WebAssembly.Module)
                    ? source
                    : new WebAssembly.Module(source);
                var inst = new WebAssembly.Instance(mod, imports);
                perfLog("WebAssembly sync instantiate OK");
                return Promise.resolve({ module: mod, instance: inst });
            } catch (e) {
                perfLog("WebAssembly sync instantiate failed, fallback: " + e);
                return orig.call(WebAssembly, source, imports);
            }
        };
    })();

    HavokPhysics({
        wasmBinary: wasmBuffer,
        locateFile: function (path) { return "app:///Scripts/" + path; }
    }).then(function (havok) {
        perfLog("Havok engine initialized");
        physicsScene = createScene(engine, havok);
        activeScene.dispose();
        perfLog("Physics scene created - rendering started");
    }).catch(function (err) {
        BABYLON.Tools.Error("[Havok] Init failed: " + err);
    });
}

// -------------------------------------------------------

function createScene(engine, havok) {
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.12, 1.0);

    // カメラ
    var camera = new BABYLON.ArcRotateCamera(
        "cam", -Math.PI / 4, Math.PI / 3.5, 40,
        new BABYLON.Vector3(0, 3, 0), scene
    );
    camera.attachControl(true);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 100;
    camera.wheelPrecision = 3;

    // ライト
    var hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.5;
    hemi.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    var dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1, -2, -1), scene);
    dir.intensity = 0.8;
    dir.diffuse = new BABYLON.Color3(1.0, 0.95, 0.85);

    // Physics v2: HavokPlugin
    var hk = new BABYLON.HavokPlugin(true, havok);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), hk);
    perfLog("Physics v2 (HavokPlugin) enabled");

    // 床 (static, mass=0)
    var ground = BABYLON.MeshBuilder.CreateBox(
        "ground", { width: 40, height: 0.5, depth: 40 }, scene
    );
    ground.position.y = -0.25;
    var groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.22, 0.22, 0.28);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;
    new BABYLON.PhysicsAggregate(
        ground, BABYLON.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.4, friction: 0.8 },
        scene
    );

    // カラフルなボックス (dynamic, mass=1)
    for (var i = 0; i < BOX_COUNT; i++) {
        var w = 0.5 + Math.random() * 1.0;
        var h = 0.5 + Math.random() * 1.2;
        var d = 0.5 + Math.random() * 1.0;

        var box = BABYLON.MeshBuilder.CreateBox(
            "box" + i, { width: w, height: h, depth: d }, scene
        );
        box.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 28,
            4 + Math.random() * 40,
            (Math.random() - 0.5) * 28
        );
        box.rotation = new BABYLON.Vector3(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        var mat = new BABYLON.StandardMaterial("mat" + i, scene);
        mat.diffuseColor = PALETTE[i % PALETTE.length];
        mat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        mat.specularPower = 32;
        box.material = mat;

        new BABYLON.PhysicsAggregate(
            box, BABYLON.PhysicsShapeType.BOX,
            { mass: 1.0, restitution: 0.35, friction: 0.7 },
            scene
        );
    }
    perfLog("Boxes created: " + BOX_COUNT);

    var firstFrame = true;
    scene.registerAfterRender(function () {
        if (firstFrame) {
            perfLog("First physics frame rendered");
            firstFrame = false;
        }
    });

    return scene;
}
