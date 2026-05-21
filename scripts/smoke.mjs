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
  await page.keyboard.press("Space");
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector("canvas")),
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    messageClass: document.querySelector("#message")?.className ?? ""
  }));

  await page.close();
  assert(state.canvas, "desktop canvas did not render");
  assert(state.speed > 60, `desktop launch did not accelerate, speed=${state.speed}`);
  assert(state.messageClass.includes("hidden"), "desktop launch prompt stayed visible");
}

async function checkMobile(browser) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("[data-control=right]").dispatchEvent("pointerdown");
  await page.waitForTimeout(700);
  await page.locator("[data-control=right]").dispatchEvent("pointerup");

  const state = await page.evaluate(() => {
    const status = document.querySelector(".status-panel")?.getBoundingClientRect();
    const controls = document.querySelector(".touch-controls")?.getBoundingClientRect();
    return {
      controlsDisplay: getComputedStyle(document.querySelector(".touch-controls")).display,
      speed: Number(document.querySelector("#speed")?.textContent ?? 0),
      statusBottom: status?.bottom ?? 0,
      controlsTop: controls?.top ?? 0
    };
  });

  await page.close();
  assert(state.controlsDisplay === "grid", "mobile controls were not visible");
  assert(state.speed > 60, `mobile touch launch did not accelerate, speed=${state.speed}`);
  assert(state.statusBottom < state.controlsTop - 20, "mobile HUD overlaps touch controls");
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
