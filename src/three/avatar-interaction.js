import * as THREE from "three";

const MIN_CAMERA_DISTANCE = 2.62;
const MAX_CAMERA_DISTANCE = 5.1;
const FALLBACK_CAMERA_DISTANCE = 3.45;

function materialList(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function setDecalHighlight(mesh, isHighlighted) {
  if (!mesh) return;

  materialList(mesh).forEach((material) => {
    if (!material || !("emissive" in material)) return;

    if (!material.userData.baseEmissive) {
      material.userData.baseEmissive = material.emissive.clone();
      material.userData.baseEmissiveIntensity = material.emissiveIntensity;
    }

    if (isHighlighted) {
      material.emissive.set(0xff6b3e);
      material.emissiveIntensity = 0.5;
    } else {
      material.emissive.copy(material.userData.baseEmissive);
      material.emissiveIntensity = material.userData.baseEmissiveIntensity ?? 1;
    }
  });
}

export function attachAvatarInteraction({
  canvas,
  camera,
  avatarRoot,
  decals,
  addFrameHandler,
  defaultCameraDistance = FALLBACK_CAMERA_DISTANCE,
  reducedMotion = false,
  onHover = () => {},
  onSelect = () => {},
}) {
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const activePointers = new Map();
  const basePosition = avatarRoot.position.clone();
  const isCompact = window.matchMedia("(max-width: 760px)").matches;
  const defaultExploreRootX = isCompact ? 0 : 0.22;
  const defaultExploreRootY = isCompact ? -0.38 : 0;

  let hoveredDecal = null;
  let selectedDecal = null;
  let primaryPointerId = null;
  let lastPrimaryPoint = null;
  let pointerDownPoint = null;
  let didDrag = false;
  let pinchStartDistance = 0;
  let pinchStartCameraDistance = defaultCameraDistance;
  let enabled = true;
  let directorMode = false;

  const state = {
    mode: "EXPLORE",
    rotationX: 0,
    rotationY: 0,
    cameraDistance: defaultCameraDistance,
    lookAtY: 0.02,
    rootX: defaultExploreRootX,
    rootY: defaultExploreRootY,
    explore: {
      rotationX: 0,
      rotationY: 0,
      cameraDistance: defaultCameraDistance,
      lookAtY: 0.02,
      rootX: defaultExploreRootX,
      rootY: defaultExploreRootY,
    },
    story: {
      rotationX: 0,
      rotationY: 0,
      cameraDistance: defaultCameraDistance,
      lookAtY: 0.02,
      rootX: defaultExploreRootX,
      rootY: defaultExploreRootY,
    },
    pointer: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
    },
    velocityX: 0,
    velocityY: 0,
  };

  function canInteract() {
    return enabled && !directorMode;
  }

  function getDecalRootPosition(decal) {
    decal.geometry.computeBoundingBox();
    const position = decal.geometry.boundingBox.getCenter(new THREE.Vector3());
    decal.localToWorld(position);
    return avatarRoot.worldToLocal(position);
  }

  function setPointerNdc(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerNdc.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  function pickDecal(clientX, clientY) {
    setPointerNdc(clientX, clientY);
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObjects(decals, false)[0]?.object ?? null;
  }

  function clearHover() {
    if (hoveredDecal && hoveredDecal !== selectedDecal) {
      setDecalHighlight(hoveredDecal, false);
    }
    hoveredDecal = null;
    canvas.classList.remove("is-hovering");
    onHover(null);
  }

  function updateHover(clientX, clientY) {
    if (!canInteract()) {
      clearHover();
      return;
    }

    const nextHovered = pickDecal(clientX, clientY);
    if (nextHovered === hoveredDecal) return;

    if (hoveredDecal && hoveredDecal !== selectedDecal) {
      setDecalHighlight(hoveredDecal, false);
    }
    hoveredDecal = nextHovered;
    if (hoveredDecal) setDecalHighlight(hoveredDecal, true);
    canvas.classList.toggle("is-hovering", Boolean(hoveredDecal));
    onHover(hoveredDecal);
  }

  function updatePointerFollow(clientX, clientY) {
    if (reducedMotion || directorMode || activePointers.size) return;
    const bounds = canvas.getBoundingClientRect();
    const x = ((clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1;
    const y = ((clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1;
    state.pointer.targetX = THREE.MathUtils.clamp(x, -1, 1) * 0.052;
    state.pointer.targetY = THREE.MathUtils.clamp(y, -1, 1) * 0.025;
  }

  function distanceBetweenPointers() {
    const points = [...activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function handlePointerDown(event) {
    if (!canInteract()) return;
    canvas.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size === 1) {
      primaryPointerId = event.pointerId;
      lastPrimaryPoint = { x: event.clientX, y: event.clientY };
      pointerDownPoint = { x: event.clientX, y: event.clientY };
      didDrag = false;
      state.velocityX = 0;
      state.velocityY = 0;
      state.pointer.targetX = 0;
      state.pointer.targetY = 0;
      canvas.classList.add("is-dragging");
    } else if (activePointers.size === 2) {
      pinchStartDistance = distanceBetweenPointers();
      pinchStartCameraDistance = state.explore.cameraDistance;
      didDrag = true;
    }
  }

  function handlePointerMove(event) {
    updatePointerFollow(event.clientX, event.clientY);
    if (!canInteract()) return;

    if (!activePointers.has(event.pointerId)) {
      updateHover(event.clientX, event.clientY);
      return;
    }

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.size >= 2) {
      const currentDistance = distanceBetweenPointers();
      if (pinchStartDistance > 0) {
        const ratio = pinchStartDistance / Math.max(currentDistance, 1);
        state.explore.cameraDistance = THREE.MathUtils.clamp(
          pinchStartCameraDistance * ratio,
          MIN_CAMERA_DISTANCE,
          MAX_CAMERA_DISTANCE,
        );
      }
      return;
    }

    if (event.pointerId !== primaryPointerId || !lastPrimaryPoint) return;
    const deltaX = event.clientX - lastPrimaryPoint.x;
    const deltaY = event.clientY - lastPrimaryPoint.y;
    const totalDistance = pointerDownPoint
      ? Math.hypot(event.clientX - pointerDownPoint.x, event.clientY - pointerDownPoint.y)
      : 0;

    if (totalDistance > 4) didDrag = true;
    state.explore.rotationY += deltaX * 0.0062;
    state.explore.rotationX = THREE.MathUtils.clamp(
      state.explore.rotationX + deltaY * 0.003,
      -0.16,
      0.14,
    );
    state.velocityY = deltaX * 0.0009;
    state.velocityX = deltaY * 0.00045;
    lastPrimaryPoint = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event) {
    if (!activePointers.has(event.pointerId)) return;
    const isPrimary = event.pointerId === primaryPointerId;

    if (canInteract() && isPrimary && !didDrag && activePointers.size === 1) {
      const nextSelected = pickDecal(event.clientX, event.clientY);
      if (selectedDecal && selectedDecal !== nextSelected) {
        setDecalHighlight(selectedDecal, false);
      }
      selectedDecal = nextSelected;
      if (selectedDecal) setDecalHighlight(selectedDecal, true);
      onSelect(selectedDecal);
    }

    activePointers.delete(event.pointerId);
    if (activePointers.size === 0) {
      primaryPointerId = null;
      lastPrimaryPoint = null;
      pointerDownPoint = null;
      canvas.classList.remove("is-dragging");
      updatePointerFollow(event.clientX, event.clientY);
      updateHover(event.clientX, event.clientY);
    } else {
      const [nextId, nextPoint] = activePointers.entries().next().value;
      primaryPointerId = nextId;
      lastPrimaryPoint = { ...nextPoint };
      pointerDownPoint = { ...nextPoint };
      pinchStartDistance = 0;
    }
  }

  function handlePointerLeave() {
    if (!activePointers.size) {
      clearHover();
      state.pointer.targetX = 0;
      state.pointer.targetY = 0;
    }
  }

  function reset() {
    Object.assign(state.explore, {
      rotationX: 0,
      rotationY: 0,
      cameraDistance: defaultCameraDistance,
      lookAtY: 0.02,
      rootX: defaultExploreRootX,
      rootY: defaultExploreRootY,
    });
    state.velocityX = 0;
    state.velocityY = 0;
    if (selectedDecal) {
      setDecalHighlight(selectedDecal, false);
      selectedDecal = null;
      onSelect(null);
    }
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    canvas.classList.toggle("is-locked", !canInteract());
    canvas.classList.remove("is-dragging");
    if (!enabled) clearHover();
  }

  function setStoryState({ mode, pose }) {
    directorMode = mode !== "EXPLORE";
    state.mode = mode;
    if (pose) Object.assign(state.story, pose);
    canvas.classList.toggle("is-locked", !canInteract());
    if (directorMode) {
      clearHover();
      state.pointer.targetX = 0;
      state.pointer.targetY = 0;
      state.velocityX = 0;
      state.velocityY = 0;
    }
  }

  function focusOnDecal(decal) {
    const position = getDecalRootPosition(decal);
    state.explore.rotationY = Math.atan2(-position.x, position.z);
    state.explore.rotationX = THREE.MathUtils.clamp(
      (position.y - 0.12) * -0.045,
      -0.11,
      0.08,
    );
    state.explore.cameraDistance = Math.max(MIN_CAMERA_DISTANCE, defaultCameraDistance - 0.42);
    state.explore.lookAtY = THREE.MathUtils.clamp(position.y * 0.52, -0.25, 0.42);
    state.velocityX = 0;
    state.velocityY = 0;
  }

  function orientTowardDecal(decal, strength = 0.32) {
    const position = getDecalRootPosition(decal);
    state.explore.rotationY = Math.atan2(-position.x, position.z) * strength;
    state.explore.rotationX = THREE.MathUtils.clamp(
      (position.y - 0.12) * -0.018,
      -0.06,
      0.05,
    );
    state.velocityX = 0;
    state.velocityY = 0;
  }

  function playDecalMotion(decal, { type = "spin", reducedMotion: lessMotion = false } = {}) {
    const parent = decal.parent;
    const originalPosition = decal.position.clone();
    const originalQuaternion = decal.quaternion.clone();
    const originalScale = decal.scale.clone();
    decal.geometry.computeBoundingBox();

    const pivotPosition = decal.geometry.boundingBox.getCenter(new THREE.Vector3());
    decal.localToWorld(pivotPosition);
    parent.worldToLocal(pivotPosition);

    const pivot = new THREE.Object3D();
    pivot.position.copy(pivotPosition);
    pivot.quaternion.copy(decal.quaternion);
    parent.add(pivot);
    pivot.attach(decal);

    const baseQuaternion = pivot.quaternion.clone();
    const axis = new THREE.Vector3(0, 0, 1);
    const turn = new THREE.Quaternion();
    const duration = lessMotion ? 90 : type === "locked" ? 520 : 680;

    return new Promise((resolve) => {
      const startedAt = performance.now();
      function frame(now) {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const angle =
          type === "locked"
            ? Math.sin(progress * Math.PI * 3) * 0.14 * (1 - progress)
            : eased * Math.PI * 2;
        const scaleLift = lessMotion
          ? 1
          : 1 + Math.sin(progress * Math.PI) * (type === "locked" ? 0.08 : 0.13);
        turn.setFromAxisAngle(axis, lessMotion ? 0 : angle);
        pivot.quaternion.copy(baseQuaternion).multiply(turn);
        pivot.scale.setScalar(scaleLift);

        if (progress < 1) {
          requestAnimationFrame(frame);
          return;
        }
        parent.attach(decal);
        parent.remove(pivot);
        decal.position.copy(originalPosition);
        decal.quaternion.copy(originalQuaternion);
        decal.scale.copy(originalScale);
        resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function getDecalScreenPositions() {
    const bounds = canvas.getBoundingClientRect();
    return decals.map((decal) => {
      decal.geometry.computeBoundingBox();
      const worldPosition = decal.geometry.boundingBox.getCenter(new THREE.Vector3());
      decal.localToWorld(worldPosition);
      worldPosition.project(camera);
      return {
        name: decal.name,
        x: bounds.left + ((worldPosition.x + 1) / 2) * bounds.width,
        y: bounds.top + ((1 - worldPosition.y) / 2) * bounds.height,
        visible:
          worldPosition.z >= -1 &&
          worldPosition.z <= 1 &&
          Math.abs(worldPosition.x) <= 1 &&
          Math.abs(worldPosition.y) <= 1,
      };
    });
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);
  canvas.addEventListener("pointerleave", handlePointerLeave);

  const removeFrameHandler = addFrameHandler(() => {
    if (!activePointers.size && canInteract()) {
      state.explore.rotationY += state.velocityY;
      state.explore.rotationX = THREE.MathUtils.clamp(
        state.explore.rotationX + state.velocityX,
        -0.16,
        0.14,
      );
      state.velocityY *= 0.9;
      state.velocityX *= 0.88;
    }

    state.pointer.x = THREE.MathUtils.lerp(state.pointer.x, state.pointer.targetX, 0.065);
    state.pointer.y = THREE.MathUtils.lerp(state.pointer.y, state.pointer.targetY, 0.065);
    const target = directorMode ? state.story : state.explore;
    const followX = directorMode ? 0 : state.pointer.y;
    const followY = directorMode ? 0 : state.pointer.x;
    const damping = reducedMotion ? 0.24 : 0.075;

    state.rotationX = THREE.MathUtils.lerp(state.rotationX, target.rotationX + followX, damping);
    state.rotationY = THREE.MathUtils.lerp(state.rotationY, target.rotationY + followY, damping);
    state.cameraDistance = THREE.MathUtils.lerp(
      state.cameraDistance,
      THREE.MathUtils.clamp(target.cameraDistance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE),
      damping,
    );
    state.lookAtY = THREE.MathUtils.lerp(state.lookAtY, target.lookAtY, damping);
    state.rootX = THREE.MathUtils.lerp(state.rootX, target.rootX ?? 0, damping);
    state.rootY = THREE.MathUtils.lerp(state.rootY, target.rootY ?? 0, damping);

    avatarRoot.rotation.y = state.rotationY;
    avatarRoot.rotation.x = state.rotationX;
    avatarRoot.position.x = basePosition.x + state.rootX;
    avatarRoot.position.y = basePosition.y + state.rootY;
    camera.position.z = state.cameraDistance;
    camera.lookAt(0, state.lookAtY, 0);
  });

  return {
    reset,
    setEnabled,
    setStoryState,
    focusOnDecal,
    orientTowardDecal,
    playDecalMotion,
    getDecalScreenPositions,
    getState: () => ({
      ...state,
      enabled,
      directorMode,
      selected: selectedDecal?.name ?? null,
      hovered: hoveredDecal?.name ?? null,
    }),
    destroy() {
      removeFrameHandler();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
    },
  };
}
