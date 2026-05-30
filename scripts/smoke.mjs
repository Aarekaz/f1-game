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
  await checkManualAssist(browser);
  await checkMobile(browser);
  await browser.close();
  console.log("Smoke test passed");
} finally {
  server.kill();
}

async function checkDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "apex-formula:pb:northstar:storm:balanced",
      JSON.stringify({
        bestTotalTime: 181.34,
        bestLap: 58.77,
        bestFlowScore: 0.82,
        bestPosition: 3,
        bestOvertakes: 5,
        cleanFinishes: 1,
        runs: 1,
        grade: "Apex",
        updatedAt: "2026-05-29T00:00:00.000Z"
      })
    );
  });
  await page.goto(url, { waitUntil: "networkidle" });

  const audioInitial = await page.evaluate(() => ({
    pressed: document.querySelector("#audio-toggle")?.getAttribute("aria-pressed") ?? "",
    label: document.querySelector("#audio-toggle")?.getAttribute("aria-label") ?? "",
    text: document.querySelector("#audio-toggle")?.textContent ?? ""
  }));
  await page.locator("#audio-toggle").click();
  const audioMuted = await page.evaluate(() => ({
    pressed: document.querySelector("#audio-toggle")?.getAttribute("aria-pressed") ?? "",
    label: document.querySelector("#audio-toggle")?.getAttribute("aria-label") ?? "",
    text: document.querySelector("#audio-toggle")?.textContent ?? "",
    stored: window.localStorage.getItem("apex-formula:audio-muted") ?? ""
  }));
  await page.locator("#audio-toggle").click();
  const audioUnmuted = await page.evaluate(() => ({
    pressed: document.querySelector("#audio-toggle")?.getAttribute("aria-pressed") ?? "",
    label: document.querySelector("#audio-toggle")?.getAttribute("aria-label") ?? "",
    text: document.querySelector("#audio-toggle")?.textContent ?? "",
    stored: window.localStorage.getItem("apex-formula:audio-muted") ?? ""
  }));
  const resultStewardFields = await page.evaluate(() => ({
    penalty: Boolean(document.querySelector("#result-penalty")),
    steward: Boolean(document.querySelector("#result-steward")),
    seriesScore: Boolean(document.querySelector("#result-series-score"))
  }));
  assert(audioInitial.pressed === "false" && audioInitial.text === "SND", `desktop audio toggle initial state was wrong: ${JSON.stringify(audioInitial)}`);
  assert(audioMuted.pressed === "true" && audioMuted.label === "Unmute audio" && audioMuted.text === "OFF", `desktop audio mute state was wrong: ${JSON.stringify(audioMuted)}`);
  assert(audioMuted.stored === "true", `desktop audio mute did not persist: ${audioMuted.stored}`);
  assert(audioUnmuted.pressed === "false" && audioUnmuted.text === "SND" && audioUnmuted.stored === "false", `desktop audio unmute state was wrong: ${JSON.stringify(audioUnmuted)}`);
  assert(resultStewardFields.penalty && resultStewardFields.steward, "desktop result steward fields were missing");
  assert(resultStewardFields.seriesScore, "desktop result series target score was missing");

  const seriesStart = await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll("#series-progress [data-series-event]")).map((row) => row.textContent ?? ""),
    active: document.querySelector("#series-progress [aria-current='true']")?.getAttribute("data-series-event") ?? ""
  }));
  assert(seriesStart.rows.length === 3, `desktop Apex Series rows missing: ${seriesStart.rows.join(" | ")}`);
  assert(/Storm Charge.*Northstar Ring.*Apex \/ P3/i.test(seriesStart.rows.join(" | ")), "desktop Apex Series did not show saved Northstar progress");
  assert(seriesStart.active === "aurelia-rhythm", `desktop Apex Series default event was not active: ${seriesStart.active}`);

  await page.locator("[data-series-event='mirage-dusk']").click();
  const seriesPick = await page.evaluate(() => ({
    trackSelect: document.querySelector("#track-select")?.value ?? "",
    weatherSelect: document.querySelector("#weather-select")?.value ?? "",
    assistSelect: document.querySelector("#assist-select")?.value ?? "",
    active: document.querySelector("#series-progress [aria-current='true']")?.getAttribute("data-series-event") ?? "",
    sessionBrief: document.querySelector("#session-brief")?.textContent ?? ""
  }));
  assert(seriesPick.trackSelect === "mirage", "desktop Apex Series event did not select Mirage");
  assert(seriesPick.weatherSelect === "dusk", "desktop Apex Series event did not select dusk weather");
  assert(seriesPick.assistSelect === "balanced", "desktop Apex Series event did not select balanced assists");
  assert(seriesPick.active === "mirage-dusk", `desktop Apex Series active row was wrong: ${seriesPick.active}`);
  assert(/gulf|marina|gold|settles/i.test(seriesPick.sessionBrief), `desktop Apex Series brief did not update: ${seriesPick.sessionBrief}`);

  await page.selectOption("#track-select", "northstar");
  await page.selectOption("#weather-select", "storm");
  const ready = await page.evaluate(() => ({
    startVisible: !document.querySelector("#start-panel")?.classList.contains("hidden"),
    trackSelect: document.querySelector("#track-select")?.value ?? "",
    weatherSelect: document.querySelector("#weather-select")?.value ?? "",
    assistSelect: document.querySelector("#assist-select")?.value ?? "",
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    sessionBrief: document.querySelector("#session-brief")?.textContent ?? "",
    briefingTrack: document.querySelector("#brief-track-name")?.textContent ?? "",
    briefingPath: document.querySelector("#brief-track-path")?.getAttribute("d") ?? "",
    briefingDifficulty: document.querySelector("#brief-difficulty")?.textContent ?? "",
    briefingGrip: document.querySelector("#brief-grip")?.textContent ?? "",
    briefingWeather: document.querySelector("#brief-weather")?.textContent ?? "",
    briefingAssist: document.querySelector("#brief-assist")?.textContent ?? "",
    sessionBest: document.querySelector("#session-best")?.textContent ?? "",
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    trackOffset: Number(document.querySelector("#game canvas")?.dataset.trackOffset ?? 0),
    carDistance: Number(document.querySelector("#game canvas")?.dataset.carDistance ?? 0),
    carWorldZ: Number(document.querySelector("#game canvas")?.dataset.carWorldZ ?? 0),
    carWorldY: Number(document.querySelector("#game canvas")?.dataset.carWorldY ?? 0),
    circuitWorldZ: Number(document.querySelector("#game canvas")?.dataset.circuitWorldZ ?? 0),
    carScreenX: Number(document.querySelector("#game canvas")?.dataset.carScreenX ?? 0),
    carScreenY: Number(document.querySelector("#game canvas")?.dataset.carScreenY ?? 0),
    carScreenZ: Number(document.querySelector("#game canvas")?.dataset.carScreenZ ?? 0),
    seriesTargetChip: document.querySelector("#series-target-chip")?.textContent ?? "",
    seriesTargetMode: document.querySelector("#series-target-chip")?.getAttribute("data-mode") ?? "",
    seriesActive: document.querySelector("#series-progress [aria-current='true']")?.getAttribute("data-series-event") ?? "",
    seriesRows: Array.from(document.querySelectorAll("#series-progress [data-series-event]")).map((row) => row.textContent ?? "")
  }));
  assert(ready.startVisible, "desktop start panel was not visible");
  assert(ready.trackSelect === "northstar", "desktop fictional track selector did not update");
  assert(ready.weatherSelect === "storm", "desktop fictional weather selector did not update");
  assert(ready.assistSelect === "balanced", "desktop assist selector did not default to balanced");
  assert(ready.hudPhase === "ready", `desktop HUD did not expose ready phase: ${ready.hudPhase}`);
  assert(/alpine|wet|spray|settles/i.test(ready.sessionBrief), `desktop session brief did not describe selection: ${ready.sessionBrief}`);
  assert(ready.briefingTrack === "Northstar Ring", `desktop briefing track did not update: ${ready.briefingTrack}`);
  assert(ready.briefingPath.length > 100, "desktop briefing circuit outline was not drawn");
  assert(ready.briefingDifficulty === "90%", `desktop briefing difficulty was wrong: ${ready.briefingDifficulty}`);
  assert(ready.briefingGrip === "78%", `desktop briefing grip was wrong: ${ready.briefingGrip}`);
  assert(ready.briefingWeather === "Wet Storm", `desktop briefing weather was wrong: ${ready.briefingWeather}`);
  assert(ready.briefingAssist === "Balanced", `desktop briefing assist was wrong: ${ready.briefingAssist}`);
  assert(/Best|flow/i.test(ready.sessionBest), `desktop personal best readout missing: ${ready.sessionBest}`);
  assert(ready.seriesActive === "northstar-storm", `desktop Apex Series selected event did not stay active: ${ready.seriesActive}`);
  assert(ready.seriesTargetChip === "R3 target: Survive low grip", `desktop series target chip did not update: ${ready.seriesTargetChip}`);
  assert(ready.seriesTargetMode === "series", `desktop series target mode was wrong: ${ready.seriesTargetMode}`);
  assert(ready.seriesRows.length === 3, "desktop Apex Series row count changed after selection");
  assert(ready.speed === 0, "desktop race moved before start");

  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1200);
  const launch = await page.evaluate(() => ({
    objective: document.querySelector("#objective")?.textContent ?? "",
    cue: document.querySelector("#track-cue")?.textContent ?? "",
    paceTarget: document.querySelector("#pace-target")?.textContent ?? "",
    messageTitle: document.querySelector("#message strong")?.textContent ?? "",
    messageTone: document.querySelector("#message")?.getAttribute("data-tone") ?? "",
    launchCharge: Number(document.querySelector("#game canvas")?.dataset.launchCharge ?? 0)
  }));
  assert(/Launch/i.test(launch.objective), `desktop launch objective was not visible: ${launch.objective}`);
  assert(/revs|throttle|sweet/i.test(launch.cue), `desktop launch cue was not visible: ${launch.cue}`);
  assert(/launch/i.test(launch.paceTarget), `desktop launch quality was not visible: ${launch.paceTarget}`);
  assert(launch.messageTitle === "Formation ready", `desktop launch radio title was wrong: ${launch.messageTitle}`);
  assert(launch.messageTone === "launch", `desktop launch radio tone was wrong: ${launch.messageTone}`);
  assert(launch.launchCharge > 0.2, `desktop launch charge did not build during countdown, charge=${launch.launchCharge}`);
  await page.waitForTimeout(3900);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowUp");

  const state = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector("#game canvas")),
    canvasBox: document.querySelector("#game canvas")?.getBoundingClientRect().toJSON(),
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    gear: Number(document.querySelector("#gear")?.textContent ?? 0),
    shiftLightsActive: Number(document.querySelector("#shift-lights")?.dataset.activeLights ?? 0),
    shiftLightCount: document.querySelectorAll("#shift-lights i").length,
    objective: document.querySelector("#objective")?.textContent ?? "",
    timingRows: Array.from(document.querySelectorAll("#timing-tower div")).map((row) => row.textContent ?? ""),
    timingPlayer: document.querySelector("#timing-tower .player")?.textContent ?? "",
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
    carDistance: Number(document.querySelector("#game canvas")?.dataset.carDistance ?? 0),
    carWorldX: Number(document.querySelector("#game canvas")?.dataset.carWorldX ?? 0),
    carWorldZ: Number(document.querySelector("#game canvas")?.dataset.carWorldZ ?? 0),
    carWorldY: Number(document.querySelector("#game canvas")?.dataset.carWorldY ?? 0),
    circuitWorldZ: Number(document.querySelector("#game canvas")?.dataset.circuitWorldZ ?? 0),
    cameraWorldX: Number(document.querySelector("#game canvas")?.dataset.cameraWorldX ?? 0),
    cameraWorldY: Number(document.querySelector("#game canvas")?.dataset.cameraWorldY ?? 0),
    cameraWorldZ: Number(document.querySelector("#game canvas")?.dataset.cameraWorldZ ?? 0),
    cameraMode: document.querySelector("#game canvas")?.dataset.cameraMode ?? "",
    carScreenX: Number(document.querySelector("#game canvas")?.dataset.carScreenX ?? 0),
    carScreenY: Number(document.querySelector("#game canvas")?.dataset.carScreenY ?? 0),
    carScreenZ: Number(document.querySelector("#game canvas")?.dataset.carScreenZ ?? 0),
    carSlip: Number(document.querySelector("#game canvas")?.dataset.carSlip ?? 0),
    carWheelspin: Number(document.querySelector("#game canvas")?.dataset.carWheelspin ?? 0),
    carUndersteer: Number(document.querySelector("#game canvas")?.dataset.carUndersteer ?? 0),
    carLockup: Number(document.querySelector("#game canvas")?.dataset.carLockup ?? 0),
    carHeading: Number(document.querySelector("#game canvas")?.dataset.carHeading ?? 0),
    carYawRate: Number(document.querySelector("#game canvas")?.dataset.carYawRate ?? 0),
    wheelSpin: Number(document.querySelector("#game canvas")?.dataset.wheelSpin ?? 0),
    brakeGlow: Number(document.querySelector("#game canvas")?.dataset.brakeGlow ?? 0),
    flowScore: Number(document.querySelector("#game canvas")?.dataset.flowScore ?? 0),
    flowState: document.querySelector("#game canvas")?.dataset.flowState ?? "",
    flowMeter: document.querySelector("#flow")?.style.getPropertyValue("--value") ?? "",
    surfaceName: document.querySelector("#game canvas")?.dataset.surfaceName ?? "",
    surfaceGripModifier: Number(document.querySelector("#game canvas")?.dataset.surfaceGripModifier ?? 0),
    surfaceRumble: Number(document.querySelector("#game canvas")?.dataset.surfaceRumble ?? 0),
    draft: Number(document.querySelector("#game canvas")?.dataset.draft ?? 0),
    dirtyAir: Number(document.querySelector("#game canvas")?.dataset.dirtyAir ?? 0),
    rivalProximity: Number(document.querySelector("#game canvas")?.dataset.rivalProximity ?? 0),
    sideBySide: Number(document.querySelector("#game canvas")?.dataset.sideBySide ?? 0),
    contactRisk: Number(document.querySelector("#game canvas")?.dataset.contactRisk ?? 0),
    defensiveRivals: Number(document.querySelector("#game canvas")?.dataset.defensiveRivals ?? 0),
    nearestRivalGap: Number(document.querySelector("#game canvas")?.dataset.nearestRivalGap ?? NaN),
    racecraftState: document.querySelector("#game canvas")?.dataset.racecraftState ?? "",
    rainIntensity: Number(document.querySelector("#game canvas")?.dataset.rainIntensity ?? 0),
    roadWetness: Number(document.querySelector("#game canvas")?.dataset.roadWetness ?? 0),
    launchCharge: Number(document.querySelector("#game canvas")?.dataset.launchCharge ?? 0),
    launchQuality: Number(document.querySelector("#game canvas")?.dataset.launchQuality ?? 0),
    assistSteer: Number(document.querySelector("#game canvas")?.dataset.assistSteer ?? 0),
    assistBrake: Number(document.querySelector("#game canvas")?.dataset.assistBrake ?? 0),
    assistThrottleTrim: Number(document.querySelector("#game canvas")?.dataset.assistThrottleTrim ?? 0),
    assistChip: document.querySelector("#assist-chip")?.textContent ?? "",
    assistChipMode: document.querySelector("#assist-chip")?.getAttribute("data-mode") ?? "",
    seriesTargetChip: document.querySelector("#series-target-chip")?.textContent ?? "",
    seriesTargetMode: document.querySelector("#series-target-chip")?.getAttribute("data-mode") ?? "",
    messageTitle: document.querySelector("#message strong")?.textContent ?? "",
    messageTone: document.querySelector("#message")?.getAttribute("data-tone") ?? "",
    assetCar: document.querySelector("#game canvas")?.dataset.assetCar ?? "",
    tracksideAssets: document.querySelector("#game canvas")?.dataset.tracksideAssets ?? "",
    tracksideGrandstands: Number(document.querySelector("#game canvas")?.dataset.tracksideGrandstands ?? 0),
    tracksideLightPosts: Number(document.querySelector("#game canvas")?.dataset.tracksideLightPosts ?? 0),
    circuitDressingPieces: Number(document.querySelector("#game canvas")?.dataset.circuitDressingPieces ?? 0),
    circuitCatchFences: Number(document.querySelector("#game canvas")?.dataset.circuitCatchFences ?? 0),
    circuitPitWallModules: Number(document.querySelector("#game canvas")?.dataset.circuitPitWallModules ?? 0),
    circuitMarshalPosts: Number(document.querySelector("#game canvas")?.dataset.circuitMarshalPosts ?? 0),
    circuitCheckpointGates: Number(document.querySelector("#game canvas")?.dataset.circuitCheckpointGates ?? 0),
    circuitVenueHero: document.querySelector("#game canvas")?.dataset.circuitVenueHero ?? "",
    surfaceTerrainBands: Number(document.querySelector("#game canvas")?.dataset.surfaceTerrainBands ?? 0),
    surfaceRacingGroove: document.querySelector("#game canvas")?.dataset.surfaceRacingGroove ?? "",
    surfaceWetSheen: document.querySelector("#game canvas")?.dataset.surfaceWetSheen ?? "",
    surfaceEdgeLines: document.querySelector("#game canvas")?.dataset.surfaceEdgeLines ?? "",
    surfaceFlowCues: Number(document.querySelector("#game canvas")?.dataset.surfaceFlowCues ?? 0),
    surfaceGridSlots: Number(document.querySelector("#game canvas")?.dataset.surfaceGridSlots ?? 0),
    surfacePuddles: Number(document.querySelector("#game canvas")?.dataset.surfacePuddles ?? 0),
    surfaceWetSheenOpacity: Number(document.querySelector("#game canvas")?.dataset.surfaceWetSheenOpacity ?? 0),
    surfacePuddleOpacity: Number(document.querySelector("#game canvas")?.dataset.surfacePuddleOpacity ?? 0),
    racingLineAssist: document.querySelector("#game canvas")?.dataset.racingLineAssist ?? "",
    dynamicRacingLineSegments: Number(document.querySelector("#game canvas")?.dataset.dynamicRacingLineSegments ?? 0),
    racingLineCue: document.querySelector("#game canvas")?.dataset.racingLineCue ?? "",
    assetWeather: document.querySelector("#game canvas")?.dataset.weather ?? "",
    trackLayout: document.querySelector("#game canvas")?.dataset.trackLayout ?? "",
    horizonTrack: document.querySelector("#game canvas")?.dataset.horizonTrack ?? "",
    horizonRenderPolicy: document.querySelector("#game canvas")?.dataset.horizonRenderPolicy ?? "",
    horizonSkyDepthWrite: document.querySelector("#game canvas")?.dataset.horizonSkyDepthWrite ?? "",
    horizonSkyRenderOrder: Number(document.querySelector("#game canvas")?.dataset.horizonSkyRenderOrder ?? 0),
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    sessionTrack: document.querySelector("#session-track")?.textContent ?? "",
    sessionWeather: document.querySelector("#session-weather")?.textContent ?? "",
    streak: document.querySelector("#streak")?.textContent ?? "",
    hudCoverage: (() => {
      const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
      const selectors = [".topbar", "#timing-tower", ".status-panel", "#message:not(.hidden)"];
      const covered = selectors.reduce((total, selector) => {
        const element = document.querySelector(selector);
        if (!element) return total;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return total;
        const rect = element.getBoundingClientRect();
        return total + rect.width * rect.height;
      }, 0);
      return covered / viewportArea;
    })(),
    racingStatusWidth: document.querySelector(".status-panel")?.getBoundingClientRect().width ?? 0,
    racingTimingWidth: document.querySelector("#timing-tower")?.getBoundingClientRect().width ?? 0
  }));

  await page.keyboard.press("KeyC");
  await page.waitForTimeout(250);
  const podCamera = await page.evaluate(() => ({
    mode: document.querySelector("#game canvas")?.dataset.cameraMode ?? "",
    cameraWorldX: Number(document.querySelector("#game canvas")?.dataset.cameraWorldX ?? 0),
    cameraWorldY: Number(document.querySelector("#game canvas")?.dataset.cameraWorldY ?? 0),
    cameraWorldZ: Number(document.querySelector("#game canvas")?.dataset.cameraWorldZ ?? 0),
    carWorldX: Number(document.querySelector("#game canvas")?.dataset.carWorldX ?? 0),
    carWorldY: Number(document.querySelector("#game canvas")?.dataset.carWorldY ?? 0),
    carWorldZ: Number(document.querySelector("#game canvas")?.dataset.carWorldZ ?? 0)
  }));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const pausedState = await page.evaluate(() => ({
    paused: document.querySelector(".hud")?.dataset.paused ?? "",
    pauseVisible: !document.querySelector("#pause-panel")?.classList.contains("hidden"),
    pausePosition: document.querySelector("#pause-position")?.textContent ?? "",
    pauseLap: document.querySelector("#pause-lap")?.textContent ?? "",
    pauseSection: document.querySelector("#pause-section")?.textContent ?? "",
    carDistance: Number(document.querySelector("#game canvas")?.dataset.carDistance ?? 0)
  }));
  await page.waitForTimeout(550);
  const stillPaused = await page.evaluate(() => ({
    carDistance: Number(document.querySelector("#game canvas")?.dataset.carDistance ?? 0)
  }));
  await page.locator("#restart-session").click();
  await page.waitForTimeout(250);
  const restartedFromPause = await page.evaluate(() => ({
    paused: document.querySelector(".hud")?.dataset.paused ?? "",
    pauseVisible: !document.querySelector("#pause-panel")?.classList.contains("hidden"),
    startVisible: !document.querySelector("#start-panel")?.classList.contains("hidden"),
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    carDistance: Number(document.querySelector("#game canvas")?.dataset.carDistance ?? 0)
  }));
  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(3900);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowUp");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const resumedState = await page.evaluate(() => ({
    paused: document.querySelector(".hud")?.dataset.paused ?? "",
    pauseVisible: !document.querySelector("#pause-panel")?.classList.contains("hidden")
  }));

  await page.close();
  assert(state.canvas, "desktop canvas did not render");
  assertCanvasBox(state.canvasBox, "desktop");
  assert(state.trackOffset > ready.trackOffset + 10, "desktop WebGL track did not advance after launch");
  assert(state.carDistance > ready.carDistance + 10, "desktop car distance did not advance after launch");
  assert(Math.abs(state.carWorldZ - ready.carWorldZ) > 10, "desktop car did not move through world-space circuit coordinates");
  assert(Number.isFinite(state.carWorldY) && state.carWorldY > 0.5, "desktop car did not receive elevated track height");
  assert(state.circuitWorldZ === ready.circuitWorldZ, "desktop circuit moved instead of staying in world space");
  assert(Number.isFinite(state.cameraWorldX), "desktop chase camera X telemetry was missing");
  assert(state.cameraMode === "chase", `desktop default camera mode was wrong: ${state.cameraMode}`);
  assert(Number.isFinite(state.cameraWorldY) && state.cameraWorldY > state.carWorldY, "desktop chase camera did not sit above the car");
  assert(Math.abs(state.cameraWorldZ - state.carWorldZ) > 3, "desktop chase camera did not separate from the car in world space");
  assert(podCamera.mode === "pod", `desktop camera toggle did not enter pod mode: ${podCamera.mode}`);
  assert(
    Math.hypot(podCamera.cameraWorldX - podCamera.carWorldX, podCamera.cameraWorldZ - podCamera.carWorldZ) <
      Math.hypot(state.cameraWorldX - state.carWorldX, state.cameraWorldZ - state.carWorldZ),
    "desktop pod camera did not move closer to the car"
  );
  assert(pausedState.paused === "true", `desktop pause did not set HUD paused state: ${pausedState.paused}`);
  assert(pausedState.pauseVisible, "desktop pause panel did not become visible");
  assert(/P\d+/.test(pausedState.pausePosition), `desktop pause position summary was missing: ${pausedState.pausePosition}`);
  assert(/\d\/\d/.test(pausedState.pauseLap), `desktop pause lap summary was missing: ${pausedState.pauseLap}`);
  assert(pausedState.pauseSection.length > 0, "desktop pause section summary was missing");
  assert(Math.abs(stillPaused.carDistance - pausedState.carDistance) < 0.05, "desktop car kept moving while paused");
  assert(restartedFromPause.paused === "false", `desktop pause restart did not clear paused state: ${restartedFromPause.paused}`);
  assert(!restartedFromPause.pauseVisible, "desktop pause restart left pause panel visible");
  assert(restartedFromPause.startVisible, "desktop pause restart did not return to setup panel");
  assert(restartedFromPause.hudPhase === "ready", `desktop pause restart did not reset HUD phase: ${restartedFromPause.hudPhase}`);
  assert(restartedFromPause.speed === 0, `desktop pause restart did not reset speed: ${restartedFromPause.speed}`);
  assert(restartedFromPause.carDistance === 0, `desktop pause restart did not reset car distance: ${restartedFromPause.carDistance}`);
  assert(resumedState.paused === "false", `desktop resume did not clear HUD paused state: ${resumedState.paused}`);
  assert(!resumedState.pauseVisible, "desktop pause panel stayed visible after resume");
  assert(
    Math.hypot(state.carScreenX - ready.carScreenX, state.carScreenY - ready.carScreenY) > 0.025,
    "desktop car stayed visually pinned to the same screen position"
  );
  assert(Number.isFinite(state.carScreenX), "desktop car screen-space X telemetry was missing");
  assert(Math.abs(state.carScreenX) < 0.72, `desktop car drifted too far horizontally in frame: ${state.carScreenX}`);
  assert(state.carScreenY > -0.55 && state.carScreenY < 0.72, `desktop car drifted too far vertically in frame: ${state.carScreenY}`);
  assert(state.carScreenZ > -1 && state.carScreenZ < 1, `desktop car was outside camera depth range: ${state.carScreenZ}`);
  assert(Number.isFinite(state.carHeading), "desktop car heading telemetry was missing");
  assert(Number.isFinite(state.carYawRate), "desktop car yaw-rate telemetry was missing");
  assert(Number.isFinite(state.carSlip), "desktop slip telemetry was missing");
  assert(Number.isFinite(state.carWheelspin), "desktop wheelspin telemetry was missing");
  assert(Number.isFinite(state.carUndersteer), "desktop understeer telemetry was missing");
  assert(Number.isFinite(state.carLockup), "desktop brake-lock telemetry was missing");
  assert(Number.isFinite(state.wheelSpin) && Math.abs(state.wheelSpin) > 10, "desktop animated wheel spin telemetry was missing");
  assert(Number.isFinite(state.brakeGlow), "desktop brake glow telemetry was missing");
  assert(state.flowScore > 0 && state.flowScore <= 1, `desktop flow score was missing: ${state.flowScore}`);
  assert(state.flowState.length > 0, "desktop flow state was missing");
  assert(/%/.test(state.flowMeter), `desktop flow meter did not update: ${state.flowMeter}`);
  assert(/Asphalt|Kerb|Runoff|Gravel/.test(state.surfaceName), `desktop surface name was missing: ${state.surfaceName}`);
  assert(state.surfaceGripModifier > 0 && state.surfaceGripModifier <= 1, `desktop surface grip modifier was invalid: ${state.surfaceGripModifier}`);
  assert(Number.isFinite(state.surfaceRumble), "desktop surface rumble telemetry was missing");
  assert(Number.isFinite(state.draft), "desktop draft telemetry was missing");
  assert(Number.isFinite(state.dirtyAir), "desktop dirty-air telemetry was missing");
  assert(Number.isFinite(state.rivalProximity), "desktop rival proximity telemetry was missing");
  assert(Number.isFinite(state.sideBySide), "desktop side-by-side telemetry was missing");
  assert(Number.isFinite(state.contactRisk), "desktop contact-risk telemetry was missing");
  assert(Number.isFinite(state.defensiveRivals), "desktop defensive-rival telemetry was missing");
  assert(Number.isFinite(state.nearestRivalGap), "desktop nearest-rival gap telemetry was missing");
  assert(state.racecraftState.length > 0, "desktop racecraft state was missing");
  assert(/air|rival|wheel|contact|defensive|overtakes|slipstream|rhythm|zone|untidy|reset|kerb|runoff|gravel/i.test(state.streak), `desktop racecraft HUD was missing: ${state.streak}`);
  assert(state.rainIntensity > 0.8, `desktop rain intensity did not reach renderer, rain=${state.rainIntensity}`);
  assert(state.roadWetness > 0.8, `desktop road wetness did not reach renderer, wetness=${state.roadWetness}`);
  assert(state.launchCharge > 0.5, `desktop launch charge did not build during countdown, charge=${state.launchCharge}`);
  assert(Number.isFinite(state.launchQuality), "desktop launch quality telemetry was missing");
  assert(Number.isFinite(state.assistSteer), "desktop assist steering telemetry was missing");
  assert(Number.isFinite(state.assistBrake), "desktop assist brake telemetry was missing");
  assert(Number.isFinite(state.assistThrottleTrim), "desktop assist throttle telemetry was missing");
  assert(/assist|Manual/i.test(state.assistChip), `desktop assist chip was missing: ${state.assistChip}`);
  assert(["ready", "active", "manual"].includes(state.assistChipMode), `desktop assist chip mode was invalid: ${state.assistChipMode}`);
  assert(state.seriesTargetChip === "R3 target: Survive low grip", `desktop racing target chip was wrong: ${state.seriesTargetChip}`);
  assert(state.seriesTargetMode === "series", `desktop racing target mode was wrong: ${state.seriesTargetMode}`);
  assert(state.speed > 60, `desktop launch did not accelerate, speed=${state.speed}`);
  assert(state.gear >= 1, "desktop gear readout was missing");
  assert(state.shiftLightCount === 5, `desktop shift-light cluster was incomplete: ${state.shiftLightCount}`);
  assert(state.shiftLightsActive > 0, `desktop shift lights did not react to RPM: ${state.shiftLightsActive}`);
  assert(state.assetCar === "apex-procedural-f25", `desktop fictional formula car did not load, asset=${state.assetCar}`);
  assert(state.tracksideAssets === "kenney", `desktop free trackside assets did not load, assets=${state.tracksideAssets}`);
  assert(state.tracksideGrandstands >= 4, `desktop free grandstand assets did not load, grandstands=${state.tracksideGrandstands}`);
  assert(state.tracksideLightPosts >= 4, `desktop free light-post assets did not load, lights=${state.tracksideLightPosts}`);
  assert(state.circuitDressingPieces >= 280, `desktop circuit dressing was too sparse: ${state.circuitDressingPieces}`);
  assert(state.circuitCatchFences >= 90, `desktop catch fencing was missing: ${state.circuitCatchFences}`);
  assert(state.circuitPitWallModules >= 5, `desktop pit wall modules were missing: ${state.circuitPitWallModules}`);
  assert(state.circuitMarshalPosts >= 3, `desktop marshal posts were missing: ${state.circuitMarshalPosts}`);
  assert(state.circuitCheckpointGates >= 7, `desktop checkpoint gates were missing: ${state.circuitCheckpointGates}`);
  assert(/northstar-venue-hero/.test(state.circuitVenueHero), `desktop venue hero did not match selected track: ${state.circuitVenueHero}`);
  assert(state.surfaceTerrainBands >= 2, `desktop terrain was not split into road-safe bands: ${state.surfaceTerrainBands}`);
  assert(state.surfaceRacingGroove === "rubbered-racing-groove", `desktop rubbered racing groove was missing: ${state.surfaceRacingGroove}`);
  assert(state.surfaceWetSheen === "wet-asphalt-sheen", `desktop wet surface sheen was missing: ${state.surfaceWetSheen}`);
  assert(/painted-left-track-edge/.test(state.surfaceEdgeLines), `desktop painted edge lines were missing: ${state.surfaceEdgeLines}`);
  assert(state.surfaceFlowCues >= 20, `desktop apex flow cues were too sparse: ${state.surfaceFlowCues}`);
  assert(state.surfaceGridSlots >= 10, `desktop painted grid slots were missing: ${state.surfaceGridSlots}`);
  assert(state.surfacePuddles >= 5, `desktop standing water details were missing: ${state.surfacePuddles}`);
  assert(state.surfaceWetSheenOpacity > 0.1, `desktop wet sheen did not react to storm weather: ${state.surfaceWetSheenOpacity}`);
  assert(state.surfacePuddleOpacity > 0.2, `desktop puddles did not react to storm weather: ${state.surfacePuddleOpacity}`);
  assert(state.racingLineAssist === "dynamic", `desktop dynamic racing line did not activate: ${state.racingLineAssist}`);
  assert(state.dynamicRacingLineSegments >= 24, `desktop dynamic racing line segments missing: ${state.dynamicRacingLineSegments}`);
  assert(["brake", "apex", "exit", "commit"].includes(state.racingLineCue), `desktop racing line cue was missing: ${state.racingLineCue}`);
  assert(state.assetWeather === "Wet Storm", `desktop weather did not reach renderer, weather=${state.assetWeather}`);
  assert(state.trackLayout === "northstar", `desktop selected layout did not reach renderer, layout=${state.trackLayout}`);
  assert(state.horizonTrack === "northstar", `desktop selected layout did not rebuild horizon, horizon=${state.horizonTrack}`);
  assert(state.horizonRenderPolicy === "background-depth-safe", `desktop horizon render policy was unsafe: ${state.horizonRenderPolicy}`);
  assert(state.horizonSkyDepthWrite === "false", `desktop horizon sky wrote to depth: ${state.horizonSkyDepthWrite}`);
  assert(state.horizonSkyRenderOrder <= -1000, `desktop horizon sky did not render behind the world: ${state.horizonSkyRenderOrder}`);
  assert(state.hudPhase === "racing", `desktop HUD did not switch into racing phase: ${state.hudPhase}`);
  assert(state.hudCoverage < 0.16, `desktop racing HUD covered too much of the playfield: ${state.hudCoverage}`);
  assert(state.racingStatusWidth <= 250, `desktop racing status panel was too wide: ${state.racingStatusWidth}`);
  assert(state.racingTimingWidth <= 216, `desktop racing timing tower was too wide: ${state.racingTimingWidth}`);
  assert(state.sessionTrack === "Northstar Ring", `desktop session track missing: ${state.sessionTrack}`);
  assert(state.sessionWeather === "Wet Storm / Balanced", `desktop session weather and assist missing: ${state.sessionWeather}`);
  assert(state.mapPath.length > 100, "desktop minimap path was not drawn");
  assert(state.mapCarX > 0, "desktop minimap car marker was not positioned");
  assert(state.instruction.length > 0, "desktop track instruction was missing");
  assert(/kph/i.test(state.paceTarget), `desktop pace target missing: ${state.paceTarget}`);
  assert(/Catch|Hold/.test(state.objective), `desktop objective missing: ${state.objective}`);
  assert(state.timingRows.length >= 4, `desktop timing tower rows missing: ${state.timingRows.join(" | ")}`);
  assert(/P\d+/.test(state.timingPlayer) && /You|APEX|LIVE/.test(state.timingPlayer), `desktop timing tower player row missing: ${state.timingPlayer}`);
  assert(state.section.length > 0, "desktop circuit section was missing");
  assert(state.cue.length > 0, "desktop driving cue was missing");
  assert(/\d\/[67]/.test(state.checkpoint), `desktop checkpoint readout missing: ${state.checkpoint}`);
  assert(state.penalty.length > 0, "desktop penalty readout was missing");
  assert(state.lapTime !== "0.00", "desktop lap timer did not advance");
  assert(!state.hintVisible, "desktop keyboard hint stayed visible during racing");
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
    const camera = document.querySelector("[data-control=camera]")?.getBoundingClientRect();
    const pause = document.querySelector("#pause-race")?.getBoundingClientRect();
    return {
      controlsDisplay: getComputedStyle(document.querySelector(".touch-controls")).display,
      pauseDisplay: getComputedStyle(document.querySelector("#pause-race")).display,
      racingTimingDisplay: getComputedStyle(document.querySelector("#timing-tower")).display,
      speed: Number(document.querySelector("#speed")?.textContent ?? 0),
      objective: document.querySelector("#objective")?.textContent ?? "",
      canvasBox: document.querySelector("#game canvas")?.getBoundingClientRect().toJSON(),
      statusWidth: status?.width ?? 0,
      statusBottom: status?.bottom ?? 0,
      controlsTop: Math.min(steer?.top ?? Infinity, pedals?.top ?? Infinity),
      pauseTop: pause?.top ?? Infinity,
      throttleWidth: throttle?.width ?? 0,
      cameraWidth: camera?.width ?? 0
    };
  });

  await page.locator("#pause-race").click();
  await page.waitForTimeout(200);
  const pausedState = await page.evaluate(() => ({
    paused: document.querySelector(".hud")?.dataset.paused ?? "",
    pauseVisible: !document.querySelector("#pause-panel")?.classList.contains("hidden"),
    controlsDisplay: getComputedStyle(document.querySelector(".touch-controls")).display
  }));
  await page.locator("#resume-race").click();
  await page.waitForTimeout(200);
  const resumedState = await page.evaluate(() => ({
    paused: document.querySelector(".hud")?.dataset.paused ?? "",
    pauseVisible: !document.querySelector("#pause-panel")?.classList.contains("hidden")
  }));

  await page.locator("[data-control=camera]").dispatchEvent("pointerdown");
  await page.locator("[data-control=camera]").dispatchEvent("pointerup");
  await page.waitForTimeout(200);
  const cameraState = await page.evaluate(() => ({
    mode: document.querySelector("#game canvas")?.dataset.cameraMode ?? ""
  }));

  const finishedState = await page.evaluate(() => {
    document.querySelector(".hud").dataset.phase = "finished";
    return {
      controlsDisplay: getComputedStyle(document.querySelector(".touch-controls")).display
    };
  });

  await page.close();
  assert(state.controlsDisplay === "grid", "mobile controls were not visible");
  assert(state.pauseDisplay === "grid", "mobile pause button was not visible during racing");
  assert(state.pauseTop < state.controlsTop, "mobile pause button overlapped driving controls");
  assert(pausedState.paused === "true", `mobile pause did not set HUD paused state: ${pausedState.paused}`);
  assert(pausedState.pauseVisible, "mobile pause panel did not become visible");
  assert(pausedState.controlsDisplay === "none", "mobile driving controls stayed visible while paused");
  assert(resumedState.paused === "false", `mobile resume did not clear HUD paused state: ${resumedState.paused}`);
  assert(!resumedState.pauseVisible, "mobile pause panel stayed visible after resume");
  assert(cameraState.mode === "pod", `mobile camera button did not toggle camera mode: ${cameraState.mode}`);
  assert(finishedState.controlsDisplay === "none", "mobile controls stayed visible after race finish");
  assert(state.racingTimingDisplay === "none", "mobile racing timing tower should collapse to protect the playfield");
  assertCanvasBox(state.canvasBox, "mobile");
  assert(state.speed > 60, `mobile touch launch did not accelerate, speed=${state.speed}`);
  assert(/Catch|Hold/.test(state.objective), `mobile objective missing: ${state.objective}`);
  assert(state.statusWidth <= 170, `mobile racing status panel was too wide: ${state.statusWidth}`);
  assert(state.statusBottom < state.controlsTop - 20, "mobile HUD overlaps touch controls");
  assert(state.throttleWidth >= 56, "mobile throttle button is too small");
  assert(state.cameraWidth >= 38, "mobile camera button is too small");
}

