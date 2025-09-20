import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RGBELoader } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";

// Simple HDRI + ground projection viewer. Usage:
// /hdri?model=/assets/models/myModel.glb&hdr=/assets/envs/studio.hdr

const loadHDRI = async (url: string, renderer: THREE.WebGLRenderer) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync(url);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const envMap = pmrem.fromEquirectangular(hdr).texture;
  hdr.dispose();
  return envMap;
};

const placeOnGround = (root: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const minY = box.min.y;
  root.position.y -= minY; // lift to y=0
  root.position.x -= center.x;
  root.position.z -= center.z;
};

export const HdriViewerPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace as any;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(2.5, 2, 4);

    const search = new URLSearchParams(window.location.search);
    const modelUrl = search.get("model") || "/assets/models/myModel.glb";
    const hdrUrl = search.get("hdr") || "/assets/envs/studio.hdr";

    // Ground shadow catcher
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Sun light for shadows
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);

    let anim = true;

    (async () => {
      try {
        const envMap = await loadHDRI(hdrUrl, renderer);
        scene.environment = envMap;
        scene.background = envMap;

        const gltf = await new GLTFLoader().loadAsync(modelUrl);
        const model = gltf.scene;
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if ((mesh as any).isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            const mat: any = (mesh.material ?? {}) as any;
            if (mat) mat.envMapIntensity = mat.envMapIntensity ?? 1.0;
          }
        });

        placeOnGround(model);
        scene.add(model);

        const clock = new THREE.Clock();
        const tick = () => {
          clock.getDelta();
          renderer.render(scene, camera);
          if (anim) requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        console.error("HDRI viewer error", e);
      }
    })();

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      anim = false;
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100vw", height: "100vh" }} />;
};

export default HdriViewerPage;
