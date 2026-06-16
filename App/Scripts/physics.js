// =============================================================
// Physics sample: colorful boxes falling on a floor
// Uses Cannon.js (pure JS) + BABYLON.PhysicsImpostor (Physics v1)
// Compatible with both Chakra and V8 builds.
// =============================================================

const _t0 = Date.now();
function perfLog(label) {
    BABYLON.Tools.Log("[PERF JS] " + (Date.now() - _t0) + " ms  " + label);
}

const BOX_COUNT = 150;
const PALETTE = [
    new BABYLON.Color3(1.00, 0.42, 0.42),  // coral red
    new BABYLON.Color3(0.31, 0.80, 0.77),  // teal
    new BABYLON.Color3(1.00, 0.90, 0.27),  // golden yellow
    new BABYLON.Color3(0.61, 0.36, 0.90),  // purple
    new BABYLON.Color3(0.97, 0.50, 0.00),  // orange
    new BABYLON.Color3(0.26, 0.38, 0.93),  // blue
    new BABYLON.Color3(0.18, 0.78, 0.33),  // green
    new BABYLON.Color3(0.97, 0.15, 0.52),  // pink
];

perfLog("Script start");

const engine = new BABYLON.NativeEngine();
perfLog("NativeEngine created");

const scene = createScene();
perfLog("createScene() returned");

engine.runRenderLoop(function () {
    scene.render();
});

// =============================================================

function createScene() {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.12, 1.0);

    // Camera
    const camera = new BABYLON.ArcRotateCamera(
        "cam", -Math.PI / 4, Math.PI / 3.5, 40,
        new BABYLON.Vector3(0, 3, 0), scene
    );
    camera.attachControl(true);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 100;
    camera.lowerBetaLimit   = 0.1;
    camera.upperBetaLimit   = Math.PI / 2 - 0.05;
    camera.wheelPrecision   = 3;

    // Lights
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.5;
    hemi.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-1, -2, -1), scene);
    dir.intensity = 0.8;
    dir.diffuse   = new BABYLON.Color3(1.0, 0.95, 0.85);

    // Physics engine (Cannon.js)
    scene.enablePhysics(
        new BABYLON.Vector3(0, -9.81, 0),
        new BABYLON.CannonJSPlugin(true, 10, CANNON)
    );
    perfLog("Physics enabled (Cannon.js)");

    // Floor (static)
    const ground = BABYLON.MeshBuilder.CreateBox(
        "ground", { width: 40, height: 0.5, depth: 40 }, scene
    );
    ground.position.y = -0.25;
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor  = new BABYLON.Color3(0.22, 0.22, 0.28);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMat;
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
        ground, BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.4, friction: 0.8 },
        scene
    );

    // Colorful boxes dropped from random heights
    for (var i = 0; i < BOX_COUNT; i++) {
        var w = 0.5 + Math.random() * 1.0;
        var h = 0.5 + Math.random() * 1.2;
        var d = 0.5 + Math.random() * 1.0;

        var box = BABYLON.MeshBuilder.CreateBox("box" + i, { width: w, height: h, depth: d }, scene);

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
        mat.diffuseColor  = PALETTE[i % PALETTE.length];
        mat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        mat.specularPower = 32;
        box.material = mat;

        box.physicsImpostor = new BABYLON.PhysicsImpostor(
            box, BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 1.0, restitution: 0.35, friction: 0.7 },
            scene
        );
    }
    perfLog("Boxes created: " + BOX_COUNT);

    var firstFrame = true;
    scene.registerAfterRender(function() {
        if (firstFrame) {
            perfLog("First frame rendered");
            firstFrame = false;
        }
    });

    return scene;
}
