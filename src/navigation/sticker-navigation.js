import { getStickerEntry } from "./sticker-registry.js";

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

export function createStickerNavigation({
  interaction,
  lockedToast,
  reducedMotion = false,
  onPreview = () => {},
}) {
  let mode = "EXPLORE";
  let activeSectionId = null;
  let busy = false;
  let token = 0;

  async function showLocked(mesh) {
    const currentToken = ++token;
    busy = true;
    mode = "LOCKED_FEEDBACK";
    interaction.setEnabled(false);
    interaction.orientTowardDecal(mesh);
    lockedToast.classList.add("is-visible");

    await Promise.all([
      interaction.playDecalMotion(mesh, { type: "locked", reducedMotion }),
      wait(reducedMotion ? 160 : 760),
    ]);

    if (currentToken !== token) return;
    lockedToast.classList.remove("is-visible");
    interaction.setEnabled(true);
    mode = "EXPLORE";
    busy = false;
  }

  async function showPreview(mesh, sectionId) {
    const currentToken = ++token;
    busy = true;
    mode = "FOCUSING";
    interaction.setEnabled(false);
    interaction.focusOnDecal(mesh);
    onPreview(sectionId);

    await interaction.playDecalMotion(mesh, { type: "spin", reducedMotion });
    if (currentToken !== token) return;

    activeSectionId = sectionId;
    interaction.setEnabled(true);
    mode = "EXPLORE";
    busy = false;
  }

  async function handleSticker(mesh) {
    if (!mesh || busy || window.scrollY > 80) return;
    const entry = getStickerEntry(mesh.name);
    if (!entry) return;

    if (entry.status === "locked") {
      await showLocked(mesh);
      return;
    }

    await showPreview(mesh, entry.sectionId);
  }

  return {
    handleSticker,
    getState: () => ({ mode, activeSectionId, busy }),
    destroy() {
      token += 1;
    },
  };
}
