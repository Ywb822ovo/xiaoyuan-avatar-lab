import * as THREE from "three";

export function createScene(canvas) {
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    throw new Error("当前浏览器无法创建 WebGL 场景。请开启硬件加速后重试。", {
      cause: error,
    });
  }

  const scene = new THREE.Scene();
  scene.background = null;
  renderer.setClearColor(0xa8ae8e, 0);

  const isCompact = window.matchMedia("(max-width: 820px)").matches;
  const defaultCameraDistance = isCompact ? 4.15 : 3.45;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.04, defaultCameraDistance);
  camera.lookAt(0, 0.02, 0);

  const hemisphere = new THREE.HemisphereLight(0xfff7ea, 0x6e5d52, 2.3);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(0xffead3, 3.25);
  keyLight.position.set(3.2, 4.5, 4.2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xdce9ff, 1.45);
  fillLight.position.set(-3.5, 1.5, 2.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffc99f, 1.35);
  rimLight.position.set(2.5, 2.6, -3.8);
  scene.add(rimLight);

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, isCompact ? 1.35 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const frameHandlers = new Set();

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function addFrameHandler(handler) {
    frameHandlers.add(handler);
    return () => frameHandlers.delete(handler);
  }

  resize();
  window.addEventListener("resize", resize);

  renderer.setAnimationLoop((time) => {
    const seconds = time / 1000;
    frameHandlers.forEach((handler) => handler(seconds));
    renderer.render(scene, camera);
  });

  function destroy() {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    defaultCameraDistance,
    addFrameHandler,
    destroy,
  };
}
