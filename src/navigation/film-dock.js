export function createFilmDock({
  root,
  sections,
  reducedMotion = false,
  onSelect = () => {},
}) {
  let previewId = null;
  let activeIndex = -1;
  let mode = "EXPLORE";

  const buttons = sections.map((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "film-frame";
    button.dataset.sectionId = section.id;
    button.setAttribute("aria-label", `前往${section.title}`);
    button.innerHTML = `
      <span class="film-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="film-title">${section.navLabel ?? section.title}</span>
      <span class="film-mark" aria-hidden="true"></span>`;
    button.addEventListener("click", () => onSelect(index));
    return button;
  });

  const rail = document.createElement("div");
  rail.className = "film-rail";
  rail.append(...buttons);

  const progress = document.createElement("span");
  progress.className = "film-progress";
  progress.setAttribute("aria-hidden", "true");

  root.replaceChildren(rail, progress);

  function paint() {
    buttons.forEach((button, index) => {
      const section = sections[index];
      const isActive = mode !== "EXPLORE" && index === activeIndex;
      const isPreview = mode === "EXPLORE" && section.id === previewId;
      button.classList.toggle("is-active", isActive);
      button.classList.toggle("is-preview", isPreview);
      button.setAttribute("aria-current", isActive ? "page" : "false");
    });

    root.dataset.mode = mode.toLowerCase();

    const selected = buttons[mode === "EXPLORE" ? sections.findIndex((item) => item.id === previewId) : activeIndex];
    if (selected && !reducedMotion) {
      selected.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }

  function setPreview(sectionId) {
    previewId = sectionId;
    paint();
  }

  function setStoryState({ activeIndex: nextIndex, mode: nextMode, progress: ratio }) {
    activeIndex = nextIndex;
    mode = nextMode;
    progress.style.transform = `scaleX(${Math.max(0, Math.min(ratio, 1))})`;
    paint();
  }

  paint();

  return {
    setPreview,
    setStoryState,
    destroy() {
      buttons.forEach((button, index) => {
        button.replaceWith(button.cloneNode(true));
        buttons[index] = null;
      });
    },
  };
}
