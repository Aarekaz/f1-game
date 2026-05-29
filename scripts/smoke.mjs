import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";

const port = await getFreePort();
const url = `http://127.0.0.1:${port}/`;
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"]
});

const logs = [];
server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
server.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  await waitForServer(url);
  const browser = await chromium.launch({ headless: true });
  await checkDesktop(browser);
  await checkMobile(browser);
  await browser.close();
  console.log("Smoke test passed");
} finally {
  server.kill();
}

async function checkDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.selectOption("#track-select", "northstar");
  await page.selectOption("#weather-select", "storm");
  const ready = await page.evaluate(() => ({
    startVisible: !document.querySelector("#start-panel")?.classList.contains("hidden"),
    trackSelect: document.querySelector("#track-select")?.value ?? "",
    weatherSelect: document.querySelector("#weather-select")?.value ?? "",
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    sessionBrief: document.querySelector("#session-brief")?.textContent ?? "",
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    trackOffset: Number(document.querySelector("#game canvas")?.dataset.trackOffset ?? 0),
    carWorldZ: Number(document.querySelector("#game canvas")?.dataset.carWorldZ ?? 0),
    carWorldY: Number(document.querySelector("#game canvas")?.dataset.carWorldY ?? 0),
    circuitWorldZ: Number(document.querySelector("#game canvas")?.dataset.circuitWorldZ ?? 0),
    carScreenY: Number(document.querySelector("#game canvas")?.dataset.carScreenY ?? 0)
  }));
  assert(ready.startVisible, "desktop start panel was not visible");
  assert(ready.trackSelect === "northstar", "desktop fictional track selector did not update");
  assert(ready.weatherSelect === "storm", "desktop fictional weather selector did not update");
  assert(ready.hudPhase === "ready", `desktop HUD did not expose ready phase: ${ready.hudPhase}`);
  assert(/alpine|wet|spray/i.test(ready.sessionBrief), `desktop session brief did not describe selection: ${ready.sessionBrief}`);
  assert(ready.speed === 0, "desktop race moved before start");

  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(3900);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowUp");

  const state = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector("#game canvas")),
    canvasBox: document.querySelector("#game canvas")?.getBoundingClientRect().toJSON(),
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    gear: Number(document.querySelector("#gear")?.textContent ?? 0),
    objective: document.querySelector("#objective")?.textContent ?? "",
    mapPath: document.querySelector("#track-map-path")?.getAttribute("d") ?? "",
    mapCarX: Number(document.querySelector("#map-car")?.getAttribute("cx") ?? 0),
    section: document.querySelector("#section-name")?.textContent ?? "",
    instruction: document.querySelector("#track-instruction")?.textContent ?? "",
    paceTarget: document.querySelector("#pace-target")?.textContent ?? "",
    cue: document.querySelector("#track-cue")?.textContent ?? "",
    checkpoint: document.querySelector("#checkpoint")?.textContent ?? "",
    penalty: document.querySelector("#penalty")?.textContent ?? "",
    lapTime: document.querySelector("#current-lap-time")?.textContent ?? "",
    hintVisible: getComputedStyle(document.querySelector(".control-hint")).display !== "none",
    startVisible: !document.querySelector("#start-panel")?.classList.contains("hidden"),
    trackOffset: Number(document.querySelector("#game canvas")?.dataset.trackOffset ?? 0),
    carWorldZ: Number(document.querySelector("#game canvas")?.dataset.carWorldZ ?? 0),
    carWorldY: Number(document.querySelector("#game canvas")?.dataset.carWorldY ?? 0),
    circuitWorldZ: Number(document.querySelector("#game canvas")?.dataset.circuitWorldZ ?? 0),
    cameraWorldZ: Number(document.querySelector("#game canvas")?.dataset.cameraWorldZ ?? 0),
    carScreenX: Number(document.querySelector("#game canvas")?.dataset.carScreenX ?? 0),
    carScreenY: Number(document.querySelector("#game canvas")?.dataset.carScreenY ?? 0),
    carSlip: Number(document.querySelector("#game canvas")?.dataset.carSlip ?? 0),
    carWheelspin: Number(document.querySelector("#game canvas")?.dataset.carWheelspin ?? 0),
    carUndersteer: Number(document.querySelector("#game canvas")?.dataset.carUndersteer ?? 0),
    carLockup: Number(document.querySelector("#game canvas")?.dataset.carLockup ?? 0),
    draft: Number(document.querySelector("#game canvas")?.dataset.draft ?? 0),
    dirtyAir: Number(document.querySelector("#game canvas")?.dataset.dirtyAir ?? 0),
    rainIntensity: Number(document.querySelector("#game canvas")?.dataset.rainIntensity ?? 0),
    roadWetness: Number(document.querySelector("#game canvas")?.dataset.roadWetness ?? 0),
    assetCar: document.querySelector("#game canvas")?.dataset.assetCar ?? "",
    tracksideAssets: document.querySelector("#game canvas")?.dataset.tracksideAssets ?? "",
    assetWeather: document.querySelector("#game canvas")?.dataset.weather ?? "",
    trackLayout: document.querySelector("#game canvas")?.dataset.trackLayout ?? "",
    horizonTrack: document.querySelector("#game canvas")?.dataset.horizonTrack ?? "",
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    sessionTrack: document.querySelector("#session-track")?.textContent ?? "",
    sessionWeather: document.querySelector("#session-weather")?.textContent ?? ""
  }));

  await page.close();
  assert(state.canvas, "desktop canvas did not render");
  assertCanvasBox(state.canvasBox, "desktop");
  assert(state.trackOffset > ready.trackOffset + 10, "desktop WebGL track did not advance after launch");
  assert(state.carWorldZ > ready.carWorldZ + 10, "desktop car did not move through world space");
  assert(Number.isFinite(state.carWorldY) && state.carWorldY > 0.5, "desktop car did not receive elevated track height");
  assert(state.circuitWorldZ === ready.circuitWorldZ, "desktop circuit moved instead of staying in world space");
  assert(state.cameraWorldZ < 0, "desktop chase camera did not move into world space");
  assert(Math.abs(state.carScreenY - ready.carScreenY) > 0.01, "desktop car stayed visually pinned to the same screen position");
  assert(Number.isFinite(state.carScreenX), "desktop car screen-space X telemetry was missing");
  assert(Number.isFinite(state.carSlip), "desktop slip telemetry was missing");
  assert(Number.isFinite(state.carWheelspin), "desktop wheelspin telemetry was missing");
  assert(Number.isFinite(state.carUndersteer), "desktop understeer telemetry was missing");
  assert(Number.isFinite(state.carLockup), "desktop brake-lock telemetry was missing");
  assert(Number.isFinite(state.draft), "desktop draft telemetry was missing");
  assert(Number.isFinite(state.dirtyAir), "desktop dirty-air telemetry was missing");
  assert(state.rainIntensity > 0.8, `desktop rain intensity did not reach renderer, rain=${state.rainIntensity}`);
  assert(state.roadWetness > 0.8, `desktop road wetness did not reach renderer, wetness=${state.roadWetness}`);
  assert(state.speed > 60, `desktop launch did not accelerate, speed=${state.speed}`);
  assert(state.gear >= 1, "desktop gear readout was missing");
  assert(state.assetCar === "apex-procedural", `desktop fictional formula car did not load, asset=${state.assetCar}`);
  assert(state.tracksideAssets === "kenney", `desktop free trackside assets did not load, assets=${state.tracksideAssets}`);
  assert(state.assetWeather === "Wet Storm", `desktop weather did not reach renderer, weather=${state.assetWeather}`);
  assert(state.trackLayout === "northstar", `desktop selected layout did not reach renderer, layout=${state.trackLayout}`);
  assert(state.horizonTrack === "northstar", `desktop selected layout did not rebuild horizon, horizon=${state.horizonTrack}`);
  assert(state.hudPhase === "racing", `desktop HUD did not switch into racing phase: ${state.hudPhase}`);
  assert(state.sessionTrack === "Northstar Ring", `desktop session track missing: ${state.sessionTrack}`);
  assert(state.sessionWeather === "Wet Storm", `desktop session weather missing: ${state.sessionWeather}`);
  assert(state.mapPath.length > 100, "desktop minimap path was not drawn");
  assert(state.mapCarX > 0, "desktop minimap car marker was not positioned");
  assert(state.instruction.length > 0, "desktop track instruction was missing");
  assert(/kph/i.test(state.paceTarget), `desktop pace target missing: ${state.paceTarget}`);
  assert(/Catch|Hold/.test(state.objective), `desktop objective missing: ${state.objective}`);
  assert(state.section.length > 0, "desktop circuit section was missing");
  assert(state.cue.length > 0, "desktop driving cue was missing");
  assert(/\d\/[67]/.test(state.checkpoint), `desktop checkpoint readout missing: ${state.checkpoint}`);
  assert(state.penalty.length > 0, "desktop penalty readout was missing");
  assert(state.lapTime !== "0.00", "desktop lap timer did not advance");
  assert(state.hintVisible, "desktop keyboard hint was not visible");
  assert(!state.startVisible, "desktop start panel stayed visible after countdown");
}

