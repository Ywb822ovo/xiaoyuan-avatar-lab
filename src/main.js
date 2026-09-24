import "./style.css";
import { sections } from "./content/sections.js";
import { createCinematicScroll } from "./navigation/cinematic-scroll.js";
import { createFilmDock } from "./navigation/film-dock.js";
import { createStickerNavigation } from "./navigation/sticker-navigation.js";
import { stickerRegistry } from "./navigation/sticker-registry.js";
import { attachAvatarInteraction } from "./three/avatar-interaction.js";
import { createScene } from "./three/create-scene.js";
import { loadAvatar } from "./three/load-avatar.js";

const canvas = document.querySelector("#scene");
const loadingCard = document.querySelector("#loading-card");
const loadingValue = document.querySelector("#loading-value");
const loadingProgress = document.querySelector("#loading-progress");
const errorCard = document.querySelector("#error-card");
const errorMessage = document.querySelector("#error-message");
const lockedToast = document.querySelector("#locked-toast");
const story = document.querySelector("#story");
const frameState = document.querySelector("#frame-state");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let sceneRuntime = null;
let interaction = null;
let stickerNavigation = null;
let cinematicScroll = null;
let filmDock = null;

function setProgress(ratio) {
  const percentage = ratio === null ? null : Math.round(ratio * 100);
  loadingValue.textContent = percentage === null ? "加载中" : `${percentage}%`;
  loadingProgress.style.width =
    percentage === null ? "34%" : `${Math.max(percentage, 4)}%`;
}

function showError(error) {
  errorMessage.textContent =
    error instanceof Error ? `${error.message} 正文仍可继续浏览。` : "正文仍可继续浏览。";
  errorCard.hidden = false;
  loadingCard.classList.add("is-hidden");
  document.body.classList.add("has-scene-error");
}

function warnAboutMissingStickers(decals) {
  const available = new Set(decals.map((decal) => decal.name));
  const missing = Object.keys(stickerRegistry).filter(
    (decalName) => !available.has(decalName),
  );

  if (missing.length) {
    console.warn(`以下贴纸节点未在 GLB 中找到：${missing.join(", ")}`);
  }
}

function renderStory() {
  const nodes = sections.map((section, index) => {
    const article = document.createElement("article");
    article.className = `story-section story-section--${index % 2 ? "right" : "left"}`;
    article.id = section.id;
    article.dataset.sectionIndex = String(index);

    const cards = section.cards
      .map(
        (card) => `
          <div class="story-card">
            <span>${card.label}</span>
            <strong>${card.value}</strong>
          </div>`,
      )
      .join("");

    article.innerHTML = `
      <div class="story-panel">
        <div class="story-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
        <p class="story-kicker">${section.kicker}</p>
        <h2>${section.title}</h2>
        <p class="story-lead">${section.lead}</p>
        <div class="story-cards">${cards}</div>
      </div>`;

    return article;
  });

  story.replaceChildren(...nodes);
  return nodes;
}

async function start() {
  const sectionNodes = renderStory();

  filmDock = createFilmDock({
    root: document.querySelector("#film-dock"),
    sections,
    reducedMotion,
    onSelect: (index) => cinematicScroll?.seekTo(index),
  });

  cinematicScroll = createCinematicScroll({
    hero: document.querySelector("#top"),
    sectionNodes,
    reducedMotion,
    onUpdate: ({ activeIndex, mode, progress, pose }) => {
      interaction?.setStoryState({ mode, pose });
      filmDock?.setStoryState({ activeIndex, mode, progress });
      frameState.textContent = mode === "EXPLORE" ? "EXPLORE" : "DIRECTED / SCROLL";
      document.body.dataset.mode = mode.toLowerCase();
      document.body.dataset.section =
        mode === "EXPLORE" ? "hero" : sections[activeIndex].id;
    },
  });

  try {
    sceneRuntime = createScene(canvas);
    const avatar = await loadAvatar({
      scene: sceneRuntime.scene,
      url: `${import.meta.env.BASE_URL}models/xiaoyuan-avatar.glb`,
      onProgress: setProgress,
    });

    warnAboutMissingStickers(avatar.decals);

    interaction = attachAvatarInteraction({
      canvas,
      camera: sceneRuntime.camera,
      avatarRoot: avatar.root,
      decals: avatar.decals,
      addFrameHandler: sceneRuntime.addFrameHandler,
      defaultCameraDistance: sceneRuntime.defaultCameraDistance,
      reducedMotion,
      onSelect: (mesh) => stickerNavigation?.handleSticker(mesh),
    });

    stickerNavigation = createStickerNavigation({
      interaction,
      lockedToast,
      reducedMotion,
      onPreview: (sectionId) => filmDock?.setPreview(sectionId),
    });

    cinematicScroll.refresh();

    window.__xiaoyuanSite = {
      decalCount: avatar.decals.length,
      animationNames: avatar.animations.map((clip) => clip.name),
      getInteractionState: interaction.getState,
      getScrollState: cinematicScroll.getState,
      getStickerState: stickerNavigation.getState,
      getDecalScreenPositions: interaction.getDecalScreenPositions,
      seekTo: cinematicScroll.seekTo,
    };

    setProgress(1);
    window.setTimeout(
      () => loadingCard.classList.add("is-hidden"),
      reducedMotion ? 20 : 260,
    );
  } catch (error) {
    console.error(error);
    showError(error);
  }
}

start();

window.addEventListener("beforeunload", () => {
  stickerNavigation?.destroy();
  cinematicScroll?.destroy();
  filmDock?.destroy();
  interaction?.destroy();
  sceneRuntime?.destroy();
});
