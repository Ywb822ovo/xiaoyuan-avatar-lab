import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const DECAL_PATTERN = /^decal-(\d+)$/;

function configureMaterial(material, isDecal) {
  if (!material) return material;

  const configured = material.clone();

  if ("envMapIntensity" in configured) {
    configured.envMapIntensity = isDecal ? 0.15 : 0.7;
  }

  if (isDecal) {
    configured.transparent = true;
    configured.depthWrite = false;
    configured.alphaTest = 0.025;
  }

  configured.needsUpdate = true;
  return configured;
}

export async function loadAvatar({
  scene,
  url,
  onProgress = () => {},
}) {
  const loader = new GLTFLoader();

  const gltf = await loader.loadAsync(url, (event) => {
    if (!event.total) {
      onProgress(null);
      return;
    }

    onProgress(Math.min(event.loaded / event.total, 1));
  });

  const avatarRoot = gltf.scene;
  avatarRoot.name = "xiaoyuan-avatar";

  avatarRoot.traverse((object) => {
    if (object.isCamera) {
      object.visible = false;
    }
  });

  const initialBox = new THREE.Box3().setFromObject(avatarRoot);
  const initialCenter = initialBox.getCenter(new THREE.Vector3());
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const targetHeight = 2.18;
  const uniformScale = targetHeight / Math.max(initialSize.y, 0.001);

  avatarRoot.scale.multiplyScalar(uniformScale);
  avatarRoot.position.set(
    -initialCenter.x * uniformScale,
    -initialCenter.y * uniformScale - 0.03,
    -initialCenter.z * uniformScale,
  );

  const decals = [];

  avatarRoot.traverse((object) => {
    if (!object.isMesh) return;

    const match = object.name.match(DECAL_PATTERN);
    const isDecal = Boolean(match);

    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) =>
        configureMaterial(material, isDecal),
      );
    } else {
      object.material = configureMaterial(object.material, isDecal);
    }

    if (isDecal) {
      object.userData.decalIndex = Number(match[1]);
      object.renderOrder = 20 + object.userData.decalIndex;
      decals.push(object);
    }
  });

  decals.sort((a, b) => a.userData.decalIndex - b.userData.decalIndex);
  scene.add(avatarRoot);

  return {
    root: avatarRoot,
    decals,
    animations: gltf.animations,
  };
}
