/// <reference path="../../node_modules/babylonjs/babylon.module.d.ts" />

const engine = new BABYLON.NativeEngine();
const scene = new BABYLON.Scene(engine);

// Orbit camera
const camera = new BABYLON.ArcRotateCamera(
    "camera", -Math.PI / 2, Math.PI / 4, 5, BABYLON.Vector3.Zero(), scene);

// Soft ambient light
const light = new BABYLON.HemisphericLight(
    "light", new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.8;

// A rotating box
const box = BABYLON.MeshBuilder.CreateBox("box", { size: 1.5 }, scene);
const mat = new BABYLON.StandardMaterial("mat", scene);
mat.diffuseColor  = new BABYLON.Color3(0.2, 0.5, 1.0);
mat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
box.material = mat;

BABYLON.Tools.Log("Hello, Babylon Native on Win32!");

engine.runRenderLoop(function () {
    box.rotation.y += 0.01;
    scene.render();
});
