import * as THREE from "three";

const DESKTOP_POSES = [
  { rotationX: -0.025, rotationY: 0.08, cameraDistance: 3.05, lookAtY: 0.2, rootX: 0.52, rootY: 0 },
  { rotationX: 0.015, rotationY: -0.62, cameraDistance: 2.72, lookAtY: 0.27, rootX: -0.52, rootY: 0.02 },
  { rotationX: -0.02, rotationY: 0.74, cameraDistance: 2.83, lookAtY: 0.11, rootX: 0.56, rootY: -0.02 },
  { rotationX: 0.035, rotationY: -0.82, cameraDistance: 2.67, lookAtY: 0.22, rootX: -0.6, rootY: 0.01 },
  { rotationX: -0.035, rotationY: 0.34, cameraDistance: 3.48, lookAtY: 0.05, rootX: 0.5, rootY: -0.04 },
  { rotationX: 0, rotationY: -0.08, cameraDistance: 3.22, lookAtY: 0.14, rootX: -0.48, rootY: 0 },
];

const MOBILE_POSES = DESKTOP_POSES.map((pose, index) => ({
  ...pose,
  rotationY: pose.rotationY * 0.68,
  cameraDistance: Math.max(pose.cameraDistance + 0.8, 3.65),
  lookAtY: 0.28,
  rootX: index % 2 ? -0.2 : 0.2,
  rootY: -0.28,
}));

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function interpolatePose(from, to, amount) {
  const eased = amount * amount * (3 - 2 * amount);
  return Object.fromEntries(
    Object.keys(from).map((key) => [key, THREE.MathUtils.lerp(from[key], to[key], eased)]),
  );
}

export function createCinematicScroll({
  hero,
  sectionNodes,
  reducedMotion = false,
  onUpdate = () => {},
}) {
  let frame = 0;
  let keyPositions = [];
  let mode = "EXPLORE";
  let activeIndex = 0;
  let progress = 0;
  let currentPose = DESKTOP_POSES[0];

  function getPoses() {
    return window.matchMedia("(max-width: 760px)").matches ? MOBILE_POSES : DESKTOP_POSES;
  }

  function measure() {
    const viewportHeight = window.innerHeight;
    keyPositions = sectionNodes.map(
      (node) =>
        node.getBoundingClientRect().top +
        window.scrollY +
        Math.min(viewportHeight * 0.44, 380),
    );
  }

  function calculate() {
    frame = 0;
    if (!keyPositions.length) measure();

    const viewportHeight = window.innerHeight;
    const marker = window.scrollY + viewportHeight * 0.5;
    const exploreThreshold = Math.max(120, hero.offsetHeight * 0.38);
    mode = window.scrollY < exploreThreshold ? "EXPLORE" : "STORY";

    const poses = getPoses();
    const first = keyPositions[0];
    const last = keyPositions[keyPositions.length - 1];
    progress = clamp01((marker - first) / Math.max(last - first, 1));

    activeIndex = 0;
    for (let index = 0; index < keyPositions.length - 1; index += 1) {
      const midpoint = (keyPositions[index] + keyPositions[index + 1]) / 2;
      if (marker >= midpoint) activeIndex = index + 1;
    }

    if (marker <= first) {
      currentPose = poses[0];
    } else if (marker >= last) {
      currentPose = poses[poses.length - 1];
    } else {
      let segment = 0;
      while (segment < keyPositions.length - 2 && marker > keyPositions[segment + 1]) {
        segment += 1;
      }
      const local = clamp01(
        (marker - keyPositions[segment]) /
          Math.max(keyPositions[segment + 1] - keyPositions[segment], 1),
      );
      currentPose = interpolatePose(poses[segment], poses[segment + 1], local);
    }

    sectionNodes.forEach((node, index) => {
      const isActive = index === activeIndex && mode === "STORY";
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-current", isActive ? "step" : "false");
    });

    onUpdate({ activeIndex, mode, progress, pose: currentPose });
  }

  function requestCalculate() {
    if (frame) return;
    frame = window.requestAnimationFrame(calculate);
  }

  function refresh() {
    measure();
    calculate();
  }

  function seekTo(index) {
    const target = sectionNodes[index];
    if (!target) return;
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: targetTop,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function handleResize() {
    measure();
    requestCalculate();
  }

  window.addEventListener("scroll", requestCalculate, { passive: true });
  window.addEventListener("resize", handleResize);
  refresh();

  return {
    refresh,
    seekTo,
    getState: () => ({ mode, activeIndex, progress, pose: { ...currentPose } }),
    destroy() {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestCalculate);
      window.removeEventListener("resize", handleResize);
    },
  };
}
