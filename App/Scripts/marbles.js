// =============================================================
// Marbles — Babylon Native port
// Original: webgl-physics-examples/examples/babylonjs/havok/marbles/index.js
//
// Changes from the browser version:
//   - new BABYLON.NativeEngine() instead of new BABYLON.Engine(canvas)
//   - camera.attachControl(true) — no canvas argument needed
//   - HavokPhysics loaded from base64-embedded WASM (no network fetch)
//   - WebAssembly.instantiate patched to synchronous for V8 embedding
//   - NativeEngine started before HavokPhysics() to pump the event loop
//   - window / document / DOM APIs removed
// =============================================================

var _t0 = Date.now();
function perfLog(label) {
    BABYLON.Tools.Log("[PERF JS] " + (Date.now() - _t0) + " ms  " + label);
}

var PHYSICS_SCALE = 1 / 10;

// Physics debug wireframe (matches original demo). Default ON.
var showWireframe = true;
var physicsViewer = null;
var trackedBodies = [];

perfLog("Script start");

// Show a green wireframe of each physics shape via BABYLON.Debug.PhysicsViewer.
// Bodies are created asynchronously (after GLTF load), so poll scene.meshes
// each frame and register any new physicsBody exactly once.
function setupPhysicsDebugWireframe(scene) {
    if (!BABYLON.Debug || !BABYLON.Debug.PhysicsViewer) {
        BABYLON.Tools.Warn("[Marbles] PhysicsViewer not available; wireframe disabled");
        return;
    }

    physicsViewer = new BABYLON.Debug.PhysicsViewer(scene);
    var seenBodies = new WeakSet();

    scene.registerBeforeRender(function () {
        scene.meshes.forEach(function (mesh) {
            if (!mesh) {
                return;
            }
            if (mesh.physicsBody && !seenBodies.has(mesh.physicsBody) && physicsViewer.showBody) {
                seenBodies.add(mesh.physicsBody);
                trackedBodies.push(mesh.physicsBody);
                if (showWireframe) {
                    physicsViewer.showBody(mesh.physicsBody);
                }
            }
        });
    });
}

// Show/hide the physics wireframe for all tracked bodies.
function setWireframeVisible(visible) {
    if (showWireframe === visible) {
        return;
    }
    showWireframe = visible;
    if (physicsViewer) {
        trackedBodies.forEach(function (body) {
            if (visible) {
                physicsViewer.showBody(body);
            } else {
                physicsViewer.hideBody(body);
            }
        });
    }
    BABYLON.Tools.Log("[Marbles] wireframe " + (visible ? "ON" : "OFF"));
}

// Exposed for the C++ host: Babylon Native has no DOM keydown, so the Win32
// host forwards the 'W' key via Runtime::Eval to toggle the wireframe.
globalThis.toggleWireframe = function () {
    setWireframeVisible(!showWireframe);
};

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

    // Start NativeEngine + placeholder scene first so the render loop
    // pumps the event loop, allowing the HavokPhysics Promise to resolve.
    var engine = new BABYLON.NativeEngine();
    perfLog("NativeEngine created");

    var activeScene = new BABYLON.Scene(engine);
    activeScene.clearColor = new BABYLON.Color4(0.0, 0.0, 0.0, 1.0);
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

    // Patch WebAssembly.instantiate to use the synchronous API.
    // In Babylon Native V8, background WASM compilation Promises do not
    // resolve because the microtask queue is only drained at render frame
    // boundaries. Using new WebAssembly.Module() + Instance() synchronously
    // and wrapping in Promise.resolve() lets the .then() fire on the next frame.
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
        perfLog("Marbles scene created");
    }).catch(function (err) {
        BABYLON.Tools.Error("[Havok] Init failed: " + err);
    });
}

// -------------------------------------------------------

