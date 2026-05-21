import { spawn } from "node:child_process";
import { chromium } from "playwright";

const url = "http://127.0.0.1:5173/";
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
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
  const ready = await page.evaluate(() => ({
    startVisible: !document.querySelector("#start-panel")?.classList.contains("hidden"),
    speed: Number(document.querySelector("#speed")?.textContent ?? 0)
  }));
  assert(ready.startVisible, "desktop start panel was not visible");
  assert(ready.speed === 0, "desktop race moved before start");

  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(3900);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowUp");

  const state = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector("canvas")),
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    objective: document.querySelector("#objective")?.textContent ?? "",
    lapTime: document.querySelector("#current-lap-time")?.textContent ?? "",
    hintVisible: getComputedStyle(document.querySelector(".control-hint")).display !== "none",
    startVisible: !document.querySelector("#start-panel")?.classList.contains("hidden")
  }));

  await page.close();
  assert(state.canvas, "desktop canvas did not render");
  assert(state.speed > 60, `desktop launch did not accelerate, speed=${state.speed}`);
  assert(state.objective.includes("Gain"), `desktop objective missing: ${state.objective}`);
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
      statusBottom: status?.bottom ?? 0,
      controlsTop: Math.min(steer?.top ?? Infinity, pedals?.top ?? Infinity),
      throttleWidth: throttle?.width ?? 0
    };
  });

  await page.close();
  assert(state.controlsDisplay === "grid", "mobile controls were not visible");
  assert(state.speed > 60, `mobile touch launch did not accelerate, speed=${state.speed}`);
  assert(state.objective.includes("Gain"), `mobile objective missing: ${state.objective}`);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
