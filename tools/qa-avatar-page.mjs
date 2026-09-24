import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const targetUrl = process.argv[2] ?? "http://127.0.0.1:50709/";
const outputDir =
  process.argv[3] ?? path.join(process.cwd(), "artifacts", "sticker-navigation");

await mkdir(outputDir, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

const report = {
  targetUrl,
  desktop: {},
  mobile: {},
  smallMobile: {},
  reducedMotion: {},
  consoleErrors: [],
  pageErrors: [],
};

function attachErrorCapture(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      report.consoleErrors.push(`[${label}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    report.pageErrors.push(`[${label}] ${error.message}`);
  });
}

async function waitForHub(page) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      window.__avatarLab?.decalCount === 10 &&
      window.__avatarLab?.getNavigationState().mode === "HUB",
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(450);
}

async function waitForMode(page, mode) {
  await page.waitForFunction(
    (expected) => window.__avatarLab?.getNavigationState().mode === expected,
    mode,
    { timeout: 10_000 },
  );
}

async function inspectFit(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    };

    const regions = Object.fromEntries(
      requestedSelectors.map((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        return [
          selector,
          {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            fits:
              rect.left >= -1 &&
              rect.top >= -1 &&
              rect.right <= window.innerWidth + 1 &&
              rect.bottom <= window.innerHeight + 1,
          },
        ];
      }),
    );

    return {
      viewport,
      regions,
      canScrollX: viewport.scrollWidth > viewport.width,
      canScrollY: viewport.scrollHeight > viewport.height,
    };
  }, selectors);
}

async function getDecalPoint(page, name) {
  const point = await page.evaluate((decalName) => {
    const position = window.__avatarLab
      .getDecalScreenPositions()
      .find((item) => item.name === decalName);
    if (!position) return null;
    return {
      ...position,
      targetId: document.elementFromPoint(position.x, position.y)?.id ?? null,
    };
  }, name);

  if (!point?.visible || point.targetId !== "scene") {
    throw new Error(`${name} 当前没有暴露在可点击画布区域。`);
  }

  return point;
}

async function clickDecal(page, name, useTouch = false) {
  const point = await getDecalPoint(page, name);
  let hoveredBeforeClick = null;

  if (useTouch) {
    await page.touchscreen.tap(point.x, point.y);
  } else {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(90);
    hoveredBeforeClick = await page.evaluate(
      () => window.__avatarLab.getInteractionState().hovered,
    );
    await page.mouse.click(point.x, point.y);
  }

  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
    hoveredBeforeClick,
  };
}

async function swipeUp(context, page) {
  const session = await context.newCDPSession(page);
  const x = Math.round((await page.evaluate(() => window.innerWidth)) * 0.5);
  const startY = Math.round((await page.evaluate(() => window.innerHeight)) * 0.72);
  const endY = Math.round((await page.evaluate(() => window.innerHeight)) * 0.34);

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: startY }],
  });

  for (let step = 1; step <= 6; step += 1) {
    const y = Math.round(startY + ((endY - startY) * step) / 6);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
  }

  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

function regionsFit(fit) {
  return Object.values(fit.regions).every((region) => region.fits);
}

const desktopContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const desktopPage = await desktopContext.newPage();
attachErrorCapture(desktopPage, "desktop");
await waitForHub(desktopPage);

report.desktop.initial = await desktopPage.evaluate(() => ({
  title: document.title,
  bodyText: document.body.innerText,
  decalCount: window.__avatarLab.decalCount,
  navigation: window.__avatarLab.getNavigationState(),
}));
report.desktop.initialFit = await inspectFit(desktopPage, [
  ".brand",
  ".corner-mark",
  "#scene",
]);
report.desktop.noTutorial =
  !report.desktop.initial.bodyText.includes("选择一张贴纸") &&
  !report.desktop.initial.bodyText.includes("拖动旋转") &&
  !report.desktop.initial.bodyText.includes("点击贴纸");

await desktopPage.screenshot({
  path: path.join(outputDir, "desktop-hub.png"),
  type: "png",
});

const canvasBox = await desktopPage.locator("#scene").boundingBox();
const beforeDrag = await desktopPage.evaluate(
  () => window.__avatarLab.getInteractionState().targetRotationY,
);
await desktopPage.mouse.move(
  canvasBox.x + canvasBox.width * 0.54,
  canvasBox.y + canvasBox.height * 0.58,
);
await desktopPage.mouse.down();
await desktopPage.mouse.move(
  canvasBox.x + canvasBox.width * 0.65,
  canvasBox.y + canvasBox.height * 0.53,
  { steps: 10 },
);
await desktopPage.mouse.up();
await desktopPage.waitForTimeout(260);
const afterDrag = await desktopPage.evaluate(
  () => window.__avatarLab.getInteractionState().targetRotationY,
);
report.desktop.drag = {
  before: beforeDrag,
  after: afterDrag,
  changed: Math.abs(afterDrag - beforeDrag) > 0.1,
};

const beforeZoom = await desktopPage.evaluate(
  () => window.__avatarLab.getInteractionState().targetCameraDistance,
);
await desktopPage.mouse.wheel(0, 260);
await desktopPage.waitForTimeout(120);
const afterZoom = await desktopPage.evaluate(
  () => window.__avatarLab.getInteractionState().targetCameraDistance,
);
report.desktop.zoom = {
  before: beforeZoom,
  after: afterZoom,
  changed: Math.abs(afterZoom - beforeZoom) > 0.1,
};

await desktopPage.evaluate(() => window.__avatarLab.returnToHub());
await desktopPage.keyboard.press("Escape");
await desktopPage.waitForTimeout(50);
await desktopPage.evaluate(() => {
  window.__avatarLab.getInteractionState();
});

// Reload to return to a deterministic front-facing hub before decal tests.
await waitForHub(desktopPage);

report.desktop.aboutClickPoint = await clickDecal(
  desktopPage,
  "decal-9",
);
await desktopPage.waitForTimeout(320);
report.desktop.focusTransitionMode = await desktopPage.evaluate(
  () => window.__avatarLab.getNavigationState().mode,
);
await desktopPage.screenshot({
  path: path.join(outputDir, "desktop-focusing.png"),
  type: "png",
});
await waitForMode(desktopPage, "SECTION");
report.desktop.activeSection = await desktopPage.evaluate(() => ({
  navigation: window.__avatarLab.getNavigationState(),
  title: document.querySelector("#section-title").textContent,
  shellOpen: document.querySelector("#section-shell").classList.contains("is-open"),
}));
report.desktop.sectionFit = await inspectFit(desktopPage, [
  ".back-button",
  ".section-progress",
  ".section-content",
  ".section-dots",
]);

await desktopPage.screenshot({
  path: path.join(outputDir, "desktop-about.png"),
  type: "png",
});

await desktopPage.mouse.move(1200, 700);
await desktopPage.mouse.wheel(0, 420);
await desktopPage.waitForFunction(
  () => window.__avatarLab.getNavigationState().activeSectionId === "resume",
);
report.desktop.wheelSection = {
  id: await desktopPage.evaluate(
    () => window.__avatarLab.getNavigationState().activeSectionId,
  ),
  title: await desktopPage.locator("#section-title").textContent(),
};

await desktopPage.locator('.section-dot[data-index="4"]').click();
await desktopPage.waitForFunction(
  () => window.__avatarLab.getNavigationState().activeSectionId === "project-c",
);
report.desktop.dotNavigation = {
  id: await desktopPage.evaluate(
    () => window.__avatarLab.getNavigationState().activeSectionId,
  ),
  title: await desktopPage.locator("#section-title").textContent(),
};

await desktopPage.keyboard.press("Escape");
await waitForMode(desktopPage, "HUB");
report.desktop.escapeReturn = await desktopPage.evaluate(() => ({
  navigation: window.__avatarLab.getNavigationState(),
  shellHidden:
    document.querySelector("#section-shell").getAttribute("aria-hidden") ===
    "true",
}));

report.desktop.resumeClickPoint = await clickDecal(
  desktopPage,
  "decal-0",
);
await waitForMode(desktopPage, "SECTION");
await desktopPage.locator("#back-button").click();
await waitForMode(desktopPage, "HUB");
report.desktop.backButtonReturn =
  (await desktopPage.evaluate(
    () => window.__avatarLab.getNavigationState().mode,
  )) === "HUB";

report.desktop.lockedClickPoint = await clickDecal(
  desktopPage,
  "decal-1",
);
await desktopPage.waitForFunction(() =>
  document.querySelector("#locked-toast").classList.contains("is-visible"),
);
report.desktop.lockedVisible =
  (await desktopPage.locator("#locked-toast").textContent()).trim() ===
  "区域尚未解锁";
await desktopPage.waitForTimeout(240);
await desktopPage.screenshot({
  path: path.join(outputDir, "desktop-locked.png"),
  type: "png",
});
await waitForMode(desktopPage, "HUB");
report.desktop.lockedReturned =
  !(await desktopPage
    .locator("#locked-toast")
    .evaluate((element) => element.classList.contains("is-visible")));

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobileContext.newPage();
attachErrorCapture(mobilePage, "mobile");
await waitForHub(mobilePage);
report.mobile.hubFit = await inspectFit(mobilePage, [
  ".brand",
  ".corner-mark",
  "#scene",
]);

report.mobile.activeClickPoint = await clickDecal(
  mobilePage,
  "decal-6",
  true,
);
await waitForMode(mobilePage, "SECTION");
report.mobile.initialSection = await mobilePage.evaluate(
  () => window.__avatarLab.getNavigationState().activeSectionId,
);
report.mobile.sectionFit = await inspectFit(mobilePage, [
  ".back-button",
  ".section-progress",
  ".section-content",
  ".section-dots",
]);

await swipeUp(mobileContext, mobilePage);
await mobilePage.waitForFunction(
  () => window.__avatarLab.getNavigationState().activeSectionId === "project-c",
);
report.mobile.swipeSection = await mobilePage.evaluate(
  () => window.__avatarLab.getNavigationState().activeSectionId,
);
await mobilePage.waitForTimeout(320);

await mobilePage.screenshot({
  path: path.join(outputDir, "mobile-project-c.png"),
  type: "png",
});

await mobilePage.locator("#back-button").click();
await waitForMode(mobilePage, "HUB");
await mobilePage.waitForTimeout(420);
await mobilePage.screenshot({
  path: path.join(outputDir, "mobile-hub.png"),
  type: "png",
});
await mobileContext.close();

const smallMobileContext = await browser.newContext({
  viewport: { width: 320, height: 568 },
  isMobile: true,
  hasTouch: true,
});
const smallMobilePage = await smallMobileContext.newPage();
attachErrorCapture(smallMobilePage, "small-mobile");
await waitForHub(smallMobilePage);
report.smallMobile.hubFit = await inspectFit(smallMobilePage, [
  ".brand",
  ".corner-mark",
  "#scene",
]);
await smallMobilePage.screenshot({
  path: path.join(outputDir, "mobile-320x568-hub.png"),
  type: "png",
});
await smallMobileContext.close();

const reducedContext = await browser.newContext({
  viewport: { width: 1200, height: 800 },
  reducedMotion: "reduce",
});
const reducedPage = await reducedContext.newPage();
attachErrorCapture(reducedPage, "reduced-motion");
await waitForHub(reducedPage);
const reducedStartedAt = Date.now();
await clickDecal(reducedPage, "decal-9");
await waitForMode(reducedPage, "SECTION");
report.reducedMotion = {
  enteredSection: true,
  durationMs: Date.now() - reducedStartedAt,
};
await reducedContext.close();

await desktopContext.close();
await browser.close();

report.passed =
  report.desktop.initial.title === "小缘的个人空间" &&
  report.desktop.initial.decalCount === 10 &&
  report.desktop.noTutorial &&
  report.desktop.drag.changed &&
  report.desktop.zoom.changed &&
  report.desktop.aboutClickPoint.hoveredBeforeClick === "decal-9" &&
  report.desktop.focusTransitionMode === "FOCUSING" &&
  report.desktop.activeSection.navigation.activeSectionId === "about" &&
  report.desktop.activeSection.title === "个人介绍" &&
  report.desktop.wheelSection.id === "resume" &&
  report.desktop.dotNavigation.id === "project-c" &&
  report.desktop.escapeReturn.navigation.mode === "HUB" &&
  report.desktop.escapeReturn.shellHidden &&
  report.desktop.backButtonReturn &&
  report.desktop.lockedVisible &&
  report.desktop.lockedReturned &&
  report.mobile.initialSection === "project-b" &&
  report.mobile.swipeSection === "project-c" &&
  report.reducedMotion.enteredSection &&
  regionsFit(report.desktop.initialFit) &&
  regionsFit(report.desktop.sectionFit) &&
  regionsFit(report.mobile.hubFit) &&
  regionsFit(report.mobile.sectionFit) &&
  regionsFit(report.smallMobile.hubFit) &&
  !report.desktop.initialFit.canScrollX &&
  !report.desktop.initialFit.canScrollY &&
  !report.mobile.hubFit.canScrollX &&
  !report.mobile.hubFit.canScrollY &&
  !report.smallMobile.hubFit.canScrollX &&
  !report.smallMobile.hubFit.canScrollY &&
  report.consoleErrors.length === 0 &&
  report.pageErrors.length === 0;

console.log(JSON.stringify(report, null, 2));

if (!report.passed) {
  process.exitCode = 1;
}