function createScene(engine, havok) {
    var scene = new BABYLON.Scene(engine);

    // Physics v2
    var hk = new BABYLON.HavokPlugin(true, havok);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.8, 0), hk);
    perfLog("HavokPlugin enabled");

    setupPhysicsDebugWireframe(scene);

    // Three-camera split viewport (matches original browser demo)
    var camera1 = new BABYLON.ArcRotateCamera("camera1", 0, Math.PI / 180 * 60, 30, BABYLON.Vector3.Zero(), scene);
    camera1.setTarget(BABYLON.Vector3.Zero());
    camera1.attachControl(true);

    var camera2 = new BABYLON.ArcRotateCamera("camera2", 0, 1, 10, BABYLON.Vector3.Zero(), scene);
    var camera3 = new BABYLON.ArcRotateCamera("camera3", 0, 1, 10, BABYLON.Vector3.Zero(), scene);

    camera1.viewport = new BABYLON.Viewport(0.4, 0.0, 0.6, 1.0); // right 60%
    camera2.viewport = new BABYLON.Viewport(0.0, 0.0, 0.4, 0.5); // bottom-left 40x50%
    camera3.viewport = new BABYLON.Viewport(0.0, 0.5, 0.4, 0.5); // top-left 40x50%
    scene.activeCameras.push(camera1);
    scene.activeCameras.push(camera2);
    scene.activeCameras.push(camera3);

    // Environment texture + skybox
    var cubeTexture = new BABYLON.CubeTexture("app:///Scripts/textures/papermillSpecularHDR.env", scene);
    scene.createDefaultSkybox(cubeTexture, true);

    // Lights
    new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);

    var light2 = new BABYLON.DirectionalLight("light2", new BABYLON.Vector3(0, 1, 0), scene);
    light2.position = new BABYLON.Vector3(4, 4, 0);
    light2.setDirectionToTarget(BABYLON.Vector3.Zero());
    light2.intensity = 3;
    var shadow = new BABYLON.ShadowGenerator(512, light2);

    // Ground (PBR + grass texture)
    var matGround = new BABYLON.PBRMetallicRoughnessMaterial("ground", scene);
    var grassTex = new BABYLON.Texture("app:///Scripts/textures/grass.jpg", scene);
    grassTex.uScale = grassTex.vScale = 2;
    matGround.baseTexture = grassTex;

    var ground = BABYLON.MeshBuilder.CreateBox("ground", { size: 400 * PHYSICS_SCALE }, scene);
    ground.position.y = -15 * PHYSICS_SCALE;
    ground.scaling.y = 0.01;
    ground.material = matGround;
    ground.receiveShadows = true;
    new BABYLON.PhysicsAggregate(
        ground, BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.2, restitution: 0.3 }, scene
    );

    // Load GLTF sphere model
    var sphereMeshes = [];
    var cameraTarget = null;

    BABYLON.SceneLoader.ImportMeshAsync(null, "app:///Scripts/models/IridescenceMetallicSpheres/glTF/", "IridescenceMetallicSpheres.gltf", scene)
        .then(function (result) {
            perfLog("GLTF loaded: " + result.meshes.length + " meshes");

            // Hide label planes
            result.meshes.forEach(function (m) {
                if (m.name.lastIndexOf("Plane") !== -1) {
                    m.isVisible = false;
                }
            });

            // Add physics to sphere meshes
            sphereMeshes = result.meshes.filter(function (m) {
                return m.name.indexOf("Sphere") !== -1;
            });

            sphereMeshes.forEach(function (mesh) {
                shadow.addShadowCaster(mesh, true);
                mesh.position.x += Math.random();
                mesh.position.z += Math.random();
                mesh.parent = null;
                mesh.aggregate = new BABYLON.PhysicsAggregate(
                    mesh, BABYLON.PhysicsShapeType.SPHERE,
                    { mass: 1, friction: 0.1, restitution: 0.3 }, scene
                );
            });

            if (sphereMeshes.length > 0) {
                cameraTarget = sphereMeshes[0];
                cameraTarget.showBoundingBox = true;
                camera2.parent = cameraTarget;
            }

            perfLog("Spheres ready: " + sphereMeshes.length);
        })
        .catch(function (err) {
            BABYLON.Tools.Error("[Marbles] GLTF load failed: " + err);
            // Fallback to primitive spheres if GLTF loading fails
            createFallbackSpheres(scene, shadow, sphereMeshes, function (target) {
                cameraTarget = target;
                cameraTarget.showBoundingBox = true;
                camera2.parent = cameraTarget;
            }, havok);
        });

    var randomNumber = function (min, max) {
        if (min === max) return min;
        return Math.random() * (max - min) + min;
    };
    var getNextPosition = function (y) {
        return new BABYLON.Vector3(
            randomNumber(-50, 50) * PHYSICS_SCALE,
            (randomNumber(0, 200) + y) * PHYSICS_SCALE,
            randomNumber(-50, 50) * PHYSICS_SCALE
        );
    };

    // Respawn fallen spheres from above + rotate main camera
    scene.onBeforeRenderObservable.add(function () {
        sphereMeshes.forEach(function (mesh) {
            if (mesh.aggregate && mesh.position.y < -100 * PHYSICS_SCALE) {
                var body = mesh.aggregate.body;
                var pos = getNextPosition(200);
                body.disablePreStep = false;
                body.transformNode.position.set(pos.x, pos.y, pos.z);
                body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
                body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
            }
        });
        camera1.alpha -= 0.005 * scene.getAnimationRatio();
        if (cameraTarget) {
            camera3.setPosition(cameraTarget.position);
        }
    });

    var firstFrame = true;
    scene.registerAfterRender(function () {
        if (firstFrame) {
            perfLog("First frame rendered");
            firstFrame = false;
        }
    });

    return scene;
}

// Fallback: primitive PBR spheres used when GLTF loading fails
function createFallbackSpheres(scene, shadow, sphereMeshes, onReady, havok) {
    perfLog("Fallback: creating primitive spheres");
    var colors = [
        new BABYLON.Color3(1, 0.2, 0.2), new BABYLON.Color3(0.2, 0.6, 1),
        new BABYLON.Color3(1, 0.9, 0.1), new BABYLON.Color3(0.4, 0.9, 0.4),
        new BABYLON.Color3(1, 0.5, 0.0), new BABYLON.Color3(0.8, 0.2, 0.9),
    ];
    for (var i = 0; i < 18; i++) {
        var sphere = BABYLON.MeshBuilder.CreateSphere("sphere" + i, { diameter: 1.0 }, scene);
        sphere.position = new BABYLON.Vector3(
            (Math.random() - 0.5) * 20,
            4 + Math.random() * 30,
            (Math.random() - 0.5) * 20
        );
        var mat = new BABYLON.PBRMetallicRoughnessMaterial("smat" + i, scene);
        mat.baseColor = colors[i % colors.length];
        mat.metallic = 0.9;
        mat.roughness = 0.1;
        sphere.material = mat;
        shadow.addShadowCaster(sphere, true);
        sphere.parent = null;
        sphere.aggregate = new BABYLON.PhysicsAggregate(
            sphere, BABYLON.PhysicsShapeType.SPHERE,
            { mass: 1, friction: 0.1, restitution: 0.3 }, scene
        );
        sphereMeshes.push(sphere);
    }
    if (sphereMeshes.length > 0) {
        onReady(sphereMeshes[0]);
    }
    perfLog("Fallback spheres ready: " + sphereMeshes.length);
}
