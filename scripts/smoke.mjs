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
        seriesTargetMet: true,
        seriesTargetMetAt: "2026-05-29T00:00:00.000Z",
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
    seriesScore: Boolean(document.querySelector("#result-series-score")),
    seriesDetail: Boolean(document.querySelector("#result-series-detail")),
    restart: Boolean(document.querySelector("#restart-race"))
  }));
  assert(audioInitial.pressed === "false" && audioInitial.text === "SND", `desktop audio toggle initial state was wrong: ${JSON.stringify(audioInitial)}`);
  assert(audioMuted.pressed === "true" && audioMuted.label === "Unmute audio" && audioMuted.text === "OFF", `desktop audio mute state was wrong: ${JSON.stringify(audioMuted)}`);
  assert(audioMuted.stored === "true", `desktop audio mute did not persist: ${audioMuted.stored}`);
  assert(audioUnmuted.pressed === "false" && audioUnmuted.text === "SND" && audioUnmuted.stored === "false", `desktop audio unmute state was wrong: ${JSON.stringify(audioUnmuted)}`);
  assert(resultStewardFields.penalty && resultStewardFields.steward, "desktop result steward fields were missing");
  assert(resultStewardFields.seriesScore, "desktop result series target score was missing");
  assert(resultStewardFields.seriesDetail, "desktop result series target detail was missing");
  assert(resultStewardFields.restart, "desktop result restart action was missing");

  const seriesStart = await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll("#series-progress [data-series-event]")).map((row) => row.textContent ?? ""),
    active: document.querySelector("#series-progress [aria-current='true']")?.getAttribute("data-series-event") ?? ""
  }));
  assert(seriesStart.rows.length === 3, `desktop Apex Series rows missing: ${seriesStart.rows.join(" | ")}`);
  assert(/Storm Charge.*Northstar Ring.*Target met \/ Apex/i.test(seriesStart.rows.join(" | ")), "desktop Apex Series did not show cleared Northstar progress");
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
    targetContractMode: document.querySelector("#target-contract")?.getAttribute("data-mode") ?? "",
    targetContractTitle: document.querySelector("#target-contract-title")?.textContent ?? "",
    targetContractGoal: document.querySelector("#target-contract-goal")?.textContent ?? "",
    targetContractCriteria: document.querySelector("#target-contract-criteria")?.textContent ?? "",
    sessionBest: document.querySelector("#session-best")?.textContent ?? "",
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    trackOffset: Number(document.querySelector("#game canvas")?.dataset.trackOffset ?? 0),
    carDistance: Number(document.querySelector("#game canvas")?.dataset.carDistance ?? 0),
    carWorldX: Number(document.querySelector("#game canvas")?.dataset.carWorldX ?? 0),
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
  assert(ready.targetContractMode === "series", `desktop target contract mode was wrong: ${ready.targetContractMode}`);
  assert(ready.targetContractTitle === "R3 Storm Charge", `desktop target contract title was wrong: ${ready.targetContractTitle}`);
  assert(ready.targetContractGoal === "Survive low grip", `desktop target contract goal was wrong: ${ready.targetContractGoal}`);
  assert(ready.targetContractCriteria === "P5 / 48% flow / warnings ok / 3s max", `desktop target contract criteria was wrong: ${ready.targetContractCriteria}`);
  assert(/Best|flow/i.test(ready.sessionBest), `desktop personal best readout missing: ${ready.sessionBest}`);
  assert(ready.seriesActive === "northstar-storm", `desktop Apex Series selected event did not stay active: ${ready.seriesActive}`);
  assert(ready.seriesTargetChip === "R3 target: Survive low grip", `desktop series target chip did not update: ${ready.seriesTargetChip}`);
  assert(ready.seriesTargetMode === "series", `desktop series target mode was wrong: ${ready.seriesTargetMode}`);
  assert(ready.seriesRows.length === 3, "desktop Apex Series row count changed after selection");
  assert(ready.speed === 0, "desktop race moved before start");

  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("Shift");
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
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("#game canvas");
      return (
        Number(document.querySelector("#speed")?.textContent ?? 0) > 120 &&
        canvas?.dataset.aeroBoostAvailable === "true" &&
        Number(canvas?.dataset.aeroBoostActive ?? 0) > 0.35 &&
        Number(canvas?.dataset.ersDeployGlow ?? 0) > 0.6
      );
    },
    undefined,
    { timeout: 12000 }
  );
  const boostHeldState = await page.evaluate(() => ({
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    ersDeployGlow: Number(document.querySelector("#game canvas")?.dataset.ersDeployGlow ?? 0),
    aeroBoostAvailable: document.querySelector("#game canvas")?.dataset.aeroBoostAvailable ?? "",
    aeroBoostActive: Number(document.querySelector("#game canvas")?.dataset.aeroBoostActive ?? 0),
    aeroDragReduction: Number(document.querySelector("#game canvas")?.dataset.aeroDragReduction ?? 0),
    rearAeroFlap: Number(document.querySelector("#game canvas")?.dataset.rearAeroFlap ?? 0)
  }));
  await page.keyboard.up("Shift");
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    () => Number(document.querySelector("#game canvas")?.dataset.airWakeIntensity ?? 0) > 0.01,
    undefined,
    { timeout: 3000 }
  );
  const trafficWakeState = await page.evaluate(() => ({
    airWakeIntensity: Number(document.querySelector("#game canvas")?.dataset.airWakeIntensity ?? 0),
    airWakeRibbons: Number(document.querySelector("#game canvas")?.dataset.airWakeRibbons ?? 0)
  }));
  await page.waitForFunction(
    () => Number(document.querySelector("#game canvas")?.dataset.cameraRejoinFocus ?? 0) > 0.08,
    undefined,
    { timeout: 5000 }
  );
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
    cameraChaseDistance: Number(document.querySelector("#game canvas")?.dataset.cameraChaseDistance ?? 0),
    cameraObstructionCandidates: Number(document.querySelector("#game canvas")?.dataset.cameraObstructionCandidates ?? 0),
    cameraObstructionCulled: Number(document.querySelector("#game canvas")?.dataset.cameraObstructionCulled ?? 0),
    cameraBarrierObstructionsCulled: Number(document.querySelector("#game canvas")?.dataset.cameraBarrierObstructionsCulled ?? 0),
    cameraGateObstructionsCulled: Number(document.querySelector("#game canvas")?.dataset.cameraGateObstructionsCulled ?? 0),
    cameraBoardObstructionsCulled: Number(document.querySelector("#game canvas")?.dataset.cameraBoardObstructionsCulled ?? 0),
    cameraBuffet: Number(document.querySelector("#game canvas")?.dataset.cameraBuffet ?? 0),
    cameraLookAhead: Number(document.querySelector("#game canvas")?.dataset.cameraLookAhead ?? 0),
    cameraMotionRig: document.querySelector("#game canvas")?.dataset.cameraMotionRig ?? "",
    cameraLongitudinalInertia: Number(document.querySelector("#game canvas")?.dataset.cameraLongitudinalInertia ?? 0),
    cameraLateralInertia: Number(document.querySelector("#game canvas")?.dataset.cameraLateralInertia ?? 0),
    cameraVerticalInertia: Number(document.querySelector("#game canvas")?.dataset.cameraVerticalInertia ?? 0),
    cameraRoadFrameDrift: Number(document.querySelector("#game canvas")?.dataset.cameraRoadFrameDrift ?? 0),
    cameraSpeedDeltaKphPerSecond: Number(document.querySelector("#game canvas")?.dataset.cameraSpeedDeltaKphPerSecond ?? 0),
    cameraApexBias: Number(document.querySelector("#game canvas")?.dataset.cameraApexBias ?? 0),
    cameraRoadSpeedFraming: Number(document.querySelector("#game canvas")?.dataset.cameraRoadSpeedFraming ?? 0),
    cameraStructureLift: Number(document.querySelector("#game canvas")?.dataset.cameraStructureLift ?? 0),
    cameraRejoinLift: Number(document.querySelector("#game canvas")?.dataset.cameraRejoinLift ?? 0),
    cameraRejoinFocus: Number(document.querySelector("#game canvas")?.dataset.cameraRejoinFocus ?? 0),
    cameraRoadRecoveryFocus: Number(document.querySelector("#game canvas")?.dataset.cameraRoadRecoveryFocus ?? 0),
    cameraRoadTargetDelta: Number(document.querySelector("#game canvas")?.dataset.cameraRoadTargetDelta ?? 0),
    cameraRoll: Number(document.querySelector("#game canvas")?.dataset.cameraRoll ?? 0),
    cameraFov: Number(document.querySelector("#game canvas")?.dataset.cameraFov ?? 0),
    cameraFrameGuard: Number(document.querySelector("#game canvas")?.dataset.cameraFrameGuard ?? 0),
    carScreenX: Number(document.querySelector("#game canvas")?.dataset.carScreenX ?? 0),
    carScreenY: Number(document.querySelector("#game canvas")?.dataset.carScreenY ?? 0),
    carScreenZ: Number(document.querySelector("#game canvas")?.dataset.carScreenZ ?? 0),
    carSlip: Number(document.querySelector("#game canvas")?.dataset.carSlip ?? 0),
    carWheelspin: Number(document.querySelector("#game canvas")?.dataset.carWheelspin ?? 0),
    carUndersteer: Number(document.querySelector("#game canvas")?.dataset.carUndersteer ?? 0),
    carLockup: Number(document.querySelector("#game canvas")?.dataset.carLockup ?? 0),
    carSteering: Number(document.querySelector("#game canvas")?.dataset.carSteering ?? 0),
    carHeading: Number(document.querySelector("#game canvas")?.dataset.carHeading ?? 0),
    carYawRate: Number(document.querySelector("#game canvas")?.dataset.carYawRate ?? 0),
    wheelSpin: Number(document.querySelector("#game canvas")?.dataset.wheelSpin ?? 0),
    carGroundShadow: document.querySelector("#game canvas")?.dataset.carGroundShadow ?? "",
    carGroundShadowOpacity: Number(document.querySelector("#game canvas")?.dataset.carGroundShadowOpacity ?? 0),
    carGroundShadowLength: Number(document.querySelector("#game canvas")?.dataset.carGroundShadowLength ?? 0),
    speedStreaks: document.querySelector("#game canvas")?.dataset.speedStreaks ?? "",
    speedStreakOpacity: Number(document.querySelector("#game canvas")?.dataset.speedStreakOpacity ?? 0),
    speedStreakCount: Number(document.querySelector("#game canvas")?.dataset.speedStreakCount ?? 0),
    brakeGlow: Number(document.querySelector("#game canvas")?.dataset.brakeGlow ?? 0),
    brakePressureTrail: Number(document.querySelector("#game canvas")?.dataset.brakePressureTrail ?? 0),
    brakePressureMarks: Number(document.querySelector("#game canvas")?.dataset.brakePressureMarks ?? 0),
    rearRainLight: Number(document.querySelector("#game canvas")?.dataset.rearRainLight ?? 0),
    rearRainLightGlow: Number(document.querySelector("#game canvas")?.dataset.rearRainLightGlow ?? 0),
    ersDeployGlow: Number(document.querySelector("#game canvas")?.dataset.ersDeployGlow ?? 0),
    aeroBoostAvailable: document.querySelector("#game canvas")?.dataset.aeroBoostAvailable ?? "",
    aeroBoostActive: Number(document.querySelector("#game canvas")?.dataset.aeroBoostActive ?? 0),
    aeroDragReduction: Number(document.querySelector("#game canvas")?.dataset.aeroDragReduction ?? 0),
    frontAeroLoad: Number(document.querySelector("#game canvas")?.dataset.frontAeroLoad ?? 0),
    rearAeroLoad: Number(document.querySelector("#game canvas")?.dataset.rearAeroLoad ?? 0),
    aeroBalance: Number(document.querySelector("#game canvas")?.dataset.aeroBalance ?? 0),
    aeroWashout: Number(document.querySelector("#game canvas")?.dataset.aeroWashout ?? 0),
    rearAeroFlap: Number(document.querySelector("#game canvas")?.dataset.rearAeroFlap ?? 0),
    shiftCut: Number(document.querySelector("#game canvas")?.dataset.shiftCut ?? 0),
    tractionBite: Number(document.querySelector("#game canvas")?.dataset.tractionBite ?? 0),
    rearTractionRotation: Number(document.querySelector("#game canvas")?.dataset.rearTractionRotation ?? 0),
    driveTorqueLoad: Number(document.querySelector("#game canvas")?.dataset.driveTorqueLoad ?? 0),
    differentialLock: Number(document.querySelector("#game canvas")?.dataset.differentialLock ?? 0),
    insideRearSlip: Number(document.querySelector("#game canvas")?.dataset.insideRearSlip ?? 0),
    engineBraking: Number(document.querySelector("#game canvas")?.dataset.engineBraking ?? 0),
    trailBraking: Number(document.querySelector("#game canvas")?.dataset.trailBraking ?? 0),
    thresholdBraking: Number(document.querySelector("#game canvas")?.dataset.thresholdBraking ?? 0),
    pedalOverlapLoad: Number(document.querySelector("#game canvas")?.dataset.pedalOverlapLoad ?? 0),
    brakeBalanceLoad: Number(document.querySelector("#game canvas")?.dataset.brakeBalanceLoad ?? 0),
    frontLockRisk: Number(document.querySelector("#game canvas")?.dataset.frontLockRisk ?? 0),
    rearBrakeStability: Number(document.querySelector("#game canvas")?.dataset.rearBrakeStability ?? 0),
    powerState: document.querySelector("#game canvas")?.dataset.powerState ?? "",
    wetRivalSprays: Number(document.querySelector("#game canvas")?.dataset.wetRivalSprays ?? 0),
    wetRivalSprayStrength: Number(document.querySelector("#game canvas")?.dataset.wetRivalSprayStrength ?? 0),
    playerWaterSpray: document.querySelector("#game canvas")?.dataset.playerWaterSpray ?? "",
    playerWaterSprayStrength: Number(document.querySelector("#game canvas")?.dataset.playerWaterSprayStrength ?? 0),
    playerWaterSprayPlumes: Number(document.querySelector("#game canvas")?.dataset.playerWaterSprayPlumes ?? 0),
    rivalLabelsVisible: Number(document.querySelector("#game canvas")?.dataset.rivalLabelsVisible ?? 0),
    rivalLabelSample: document.querySelector("#game canvas")?.dataset.rivalLabelSample ?? "",
    rivalLabelMaxScale: Number(document.querySelector("#game canvas")?.dataset.rivalLabelMaxScale ?? 0),
    lensRainDroplets: Number(document.querySelector("#game canvas")?.dataset.lensRainDroplets ?? 0),
    lensRainOpacity: Number(document.querySelector("#game canvas")?.dataset.lensRainOpacity ?? 0),
    flowScore: Number(document.querySelector("#game canvas")?.dataset.flowScore ?? 0),
    flowState: document.querySelector("#game canvas")?.dataset.flowState ?? "",
    flowMeter: document.querySelector("#flow")?.style.getPropertyValue("--value") ?? "",
    tireTemp: Number(document.querySelector("#game canvas")?.dataset.tireTemp ?? 0),
    tireWear: Number(document.querySelector("#game canvas")?.dataset.tireWear ?? 0),
    tireState: document.querySelector("#game canvas")?.dataset.tireState ?? "",
    tireMeter: document.querySelector("#tire")?.style.getPropertyValue("--value") ?? "",
    tireMeterState: document.querySelector("#tire")?.getAttribute("data-state") ?? "",
    fuelLoad: Number(document.querySelector("#game canvas")?.dataset.fuelLoad ?? 0),
    fuelMassKg: Number(document.querySelector("#game canvas")?.dataset.fuelMassKg ?? 0),
    fuelState: document.querySelector("#game canvas")?.dataset.fuelState ?? "",
    brakeTemp: Number(document.querySelector("#game canvas")?.dataset.brakeTemp ?? 0),
    brakeFade: Number(document.querySelector("#game canvas")?.dataset.brakeFade ?? 0),
    brakeState: document.querySelector("#game canvas")?.dataset.brakeState ?? "",
    lastSector: document.querySelector("#game canvas")?.dataset.lastSector ?? "",
    lastSectorTime: document.querySelector("#game canvas")?.dataset.lastSectorTime ?? "",
    lastSectorDelta: document.querySelector("#game canvas")?.dataset.lastSectorDelta ?? "",
    sectorPaceScore: Number(document.querySelector("#game canvas")?.dataset.sectorPaceScore ?? 0),
    sectorPaceState: document.querySelector("#game canvas")?.dataset.sectorPaceState ?? "",
    surfaceName: document.querySelector("#game canvas")?.dataset.surfaceName ?? "",
    surfaceGripModifier: Number(document.querySelector("#game canvas")?.dataset.surfaceGripModifier ?? 0),
    surfaceRumble: Number(document.querySelector("#game canvas")?.dataset.surfaceRumble ?? 0),
    surfaceEdgeLoad: Number(document.querySelector("#game canvas")?.dataset.surfaceEdgeLoad ?? 0),
    splitSurfaceLoad: Number(document.querySelector("#game canvas")?.dataset.splitSurfaceLoad ?? 0),
    roadAdhesion: Number(document.querySelector("#game canvas")?.dataset.roadAdhesion ?? 0),
    lateralScrub: Number(document.querySelector("#game canvas")?.dataset.lateralScrub ?? 0),
    slipAngle: Number(document.querySelector("#game canvas")?.dataset.slipAngle ?? 0),
    velocityYaw: Number(document.querySelector("#game canvas")?.dataset.velocityYaw ?? 0),
    forwardBite: Number(document.querySelector("#game canvas")?.dataset.forwardBite ?? 0),
    longitudinalGrip: Number(document.querySelector("#game canvas")?.dataset.longitudinalGrip ?? 0),
    tireContactGrip: Number(document.querySelector("#game canvas")?.dataset.tireContactGrip ?? 0),
    tireRunoffShare: Number(document.querySelector("#game canvas")?.dataset.tireRunoffShare ?? 0),
    tireGroundContact: Number(document.querySelector("#game canvas")?.dataset.tireGroundContact ?? 0),
    tireForceLoad: Number(document.querySelector("#game canvas")?.dataset.tireForceLoad ?? 0),
    combinedSlipLoad: Number(document.querySelector("#game canvas")?.dataset.combinedSlipLoad ?? 0),
    tireGripReserve: Number(document.querySelector("#game canvas")?.dataset.tireGripReserve ?? 0),
    tirePressure: Number(document.querySelector("#game canvas")?.dataset.tirePressure ?? 0),
    tireContactPatch: Number(document.querySelector("#game canvas")?.dataset.tireContactPatch ?? 0),
    tirePressureLoad: Number(document.querySelector("#game canvas")?.dataset.tirePressureLoad ?? 0),
    brakeBalanceVisualLoad: Number(document.querySelector("#game canvas")?.dataset.brakeBalanceVisualLoad ?? 0),
    frontLockRiskVisual: Number(document.querySelector("#game canvas")?.dataset.frontLockRiskVisual ?? 0),
    rearBrakeLightnessVisual: Number(document.querySelector("#game canvas")?.dataset.rearBrakeLightnessVisual ?? 0),
    driveTorqueVisualLoad: Number(document.querySelector("#game canvas")?.dataset.driveTorqueVisualLoad ?? 0),
    pedalOverlapVisualLoad: Number(document.querySelector("#game canvas")?.dataset.pedalOverlapVisualLoad ?? 0),
    differentialLockVisual: Number(document.querySelector("#game canvas")?.dataset.differentialLockVisual ?? 0),
    insideRearSlipVisual: Number(document.querySelector("#game canvas")?.dataset.insideRearSlipVisual ?? 0),
    tireSaturation: Number(document.querySelector("#game canvas")?.dataset.tireSaturation ?? 0),
    tireRelaxation: Number(document.querySelector("#game canvas")?.dataset.tireRelaxation ?? 0),
    tireLoadFeedback: Number(document.querySelector("#game canvas")?.dataset.tireLoadFeedback ?? 0),
    steeringLoadFeedback: Number(document.querySelector("#game canvas")?.dataset.steeringLoadFeedback ?? 0),
    steeringRackLoad: Number(document.querySelector("#game canvas")?.dataset.steeringRackLoad ?? 0),
    steeringVelocity: Number(document.querySelector("#game canvas")?.dataset.steeringVelocity ?? 0),
    steeringImpulse: Number(document.querySelector("#game canvas")?.dataset.steeringImpulse ?? 0),
    selfAlignTorque: Number(document.querySelector("#game canvas")?.dataset.selfAlignTorque ?? 0),
    yawInertiaLoad: Number(document.querySelector("#game canvas")?.dataset.yawInertiaLoad ?? 0),
    yawDamping: Number(document.querySelector("#game canvas")?.dataset.yawDamping ?? 0),
    counterSteerLoad: Number(document.querySelector("#game canvas")?.dataset.counterSteerLoad ?? 0),
    slipRecovery: Number(document.querySelector("#game canvas")?.dataset.slipRecovery ?? 0),
    chassisStability: Number(document.querySelector("#game canvas")?.dataset.chassisStability ?? 0),
    roadAlignment: Number(document.querySelector("#game canvas")?.dataset.roadAlignment ?? 0),
    roadCamber: Number(document.querySelector("#game canvas")?.dataset.roadCamber ?? 0),
    roadGrade: Number(document.querySelector("#game canvas")?.dataset.roadGrade ?? 0),
    roadLoad: Number(document.querySelector("#game canvas")?.dataset.roadLoad ?? 0),
    roadCompression: Number(document.querySelector("#game canvas")?.dataset.roadCompression ?? 0),
    roadFeelFeedback: Number(document.querySelector("#game canvas")?.dataset.roadFeelFeedback ?? 0),
    roadTextureLoad: Number(document.querySelector("#game canvas")?.dataset.roadTextureLoad ?? 0),
    chassisHeave: Number(document.querySelector("#game canvas")?.dataset.chassisHeave ?? 0),
    rideSettling: Number(document.querySelector("#game canvas")?.dataset.rideSettling ?? 0),
    suspensionLoad: Number(document.querySelector("#game canvas")?.dataset.suspensionLoad ?? 0),
    suspensionTravel: Number(document.querySelector("#game canvas")?.dataset.suspensionTravel ?? 0),
    suspensionVelocity: Number(document.querySelector("#game canvas")?.dataset.suspensionVelocity ?? 0),
    damperImpulse: Number(document.querySelector("#game canvas")?.dataset.damperImpulse ?? 0),
    floorStrikeLoad: Number(document.querySelector("#game canvas")?.dataset.floorStrikeLoad ?? 0),
    frontAxleLoad: Number(document.querySelector("#game canvas")?.dataset.frontAxleLoad ?? 0),
    rearAxleLoad: Number(document.querySelector("#game canvas")?.dataset.rearAxleLoad ?? 0),
    longitudinalLoadTransfer: Number(document.querySelector("#game canvas")?.dataset.longitudinalLoadTransfer ?? 0),
    lateralLoadTransfer: Number(document.querySelector("#game canvas")?.dataset.lateralLoadTransfer ?? 0),
    chassisPitch: Number(document.querySelector("#game canvas")?.dataset.chassisPitch ?? 0),
    chassisRoll: Number(document.querySelector("#game canvas")?.dataset.chassisRoll ?? 0),
    carVisualPitch: Number(document.querySelector("#game canvas")?.dataset.carVisualPitch ?? 0),
    carVisualRoll: Number(document.querySelector("#game canvas")?.dataset.carVisualRoll ?? 0),
    frontWheelSteer: Number(document.querySelector("#game canvas")?.dataset.frontWheelSteer ?? 0),
    tireVisualSquash: Number(document.querySelector("#game canvas")?.dataset.tireVisualSquash ?? 0),
    loadedWheelBias: Number(document.querySelector("#game canvas")?.dataset.loadedWheelBias ?? 0),
    chassisVisualLoad: Number(document.querySelector("#game canvas")?.dataset.chassisVisualLoad ?? 0),
    combinedSlipVisualLoad: Number(document.querySelector("#game canvas")?.dataset.combinedSlipVisualLoad ?? 0),
    tireGripReserveVisual: Number(document.querySelector("#game canvas")?.dataset.tireGripReserveVisual ?? 0),
    tirePressureVisual: Number(document.querySelector("#game canvas")?.dataset.tirePressureVisual ?? 0),
    tireContactPatchVisual: Number(document.querySelector("#game canvas")?.dataset.tireContactPatchVisual ?? 0),
    tirePressureVisualLoad: Number(document.querySelector("#game canvas")?.dataset.tirePressureVisualLoad ?? 0),
    roadTextureVisualLoad: Number(document.querySelector("#game canvas")?.dataset.roadTextureVisualLoad ?? 0),
    floorStrikeVisualLoad: Number(document.querySelector("#game canvas")?.dataset.floorStrikeVisualLoad ?? 0),
    chassisHeaveVisual: Number(document.querySelector("#game canvas")?.dataset.chassisHeaveVisual ?? 0),
    rideSettlingVisual: Number(document.querySelector("#game canvas")?.dataset.rideSettlingVisual ?? 0),
    steeringVelocityVisual: Number(document.querySelector("#game canvas")?.dataset.steeringVelocityVisual ?? 0),
    steeringImpulseVisual: Number(document.querySelector("#game canvas")?.dataset.steeringImpulseVisual ?? 0),
    counterSteerVisualLoad: Number(document.querySelector("#game canvas")?.dataset.counterSteerVisualLoad ?? 0),
    slipRecoveryVisual: Number(document.querySelector("#game canvas")?.dataset.slipRecoveryVisual ?? 0),
    chassisStabilityVisual: Number(document.querySelector("#game canvas")?.dataset.chassisStabilityVisual ?? 0),
    steeringRackVisualLoad: Number(document.querySelector("#game canvas")?.dataset.steeringRackVisualLoad ?? 0),
    yawInertiaVisualLoad: Number(document.querySelector("#game canvas")?.dataset.yawInertiaVisualLoad ?? 0),
    yawDampingVisual: Number(document.querySelector("#game canvas")?.dataset.yawDampingVisual ?? 0),
    trackRubber: Number(document.querySelector("#game canvas")?.dataset.trackRubber ?? 0),
    dryingLine: Number(document.querySelector("#game canvas")?.dataset.dryingLine ?? 0),
    trackEvolutionState: document.querySelector("#game canvas")?.dataset.trackEvolutionState ?? "",
    rubberedLineGrip: Number(document.querySelector("#game canvas")?.dataset.rubberedLineGrip ?? 0),
    marbles: Number(document.querySelector("#game canvas")?.dataset.marbles ?? 0),
    dirtyTirePickup: Number(document.querySelector("#game canvas")?.dataset.dirtyTirePickup ?? 0),
    gripState: document.querySelector("#game canvas")?.dataset.gripState ?? "",
    draft: Number(document.querySelector("#game canvas")?.dataset.draft ?? 0),
    dirtyAir: Number(document.querySelector("#game canvas")?.dataset.dirtyAir ?? 0),
    airWakeIntensity: Number(document.querySelector("#game canvas")?.dataset.airWakeIntensity ?? 0),
    airWakeRibbons: Number(document.querySelector("#game canvas")?.dataset.airWakeRibbons ?? 0),
    rivalProximity: Number(document.querySelector("#game canvas")?.dataset.rivalProximity ?? 0),
    sideBySide: Number(document.querySelector("#game canvas")?.dataset.sideBySide ?? 0),
    contactRisk: Number(document.querySelector("#game canvas")?.dataset.contactRisk ?? 0),
    frontWingDamage: Number(document.querySelector("#game canvas")?.dataset.frontWingDamage ?? 0),
    frontWingVisualDamage: Number(document.querySelector("#game canvas")?.dataset.frontWingVisualDamage ?? 0),
    frontAeroVisualLoad: Number(document.querySelector("#game canvas")?.dataset.frontAeroVisualLoad ?? 0),
    rearAeroVisualLoad: Number(document.querySelector("#game canvas")?.dataset.rearAeroVisualLoad ?? 0),
    downforceLoss: Number(document.querySelector("#game canvas")?.dataset.downforceLoss ?? 0),
    damageState: document.querySelector("#game canvas")?.dataset.damageState ?? "",
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
    renderPipeline: document.querySelector("#game canvas")?.dataset.renderPipeline ?? "",
    renderToneMapping: document.querySelector("#game canvas")?.dataset.renderToneMapping ?? "",
    renderShadowType: document.querySelector("#game canvas")?.dataset.renderShadowType ?? "",
    renderShadowMap: document.querySelector("#game canvas")?.dataset.renderShadowMap ?? "",
    tracksideAssets: document.querySelector("#game canvas")?.dataset.tracksideAssets ?? "",
    tracksideGrandstands: Number(document.querySelector("#game canvas")?.dataset.tracksideGrandstands ?? 0),
    tracksideLightPosts: Number(document.querySelector("#game canvas")?.dataset.tracksideLightPosts ?? 0),
    circuitDressingPieces: Number(document.querySelector("#game canvas")?.dataset.circuitDressingPieces ?? 0),
    circuitSafetyBarriers: Number(document.querySelector("#game canvas")?.dataset.circuitSafetyBarriers ?? 0),
    circuitCatchFences: Number(document.querySelector("#game canvas")?.dataset.circuitCatchFences ?? 0),
    circuitPitWallModules: Number(document.querySelector("#game canvas")?.dataset.circuitPitWallModules ?? 0),
    circuitMarshalPosts: Number(document.querySelector("#game canvas")?.dataset.circuitMarshalPosts ?? 0),
    circuitCheckpointGates: Number(document.querySelector("#game canvas")?.dataset.circuitCheckpointGates ?? 0),
    circuitVenueHero: document.querySelector("#game canvas")?.dataset.circuitVenueHero ?? "",
    circuitTimingBridge: document.querySelector("#game canvas")?.dataset.circuitTimingBridge ?? "",
    circuitTimingBridgeClearance: Number(document.querySelector("#game canvas")?.dataset.circuitTimingBridgeClearance ?? 0),
    circuitTimingBridgeDeckHeight: Number(document.querySelector("#game canvas")?.dataset.circuitTimingBridgeDeckHeight ?? 0),
    surfaceTerrainBands: Number(document.querySelector("#game canvas")?.dataset.surfaceTerrainBands ?? 0),
    surfaceRacingGroove: document.querySelector("#game canvas")?.dataset.surfaceRacingGroove ?? "",
    surfaceMarbles: document.querySelector("#game canvas")?.dataset.surfaceMarbles ?? "",
    surfaceWetSheen: document.querySelector("#game canvas")?.dataset.surfaceWetSheen ?? "",
    surfaceEdgeLines: document.querySelector("#game canvas")?.dataset.surfaceEdgeLines ?? "",
    surfaceFlowCues: Number(document.querySelector("#game canvas")?.dataset.surfaceFlowCues ?? 0),
    surfaceGridSlots: Number(document.querySelector("#game canvas")?.dataset.surfaceGridSlots ?? 0),
    surfacePuddles: Number(document.querySelector("#game canvas")?.dataset.surfacePuddles ?? 0),
    surfaceWetSheenOpacity: Number(document.querySelector("#game canvas")?.dataset.surfaceWetSheenOpacity ?? 0),
    surfacePuddleOpacity: Number(document.querySelector("#game canvas")?.dataset.surfacePuddleOpacity ?? 0),
    racingLineAssist: document.querySelector("#game canvas")?.dataset.racingLineAssist ?? "",
    racingLineAssistStyle: document.querySelector("#game canvas")?.dataset.racingLineAssistStyle ?? "",
    dynamicRacingLineSegments: Number(document.querySelector("#game canvas")?.dataset.dynamicRacingLineSegments ?? 0),
    dynamicRacingLinePieces: Number(document.querySelector("#game canvas")?.dataset.dynamicRacingLinePieces ?? 0),
    racingLineCue: document.querySelector("#game canvas")?.dataset.racingLineCue ?? "",
    nextCheckpointBeacon: document.querySelector("#game canvas")?.dataset.nextCheckpointBeacon ?? "",
    nextCheckpointBeaconStyle: document.querySelector("#game canvas")?.dataset.nextCheckpointBeaconStyle ?? "",
    nextCheckpointBeaconVisible: document.querySelector("#game canvas")?.dataset.nextCheckpointBeaconVisible ?? "",
    nextCheckpointBeaconDistance: Number(document.querySelector("#game canvas")?.dataset.nextCheckpointBeaconDistance ?? 0),
    nextCheckpointBeaconLabel: document.querySelector("#game canvas")?.dataset.nextCheckpointBeaconLabel ?? "",
    nextCheckpointBeaconScale: Number(document.querySelector("#game canvas")?.dataset.nextCheckpointBeaconScale ?? 0),
    nextCheckpointBeaconOpacity: Number(document.querySelector("#game canvas")?.dataset.nextCheckpointBeaconOpacity ?? 0),
    assetWeather: document.querySelector("#game canvas")?.dataset.weather ?? "",
    trackLayout: document.querySelector("#game canvas")?.dataset.trackLayout ?? "",
    horizonTrack: document.querySelector("#game canvas")?.dataset.horizonTrack ?? "",
    horizonRenderPolicy: document.querySelector("#game canvas")?.dataset.horizonRenderPolicy ?? "",
    horizonSkySize: document.querySelector("#game canvas")?.dataset.horizonSkySize ?? "",
    horizonSkyDepthWrite: document.querySelector("#game canvas")?.dataset.horizonSkyDepthWrite ?? "",
    horizonSkyRenderOrder: Number(document.querySelector("#game canvas")?.dataset.horizonSkyRenderOrder ?? 0),
    stormLightningBolts: Number(document.querySelector("#game canvas")?.dataset.stormLightningBolts ?? 0),
    stormLightningFlash: Number(document.querySelector("#game canvas")?.dataset.stormLightningFlash ?? 0),
    surfaceTerrainReach: Number(document.querySelector("#game canvas")?.dataset.surfaceTerrainReach ?? 0),
    surfaceTerrainSkirtDrop: Number(document.querySelector("#game canvas")?.dataset.surfaceTerrainSkirtDrop ?? 0),
    surfaceTerrainOpacity: Number(document.querySelector("#game canvas")?.dataset.surfaceTerrainOpacity ?? 0),
    surfaceRunoffReach: Number(document.querySelector("#game canvas")?.dataset.surfaceRunoffReach ?? 0),
    surfaceTechnicalZones: Number(document.querySelector("#game canvas")?.dataset.surfaceTechnicalZones ?? 0),
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    hudCameraPressure: document.querySelector(".hud")?.dataset.cameraPressure ?? "",
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
    racingStatusOpacity: Number(getComputedStyle(document.querySelector(".status-panel")).opacity),
    racingTimingWidth: document.querySelector("#timing-tower")?.getBoundingClientRect().width ?? 0
  }));

  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(700);
  const brakingState = await page.evaluate(() => ({
    speed: Number(document.querySelector("#speed")?.textContent ?? 0),
    brakeGlow: Number(document.querySelector("#game canvas")?.dataset.brakeGlow ?? 0),
    brakePressureTrail: Number(document.querySelector("#game canvas")?.dataset.brakePressureTrail ?? 0),
    brakePressureMarks: Number(document.querySelector("#game canvas")?.dataset.brakePressureMarks ?? 0),
    carLockup: Number(document.querySelector("#game canvas")?.dataset.carLockup ?? 0),
    brakeTemp: Number(document.querySelector("#game canvas")?.dataset.brakeTemp ?? 0)
  }));
  await page.keyboard.up("ArrowDown");

  await page.keyboard.press("KeyC");
  await page.waitForTimeout(250);
  const podCamera = await page.evaluate(() => ({
    mode: document.querySelector("#game canvas")?.dataset.cameraMode ?? "",
    cameraWorldX: Number(document.querySelector("#game canvas")?.dataset.cameraWorldX ?? 0),
    cameraWorldY: Number(document.querySelector("#game canvas")?.dataset.cameraWorldY ?? 0),
    cameraWorldZ: Number(document.querySelector("#game canvas")?.dataset.cameraWorldZ ?? 0),
    carWorldX: Number(document.querySelector("#game canvas")?.dataset.carWorldX ?? 0),
    carWorldY: Number(document.querySelector("#game canvas")?.dataset.carWorldY ?? 0),
    carWorldZ: Number(document.querySelector("#game canvas")?.dataset.carWorldZ ?? 0),
    externalCarVisible: document.querySelector("#game canvas")?.dataset.externalCarVisible ?? "",
    carGroundShadow: document.querySelector("#game canvas")?.dataset.carGroundShadow ?? "",
    cockpitFrame: document.querySelector("#game canvas")?.dataset.cockpitFrame ?? "",
    cockpitFrameParts: Number(document.querySelector("#game canvas")?.dataset.cockpitFrameParts ?? 0),
    cockpitWheelAngle: Number(document.querySelector("#game canvas")?.dataset.cockpitWheelAngle ?? 0),
    cockpitBrakeGlow: Number(document.querySelector("#game canvas")?.dataset.cockpitBrakeGlow ?? 0)
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
  assert(
    Math.hypot(state.carWorldX - ready.carWorldX, state.carWorldZ - ready.carWorldZ) > 1,
    `desktop car did not move through world-space circuit coordinates: ready=(${ready.carWorldX},${ready.carWorldZ}) state=(${state.carWorldX},${state.carWorldZ}) distance=${state.carDistance}`
  );
  assert(Number.isFinite(state.carWorldY) && state.carWorldY > 0.5, "desktop car did not receive elevated track height");
  assert(state.circuitWorldZ === ready.circuitWorldZ, "desktop circuit moved instead of staying in world space");
  assert(Number.isFinite(state.cameraWorldX), "desktop chase camera X telemetry was missing");
  assert(state.cameraMode === "chase", `desktop default camera mode was wrong: ${state.cameraMode}`);
  assert(Number.isFinite(state.cameraWorldY) && state.cameraWorldY > state.carWorldY, "desktop chase camera did not sit above the car");
  assert(Math.abs(state.cameraWorldZ - state.carWorldZ) > 3, "desktop chase camera did not separate from the car in world space");
  assert(Number.isFinite(state.cameraChaseDistance), "desktop chase camera distance telemetry was missing");
  if (state.surfaceName !== "Runoff" && state.surfaceName !== "Gravel") {
    assert(state.cameraChaseDistance < 18, `desktop chase camera sat too far from the car: ${state.cameraChaseDistance}`);
  }
  assert(state.cameraObstructionCandidates > 12, `desktop camera obstruction pass did not scan trackside posts: ${state.cameraObstructionCandidates}`);
  assert(Number.isFinite(state.cameraObstructionCulled), "desktop camera obstruction culling telemetry was missing");
  assert(Number.isFinite(state.cameraBarrierObstructionsCulled), "desktop barrier obstruction culling telemetry was missing");
  assert(Number.isFinite(state.cameraGateObstructionsCulled), "desktop gate obstruction culling telemetry was missing");
  assert(Number.isFinite(state.cameraBoardObstructionsCulled), "desktop board obstruction culling telemetry was missing");
  assert(Number.isFinite(state.cameraLookAhead) && state.cameraLookAhead > 10, `desktop camera look-ahead was missing: ${state.cameraLookAhead}`);
  assert(state.cameraMotionRig === "inertial-chase-rig", `desktop inertial camera rig was missing: ${state.cameraMotionRig}`);
  assert(Number.isFinite(state.cameraSpeedDeltaKphPerSecond), "desktop camera speed-delta telemetry was missing");
  assert(Number.isFinite(state.cameraLongitudinalInertia), "desktop camera longitudinal inertia telemetry was missing");
  assert(Number.isFinite(state.cameraLateralInertia), "desktop camera lateral inertia telemetry was missing");
  assert(Number.isFinite(state.cameraVerticalInertia), "desktop camera vertical inertia telemetry was missing");
  assert(Number.isFinite(state.cameraRoadFrameDrift), "desktop camera road-frame drift telemetry was missing");
  assert(
    Math.abs(state.cameraLongitudinalInertia) + Math.abs(state.cameraLateralInertia) + Math.abs(state.cameraVerticalInertia) > 0.035,
    `desktop camera inertia stayed static at speed: ${JSON.stringify({
      longitudinal: state.cameraLongitudinalInertia,
      lateral: state.cameraLateralInertia,
      vertical: state.cameraVerticalInertia,
      speedDelta: state.cameraSpeedDeltaKphPerSecond
    })}`
  );
  assert(Number.isFinite(state.cameraApexBias), "desktop camera apex bias telemetry was missing");
  assert(state.cameraRoadSpeedFraming > 0.2 && state.cameraRoadSpeedFraming <= 1, `desktop road-speed camera framing was missing: ${state.cameraRoadSpeedFraming}`);
  assert(Number.isFinite(state.cameraStructureLift), "desktop camera structure-lift telemetry was missing");
  assert(Number.isFinite(state.cameraRejoinLift), "desktop camera rejoin-lift telemetry was missing");
  assert(Number.isFinite(state.cameraRejoinFocus), "desktop camera rejoin-focus telemetry was missing");
  assert(Number.isFinite(state.cameraRoadRecoveryFocus), "desktop camera road-recovery telemetry was missing");
  assert(Number.isFinite(state.cameraRoadTargetDelta), "desktop camera road-target telemetry was missing");
  if (state.surfaceName === "Runoff" || state.surfaceName === "Gravel") {
    assert(state.cameraRejoinLift > 0.7, `desktop rejoin camera did not lift on ${state.surfaceName}: ${state.cameraRejoinLift}`);
    assert(state.cameraRejoinFocus > 0.08, `desktop rejoin camera did not focus on the off-track car: ${state.cameraRejoinFocus}`);
    assert(state.cameraRoadRecoveryFocus > 0.08, `desktop rejoin camera did not bias back toward the circuit: ${state.cameraRoadRecoveryFocus}`);
    assert(state.cameraRoadTargetDelta > 0.2, `desktop rejoin camera kept looking at grass instead of the road: ${state.cameraRoadTargetDelta}`);
    assert(Math.abs(state.carScreenX) < 0.66, `desktop rejoin camera let the car drift toward HUD: ${state.carScreenX}`);
  }
  assert(Number.isFinite(state.cameraRoll), "desktop camera roll telemetry was missing");
  assert(state.cameraFov >= 42 && state.cameraFov <= 58, `desktop camera FOV was out of range: ${state.cameraFov}`);
  assert(state.cameraFrameGuard >= 0 && state.cameraFrameGuard <= 1, `desktop camera frame guard telemetry was invalid: ${state.cameraFrameGuard}`);
  assert(podCamera.mode === "pod", `desktop camera toggle did not enter pod mode: ${podCamera.mode}`);
  assert(podCamera.externalCarVisible === "false", `desktop pod camera still showed the external player car: ${podCamera.externalCarVisible}`);
  assert(podCamera.cockpitFrame === "visible", `desktop pod camera cockpit frame was not visible: ${podCamera.cockpitFrame}`);
  assert(podCamera.cockpitFrameParts >= 8, `desktop pod camera cockpit frame was too sparse: ${podCamera.cockpitFrameParts}`);
  assert(Number.isFinite(podCamera.cockpitWheelAngle), "desktop pod camera cockpit wheel telemetry was missing");
  assert(Number.isFinite(podCamera.cockpitBrakeGlow), "desktop pod camera cockpit brake glow telemetry was missing");
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
  assert(Number.isFinite(state.carSteering), "desktop physical steering telemetry was missing");
  assert(Math.abs(state.carSteering) <= 1, `desktop physical steering telemetry was invalid: ${state.carSteering}`);
  assert(Number.isFinite(state.wheelSpin) && Math.abs(state.wheelSpin) > 10, "desktop animated wheel spin telemetry was missing");
  assert(Number.isFinite(state.carVisualPitch), "desktop car visual pitch telemetry was missing");
  assert(Number.isFinite(state.carVisualRoll), "desktop car visual roll telemetry was missing");
  assert(Math.abs(state.suspensionVelocity) <= 1.1, `desktop suspension velocity telemetry was invalid: ${state.suspensionVelocity}`);
  assert(state.damperImpulse >= 0 && state.damperImpulse <= 1, `desktop damper impulse telemetry was invalid: ${state.damperImpulse}`);
  assert(Number.isFinite(state.frontWheelSteer), "desktop front wheel steering visual telemetry was missing");
  assert(Math.abs(state.frontWheelSteer) <= 0.42, `desktop front wheel steering visual was invalid: ${state.frontWheelSteer}`);
  assert(state.tireVisualSquash > 0.02 && state.tireVisualSquash < 0.16, `desktop loaded tire squash was missing or extreme: ${state.tireVisualSquash}`);
  assert(Math.abs(state.loadedWheelBias) < 0.8, `desktop loaded wheel bias was invalid: ${state.loadedWheelBias}`);
  assert(state.chassisVisualLoad > 0.08 && state.chassisVisualLoad <= 1, `desktop chassis visual load was missing: ${state.chassisVisualLoad}`);
  assert(state.carGroundShadow === "planted", `desktop formula car ground shadow was missing: ${state.carGroundShadow}`);
  assert(
    state.carGroundShadowOpacity > 0.12 && state.carGroundShadowOpacity < 0.42,
    `desktop formula car ground shadow opacity was wrong: ${state.carGroundShadowOpacity}`
  );
  assert(state.carGroundShadowLength > 0.9, `desktop formula car ground shadow did not stretch with speed: ${state.carGroundShadowLength}`);
  assert(podCamera.carGroundShadow === "hidden", `desktop pod camera should hide external car shadow: ${podCamera.carGroundShadow}`);
  assert(state.speedStreaks === "peripheral-ground-rush", `desktop high-speed ground-rush cue was missing: ${state.speedStreaks}`);
  assert(state.speedStreakOpacity > 0.08, `desktop high-speed ground-rush cue was too faint: ${state.speedStreakOpacity}`);
  assert(state.speedStreakCount >= 20, `desktop high-speed ground-rush cue was too sparse: ${state.speedStreakCount}`);
  assert(state.frontAxleLoad > 0.7 && state.frontAxleLoad < 1.4, `desktop front axle load telemetry was invalid: ${state.frontAxleLoad}`);
  assert(state.rearAxleLoad > 0.7 && state.rearAxleLoad < 1.4, `desktop rear axle load telemetry was invalid: ${state.rearAxleLoad}`);
  assert(Math.abs(state.longitudinalLoadTransfer) < 0.5, `desktop longitudinal load transfer telemetry was invalid: ${state.longitudinalLoadTransfer}`);
  assert(Math.abs(state.lateralLoadTransfer) < 0.5, `desktop lateral load transfer telemetry was invalid: ${state.lateralLoadTransfer}`);
  assert(Number.isFinite(state.brakeGlow), "desktop brake glow telemetry was missing");
  assert(Number.isFinite(state.brakePressureTrail), "desktop brake pressure trail telemetry was missing");
  assert(brakingState.brakeGlow > state.brakeGlow, `desktop brake glow did not rise under braking: ${JSON.stringify(brakingState)}`);
  assert(brakingState.brakeTemp >= state.brakeTemp, `desktop brake temperature did not rise under braking: ${JSON.stringify(brakingState)}`);
  assert(brakingState.brakePressureTrail > 0.2, `desktop brake pressure trail did not activate under braking: ${JSON.stringify(brakingState)}`);
  assert(brakingState.brakePressureMarks >= 8, `desktop brake pressure marks were missing under braking: ${JSON.stringify(brakingState)}`);
  assert(state.rearRainLight > 0.6, `desktop rear rain light did not activate in storm weather: ${state.rearRainLight}`);
  assert(state.rearRainLightGlow > 0.6, `desktop rear rain light glow did not activate in storm weather: ${state.rearRainLightGlow}`);
  assert(boostHeldState.speed > 120, `desktop held-boost sample was too slow: ${JSON.stringify(boostHeldState)}`);
  assert(boostHeldState.ersDeployGlow > 0.6, `desktop ERS deploy glow did not activate while boost was held: ${JSON.stringify(boostHeldState)}`);
  assert(boostHeldState.aeroBoostAvailable === "true", `desktop aero boost window did not open: ${JSON.stringify(boostHeldState)}`);
  assert(boostHeldState.aeroBoostActive > 0.35, `desktop aero boost did not activate: ${JSON.stringify(boostHeldState)}`);
  assert(boostHeldState.aeroDragReduction > 0, `desktop aero drag reduction stayed inactive: ${JSON.stringify(boostHeldState)}`);
  assert(boostHeldState.rearAeroFlap > 0.35, `desktop rear aero flap did not open: ${JSON.stringify(boostHeldState)}`);
  assert(state.shiftCut >= 0 && state.shiftCut <= 1, `desktop shift-cut telemetry was invalid: ${state.shiftCut}`);
  assert(state.tractionBite >= 0 && state.tractionBite <= 1, `desktop traction-bite telemetry was invalid: ${state.tractionBite}`);
  assert(Math.abs(state.rearTractionRotation) <= 0.5, `desktop rear-traction rotation telemetry was invalid: ${state.rearTractionRotation}`);
  assert(state.driveTorqueLoad >= 0 && state.driveTorqueLoad <= 1, `desktop drive torque load was invalid: ${state.driveTorqueLoad}`);
  assert(state.differentialLock >= 0 && state.differentialLock <= 1, `desktop differential lock was invalid: ${state.differentialLock}`);
  assert(state.insideRearSlip >= 0 && state.insideRearSlip <= 1, `desktop inside rear slip was invalid: ${state.insideRearSlip}`);
  assert(state.engineBraking >= 0 && state.engineBraking <= 1, `desktop engine-braking telemetry was invalid: ${state.engineBraking}`);
  assert(state.trailBraking >= 0 && state.trailBraking <= 1, `desktop trail-braking telemetry was invalid: ${state.trailBraking}`);
  assert(state.thresholdBraking >= 0 && state.thresholdBraking <= 1, `desktop threshold-braking telemetry was invalid: ${state.thresholdBraking}`);
  assert(state.pedalOverlapLoad >= 0 && state.pedalOverlapLoad <= 1, `desktop pedal-overlap telemetry was invalid: ${state.pedalOverlapLoad}`);
  assert(state.brakeBalanceLoad >= 0 && state.brakeBalanceLoad <= 1, `desktop brake balance load was invalid: ${state.brakeBalanceLoad}`);
  assert(state.frontLockRisk >= 0 && state.frontLockRisk <= 1, `desktop front lock risk was invalid: ${state.frontLockRisk}`);
  assert(state.rearBrakeStability >= 0.42 && state.rearBrakeStability <= 1.05, `desktop rear brake stability was invalid: ${state.rearBrakeStability}`);
  assert(/Power|Shift|Traction|Rear|Engine|Trail|Threshold|Pedal|Diff|Inside|redline/i.test(state.powerState), `desktop power state was missing: ${state.powerState}`);
  assert(state.wetRivalSprays > 0, `desktop wet rival spray did not render in storm weather: ${state.wetRivalSprays}`);
  assert(state.wetRivalSprayStrength > 0.2, `desktop wet rival spray stayed too faint: ${state.wetRivalSprayStrength}`);
  assert(state.playerWaterSpray === "active", `desktop player spray did not render in storm weather: ${state.playerWaterSpray}`);
  assert(state.playerWaterSprayStrength > 0.4, `desktop player spray stayed too faint: ${state.playerWaterSprayStrength}`);
  assert(state.playerWaterSprayPlumes >= 12, `desktop player spray plume count was too sparse: ${state.playerWaterSprayPlumes}`);
  assert(state.rivalLabelsVisible > 0, `desktop in-world rival labels did not render: ${state.rivalLabelsVisible}`);
  assert(/[A-Z]{3}.*[+-]\d/.test(state.rivalLabelSample), `desktop rival label sample was not readable: ${state.rivalLabelSample}`);
  assert(state.rivalLabelMaxScale > 0 && state.rivalLabelMaxScale <= 0.9, `desktop rival labels were too large in camera view: ${state.rivalLabelMaxScale}`);
  assert(state.lensRainDroplets >= 8, `desktop rain lens droplets were missing in storm weather: ${state.lensRainDroplets}`);
  assert(state.lensRainOpacity > 0.1, `desktop rain lens opacity stayed too faint: ${state.lensRainOpacity}`);
  assert(state.flowScore > 0 && state.flowScore <= 1, `desktop flow score was missing: ${state.flowScore}`);
  assert(state.flowState.length > 0, "desktop flow state was missing");
  assert(/%/.test(state.flowMeter), `desktop flow meter did not update: ${state.flowMeter}`);
  assert(state.tireTemp > 0 && state.tireTemp <= 1.1, `desktop tire temperature telemetry was invalid: ${state.tireTemp}`);
  assert(state.tireWear >= 0 && state.tireWear < 0.2, `desktop tire wear telemetry was invalid: ${state.tireWear}`);
  assert(/Tires|tire/i.test(state.tireState), `desktop tire state was missing: ${state.tireState}`);
  assert(/%/.test(state.tireMeter), `desktop tire meter did not update: ${state.tireMeter}`);
  assert(state.tireMeterState === state.tireState, `desktop tire meter state was not wired: ${state.tireMeterState}`);
  assert(state.fuelLoad > 0 && state.fuelLoad <= 1, `desktop fuel load telemetry was invalid: ${state.fuelLoad}`);
  assert(state.fuelMassKg > 20, `desktop fuel mass telemetry was invalid: ${state.fuelMassKg}`);
  assert(/fuel|car/i.test(state.fuelState), `desktop fuel state was missing: ${state.fuelState}`);
  assert(state.brakeTemp > 0 && state.brakeTemp <= 1.1, `desktop brake temperature telemetry was invalid: ${state.brakeTemp}`);
  assert(state.brakeFade >= 0 && state.brakeFade <= 1, `desktop brake fade telemetry was invalid: ${state.brakeFade}`);
  assert(/brake/i.test(state.brakeState), `desktop brake state was missing: ${state.brakeState}`);
  assert(state.sectorPaceScore >= 0 && state.sectorPaceScore <= 1, `desktop sector pace score was invalid: ${state.sectorPaceScore}`);
  assert(/sector/i.test(state.sectorPaceState), `desktop sector pace state was missing: ${state.sectorPaceState}`);
  if (state.lastSector) {
    assert(/^[123]$/.test(state.lastSector), `desktop last sector was invalid: ${state.lastSector}`);
    assert(state.lastSectorTime.length > 0, "desktop last sector time was missing");
    assert(state.lastSectorDelta.length > 0, "desktop last sector delta was missing");
  }
  assert(/Asphalt|Kerb|Runoff|Gravel/.test(state.surfaceName), `desktop surface name was missing: ${state.surfaceName}`);
  assert(state.surfaceGripModifier > 0 && state.surfaceGripModifier <= 1, `desktop surface grip modifier was invalid: ${state.surfaceGripModifier}`);
  assert(Number.isFinite(state.surfaceRumble), "desktop surface rumble telemetry was missing");
  assert(state.surfaceEdgeLoad >= 0 && state.surfaceEdgeLoad <= 1, `desktop surface edge-load telemetry was invalid: ${state.surfaceEdgeLoad}`);
  assert(state.splitSurfaceLoad >= -1 && state.splitSurfaceLoad <= 1, `desktop split surface load telemetry was invalid: ${state.splitSurfaceLoad}`);
  assert(state.roadAdhesion > 0 && state.roadAdhesion <= 1.1, `desktop road adhesion telemetry was invalid: ${state.roadAdhesion}`);
  assert(state.lateralScrub >= 0 && state.lateralScrub <= 1, `desktop lateral scrub telemetry was invalid: ${state.lateralScrub}`);
  assert(Number.isFinite(state.slipAngle) && Math.abs(state.slipAngle) <= 0.75, `desktop slip-angle telemetry was invalid: ${state.slipAngle}`);
  assert(Number.isFinite(state.velocityYaw) && Math.abs(state.velocityYaw) <= 0.75, `desktop velocity-yaw telemetry was invalid: ${state.velocityYaw}`);
  assert(state.forwardBite > 0.25 && state.forwardBite <= 1.1, `desktop forward bite telemetry was invalid: ${state.forwardBite}`);
  assert(state.longitudinalGrip > 0.18 && state.longitudinalGrip <= 1.1, `desktop longitudinal grip telemetry was invalid: ${state.longitudinalGrip}`);
  assert(state.tireContactGrip > 0.2 && state.tireContactGrip <= 1.1, `desktop tire contact grip telemetry was invalid: ${state.tireContactGrip}`);
  assert(state.tireRunoffShare >= 0 && state.tireRunoffShare <= 1, `desktop tire runoff share telemetry was invalid: ${state.tireRunoffShare}`);
  assert(state.tireGroundContact > 0.55 && state.tireGroundContact <= 1.1, `desktop tire ground contact telemetry was invalid: ${state.tireGroundContact}`);
  assert(state.tireForceLoad >= 0 && state.tireForceLoad <= 1.85, `desktop tire force load telemetry was invalid: ${state.tireForceLoad}`);
  assert(state.combinedSlipLoad >= 0 && state.combinedSlipLoad <= 1, `desktop combined slip telemetry was invalid: ${state.combinedSlipLoad}`);
  assert(state.tireGripReserve >= 0.52 && state.tireGripReserve <= 1.05, `desktop tire grip reserve telemetry was invalid: ${state.tireGripReserve}`);
  assert(state.tirePressure >= 0.86 && state.tirePressure <= 1.18, `desktop tire pressure telemetry was invalid: ${state.tirePressure}`);
  assert(state.tireContactPatch >= 0.74 && state.tireContactPatch <= 1.1, `desktop tire contact patch telemetry was invalid: ${state.tireContactPatch}`);
  assert(state.tirePressureLoad >= 0 && state.tirePressureLoad <= 1, `desktop tire pressure load telemetry was invalid: ${state.tirePressureLoad}`);
  assert(Number.isFinite(state.combinedSlipVisualLoad) && state.combinedSlipVisualLoad >= 0, "desktop combined slip visual load was missing");
  assert(state.tireGripReserveVisual >= 0.52 && state.tireGripReserveVisual <= 1.05, `desktop tire grip reserve visual load was invalid: ${state.tireGripReserveVisual}`);
  assert(state.tirePressureVisual >= 0.86 && state.tirePressureVisual <= 1.18, `desktop tire pressure visual load was invalid: ${state.tirePressureVisual}`);
  assert(
    state.tireContactPatchVisual >= 0.74 && state.tireContactPatchVisual <= 1.1,
    `desktop tire contact patch visual load was invalid: ${state.tireContactPatchVisual}`
  );
  assert(state.tirePressureVisualLoad >= 0 && state.tirePressureVisualLoad <= 1, `desktop tire pressure visual load was invalid: ${state.tirePressureVisualLoad}`);
  assert(state.brakeBalanceVisualLoad >= 0 && state.brakeBalanceVisualLoad <= 1, `desktop brake balance visual load was invalid: ${state.brakeBalanceVisualLoad}`);
  assert(state.frontLockRiskVisual >= 0 && state.frontLockRiskVisual <= 1, `desktop front lock risk visual load was invalid: ${state.frontLockRiskVisual}`);
  assert(state.rearBrakeLightnessVisual >= 0 && state.rearBrakeLightnessVisual <= 1, `desktop rear brake lightness visual load was invalid: ${state.rearBrakeLightnessVisual}`);
  assert(state.driveTorqueVisualLoad >= 0 && state.driveTorqueVisualLoad <= 1, `desktop drive torque visual load was invalid: ${state.driveTorqueVisualLoad}`);
  assert(state.pedalOverlapVisualLoad >= 0 && state.pedalOverlapVisualLoad <= 1, `desktop pedal-overlap visual load was invalid: ${state.pedalOverlapVisualLoad}`);
  assert(state.differentialLockVisual >= 0 && state.differentialLockVisual <= 1, `desktop differential lock visual load was invalid: ${state.differentialLockVisual}`);
  assert(state.insideRearSlipVisual >= 0 && state.insideRearSlipVisual <= 1, `desktop inside rear slip visual load was invalid: ${state.insideRearSlipVisual}`);
  assert(state.tireSaturation >= 0 && state.tireSaturation <= 1, `desktop tire saturation telemetry was invalid: ${state.tireSaturation}`);
  assert(state.tireRelaxation >= 0 && state.tireRelaxation <= 1, `desktop tire relaxation telemetry was invalid: ${state.tireRelaxation}`);
  assert(state.tireLoadFeedback >= 0 && state.tireLoadFeedback <= 1, `desktop tire load feedback telemetry was invalid: ${state.tireLoadFeedback}`);
  assert(state.steeringLoadFeedback >= 0 && state.steeringLoadFeedback <= 1, `desktop steering load feedback telemetry was invalid: ${state.steeringLoadFeedback}`);
  assert(state.steeringLoadFeedback > 0.12, `desktop steering load feedback stayed too quiet: ${state.steeringLoadFeedback}`);
  assert(state.steeringRackLoad >= 0 && state.steeringRackLoad <= 1, `desktop steering rack load telemetry was invalid: ${state.steeringRackLoad}`);
  assert(state.steeringVelocity >= -1 && state.steeringVelocity <= 1, `desktop steering velocity telemetry was invalid: ${state.steeringVelocity}`);
  assert(state.steeringImpulse >= 0 && state.steeringImpulse <= 1, `desktop steering impulse telemetry was invalid: ${state.steeringImpulse}`);
  assert(Number.isFinite(state.selfAlignTorque) && Math.abs(state.selfAlignTorque) <= 1, `desktop self-align torque telemetry was invalid: ${state.selfAlignTorque}`);
  assert(Number.isFinite(state.steeringRackVisualLoad) && state.steeringRackVisualLoad >= 0, "desktop steering rack visual load was missing");
  assert(state.steeringVelocityVisual >= -1 && state.steeringVelocityVisual <= 1, `desktop steering velocity visual load was invalid: ${state.steeringVelocityVisual}`);
  assert(state.steeringImpulseVisual >= 0 && state.steeringImpulseVisual <= 1, `desktop steering impulse visual load was invalid: ${state.steeringImpulseVisual}`);
  assert(state.yawInertiaLoad >= 0 && state.yawInertiaLoad <= 1, `desktop yaw inertia load telemetry was invalid: ${state.yawInertiaLoad}`);
  assert(state.yawDamping >= 0.2 && state.yawDamping <= 1.2, `desktop yaw damping telemetry was invalid: ${state.yawDamping}`);
  assert(state.counterSteerLoad >= 0 && state.counterSteerLoad <= 1, `desktop countersteer telemetry was invalid: ${state.counterSteerLoad}`);
  assert(state.slipRecovery >= 0 && state.slipRecovery <= 1, `desktop slip recovery telemetry was invalid: ${state.slipRecovery}`);
  assert(state.chassisStability >= 0.34 && state.chassisStability <= 1.08, `desktop chassis stability telemetry was invalid: ${state.chassisStability}`);
  assert(Number.isFinite(state.yawInertiaVisualLoad) && state.yawInertiaVisualLoad >= 0, "desktop yaw inertia visual load was missing");
  assert(state.yawDampingVisual >= 0.2 && state.yawDampingVisual <= 1.2, `desktop yaw damping visual load was invalid: ${state.yawDampingVisual}`);
  assert(state.counterSteerVisualLoad >= 0 && state.counterSteerVisualLoad <= 1, `desktop countersteer visual load was invalid: ${state.counterSteerVisualLoad}`);
  assert(state.slipRecoveryVisual >= 0 && state.slipRecoveryVisual <= 1, `desktop slip recovery visual load was invalid: ${state.slipRecoveryVisual}`);
  assert(
    state.chassisStabilityVisual >= 0.34 && state.chassisStabilityVisual <= 1.08,
    `desktop chassis stability visual load was invalid: ${state.chassisStabilityVisual}`
  );
  assert(state.roadAlignment > 0.25 && state.roadAlignment <= 1.05, `desktop road alignment telemetry was invalid: ${state.roadAlignment}`);
  assert(Number.isFinite(state.roadCamber), "desktop road camber telemetry was missing");
  assert(Number.isFinite(state.roadGrade), "desktop road grade telemetry was missing");
  assert(state.roadLoad > 0.65 && state.roadLoad < 1.35, `desktop road load telemetry was invalid: ${state.roadLoad}`);
  assert(state.roadCompression >= -0.3 && state.roadCompression <= 0.3, `desktop road compression telemetry was invalid: ${state.roadCompression}`);
  assert(state.roadFeelFeedback >= 0 && state.roadFeelFeedback <= 1, `desktop road feel feedback telemetry was invalid: ${state.roadFeelFeedback}`);
  assert(state.roadFeelFeedback > 0.025, `desktop road feel feedback stayed too quiet: ${state.roadFeelFeedback}`);
  assert(state.roadTextureLoad >= 0 && state.roadTextureLoad <= 1, `desktop road texture telemetry was invalid: ${state.roadTextureLoad}`);
  assert(state.chassisHeave >= -0.25 && state.chassisHeave <= 0.25, `desktop chassis heave telemetry was invalid: ${state.chassisHeave}`);
  assert(state.rideSettling >= 0 && state.rideSettling <= 1, `desktop ride settling telemetry was invalid: ${state.rideSettling}`);
  assert(state.roadTextureVisualLoad >= 0 && state.roadTextureVisualLoad <= 1, `desktop road texture visual load was invalid: ${state.roadTextureVisualLoad}`);
  assert(state.floorStrikeLoad >= 0 && state.floorStrikeLoad <= 1, `desktop floor strike telemetry was invalid: ${state.floorStrikeLoad}`);
  assert(state.floorStrikeVisualLoad >= 0 && state.floorStrikeVisualLoad <= 1, `desktop floor strike visual load was invalid: ${state.floorStrikeVisualLoad}`);
  assert(state.chassisHeaveVisual >= -0.25 && state.chassisHeaveVisual <= 0.25, `desktop chassis heave visual load was invalid: ${state.chassisHeaveVisual}`);
  assert(state.rideSettlingVisual >= 0 && state.rideSettlingVisual <= 1, `desktop ride settling visual load was invalid: ${state.rideSettlingVisual}`);
  assert(state.suspensionLoad > 0.45 && state.suspensionLoad < 1.7, `desktop suspension load telemetry was invalid: ${state.suspensionLoad}`);
  assert(state.suspensionTravel > -0.35 && state.suspensionTravel < 0.45, `desktop suspension travel telemetry was invalid: ${state.suspensionTravel}`);
  assert(Number.isFinite(state.chassisPitch), "desktop chassis pitch telemetry was missing");
  assert(Number.isFinite(state.chassisRoll), "desktop chassis roll telemetry was missing");
  assert(Number.isFinite(state.trackRubber) && state.trackRubber >= 0, `desktop track rubber telemetry was missing: ${state.trackRubber}`);
  assert(Number.isFinite(state.dryingLine) && state.dryingLine >= 0, `desktop drying-line telemetry was missing: ${state.dryingLine}`);
  assert(state.trackEvolutionState.length > 0, "desktop track evolution state was missing");
  assert(Number.isFinite(state.rubberedLineGrip) && state.rubberedLineGrip >= 0, `desktop rubbered-line grip telemetry was missing: ${state.rubberedLineGrip}`);
  assert(Number.isFinite(state.marbles) && state.marbles >= 0, `desktop marble telemetry was missing: ${state.marbles}`);
  assert(Number.isFinite(state.dirtyTirePickup) && state.dirtyTirePickup >= 0, `desktop dirty-tire telemetry was missing: ${state.dirtyTirePickup}`);
  assert(/track|line|marbles|tires|surface/i.test(state.gripState), `desktop grip state was missing: ${state.gripState}`);
  assert(Number.isFinite(state.draft), "desktop draft telemetry was missing");
  assert(Number.isFinite(state.dirtyAir), "desktop dirty-air telemetry was missing");
  assert(Number.isFinite(state.cameraBuffet), "desktop camera buffet telemetry was missing");
  assert(trafficWakeState.airWakeIntensity > 0.01, `desktop air wake did not react to traffic turbulence: ${trafficWakeState.airWakeIntensity}`);
  assert(trafficWakeState.airWakeRibbons >= 10, `desktop air wake ribbons were missing: ${trafficWakeState.airWakeRibbons}`);
  assert(Number.isFinite(state.rivalProximity), "desktop rival proximity telemetry was missing");
  assert(Number.isFinite(state.sideBySide), "desktop side-by-side telemetry was missing");
  assert(Number.isFinite(state.contactRisk), "desktop contact-risk telemetry was missing");
  assert(Number.isFinite(state.frontWingDamage) && state.frontWingDamage >= 0, "desktop front-wing damage telemetry was missing");
  assert(Number.isFinite(state.frontWingVisualDamage) && state.frontWingVisualDamage >= 0, "desktop front-wing visual damage was missing");
  assert(state.frontAeroLoad >= 0 && state.frontAeroLoad <= 1.2, `desktop front aero load telemetry was invalid: ${state.frontAeroLoad}`);
  assert(state.rearAeroLoad >= 0 && state.rearAeroLoad <= 1.2, `desktop rear aero load telemetry was invalid: ${state.rearAeroLoad}`);
  assert(Math.abs(state.aeroBalance) <= 0.65, `desktop aero balance telemetry was invalid: ${state.aeroBalance}`);
  assert(state.aeroWashout >= 0 && state.aeroWashout <= 1, `desktop aero washout telemetry was invalid: ${state.aeroWashout}`);
  assert(Number.isFinite(state.frontAeroVisualLoad) && state.frontAeroVisualLoad >= 0, "desktop front aero visual load was missing");
  assert(Number.isFinite(state.rearAeroVisualLoad) && state.rearAeroVisualLoad >= 0, "desktop rear aero visual load was missing");
  assert(Number.isFinite(state.downforceLoss) && state.downforceLoss >= 0, "desktop downforce loss telemetry was missing");
  assert(/Wing/.test(state.damageState), `desktop damage state was missing: ${state.damageState}`);
  assert(Number.isFinite(state.defensiveRivals), "desktop defensive-rival telemetry was missing");
  assert(Number.isFinite(state.nearestRivalGap), "desktop nearest-rival gap telemetry was missing");
  assert(state.racecraftState.length > 0, "desktop racecraft state was missing");
  assert(/air|aero|rack|self-align|rival|wheel|contact|defensive|overtakes|slipstream|rhythm|zone|untidy|reset|kerb|runoff|gravel|wing|brake|shift|traction|power|marbles|tires|line/i.test(state.streak), `desktop racecraft HUD was missing: ${state.streak}`);
  assert(state.rainIntensity > 0.8, `desktop rain intensity did not reach renderer, rain=${state.rainIntensity}`);
  assert(state.roadWetness > 0.8, `desktop road wetness did not reach renderer, wetness=${state.roadWetness}`);
  assert(state.launchCharge > 0.5, `desktop launch charge did not build during countdown, charge=${state.launchCharge}`);
  assert(Number.isFinite(state.launchQuality), "desktop launch quality telemetry was missing");
  assert(Number.isFinite(state.assistSteer), "desktop assist steering telemetry was missing");
  assert(Number.isFinite(state.assistBrake), "desktop assist brake telemetry was missing");
  assert(Number.isFinite(state.assistThrottleTrim), "desktop assist throttle telemetry was missing");
  assert(/assist|Manual/i.test(state.assistChip), `desktop assist chip was missing: ${state.assistChip}`);
  assert(["ready", "active", "manual"].includes(state.assistChipMode), `desktop assist chip mode was invalid: ${state.assistChipMode}`);
  assert(/^P\d+\/P5 F\d+\/48 \+\d+\/3s$/.test(state.seriesTargetChip), `desktop racing target tracker was wrong: ${state.seriesTargetChip}`);
  assert(["live", "met", "missed"].includes(state.seriesTargetMode), `desktop racing target mode was wrong: ${state.seriesTargetMode}`);
  assert(state.speed > 60, `desktop launch did not accelerate, speed=${state.speed}`);
  assert(state.gear >= 1, "desktop gear readout was missing");
  assert(state.shiftLightCount === 5, `desktop shift-light cluster was incomplete: ${state.shiftLightCount}`);
  assert(state.shiftLightsActive > 0, `desktop shift lights did not react to RPM: ${state.shiftLightsActive}`);
  assert(state.assetCar === "apex-procedural-f25", `desktop fictional formula car did not load, asset=${state.assetCar}`);
  assert(state.renderPipeline === "srgb-aces-soft-shadows", `desktop render pipeline was not configured: ${state.renderPipeline}`);
  assert(state.renderToneMapping === "aces", `desktop tone mapping was not filmic: ${state.renderToneMapping}`);
  assert(state.renderShadowType === "pcf-soft", `desktop soft shadows were not configured: ${state.renderShadowType}`);
  assert(state.renderShadowMap === "2048x2048", `desktop shadow map resolution was wrong: ${state.renderShadowMap}`);
  assert(state.tracksideAssets === "kenney", `desktop free trackside assets did not load, assets=${state.tracksideAssets}`);
  assert(state.tracksideGrandstands >= 4, `desktop free grandstand assets did not load, grandstands=${state.tracksideGrandstands}`);
  assert(state.tracksideLightPosts >= 4, `desktop free light-post assets did not load, lights=${state.tracksideLightPosts}`);
  assert(state.circuitDressingPieces >= 280, `desktop circuit dressing was too sparse: ${state.circuitDressingPieces}`);
  assert(state.circuitSafetyBarriers >= 100, `desktop layered GP barriers were missing: ${state.circuitSafetyBarriers}`);
  assert(state.circuitCatchFences >= 90, `desktop catch fencing was missing: ${state.circuitCatchFences}`);
  assert(state.circuitPitWallModules >= 5, `desktop pit wall modules were missing: ${state.circuitPitWallModules}`);
  assert(state.circuitMarshalPosts >= 3, `desktop marshal posts were missing: ${state.circuitMarshalPosts}`);
  assert(state.circuitCheckpointGates >= 7, `desktop checkpoint gates were missing: ${state.circuitCheckpointGates}`);
  assert(/northstar-venue-hero/.test(state.circuitVenueHero), `desktop venue hero did not match selected track: ${state.circuitVenueHero}`);
  assert(state.circuitTimingBridge === "camera-safe-timing-bridge", `desktop timing bridge was not camera-safe: ${state.circuitTimingBridge}`);
  assert(state.circuitTimingBridgeClearance >= 11, `desktop timing bridge clearance was too tight: ${state.circuitTimingBridgeClearance}`);
  assert(state.circuitTimingBridgeDeckHeight >= 6, `desktop timing bridge deck was too low: ${state.circuitTimingBridgeDeckHeight}`);
  assert(state.surfaceTerrainBands >= 2, `desktop terrain was not split into road-safe bands: ${state.surfaceTerrainBands}`);
  assert(state.surfaceRacingGroove === "rubbered-racing-groove", `desktop rubbered racing groove was missing: ${state.surfaceRacingGroove}`);
  assert(/offline-marbles/.test(state.surfaceMarbles), `desktop offline marbles were missing: ${state.surfaceMarbles}`);
  assert(state.surfaceWetSheen === "wet-asphalt-sheen", `desktop wet surface sheen was missing: ${state.surfaceWetSheen}`);
  assert(/painted-left-track-edge/.test(state.surfaceEdgeLines), `desktop painted edge lines were missing: ${state.surfaceEdgeLines}`);
  assert(state.surfaceFlowCues >= 20, `desktop apex flow cues were too sparse: ${state.surfaceFlowCues}`);
  assert(state.surfaceGridSlots >= 10, `desktop painted grid slots were missing: ${state.surfaceGridSlots}`);
  assert(state.surfacePuddles >= 5, `desktop standing water details were missing: ${state.surfacePuddles}`);
  assert(state.surfaceWetSheenOpacity > 0.1, `desktop wet sheen did not react to storm weather: ${state.surfaceWetSheenOpacity}`);
  assert(state.surfacePuddleOpacity > 0.2, `desktop puddles did not react to storm weather: ${state.surfacePuddleOpacity}`);
  assert(state.racingLineAssist === "dynamic", `desktop dynamic racing line did not activate: ${state.racingLineAssist}`);
  assert(state.racingLineAssistStyle === "chevrons", `desktop racing line assist was not chevron styled: ${state.racingLineAssistStyle}`);
  assert(state.dynamicRacingLineSegments >= 24, `desktop dynamic racing line segments missing: ${state.dynamicRacingLineSegments}`);
  assert(state.dynamicRacingLinePieces >= state.dynamicRacingLineSegments * 2, `desktop racing line chevron pieces missing: ${state.dynamicRacingLinePieces}`);
  assert(["brake", "apex", "exit", "commit"].includes(state.racingLineCue), `desktop racing line cue was missing: ${state.racingLineCue}`);
  assert(state.nextCheckpointBeacon === "active", `desktop next-checkpoint beacon did not activate: ${state.nextCheckpointBeacon}`);
  assert(state.nextCheckpointBeaconStyle === "low-chrome", `desktop next-checkpoint beacon style was too heavy: ${state.nextCheckpointBeaconStyle}`);
  assert(state.nextCheckpointBeaconVisible === "true", `desktop next-checkpoint beacon was not visible: ${state.nextCheckpointBeaconVisible}`);
  assert(
    state.nextCheckpointBeaconDistance > 0 && state.nextCheckpointBeaconDistance < 2200,
    `desktop next-checkpoint beacon distance was invalid: ${state.nextCheckpointBeaconDistance}`
  );
  assert(/^\d\/[67] .+/.test(state.nextCheckpointBeaconLabel), `desktop next-checkpoint beacon label was missing: ${state.nextCheckpointBeaconLabel}`);
  assert(state.nextCheckpointBeaconScale > 0.3 && state.nextCheckpointBeaconScale < 1, `desktop next-checkpoint beacon scale was intrusive: ${state.nextCheckpointBeaconScale}`);
  assert(
    state.nextCheckpointBeaconOpacity > 0.04 && state.nextCheckpointBeaconOpacity < 0.3,
    `desktop next-checkpoint beacon opacity was intrusive: ${state.nextCheckpointBeaconOpacity}`
  );
  assert(state.assetWeather === "Wet Storm", `desktop weather did not reach renderer, weather=${state.assetWeather}`);
  assert(state.trackLayout === "northstar", `desktop selected layout did not reach renderer, layout=${state.trackLayout}`);
  assert(state.horizonTrack === "northstar", `desktop selected layout did not rebuild horizon, horizon=${state.horizonTrack}`);
  assert(state.horizonRenderPolicy === "background-depth-safe", `desktop horizon render policy was unsafe: ${state.horizonRenderPolicy}`);
  assert(state.horizonSkySize === "dome:6200", `desktop horizon sky dome was not full-bleed: ${state.horizonSkySize}`);
  assert(state.horizonSkyDepthWrite === "false", `desktop horizon sky wrote to depth: ${state.horizonSkyDepthWrite}`);
  assert(state.horizonSkyRenderOrder <= -1000, `desktop horizon sky did not render behind the world: ${state.horizonSkyRenderOrder}`);
  assert(state.stormLightningBolts >= 3, `desktop storm lightning layer was missing: ${state.stormLightningBolts}`);
  assert(state.stormLightningFlash > 0.02, `desktop storm lightning did not react to storm weather: ${state.stormLightningFlash}`);
  assert(
    state.surfaceTerrainReach >= 16 && state.surfaceTerrainReach <= 56,
    `desktop terrain reach was not camera-safe: ${state.surfaceTerrainReach}`
  );
  assert(state.surfaceTerrainSkirtDrop < -12, `desktop terrain skirt did not drop below the elevated circuit: ${state.surfaceTerrainSkirtDrop}`);
  assert(state.surfaceTerrainOpacity > 0.08 && state.surfaceTerrainOpacity < 0.2, `desktop terrain skirt was too opaque: ${state.surfaceTerrainOpacity}`);
  assert(state.surfaceRunoffReach >= 10 && state.surfaceRunoffReach <= 11, `desktop runoff apron was too wide for camera readability: ${state.surfaceRunoffReach}`);
  assert(state.surfaceTechnicalZones >= 3, `desktop trackside technical zones were missing: ${state.surfaceTechnicalZones}`);
  assert(state.hudPhase === "racing", `desktop HUD did not switch into racing phase: ${state.hudPhase}`);
  assert(/clear|left|right/.test(state.hudCameraPressure), `desktop HUD camera pressure state was missing: ${state.hudCameraPressure}`);
  if (state.hudCameraPressure === "right") {
    assert(state.racingStatusOpacity < 1, `desktop HUD did not begin yielding on right camera pressure: ${state.racingStatusOpacity}`);
  }
  assert(state.hudCoverage < 0.12, `desktop racing HUD covered too much of the playfield: ${state.hudCoverage}`);
  assert(state.racingStatusWidth <= 220, `desktop racing status panel was too wide: ${state.racingStatusWidth}`);
  assert(state.racingTimingWidth <= 190, `desktop racing timing tower was too wide: ${state.racingTimingWidth}`);
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
  await page.waitForFunction(
    () => document.querySelector(".hud")?.dataset.phase === "racing" && Number(document.querySelector("#speed")?.textContent ?? 0) > 60,
    undefined,
    { timeout: 9000 }
  );
  await page.locator("[data-control=right]").dispatchEvent("pointerup");
  await page.locator("[data-control=throttle]").dispatchEvent("pointerup");
  await page.waitForFunction(
    () => {
      const status = document.querySelector(".status-panel")?.getBoundingClientRect();
      return document.querySelector(".hud")?.dataset.phase === "racing" && (status?.width ?? Infinity) <= 145;
    },
    undefined,
    { timeout: 3000 }
  );

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
      cameraPortraitView: Number(document.querySelector("#game canvas")?.dataset.cameraPortraitView ?? 0),
      cameraChaseDistance: Number(document.querySelector("#game canvas")?.dataset.cameraChaseDistance ?? 0),
      cameraFov: Number(document.querySelector("#game canvas")?.dataset.cameraFov ?? 0),
      carScreenY: Number(document.querySelector("#game canvas")?.dataset.carScreenY ?? 0),
      statusOpacity: Number(getComputedStyle(document.querySelector(".status-panel")).opacity),
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
  assert(state.cameraPortraitView > 0.8, `mobile portrait camera mode was not active: ${state.cameraPortraitView}`);
  assert(state.cameraChaseDistance > 11.5, `mobile chase camera stayed too close: ${state.cameraChaseDistance}`);
  assert(state.cameraFov >= 48, `mobile chase camera FOV stayed too tight: ${state.cameraFov}`);
  assert(state.carScreenY > -0.62, `mobile car sat too low in frame: ${state.carScreenY}`);
  assert(state.statusWidth <= 145, `mobile racing status panel was too wide: ${state.statusWidth}`);
  assert(state.statusOpacity < 0.8, `mobile racing status panel did not soften over the road: ${state.statusOpacity}`);
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
  await page.waitForFunction(
    () => document.querySelector(".hud")?.dataset.phase === "racing" && Number(document.querySelector("#speed")?.textContent ?? 0) > 60,
    undefined,
    { timeout: 9000 }
  );
  await page.keyboard.up("ArrowUp");

  const state = await page.evaluate(() => ({
    hudPhase: document.querySelector(".hud")?.dataset.phase ?? "",
    sessionWeather: document.querySelector("#session-weather")?.textContent ?? "",
    racingLineAssist: document.querySelector("#game canvas")?.dataset.racingLineAssist ?? "",
    racingLineAssistStyle: document.querySelector("#game canvas")?.dataset.racingLineAssistStyle ?? "",
    dynamicRacingLineSegments: Number(document.querySelector("#game canvas")?.dataset.dynamicRacingLineSegments ?? 0),
    dynamicRacingLinePieces: Number(document.querySelector("#game canvas")?.dataset.dynamicRacingLinePieces ?? 0),
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
  assert(state.racingLineAssistStyle === "off", `manual racing line assist style stayed active: ${state.racingLineAssistStyle}`);
  assert(state.dynamicRacingLineSegments === 0, `manual racing line segments stayed active: ${state.dynamicRacingLineSegments}`);
  assert(state.dynamicRacingLinePieces === 0, `manual racing line chevron pieces stayed active: ${state.dynamicRacingLinePieces}`);
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
