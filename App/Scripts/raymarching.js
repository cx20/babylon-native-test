// ===================================================================
// Enhanced Organic Life-Form Raymarching  (Babylon Native 版)
//
// Playground 版からの変更点:
//   - engine を new BABYLON.NativeEngine() で生成
//   - camera.attachControl(canvas, true) -> attachControl(true)
//   - scene.clearColor を Color4 に変更
//   - export default を削除し engine.runRenderLoop を追加
// ===================================================================

const engine = new BABYLON.NativeEngine();
const scene = createScene();

engine.runRenderLoop(function () {
    scene.render();
});

function createScene() {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.0, 0.0, 0.0, 1.0);

    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2.5, Math.PI / 2.2, 7.0, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(true); // Babylon Native: canvas 引数は不要
    camera.minZ = 0.1;
    camera.wheelPrecision = 50;

    const autoRotate = new BABYLON.AutoRotationBehavior();
    autoRotate.idleRotationSpeed = 0.04;
    camera.addBehavior(autoRotate);

    const hdrTexture = new BABYLON.CubeTexture("https://assets.babylonjs.com/textures/environment.env", scene);
    scene.environmentTexture = hdrTexture;
    scene.environmentIntensity = 0.5;
    scene.createDefaultSkybox(hdrTexture, true, 1000, 0.25);

    const box = BABYLON.MeshBuilder.CreateBox("box", { size: 10.0 }, scene);
    const material = createEnhancedOrganicMaterial(scene);
    box.material = material;

    // FPS オーバーレイ
    const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    const fpsText = new BABYLON.GUI.TextBlock("fps");
    fpsText.text = "FPS: --";
    fpsText.color = "white";
    fpsText.fontSize = 20;
    fpsText.fontFamily = "monospace";
    fpsText.shadowColor = "black";
    fpsText.shadowBlur = 4;
    fpsText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    fpsText.verticalAlignment   = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    fpsText.left = "12px";
    fpsText.top  = "12px";
    ui.addControl(fpsText);

    let time = 0;
    scene.registerBeforeRender(() => {
        time += 0.008;
        material.setFloat("time", time);
        material.setVector3("cameraPosition", camera.position);
        fpsText.text = "FPS: " + Math.round(engine.getFps());
    });

    return scene;
}

