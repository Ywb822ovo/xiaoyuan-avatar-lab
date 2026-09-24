export const stickerRegistry = {
  "decal-9": {
    status: "active",
    sectionId: "about",
  },
  "decal-0": {
    status: "active",
    sectionId: "resume",
  },
  "decal-2": {
    status: "active",
    sectionId: "project-a",
  },
  "decal-6": {
    status: "active",
    sectionId: "project-b",
  },
  "decal-8": {
    status: "active",
    sectionId: "project-c",
  },
  "decal-5": {
    status: "active",
    sectionId: "contact",
  },
  "decal-1": {
    status: "locked",
  },
  "decal-3": {
    status: "locked",
  },
  "decal-4": {
    status: "locked",
  },
  "decal-7": {
    status: "locked",
  },
};

export function getStickerEntry(meshName) {
  return stickerRegistry[meshName] ?? null;
}