async function checkMobile(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await page.goto(url, { waitUntil: "networkidle" });
  const ready = await page.evaluate(() => !document.querySelector("#start-panel")?.classList.contains("hidden"));
  assert(ready, "mobile start panel was not visible");

  await page.locator("[data-control=throttle]").dispatchEvent("pointerdown");
  await page.locator("[data-control=right]").dispatchEvent("pointerdown");
  await page.waitForTimeout(3900);
  await page.locator("[data-control=right]").dispatchEvent("pointerup");
  await page.locator("[data-control=throttle]").dispatchEvent("pointerup");

  const state = await page.evaluate(() => {
    const status = document.querySelector(".status-panel")?.getBoundingClientRect();
    const steer = document.querySelector(".steer-pad")?.getBoundingClientRect();
    const pedals = document.querySelector(".pedal-pad")?.getBoundingClientRect();
    const throttle = document.querySelector("[data-control=throttle]")?.getBoundingClientRect();
    return {
      controlsDisplay: getComputedStyle(document.querySelector(".touch-controls")).display,
      speed: Number(document.querySelector("#speed")?.textContent ?? 0),
      objective: document.querySelector("#objective")?.textContent ?? "",
      canvasBox: document.querySelector("#game canvas")?.getBoundingClientRect().toJSON(),
      statusBottom: status?.bottom ?? 0,
      controlsTop: Math.min(steer?.top ?? Infinity, pedals?.top ?? Infinity),
      throttleWidth: throttle?.width ?? 0
    };
  });

  await page.close();
  assert(state.controlsDisplay === "grid", "mobile controls were not visible");
  assertCanvasBox(state.canvasBox, "mobile");
  assert(state.speed > 60, `mobile touch launch did not accelerate, speed=${state.speed}`);
  assert(/Catch|Hold/.test(state.objective), `mobile objective missing: ${state.objective}`);
  assert(state.statusBottom < state.controlsTop - 20, "mobile HUD overlaps touch controls");
  assert(state.throttleWidth >= 56, "mobile throttle button is too small");
}

async function waitForServer(target) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(target);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Server did not start. Logs:\n${logs.join("")}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not allocate smoke test port"));
        }
      });
    });
  });
}

function assertCanvasBox(box, label) {
  assert(Boolean(box), `${label} WebGL canvas box was unavailable`);
  assert(box.width >= 300 && box.height >= 300, `${label} WebGL canvas did not fill viewport`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