function createEnhancedOrganicMaterial(scene) {
    BABYLON.Effect.ShadersStore["bioVertexShader"] = `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 world;
        uniform mat4 worldViewProjection;
        varying vec3 vPosition;
        varying vec2 vUV;
        void main(void) {
            vec4 wp = world * vec4(position, 1.0);
            gl_Position = worldViewProjection * vec4(position, 1.0);
            vPosition = wp.xyz;
            vUV = uv;
        }
    `;

    BABYLON.Effect.ShadersStore["bioFragmentShader"] = `
        precision highp float;

        varying vec3 vPosition;
        varying vec2 vUV;

        uniform float time;
        uniform vec3 cameraPosition;
        uniform samplerCube envSampler;

        #define MAX_STEPS 150
        #define MAX_DIST 25.0
        #define SURF_DIST 0.003

        float hash(vec3 p) {
            p = fract(p * 0.3183099 + .1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                          mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                       mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                          mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
        }

        float fbm(vec3 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; ++i) {
                v += a * noise(p);
                p *= 2.0;
                a *= 0.5;
            }
            return v;
        }

        float sdSphere(vec3 p, float r) {
            return length(p) - r;
        }

        float sdEllipsoid(vec3 p, vec3 r) {
            float k0 = length(p / r);
            float k1 = length(p / (r * r));
            return k0 * (k0 - 1.0) / k1;
        }

        float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
            vec3 pa = p - a, ba = b - a;
            float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            return length(pa - ba * h) - r;
        }

        float smin(float a, float b, float k) {
            float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
            return mix(b, a, h) - k * h * (1.0 - h);
        }

        float getOrganicDist(vec3 p) {
            float t = time;

            float breathCycle = sin(t * 1.2) * 0.5 + 0.5;
            float breath = breathCycle * 0.15;

            float loop = fract(t * 0.9);
            float beat1 = smoothstep(0.0, 0.08, loop) * exp(-12.0 * loop);
            float beat2 = smoothstep(0.12, 0.22, loop) * exp(-9.0 * (loop - 0.12)) * 0.6;
            float heartbeat = (beat1 + beat2) * 0.2;

            float pulse = breath + heartbeat;

            vec3 q = p;
            q.x += sin(q.y * 1.3 + t * 0.3) * 0.35;
            q.z += cos(q.y * 1.1 + t * 0.25) * 0.4;
            q.y += sin(q.x * 0.7 + t * 0.2) * 0.25;

            float body = sdEllipsoid(q, vec3(1.6, 1.2, 1.4) + pulse);

            vec3 lobe1Pos = vec3(
                0.3 + sin(t * 0.4) * 0.15,
                1.0 + sin(t * 0.6) * 0.1,
                0.2
            );
            float lobe1 = sdSphere(q - lobe1Pos, 0.7 + pulse * 0.5);

            vec3 lobe2Pos = vec3(
                -1.0 + sin(t * 0.35) * 0.1,
                -0.2,
                0.5 + cos(t * 0.45) * 0.15
            );
            float lobe2 = sdEllipsoid(q - lobe2Pos, vec3(0.6, 0.5, 0.8) + pulse * 0.3);

            vec3 lobe3Pos = vec3(
                0.4,
                -1.1 + sin(t * 0.5) * 0.1,
                -0.3
            );
            float lobe3 = sdSphere(q - lobe3Pos, 0.55 + pulse * 0.4);

            float d = smin(body, lobe1, 0.8);
            d = smin(d, lobe2, 0.7);
            d = smin(d, lobe3, 0.6);

            vec3 t1a = vec3(1.2, 0.5, 0.0);
            vec3 t1b = vec3(
                2.8 + sin(t * 0.7) * 0.5,
                0.8 + sin(t * 1.1 + 1.0) * 0.4,
                0.3 + cos(t * 0.8) * 0.3
            );
            float tent1 = sdCapsule(q, t1a, t1b, 0.15 - smoothstep(0.0, 1.0, length(q - t1a) / 2.5) * 0.1);

            vec3 t2a = vec3(-0.5, -0.8, 0.8);
            vec3 t2b = vec3(
                -0.8 + sin(t * 0.6 + 2.0) * 0.4,
                -2.2 + sin(t * 0.9) * 0.3,
                1.6 + cos(t * 0.7 + 1.0) * 0.4
            );
            float tent2 = sdCapsule(q, t2a, t2b, 0.12 - smoothstep(0.0, 1.0, length(q - t2a) / 2.0) * 0.08);

            vec3 t3a = vec3(-0.3, 1.0, -0.6);
            vec3 t3b = vec3(
                -0.7 + sin(t * 0.8 + 3.0) * 0.3,
                2.0 + sin(t * 1.0) * 0.2,
                -1.2 + cos(t * 0.6 + 2.0) * 0.3
            );
            float tent3 = sdCapsule(q, t3a, t3b, 0.10 - smoothstep(0.0, 1.0, length(q - t3a) / 1.8) * 0.06);

            d = smin(d, tent1, 0.4);
            d = smin(d, tent2, 0.35);
            d = smin(d, tent3, 0.3);

            float surfTime = t * 0.15;
            float fleshNoise = fbm(p * 1.2 + vec3(surfTime));
            float distortion = (fleshNoise - 0.5) * 0.8;

            float veinNoise = fbm(p * 0.5 + vec3(0.0, t * 0.05, 0.0));
            float veins = 0.04 * sin(12.0 * (p.x + veinNoise * 0.8))
                               * sin(12.0 * (p.y + veinNoise * 0.6))
                               * sin(12.0 * (p.z + veinNoise * 0.7));

            float veinPulse = sin(t * 3.0 - length(p) * 4.0) * 0.5 + 0.5;
            float veinRidge = smoothstep(0.45, 0.5, fbm(p * 3.0)) * 0.06 * (1.0 + veinPulse * 0.5);

            return d + distortion + veins - veinRidge;
        }

        vec3 getNormal(vec3 p) {
            vec2 e = vec2(0.004, 0.0);
            return normalize(vec3(
                getOrganicDist(p + e.xyy) - getOrganicDist(p - e.xyy),
                getOrganicDist(p + e.yxy) - getOrganicDist(p - e.yxy),
                getOrganicDist(p + e.yyx) - getOrganicDist(p - e.yyx)
            ));
        }

        float rayMarch(vec3 ro, vec3 rd) {
            float dO = 0.0;
            for (int i = 0; i < MAX_STEPS; i++) {
                vec3 p = ro + rd * dO;
                float dS = getOrganicDist(p);
                dO += dS * 0.35;
                if (dS < SURF_DIST || dO > MAX_DIST) break;
            }
            return dO;
        }

        float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
            float res = 1.0;
            float t = mint;
            for (int i = 0; i < 32; i++) {
                float h = getOrganicDist(ro + rd * t);
                res = min(res, k * h / t);
                t += clamp(h, 0.02, 0.2);
                if (h < 0.001 || t > maxt) break;
            }
            return clamp(res, 0.0, 1.0);
        }

        float calcAO(vec3 pos, vec3 nor) {
            float occ = 0.0;
            float sca = 1.0;
            for (int i = 0; i < 5; i++) {
                float h = 0.01 + 0.12 * float(i);
                float d = getOrganicDist(pos + h * nor);
                occ += (h - d) * sca;
                sca *= 0.95;
            }
            return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
        }

        vec3 calculateBioLighting(vec3 p, vec3 n, vec3 rd) {
            float t = time;

            float nVal = fbm(p * 1.5);
            float nVal2 = fbm(p * 3.0 + vec3(10.0));

            vec3 cDeep    = vec3(0.25, 0.02, 0.04);
            vec3 cFlesh   = vec3(0.75, 0.35, 0.30);
            vec3 cPink    = vec3(0.90, 0.55, 0.50);
            vec3 cVein    = vec3(0.20, 0.05, 0.25);
            vec3 cArtery  = vec3(0.70, 0.10, 0.08);

            vec3 albedo = mix(cDeep, cFlesh, smoothstep(0.3, 0.6, nVal));
            albedo = mix(albedo, cPink, smoothstep(0.55, 0.8, nVal) * 0.6);

            float veinPattern = smoothstep(0.45, 0.5, fbm(p * 3.0));
            float veinPulse = sin(t * 3.0 - length(p) * 4.0) * 0.5 + 0.5;
            vec3 veinColor = mix(cVein, cArtery, veinPulse);
            albedo = mix(albedo, veinColor, veinPattern * 0.7);

            float cavity = smoothstep(0.2, 0.0, nVal2);
            albedo = mix(albedo, cDeep, cavity * 0.5);

            vec3 lightPos1 = vec3(5.0, 5.0, -5.0);
            vec3 lightPos2 = vec3(-3.0, 2.0, 4.0);
            vec3 L1 = normalize(lightPos1 - p);
            vec3 L2 = normalize(lightPos2 - p);
            vec3 H1 = normalize(L1 - rd);
            vec3 H2 = normalize(L2 - rd);
            vec3 V = -rd;

            float diff1 = max(0.0, dot(n, L1) * 0.5 + 0.5);
            float diff2 = max(0.0, dot(n, L2) * 0.5 + 0.5) * 0.4;

            float shadow = softShadow(p + n * 0.02, L1, 0.05, 5.0, 8.0);
            float ao = calcAO(p, n);

            float spec1 = pow(max(dot(n, H1), 0.0), 32.0);
            float spec2 = pow(max(dot(n, H1), 0.0), 8.0);
            float specTotal = spec1 * 0.5 + spec2 * 0.3;

            float fresnel = pow(1.0 - max(dot(n, V), 0.0), 3.0);

            float sss1 = pow(max(0.0, dot(L1, -V)), 4.0);
            float sss2 = pow(max(0.0, dot(n, -L1) * 0.5 + 0.5), 2.0) * 0.3;
            float sssAmount = (sss1 + sss2) * (nVal * 0.6 + 0.4);
            float thickness = clamp(getOrganicDist(p - n * 0.3) / 0.3, 0.0, 1.0);
            sssAmount *= (1.0 - thickness * 0.5);
            vec3 sssColor = mix(vec3(1.0, 0.15, 0.05), vec3(1.0, 0.4, 0.2), nVal) * sssAmount;

            vec3 ref = reflect(rd, n);
            vec3 distortedRef = ref + (fbm(p * 5.0) - 0.5) * 0.15;
            vec3 envColor = textureCube(envSampler, distortedRef).rgb;

            vec3 col = vec3(0.0);

            vec3 ambient = albedo * vec3(0.08, 0.04, 0.05);
            col += ambient * ao;
            col += albedo * (diff1 * shadow + diff2) * 0.5 * ao;

            col += sssColor * 0.8;
            col += specTotal * vec3(0.95, 0.9, 0.85) * shadow;
            col += envColor * fresnel * 0.5 * ao;
            col += fresnel * vec3(0.4, 0.05, 0.08) * 0.8;

            float bioLum = smoothstep(0.6, 0.9, nVal) * (sin(t * 2.0 + length(p) * 3.0) * 0.5 + 0.5);
            col += vec3(0.3, 0.05, 0.1) * bioLum * 0.15;

            float spec2nd = pow(max(dot(n, H2), 0.0), 16.0) * 0.2;
            col += spec2nd * vec3(0.6, 0.8, 1.0) * 0.3;

            return col;
        }

        void main() {
            vec3 ro = cameraPosition;
            vec3 rd = normalize(vPosition - ro);

            float d = rayMarch(ro, rd);

            if (d < MAX_DIST) {
                vec3 p = ro + rd * d;
                vec3 n = getNormal(p);

                vec3 col = calculateBioLighting(p, n, rd);

                col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
                col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));

                vec2 uv = vUV * 2.0 - 1.0;
                float vig = 1.0 - dot(uv, uv) * 0.15;
                col *= vig;

                gl_FragColor = vec4(col, 1.0);
            } else {
                discard;
            }
        }
    `;

    const material = new BABYLON.ShaderMaterial("bioMat", scene,
        { vertex: "bio", fragment: "bio" },
        {
            attributes: ["position", "uv"],
            uniforms: ["world", "worldViewProjection", "time", "cameraPosition"],
            samplers: ["envSampler"]
        }
    );

    material.setTexture("envSampler", scene.environmentTexture);
    material.backFaceCulling = false;

    return material;
}