async function checkManualAssist(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.selectOption("#assist-select", "manual");
  await page.click("#start-race");
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(4200);
  await page.keyboard.up("ArrowUp");

  const state = await page.evaluate(() => ({
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    sessionWeather: document.querySelector("#session-weather")?.textContent ?? "",
    racingLineAssist: document.querySelector("#game canvas")?.dataset.racingLineAssist ?? "",
    dynamicRacingLineSegments: Number(document.querySelector("#game canvas")?.dataset.dynamicRacingLineSegments ?? 0),
    assistSteer: Number(document.querySelector("#game canvas")?.dataset.assistSteer ?? 0),
    assistBrake: Number(document.querySelector("#game canvas")?.dataset.assistBrake ?? 0),
    assistThrottleTrim: Number(document.querySelector("#game canvas")?.dataset.assistThrottleTrim ?? 0),
    assistChip: document.querySelector("#assist-chip")?.textContent ?? "",
    assistChipMode: document.querySelector("#assist-chip")?.getAttribute("data-mode") ?? "",
    seriesTargetChip: document.querySelector("#series-target-chip")?.textContent ?? "",
    seriesTargetMode: document.querySelector("#series-target-chip")?.getAttribute("data-mode") ?? ""
  }));

  await page.close();
  assert(state.hudPhase === "racing", `manual smoke did not enter racing phase: ${state.hudPhase}`);
  assert(/Manual/.test(state.sessionWeather), `manual session readout did not expose manual assist: ${state.sessionWeather}`);
  assert(state.racingLineAssist === "manual-off", `manual racing line assist stayed visible: ${state.racingLineAssist}`);
  assert(state.dynamicRacingLineSegments === 0, `manual racing line segments stayed active: ${state.dynamicRacingLineSegments}`);
  assert(state.assistSteer === 0, `manual steering assist was not zero: ${state.assistSteer}`);
  assert(state.assistBrake === 0, `manual brake assist was not zero: ${state.assistBrake}`);
  assert(state.assistThrottleTrim === 0, `manual throttle assist was not zero: ${state.assistThrottleTrim}`);
  assert(state.assistChip === "Manual drive", `manual assist chip was wrong: ${state.assistChip}`);
  assert(state.assistChipMode === "manual", `manual assist chip mode was wrong: ${state.assistChipMode}`);
  assert(state.seriesTargetChip === "Free run", `manual non-series target was wrong: ${state.seriesTargetChip}`);
  assert(state.seriesTargetMode === "free", `manual non-series target mode was wrong: ${state.seriesTargetMode}`);
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
