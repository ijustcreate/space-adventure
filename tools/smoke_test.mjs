import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:5173";
const outputDir = path.resolve("output", "smoke");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"]
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 }
});

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push({ type: "console.error", text: msg.text() });
  }
});
page.on("pageerror", (err) => {
  errors.push({ type: "pageerror", text: String(err) });
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.click("[data-start-btn]");
await page.waitForTimeout(300);

const advance = async (ms) => {
  await page.evaluate(async (stepMs) => {
    if (typeof window.advanceTime === "function") {
      await window.advanceTime(stepMs);
    }
  }, ms);
};

const tapForFrames = async (key, ms = 120) => {
  await page.keyboard.down(key);
  await advance(ms);
  await page.keyboard.up(key);
  await advance(60);
};

await advance(2600);
await page.screenshot({
  path: path.join(outputDir, "idle.png"),
  fullPage: true
});

const layoutState = await page.evaluate(() => {
  const stage = document.querySelector("[data-display-stage]");
  const crew = document.querySelector('[data-ui-panel="crew"]');
  const status = document.querySelector('[data-ui-panel="supportPrimary"]');
  const brand = document.querySelector('[data-ui-panel="brand"]');
  const missingDisplayMode = !document.body.textContent.includes("Display Mode");
  const missingMuseumFeed = !document.body.textContent.includes("Museum Feed");
  if (!stage || !crew || !status || !brand) {
    return null;
  }
  const stageRect = stage.getBoundingClientRect();
  const crewRect = crew.getBoundingClientRect();
  const statusRect = status.getBoundingClientRect();
  const brandRect = brand.getBoundingClientRect();
  return {
    stage: {
      left: stageRect.left,
      top: stageRect.top,
      width: stageRect.width,
      height: stageRect.height
    },
    crew: {
      left: crewRect.left,
      top: crewRect.top,
      width: crewRect.width,
      height: crewRect.height
    },
    status: {
      left: statusRect.left,
      top: statusRect.top,
      width: statusRect.width,
      height: statusRect.height
    },
    brand: {
      left: brandRect.left,
      top: brandRect.top,
      width: brandRect.width,
      height: brandRect.height
    },
    missingDisplayMode,
    missingMuseumFeed
  };
});

if (!layoutState) {
  throw new Error("Expected stage and HUD panels to exist for layout verification.");
}

const stageAspect = layoutState.stage.width / layoutState.stage.height;
if (stageAspect < 1.52) {
  throw new Error(`Expected the display stage to be wider than before, got aspect ${stageAspect.toFixed(3)}.`);
}

const crewCenter = layoutState.crew.left + layoutState.crew.width / 2;
const stageCenter = layoutState.stage.left + layoutState.stage.width / 2;
if (Math.abs(crewCenter - stageCenter) > layoutState.stage.width * 0.08) {
  throw new Error(`Expected crew panel near top-center pentagon, got ${JSON.stringify(layoutState.crew)} within ${JSON.stringify(layoutState.stage)}.`);
}

if (layoutState.crew.top > layoutState.stage.top + layoutState.stage.height * 0.16) {
  throw new Error(`Expected crew panel to stay in the top band, got top ${layoutState.crew.top}.`);
}

if (layoutState.status.left < layoutState.stage.left + layoutState.stage.width * 0.74) {
  throw new Error(`Expected status panel in the top-right geometry zone, got ${JSON.stringify(layoutState.status)}.`);
}

if (layoutState.status.top > layoutState.stage.top + layoutState.stage.height * 0.16) {
  throw new Error(`Expected status panel to stay high in the right geometry zone, got top ${layoutState.status.top}.`);
}

if (!layoutState.missingDisplayMode || !layoutState.missingMuseumFeed) {
  throw new Error("Expected old Display Mode and Museum Feed cards to be removed.");
}

await page.click('[data-seat-role="pilot"] .seat-icon');
await advance(120);
let pilotSeatState = await page.evaluate(() => window.spaceAdventure.input.seatActive.pilot);
if (!pilotSeatState) {
  throw new Error("Expected clicking the pilot seat card to activate the pilot seat.");
}

await page.click('[data-seat-role="pilot"] .seat-icon');
await advance(120);
pilotSeatState = await page.evaluate(() => window.spaceAdventure.input.seatActive.pilot);
if (pilotSeatState) {
  throw new Error("Expected clicking the pilot seat card again to deactivate the pilot seat.");
}

for (const key of ["Digit1", "Digit2", "Digit4"]) {
  await tapForFrames(key);
}

await page.click('[data-seat-role="scientist"] .seat-icon');
await advance(120);

const activeCrewState = await page.evaluate(() =>
  JSON.parse(window.render_game_to_text())
);
if (!Object.values(activeCrewState.seats).every(Boolean)) {
  throw new Error(`Expected all four crew stations to be active, got ${JSON.stringify(activeCrewState.seats)}`);
}

await page.evaluate(() => {
  window.spaceAdventure.lifeSupportState.engineTemp = 0.6;
});
await tapForFrames("ArrowDown");
const lifeSupportState = await page.evaluate(() =>
  JSON.parse(window.render_game_to_text()).lifeSupport
);
if (lifeSupportState.engineTemp >= 0.56) {
  throw new Error(`Expected Life Support ArrowDown input to cool the engine, got ${JSON.stringify(lifeSupportState)}`);
}

await page.keyboard.down("KeyL");
await advance(260);
const scienceState = await page.evaluate(() =>
  JSON.parse(window.render_game_to_text())
);
await page.keyboard.up("KeyL");
await advance(60);
if (!/^Scanning|^Collecting/.test(scienceState.scannerStatus)) {
  throw new Error(`Expected the Science station to activate its scanner, got ${scienceState.scannerStatus}`);
}

await page.screenshot({
  path: path.join(outputDir, "crew-active.png"),
  fullPage: true
});

await page.keyboard.down("ArrowRight");
await advance(260);
await page.keyboard.up("ArrowRight");

await page.keyboard.down("KeyW");
await page.keyboard.down("KeyD");
await advance(520);
await page.keyboard.up("KeyW");
await page.keyboard.up("KeyD");

await tapForFrames("Space", 180);
await page.evaluate(() => {
  window.spaceAdventure.resetPlayerToEarth();
});
await advance(2200);

const collisionState = await page.evaluate(async () => {
  const app = window.spaceAdventure;
  const earth = app.worldBodies.find((body) => body.data.name === "Earth");
  if (!earth) {
    return null;
  }
  const center = earth.group.getWorldPosition(app.tmpVector.clone());
  app.playerState.position.copy(center);
  app.playerState.velocity.set(0, 0, 0);
  if (typeof window.advanceTime === "function") {
    await window.advanceTime(120);
  }
  return {
    collision: app.lastCollisionName,
    distanceFromEarth: app.playerState.position.distanceTo(center),
    safeRadius: earth.collisionRadius + app.shipCollisionRadius
  };
});

if (!collisionState) {
  throw new Error(`Expected a collision response when forcing the ship into Earth, got ${JSON.stringify(collisionState)}`);
}

if (collisionState.distanceFromEarth < collisionState.safeRadius - 0.08) {
  throw new Error(`Expected collision response to push the ship outside the Earth safety radius, got ${JSON.stringify(collisionState)}`);
}

await page.screenshot({
  path: path.join(outputDir, "smoke.png"),
  fullPage: true
});

await tapForFrames("F1", 160);
await advance(180);
const debugWindowRect = await page.evaluate(() => {
  const node = document.querySelector("[data-debug-window]");
  if (!node) {
    return null;
  }
  const rect = node.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: window.innerWidth,
    height: window.innerHeight
  };
});

if (
  !debugWindowRect ||
  debugWindowRect.left < 0 ||
  debugWindowRect.top < 0 ||
  debugWindowRect.right > debugWindowRect.width + 1 ||
  debugWindowRect.bottom > debugWindowRect.height + 1
) {
  throw new Error(`Debug window does not fit viewport: ${JSON.stringify(debugWindowRect)}`);
}

const positionBeforeMenuInput = await page.evaluate(() => ({
  x: window.spaceAdventure.playerState.position.x,
  y: window.spaceAdventure.playerState.position.y,
  z: window.spaceAdventure.playerState.position.z
}));
await page.keyboard.down("KeyW");
await page.keyboard.down("KeyD");
await advance(320);
await page.keyboard.up("KeyW");
await page.keyboard.up("KeyD");
const positionAfterMenuInput = await page.evaluate(() => ({
  x: window.spaceAdventure.playerState.position.x,
  y: window.spaceAdventure.playerState.position.y,
  z: window.spaceAdventure.playerState.position.z
}));
const menuMovement =
  Math.abs(positionAfterMenuInput.x - positionBeforeMenuInput.x) +
  Math.abs(positionAfterMenuInput.y - positionBeforeMenuInput.y) +
  Math.abs(positionAfterMenuInput.z - positionBeforeMenuInput.z);
if (menuMovement > 0.05) {
  throw new Error(`Player ship moved while debug window was open: ${menuMovement}`);
}

await page.click("[data-ui-edit-enabled]");
await page.click('[data-ui-scope="all"]');
await page.keyboard.down("KeyL");
await advance(260);
await page.keyboard.up("KeyL");
await page.keyboard.down("KeyU");
await page.keyboard.down("KeyI");
await advance(200);
await page.keyboard.up("KeyI");
await page.keyboard.up("KeyU");
await page.click("[data-ui-save]");

await page.screenshot({
  path: path.join(outputDir, "debug.png"),
  fullPage: true
});

await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" }));
});
await advance(120);
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Escape", key: "Escape" }));
});
await advance(120);

const debugStillVisible = await page.evaluate(() =>
  !document.querySelector("[data-debug]")?.classList.contains("hidden")
);
if (debugStillVisible) {
  throw new Error("Debug window should close when Escape is pressed.");
}

await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" }));
});
await advance(120);
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Escape", key: "Escape" }));
});
await advance(120);

await page.screenshot({
  path: path.join(outputDir, "pause.png"),
  fullPage: true
});

const state = await page.evaluate(() => {
  if (typeof window.render_game_to_text === "function") {
    return window.render_game_to_text();
  }
  return null;
});

if (state) {
  fs.writeFileSync(path.join(outputDir, "state.json"), state);
}

if (errors.length) {
  fs.writeFileSync(path.join(outputDir, "errors.json"), JSON.stringify(errors, null, 2));
}

await browser.close();
