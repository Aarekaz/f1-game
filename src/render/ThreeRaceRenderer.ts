import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import {
  getActiveTrackLayout,
  sampleTrack,
  setActiveTrackLayout,
  trackWorldHeadingAt,
  trackWorldPointAt,
  trackWorldTangentAt,
  TRACK_LOOP_LENGTH
} from "../game/trackPath";
import type { SessionConfig } from "../world/FictionalGpWorld";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";
import { buildGpCircuit } from "./buildGpCircuit";
import { RacingAssetLibrary } from "./RacingAssetLibrary";

type CameraMode = "chase" | "pod";

const RACING_LINE_SEGMENTS = 30;
const RACING_LINE_CHEVRON_BARS = 2;

function disposeObject3D(root: { traverse: (callback: (object: unknown) => void) => void }) {
  const materials = new Set<{ dispose: () => void }>();
  const textures = new Set<{ dispose: () => void }>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const mesh = object as {
      geometry: { dispose: () => void };
      material: { dispose: () => void } | Array<{ dispose: () => void }>;
    };
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) materials.add(item);
    } else {
      materials.add(material);
    }
  });

  for (const material of materials) {
    const mapped = material as { map?: { dispose: () => void } | null };
    if (mapped.map) textures.add(mapped.map);
    material.dispose();
  }

  for (const texture of textures) {
    texture.dispose();
  }
}

function makeSoftMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 76, 4, 64, 72, 62);
    gradient.addColorStop(0, "rgba(235, 243, 240, 0.46)");
    gradient.addColorStop(0.42, "rgba(225, 236, 234, 0.22)");
    gradient.addColorStop(1, "rgba(225, 236, 234, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRainDropletTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const body = ctx.createLinearGradient(48, 18, 48, 150);
    body.addColorStop(0, "rgba(255, 255, 255, 0.62)");
    body.addColorStop(0.32, "rgba(224, 239, 242, 0.34)");
    body.addColorStop(0.72, "rgba(196, 220, 224, 0.18)");
    body.addColorStop(1, "rgba(196, 220, 224, 0)");

    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(48, 58, 16, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(42, 64, 12, 70);

    const highlight = ctx.createRadialGradient(42, 36, 1, 42, 36, 22);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.74)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.ellipse(42, 38, 7, 17, -0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class ThreeRaceRenderer {
  private readonly renderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1800);
  private readonly assets = new RacingAssetLibrary();
  private readonly hemi = new THREE.HemisphereLight("#dcefff", "#14210f", 1.7);
  private readonly sun = new THREE.DirectionalLight("#ffffff", 2.7);
  private readonly car = buildFormulaCarProxy();
  private circuit = buildGpCircuit();
  private readonly tracksideAssets = new THREE.Group();
  private horizon = this.buildHorizon();
  private readonly speedStreaks = this.buildSpeedStreaks();
  private readonly airWake = this.buildAirWake();
  private readonly tireSmoke = this.buildTireSmoke();
  private readonly brakePressureTrail = this.buildBrakePressureTrail();
  private readonly rainStreaks = this.buildRainStreaks();
  private readonly waterSpray = this.buildWaterSpray();
  private readonly lensRain = this.buildLensRain();
  private readonly proximityMarkers = this.buildProximityMarkers();
  private readonly racingLineAssist = this.buildRacingLineAssist();
  private readonly checkpointBeacon = this.buildCheckpointBeacon();
  private readonly cockpitFrame = this.buildCockpitFrame();
  private readonly cameraPosition = new THREE.Vector3(0, 5.8, 22.5);
  private readonly cameraTarget = new THREE.Vector3(0, 0.72, -16.5);
  private readonly desiredCameraPosition = new THREE.Vector3();
  private readonly desiredCameraTarget = new THREE.Vector3();
  private readonly carScreenPosition = new THREE.Vector3();
  private readonly rivals = new Map<number, ReturnType<typeof buildFormulaCarProxy>>();
  private readonly rivalSprays = new Map<number, THREE.Group>();
  private readonly rivalLabels = new Map<number, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private readonly handleResize = () => this.resize();
  private cameraMode: CameraMode = "chase";
  private cameraModeSnap = false;

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#c7d8df");
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.className = "race-canvas";
    this.renderer.domElement.dataset.assetCar = "apex-procedural-f25";
    this.renderer.domElement.dataset.cameraMode = this.cameraMode;
    this.parent.appendChild(this.renderer.domElement);
    this.syncHorizonTelemetry();

    this.scene.fog = new THREE.Fog("#c7d8df", 180, 920);
    this.scene.add(this.hemi);
    this.sun.position.set(-12, 30, -22);
    this.sun.castShadow = true;
    this.scene.add(this.sun);
    this.camera.add(this.lensRain);
    this.camera.add(this.cockpitFrame);
    this.scene.add(this.camera);

    this.scene.add(this.circuit);
    this.tracksideAssets.name = "loaded-trackside-assets";
    this.scene.add(this.tracksideAssets);
    this.scene.add(this.horizon);
    this.scene.add(this.speedStreaks);
    this.scene.add(this.airWake);
    this.scene.add(this.tireSmoke);
    this.scene.add(this.brakePressureTrail);
    this.scene.add(this.rainStreaks);
    this.scene.add(this.waterSpray);
    this.scene.add(this.proximityMarkers);
    this.scene.add(this.racingLineAssist);
    this.scene.add(this.checkpointBeacon);
    this.scene.add(this.car);
    void this.loadRaceAssets();
    this.resize();
    window.addEventListener("resize", this.handleResize);
  }

  resize() {
    const width = this.parent.clientWidth || window.innerWidth || 1;
    const height = this.parent.clientHeight || window.innerHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  configure(session: SessionConfig) {
    setActiveTrackLayout(session.track.id);
    this.scene.remove(this.circuit);
    disposeObject3D(this.circuit);
    this.circuit = buildGpCircuit();
    this.scene.add(this.circuit);
    this.scene.remove(this.horizon);
    disposeObject3D(this.horizon);
    this.horizon = this.buildHorizon();
    this.scene.add(this.horizon);
    this.positionLoadedTracksideAssets();
    this.renderer.domElement.dataset.trackLayout = session.track.id;
    this.renderer.domElement.dataset.horizonTrack = session.track.id;
    this.syncHorizonTelemetry();
    this.syncCircuitDressingTelemetry();
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === "chase" ? "pod" : "chase";
    this.cameraModeSnap = true;
    this.renderer.domElement.dataset.cameraMode = this.cameraMode;
  }

  update(telemetry: RaceTelemetry) {
    const visualProgress = telemetry.car.z % TRACK_LOOP_LENGTH;
    this.renderer.domElement.dataset.trackOffset = visualProgress.toFixed(2);
    this.renderer.domElement.dataset.carDistance = telemetry.car.z.toFixed(2);
    this.renderer.domElement.dataset.circuitWorldZ = this.circuit.position.z.toFixed(2);
    this.renderer.domElement.dataset.carSlip = telemetry.car.slip.toFixed(3);
    this.renderer.domElement.dataset.carWheelspin = telemetry.car.wheelspin.toFixed(3);
    this.renderer.domElement.dataset.carUndersteer = telemetry.car.understeer.toFixed(3);
    this.renderer.domElement.dataset.carLockup = telemetry.car.lockup.toFixed(3);
    this.renderer.domElement.dataset.carHeading = telemetry.car.heading.toFixed(3);
    this.renderer.domElement.dataset.carYawRate = telemetry.car.yawRate.toFixed(3);
    this.renderer.domElement.dataset.flowScore = telemetry.flowScore.toFixed(3);
    this.renderer.domElement.dataset.flowState = telemetry.flowState;
    this.renderer.domElement.dataset.surfaceName = telemetry.surfaceName;
    this.renderer.domElement.dataset.surfaceGripModifier = telemetry.surfaceGripModifier.toFixed(2);
    this.renderer.domElement.dataset.surfaceRumble = telemetry.surfaceRumble.toFixed(3);
    this.renderer.domElement.dataset.draft = telemetry.draft.toFixed(3);
    this.renderer.domElement.dataset.dirtyAir = telemetry.dirtyAir.toFixed(3);
    this.renderer.domElement.dataset.rivalProximity = telemetry.rivalProximity.toFixed(3);
    this.renderer.domElement.dataset.sideBySide = telemetry.sideBySide.toFixed(3);
    this.renderer.domElement.dataset.contactRisk = telemetry.contactRisk.toFixed(3);
    this.renderer.domElement.dataset.defensiveRivals = String(telemetry.defensiveRivals);
    this.renderer.domElement.dataset.nearestRivalGap = telemetry.nearestRivalGapMeters === null ? "" : telemetry.nearestRivalGapMeters.toFixed(1);
    this.renderer.domElement.dataset.racecraftState = telemetry.racecraftState;
    this.renderer.domElement.dataset.rainIntensity = telemetry.rainIntensity.toFixed(2);
    this.renderer.domElement.dataset.roadWetness = telemetry.roadWetness.toFixed(2);
    this.renderer.domElement.dataset.launchCharge = telemetry.launchCharge.toFixed(2);
    this.renderer.domElement.dataset.launchQuality = telemetry.launchQuality.toFixed(2);
    this.renderer.domElement.dataset.aeroBoostAvailable = String(telemetry.aeroBoostAvailable);
    this.renderer.domElement.dataset.aeroBoostActive = telemetry.aeroBoostActive.toFixed(2);
    this.renderer.domElement.dataset.aeroDragReduction = telemetry.aeroDragReduction.toFixed(2);
    this.renderer.domElement.dataset.tireTemp = telemetry.tireTemp.toFixed(2);
    this.renderer.domElement.dataset.tireWear = telemetry.tireWear.toFixed(3);
    this.renderer.domElement.dataset.tireState = telemetry.tireState;
    this.renderer.domElement.dataset.assistSteer = telemetry.assistSteer.toFixed(3);
    this.renderer.domElement.dataset.assistBrake = telemetry.assistBrake.toFixed(3);
    this.renderer.domElement.dataset.assistThrottleTrim = telemetry.assistThrottleTrim.toFixed(3);
    this.renderer.domElement.dataset.weather = telemetry.weatherName;
    this.renderer.domElement.dataset.trackName = telemetry.trackName;
    this.applyAtmosphere(telemetry);
    const carLateral = telemetry.carX;
    const carPoint = trackWorldPointAt(telemetry.car.z, carLateral);
    const trackYaw = trackWorldHeadingAt(telemetry.car.z);
    const trackTangent = trackWorldTangentAt(telemetry.car.z);
    const trackNormal = { x: -trackTangent.z, z: trackTangent.x };
    const carX = carPoint.x;
    const carY = telemetry.car.y;
    const carZ = carPoint.z;
    this.renderer.domElement.dataset.carWorldX = carX.toFixed(2);
    this.renderer.domElement.dataset.carWorldY = carY.toFixed(2);
    this.renderer.domElement.dataset.carWorldZ = carZ.toFixed(2);
    const speedRatio = Math.min(1, telemetry.speedKph / 310);
    this.car.position.set(carX, carY, carZ);
    const rumblePulse = Math.sin(performance.now() * 0.052) * telemetry.surfaceRumble;
    this.car.position.y += Math.sin(performance.now() * 0.016) * speedRatio * 0.018 + telemetry.car.slip * 0.026 + rumblePulse * 0.032;
    this.car.rotation.y = trackYaw - telemetry.car.heading - telemetry.curve * 0.5;
    this.car.rotation.x = telemetry.car.braking * 0.035 - telemetry.car.throttle * speedRatio * 0.018 + rumblePulse * 0.018;
    this.car.rotation.z =
      -telemetry.car.yawRate * 0.3 + telemetry.car.understeer * 0.04 - telemetry.car.lockup * 0.024 - telemetry.car.bank * 0.16 + rumblePulse * 0.014;
    this.animateFormulaCar(this.car, {
      distance: telemetry.car.z,
      speedKph: telemetry.speedKph,
      steering: telemetry.car.yawRate * 0.9,
      braking: telemetry.car.braking + telemetry.car.lockup * 0.65,
      throttle: telemetry.car.throttle,
      wheelspin: telemetry.car.wheelspin,
      rainLight: telemetry.phase === "racing" ? telemetry.roadWetness * (0.46 + telemetry.rainIntensity * 0.34 + speedRatio * 0.2) : 0,
      ersDeploy: telemetry.phase === "racing" && telemetry.speedKph > 130 && telemetry.ers < 0.92 && telemetry.car.throttle > 0.35 ? 1 : 0,
      aeroOpen: telemetry.aeroBoostActive
    });
    this.renderer.domElement.dataset.wheelSpin = (telemetry.car.z * 3.2).toFixed(2);
    this.renderer.domElement.dataset.brakeGlow = clamp(telemetry.car.braking + telemetry.car.lockup * 0.65, 0, 1).toFixed(2);
    this.renderer.domElement.dataset.rearRainLight = clamp(
      telemetry.phase === "racing" ? telemetry.roadWetness * (0.46 + telemetry.rainIntensity * 0.34 + speedRatio * 0.2) : 0,
      0,
      1
    ).toFixed(2);
    this.renderer.domElement.dataset.rearRainLightGlow = clamp(
      telemetry.phase === "racing" ? telemetry.roadWetness * (0.36 + telemetry.rainIntensity * 0.42 + speedRatio * 0.22) : 0,
      0,
      1
    ).toFixed(2);
    this.renderer.domElement.dataset.ersDeployGlow = clamp(
      telemetry.phase === "racing" && telemetry.speedKph > 130 && telemetry.ers < 0.92 && telemetry.car.throttle > 0.35 ? 1 : 0,
      0,
      1
    ).toFixed(2);
    this.renderer.domElement.dataset.rearAeroFlap = telemetry.aeroBoostActive.toFixed(2);

    const carWorldYaw = trackYaw - telemetry.car.heading;
    const airBuffet = clamp(telemetry.dirtyAir * 0.48 + telemetry.draft * 0.18 + telemetry.contactRisk * 0.22, 0, 1);
    this.updateSpeedStreaks(carX, carY, carZ, carWorldYaw, speedRatio, telemetry.car.slip, telemetry.car.braking, telemetry.draft, telemetry.dirtyAir);
    this.updateAirWake(carX, carY, carZ, carWorldYaw, telemetry.draft, telemetry.dirtyAir, speedRatio);
    this.updateTireSmoke(carX, carY, carZ, carWorldYaw, speedRatio, telemetry.car.slip, telemetry.car.wheelspin, telemetry.car.lockup);
    this.updateBrakePressureTrail(carX, carY, carZ, carWorldYaw, speedRatio, telemetry.car.braking, telemetry.car.lockup);
    this.updateProximityMarkers(carX, carY, carZ, carWorldYaw, telemetry.sideBySide, telemetry.contactRisk);
    this.updateRacingLineAssist(telemetry);
    this.updateCheckpointBeacon(telemetry);
    const podMode = this.cameraMode === "pod";
    this.car.visible = !podMode || telemetry.phase === "ready";
    this.renderer.domElement.dataset.externalCarVisible = String(this.car.visible);
    this.updateCockpitFrame(telemetry, podMode);
    this.camera.fov = podMode ? 47 + speedRatio * 4 + telemetry.car.braking * 1.4 : 42 + speedRatio * 6 + telemetry.car.braking * 1.6;

    const lookAhead = podMode ? 24 + speedRatio * 32 : 10 + speedRatio * 18;
    const cameraLag = podMode ? 1.18 + speedRatio * 0.52 - telemetry.car.braking * 0.16 : 6.6 + speedRatio * 3.6 + telemetry.car.throttle * 0.4 - telemetry.car.braking * 1.2;
    const lateralShoulder = podMode ? carLateral * 0.045 - telemetry.car.yawRate * 0.08 : carLateral * (0.18 + speedRatio * 0.06) - telemetry.car.yawRate * 0.62;
    const targetLateral = podMode ? carLateral * 0.08 + telemetry.car.yawRate * 0.34 - telemetry.curve * 0.4 : carLateral * 0.24 + telemetry.car.yawRate * 1.4 - telemetry.curve * 0.85;
    const cameraPoint = {
      x: carX - trackTangent.x * cameraLag + trackNormal.x * lateralShoulder,
      z: carZ - trackTangent.z * cameraLag + trackNormal.z * lateralShoulder
    };
    const targetPoint = {
      x: carX + trackTangent.x * lookAhead + trackNormal.x * targetLateral,
      z: carZ + trackTangent.z * lookAhead + trackNormal.z * targetLateral
    };
    if (telemetry.phase === "ready") {
      const gridLateral = -4.2;
      this.desiredCameraPosition.set(
        carX - trackTangent.x * 54 + trackNormal.x * gridLateral,
        carY + 7.2,
        carZ - trackTangent.z * 54 + trackNormal.z * gridLateral
      );
      this.desiredCameraTarget.set(carX + trackTangent.x * 82, carY + 0.9, carZ + trackTangent.z * 82);
      this.cameraPosition.copy(this.desiredCameraPosition);
      this.cameraTarget.copy(this.desiredCameraTarget);
    } else {
      this.desiredCameraPosition.set(
        cameraPoint.x,
        carY +
          (podMode ? 1.34 : 2.74) -
          telemetry.car.braking * (podMode ? 0.06 : 0.18) +
          telemetry.car.slip * (podMode ? 0.08 : 0.18) +
          speedRatio * (podMode ? 0.12 : 0.16) +
          telemetry.surfaceRumble * 0.08 +
          Math.sin(performance.now() * 0.02) * airBuffet * (podMode ? 0.04 : 0.08),
        cameraPoint.z
      );
      this.desiredCameraTarget.set(
        targetPoint.x + Math.sin(performance.now() * 0.025) * airBuffet * (podMode ? 0.06 : 0.14),
        carY + (podMode ? 0.82 : 0.68) + telemetry.car.slip * 0.18 + Math.cos(performance.now() * 0.018) * airBuffet * 0.05,
        targetPoint.z
      );
      if (telemetry.cameraSnap || this.cameraModeSnap) {
        this.cameraPosition.copy(this.desiredCameraPosition);
        this.cameraTarget.copy(this.desiredCameraTarget);
        this.cameraModeSnap = false;
      } else {
        const positionFollow = (podMode ? 0.24 : 0.2) + speedRatio * (podMode ? 0.08 : 0.08) + telemetry.car.braking * 0.02;
        const targetFollow = (podMode ? 0.28 : 0.22) + speedRatio * (podMode ? 0.08 : 0.07);
        this.cameraPosition.lerp(this.desiredCameraPosition, positionFollow);
        this.cameraTarget.lerp(this.desiredCameraTarget, targetFollow);
      }
    }
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
    this.updateRainStreaks(carX, carY, carZ, telemetry.rainIntensity, speedRatio);
    this.updateLensRain(telemetry.rainIntensity, telemetry.roadWetness, speedRatio);
    this.updateWaterSpray(carX, carY, carZ, carWorldYaw, telemetry.roadWetness, speedRatio, telemetry.car.slip);
    this.carScreenPosition.copy(this.car.position).project(this.camera);
    this.renderer.domElement.dataset.cameraWorldX = this.camera.position.x.toFixed(2);
    this.renderer.domElement.dataset.cameraWorldY = this.camera.position.y.toFixed(2);
    this.renderer.domElement.dataset.cameraWorldZ = this.camera.position.z.toFixed(2);
    this.renderer.domElement.dataset.cameraMode = this.cameraMode;
    this.renderer.domElement.dataset.cameraBuffet = airBuffet.toFixed(2);
    this.renderer.domElement.dataset.carScreenX = this.carScreenPosition.x.toFixed(3);
    this.renderer.domElement.dataset.carScreenY = this.carScreenPosition.y.toFixed(3);
    this.renderer.domElement.dataset.carScreenZ = this.carScreenPosition.z.toFixed(3);
    this.horizon.position.x = this.camera.position.x;
    this.horizon.position.z = this.camera.position.z;
    this.horizon.rotation.y = this.camera.rotation.y;

    let visibleWetRivalSprays = 0;
    let strongestWetRivalSpray = 0;
    for (const rival of telemetry.rivals) {
      const existing = this.rivals.get(rival.id);
      const gapMeters = rival.z - telemetry.car.z;
      const rivalLateral = rival.x - sampleTrack(rival.z).center;
      const cameraOccludedByTrailingCar = gapMeters < -6 && Math.abs(rivalLateral - carLateral) < 5.5;
      if (gapMeters < -45 || gapMeters > 280 || cameraOccludedByTrailingCar) {
        if (existing) existing.visible = false;
        this.hideRivalSpray(rival.id);
        this.hideRivalLabel(rival.id);
        continue;
      }

      const mesh = existing ?? this.addRival(rival.id, rival.color);
      const rivalPoint = trackWorldPointAt(rival.z, rivalLateral);
      const rivalWorldYaw = trackWorldHeadingAt(rival.z) - rival.heading;
      mesh.visible = true;
      mesh.position.set(rivalPoint.x, rival.y, rivalPoint.z);
      mesh.rotation.y = rivalWorldYaw;
      mesh.rotation.z = -rival.bank * 0.12;
      this.animateFormulaCar(mesh, {
        distance: rival.z,
        speedKph: rival.speedKph,
        steering: rival.heading * -0.7,
        braking: 0,
        throttle: 0.72,
        wheelspin: 0,
        rainLight: telemetry.phase === "racing" ? telemetry.roadWetness * (0.42 + telemetry.rainIntensity * 0.34) : 0,
        ersDeploy: 0,
        aeroOpen: 0
      });
      const sprayStrength = this.updateRivalSpray(
        rival.id,
        rivalPoint.x,
        rival.y,
        rivalPoint.z,
        rivalWorldYaw,
        telemetry.roadWetness,
        rival.speedKph,
        telemetry.phase === "racing"
      );
      if (sprayStrength > 0.03) {
        visibleWetRivalSprays += 1;
        strongestWetRivalSpray = Math.max(strongestWetRivalSpray, sprayStrength);
      }
      this.updateRivalLabel(rival.id, rival.driver, rival.team, rival.gap, rivalPoint.x, rival.y, rivalPoint.z, gapMeters);
    }
    let visibleRivalLabels = 0;
    let rivalLabelSample = "";
    for (const label of this.rivalLabels.values()) {
      if (!label.visible) continue;
      visibleRivalLabels += 1;
      if (!rivalLabelSample) rivalLabelSample = String(label.userData.labelText ?? "");
    }
    this.renderer.domElement.dataset.wetRivalSprays = String(visibleWetRivalSprays);
    this.renderer.domElement.dataset.wetRivalSprayStrength = strongestWetRivalSpray.toFixed(2);
    this.renderer.domElement.dataset.rivalLabelsVisible = String(visibleRivalLabels);
    this.renderer.domElement.dataset.rivalLabelSample = rivalLabelSample;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    disposeObject3D(this.scene);
    this.rivals.clear();
    this.rivalSprays.clear();
    this.rivalLabels.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addRival(id: number, color: string) {
    const mesh = buildFormulaCarProxy(color);
    mesh.name = `rival-${id}`;
    this.rivals.set(id, mesh);
    this.scene.add(mesh);
    return mesh;
  }

  private addRivalSpray(id: number) {
    const group = new THREE.Group();
    group.name = `rival-${id}-wet-spray`;
    const texture = makeSoftMistTexture();
    const material = new THREE.MeshBasicMaterial({
      color: "#dce5e2",
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 8; index += 1) {
      const width = 0.42 + index * 0.1;
      const length = 0.72 + index * 0.15;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
      mesh.name = "rival-water-spray-plume";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(index % 2 === 0 ? -0.72 : 0.72, 0.06, 0.98 + index * 0.42);
      group.add(mesh);
    }

    group.userData.material = material;
    group.userData.texture = texture;
    this.rivalSprays.set(id, group);
    this.scene.add(group);
    return group;
  }

  private hideRivalSpray(id: number) {
    const spray = this.rivalSprays.get(id);
    if (spray) spray.visible = false;
  }

  private addRivalLabel(id: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 96;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.28), material);
    label.name = `rival-${id}-label`;
    label.renderOrder = 8;
    label.userData.canvas = canvas;
    label.userData.texture = texture;
    label.userData.labelText = "";
    this.rivalLabels.set(id, label);
    this.scene.add(label);
    return label;
  }

  private updateRivalLabel(
    id: number,
    driver: string,
    team: string,
    gap: number,
    carX: number,
    carY: number,
    carZ: number,
    gapMeters: number
  ) {
    const label = this.rivalLabels.get(id) ?? this.addRivalLabel(id);
    const gapText = gap >= 0 ? `+${gap.toFixed(1)}` : gap.toFixed(1);
    const text = `${driver.toUpperCase()}  ${team}  ${gapText}`;
    if (label.userData.labelText !== text) {
      this.drawRivalLabel(label, text);
    }

    const distanceFade = clamp(1 - Math.abs(gapMeters) / 280, 0.16, 1);
    label.visible = true;
    label.position.set(carX, carY + 2.95 + distanceFade * 0.55, carZ);
    label.lookAt(this.camera.position);
    label.scale.setScalar(0.96 + distanceFade * 0.54);
    label.material.opacity = 0.52 + distanceFade * 0.42;
  }

  private drawRivalLabel(label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, text: string) {
    const canvas = label.userData.canvas as HTMLCanvasElement | undefined;
    const texture = label.userData.texture as THREE.CanvasTexture | undefined;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !texture || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(10, 18, 22, 0.72)";
    ctx.strokeStyle = "rgba(210, 245, 236, 0.56)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(12, 18, 360, 56, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(87, 235, 255, 0.94)";
    ctx.fillRect(28, 30, 5, 32);
    ctx.fillStyle = "#f5fff8";
    ctx.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 48, 47, 300);

    label.userData.labelText = text;
    texture.needsUpdate = true;
  }

  private hideRivalLabel(id: number) {
    const label = this.rivalLabels.get(id);
    if (label) label.visible = false;
  }

  private buildCheckpointBeacon() {
    const group = new THREE.Group();
    group.name = "next-checkpoint-beacon";
    group.visible = false;

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#72f7ff",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    const spokeMaterial = new THREE.MeshBasicMaterial({
      color: "#fff1a8",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    const labelMaterial = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.055, 8, 48), ringMaterial);
    outerRing.name = "checkpoint-beacon-outer-ring";
    outerRing.renderOrder = 6;
    group.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 8, 36), ringMaterial);
    innerRing.name = "checkpoint-beacon-inner-ring";
    innerRing.renderOrder = 6;
    group.add(innerRing);

    for (const x of [-5.6, 5.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.2, 8), ringMaterial);
      post.name = "checkpoint-beacon-post";
      post.position.set(x, -0.72, 0);
      post.renderOrder = 6;
      group.add(post);
    }

    const overhead = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 11.2, 8), spokeMaterial);
    overhead.name = "checkpoint-beacon-overhead";
    overhead.position.y = 2.85;
    overhead.rotation.z = Math.PI / 2;
    overhead.renderOrder = 7;
    group.add(overhead);

    for (let index = 0; index < 4; index += 1) {
      const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.25), spokeMaterial);
      spoke.name = "checkpoint-beacon-spoke";
      spoke.position.y = index < 2 ? 3.65 : -3.65;
      spoke.position.x = index % 2 === 0 ? -1.1 : 1.1;
      spoke.renderOrder = 7;
      group.add(spoke);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 112;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelMaterial.map = texture;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.8), labelMaterial);
    label.name = "checkpoint-beacon-label";
    label.position.y = 5.65;
    label.renderOrder = 8;
    group.add(label);

    group.userData.ringMaterial = ringMaterial;
    group.userData.spokeMaterial = spokeMaterial;
    group.userData.labelMaterial = labelMaterial;
    group.userData.labelCanvas = canvas;
    group.userData.labelTexture = texture;
    group.userData.labelText = "";
    return group;
  }

  private updateCheckpointBeacon(telemetry: RaceTelemetry) {
    const rawAhead = telemetry.nextCheckpointDistance - (telemetry.car.z % TRACK_LOOP_LENGTH);
    const ahead = (rawAhead + TRACK_LOOP_LENGTH) % TRACK_LOOP_LENGTH;
    const active = telemetry.phase === "countdown" || telemetry.phase === "racing";
    const label = `${telemetry.checkpointProgress} ${telemetry.nextCheckpoint}`;
    this.renderer.domElement.dataset.nextCheckpointBeacon = active ? "active" : "idle";
    this.renderer.domElement.dataset.nextCheckpointBeaconDistance = ahead.toFixed(1);
    this.renderer.domElement.dataset.nextCheckpointBeaconLabel = label;

    if (!active || !Number.isFinite(telemetry.nextCheckpointDistance)) {
      this.checkpointBeacon.visible = false;
      this.renderer.domElement.dataset.nextCheckpointBeaconVisible = "false";
      return;
    }

    const track = sampleTrack(telemetry.nextCheckpointDistance);
    const point = trackWorldPointAt(telemetry.nextCheckpointDistance, 0);
    const heading = trackWorldHeadingAt(telemetry.nextCheckpointDistance);
    const pulse = 0.5 + Math.sin(performance.now() * 0.006 + telemetry.nextCheckpointIndex * 0.9) * 0.5;
    const distanceFade = clamp(1 - ahead / 760, 0.36, 1);
    const opacity = (0.56 + pulse * 0.28) * distanceFade;
    const spokeOpacity = (0.72 + pulse * 0.24) * distanceFade;
    const scale = 1.18 + pulse * 0.12 + clamp(1 - ahead / 220, 0, 1) * 0.22;

    this.checkpointBeacon.visible = ahead > 6 && ahead < TRACK_LOOP_LENGTH - 4;
    this.renderer.domElement.dataset.nextCheckpointBeaconVisible = String(this.checkpointBeacon.visible);
    this.checkpointBeacon.position.set(point.x, track.elevation + 4.4, point.z);
    this.checkpointBeacon.rotation.y = heading;
    this.checkpointBeacon.scale.setScalar(scale);
    const beaconScreen = this.checkpointBeacon.position.clone().project(this.camera);
    this.renderer.domElement.dataset.nextCheckpointBeaconScreenX = beaconScreen.x.toFixed(3);
    this.renderer.domElement.dataset.nextCheckpointBeaconScreenY = beaconScreen.y.toFixed(3);
    this.renderer.domElement.dataset.nextCheckpointBeaconScreenZ = beaconScreen.z.toFixed(3);

    const ringMaterial = this.checkpointBeacon.userData.ringMaterial as THREE.MeshBasicMaterial | undefined;
    const spokeMaterial = this.checkpointBeacon.userData.spokeMaterial as THREE.MeshBasicMaterial | undefined;
    const labelMaterial = this.checkpointBeacon.userData.labelMaterial as THREE.MeshBasicMaterial | undefined;
    if (ringMaterial) ringMaterial.opacity = opacity;
    if (spokeMaterial) spokeMaterial.opacity = spokeOpacity;
    if (labelMaterial) labelMaterial.opacity = 0.68 * distanceFade;

    if (this.checkpointBeacon.userData.labelText !== label) {
      this.drawCheckpointBeaconLabel(label);
    }
  }

  private drawCheckpointBeaconLabel(text: string) {
    const canvas = this.checkpointBeacon.userData.labelCanvas as HTMLCanvasElement | undefined;
    const texture = this.checkpointBeacon.userData.labelTexture as THREE.CanvasTexture | undefined;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !texture || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(8, 16, 18, 0.58)";
    ctx.strokeStyle = "rgba(114, 247, 255, 0.74)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(18, 26, 348, 58, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 241, 168, 0.95)";
    ctx.fillRect(38, 42, 36, 10);
    ctx.fillStyle = "#effffd";
    ctx.font = "800 26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), 88, 55, 250);

    this.checkpointBeacon.userData.labelText = text;
    texture.needsUpdate = true;
  }

  private buildCockpitFrame() {
    const group = new THREE.Group();
    group.name = "pod-camera-cockpit-frame";
    group.visible = false;
    group.position.set(0, -0.42, -1.38);

    const carbonMaterial = new THREE.MeshBasicMaterial({
      color: "#10171a",
      transparent: true,
      opacity: 0.88,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    const trimMaterial = new THREE.MeshBasicMaterial({
      color: "#d81842",
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: "#111b1f",
      transparent: true,
      opacity: 0.58,
      depthTest: false,
      depthWrite: false,
      fog: false
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: "#ff254d",
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 1.15), carbonMaterial);
    nose.name = "cockpit-nose";
    nose.position.set(0, -0.38, -0.36);
    nose.rotation.x = -0.1;
    group.add(nose);

    const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 1.08), trimMaterial);
    noseStripe.name = "cockpit-nose-stripe";
    noseStripe.position.set(0, -0.303, -0.37);
    noseStripe.rotation.x = -0.1;
    group.add(noseStripe);

    const wheel = new THREE.Group();
    wheel.name = "cockpit-steering-wheel";
    wheel.position.set(0, -0.3, -0.72);
    wheel.rotation.x = -0.18;
    const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 8, 32), carbonMaterial);
    wheelRing.name = "cockpit-wheel-ring";
    wheel.add(wheelRing);
    const wheelBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.032, 0.025), carbonMaterial);
    wheelBar.name = "cockpit-wheel-bar";
    wheel.add(wheelBar);
    const wheelDisplay = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.075), glowMaterial);
    wheelDisplay.name = "cockpit-wheel-display";
    wheelDisplay.position.z = 0.018;
    wheel.add(wheelDisplay);
    group.add(wheel);

    const haloStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.017, 0.58, 10), haloMaterial);
    haloStem.name = "cockpit-halo-stem";
    haloStem.position.set(0, 0.24, -0.78);
    haloStem.rotation.x = 0.08;
    group.add(haloStem);

    for (const side of [-1, 1]) {
      const haloArm = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.017, 0.86, 10), haloMaterial);
      haloArm.name = "cockpit-halo-arm";
      haloArm.position.set(side * 0.4, 0.12, -0.7);
      haloArm.rotation.z = side * 0.68;
      haloArm.rotation.x = -0.25;
      group.add(haloArm);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.03), trimMaterial);
      mirror.name = "cockpit-mirror";
      mirror.position.set(side * 0.58, -0.08, -0.72);
      mirror.rotation.y = side * 0.22;
      group.add(mirror);
    }

    const brakeFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.06), glowMaterial);
    brakeFlash.name = "cockpit-brake-flash";
    brakeFlash.position.set(0, -0.23, -0.49);
    group.add(brakeFlash);

    group.userData.parts = 10;
    group.userData.wheel = wheel;
    group.userData.glowMaterial = glowMaterial;
    group.userData.carbonMaterial = carbonMaterial;
    group.userData.trimMaterial = trimMaterial;
    group.userData.haloMaterial = haloMaterial;
    return group;
  }

  private updateCockpitFrame(telemetry: RaceTelemetry, podMode: boolean) {
    const speedRatio = clamp(telemetry.speedKph / 310, 0, 1);
    const visible = podMode && telemetry.phase !== "ready";
    this.cockpitFrame.visible = visible;
    this.renderer.domElement.dataset.cockpitFrame = visible ? "visible" : "hidden";
    this.renderer.domElement.dataset.cockpitFrameParts = String(this.cockpitFrame.userData.parts ?? 0);

    const wheel = this.cockpitFrame.userData.wheel as THREE.Group | undefined;
    const steerAngle = clamp(telemetry.car.yawRate * 0.95 - telemetry.car.heading * 0.28, -0.62, 0.62);
    if (wheel) wheel.rotation.z = -steerAngle;

    const brakeGlow = clamp(telemetry.car.braking + telemetry.car.lockup * 0.7, 0, 1);
    const glowMaterial = this.cockpitFrame.userData.glowMaterial as THREE.MeshBasicMaterial | undefined;
    if (glowMaterial) {
      glowMaterial.opacity = visible ? 0.16 + brakeGlow * 0.36 + telemetry.ers * 0.04 : 0;
      glowMaterial.color.set(brakeGlow > 0.25 ? "#ff3156" : "#69f7ff");
    }

    this.cockpitFrame.position.y = -0.42 - speedRatio * 0.025 + telemetry.car.braking * 0.018 + Math.sin(performance.now() * 0.018) * speedRatio * 0.004;
    this.cockpitFrame.position.x = clamp(telemetry.carX / 44, -0.06, 0.06) + telemetry.car.yawRate * 0.015;
    this.cockpitFrame.rotation.z = clamp(-telemetry.car.yawRate * 0.018 + telemetry.car.bank * 0.025, -0.035, 0.035);

    this.renderer.domElement.dataset.cockpitWheelAngle = steerAngle.toFixed(3);
    this.renderer.domElement.dataset.cockpitBrakeGlow = brakeGlow.toFixed(2);
  }

  private animateFormulaCar(
    root: ReturnType<typeof buildFormulaCarProxy>,
    state: {
      distance: number;
      speedKph: number;
      steering: number;
      braking: number;
      throttle: number;
      wheelspin: number;
      rainLight: number;
      ersDeploy: number;
      aeroOpen: number;
    }
  ) {
    const spin = -state.distance * 3.2 - state.wheelspin * 1.4;
    const steerAngle = clamp(state.steering, -0.42, 0.42);
    const brakeGlow = clamp(state.braking * clamp(state.speedKph / 180, 0, 1), 0, 1);
    const wheelBlur = clamp((state.speedKph - 72) / 165 + state.wheelspin * 0.3, 0, 1);
    const rainLight = clamp(state.rainLight, 0, 1);
    const rainPulse = rainLight * (0.72 + Math.sin(performance.now() * 0.011 + state.distance * 0.025) * 0.28);
    const ersDeploy = clamp(state.ersDeploy, 0, 1);
    const ersPulse = ersDeploy * (0.72 + Math.sin(performance.now() * 0.018 + state.distance * 0.032) * 0.28);
    const aeroOpen = clamp(state.aeroOpen, 0, 1);
    const rearFlap = root.getObjectByName("rear-wing-upper-plane");

    for (const wheelName of ["front-left-wheel", "front-right-wheel", "rear-left-wheel", "rear-right-wheel"]) {
      const wheel = root.getObjectByName(wheelName);
      if (!wheel) continue;

      wheel.rotation.x = spin;
      wheel.rotation.y = wheelName.startsWith("front") ? steerAngle : 0;
    }

    if (rearFlap) {
      rearFlap.rotation.x = -0.12 - state.throttle * 0.05 + state.braking * 0.13 + aeroOpen * 0.24;
    }

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      if (object.name.endsWith("brake-glow")) {
        object.visible = brakeGlow > 0.02;
        const material = object.material;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.opacity = 0.22 + brakeGlow * 0.52;
          material.emissiveIntensity = brakeGlow * 2.4;
        }
      }

      if (object.name.endsWith("wheel-blur")) {
        object.visible = wheelBlur > 0.02;
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.opacity = wheelBlur * 0.42;
        }
      }

      if (object.name === "rear-rain-light") {
        object.visible = rainLight > 0.04;
        const material = object.material;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissiveIntensity = 0.7 + rainPulse * 3.6;
        }
      }

      if (object.name === "rear-rain-light-glow") {
        object.visible = rainLight > 0.04;
        object.scale.setScalar(0.68 + rainPulse * 0.74);
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.opacity = rainPulse * 0.48;
        }
      }

      if (object.name === "ers-deploy-glow") {
        object.visible = ersDeploy > 0.03;
        object.scale.set(0.9 + ersPulse * 0.58, 0.76 + ersPulse * 0.36, 1);
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.opacity = ersPulse * 0.42;
        }
      }

      if (object.name.startsWith("ers-flow-")) {
        object.visible = ersDeploy > 0.03;
        const material = object.material;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.opacity = ersPulse * 0.64;
        }
      }
    });
  }

  private async loadRaceAssets() {
    try {
      await this.addTracksideAssets();
      this.renderer.domElement.dataset.tracksideAssets = "kenney";
    } catch {
      this.renderer.domElement.dataset.tracksideAssets = "procedural-only";
    }
  }

  private async addTracksideAssets() {
    const lights = await Promise.all([this.assets.createLightPost(), this.assets.createLightPost(), this.assets.createLightPost(), this.assets.createLightPost()]);
    const grandstands = await Promise.all([
      this.assets.createGrandstand(),
      this.assets.createGrandstand(),
      this.assets.createGrandstand(),
      this.assets.createGrandstand()
    ]);
    const lightPlacements = [
      { distance: 210, lateral: 18 },
      { distance: 760, lateral: -18 },
      { distance: 1160, lateral: 18 },
      { distance: 1470, lateral: -18 }
    ];
    const grandstandPlacements = [
      { distance: 128, lateral: -42 },
      { distance: 338, lateral: 40 },
      { distance: 870, lateral: -42 },
      { distance: 1390, lateral: 40 }
    ];

    lights.forEach((light, index) => {
      const placement = lightPlacements[index];
      light.userData.tracksidePlacement = { ...placement, rotation: placement.lateral > 0 ? -0.4 : 0.4 };
      this.tracksideAssets.add(light);
    });

    grandstands.forEach((stand, index) => {
      const placement = grandstandPlacements[index];
      stand.userData.tracksidePlacement = { ...placement, rotation: placement.lateral > 0 ? -Math.PI * 0.5 : Math.PI * 0.5 };
      this.tracksideAssets.add(stand);
    });

    this.positionLoadedTracksideAssets();
    this.renderer.domElement.dataset.tracksideLightPosts = String(lights.length);
    this.renderer.domElement.dataset.tracksideGrandstands = String(grandstands.length);
  }

  private positionLoadedTracksideAssets() {
    for (const object of this.tracksideAssets.children) {
      const placement = object.userData.tracksidePlacement as { distance: number; lateral: number; rotation: number } | undefined;
      if (!placement) continue;

      const track = sampleTrack(placement.distance);
      const point = trackWorldPointAt(placement.distance, placement.lateral);
      object.position.set(point.x, track.elevation, point.z);
      object.rotation.y = trackWorldHeadingAt(placement.distance) + placement.rotation;
    }
  }

  private syncHorizonTelemetry() {
    this.renderer.domElement.dataset.horizonRenderPolicy = String(this.horizon.userData.renderPolicy ?? "");
    const sky = this.horizon.getObjectByName("background-sky-plane");
    const skyMesh = sky instanceof THREE.Mesh ? sky : null;
    const material = skyMesh?.material instanceof THREE.MeshBasicMaterial ? skyMesh.material : null;
    this.renderer.domElement.dataset.horizonSkyDepthWrite = material ? String(material.depthWrite) : "";
    this.renderer.domElement.dataset.horizonSkyRenderOrder = skyMesh ? String(skyMesh.renderOrder) : "";
  }

  private syncCircuitDressingTelemetry() {
    const stats = this.circuit.userData.dressingStats as
      | {
          dynamicPieces: number;
          catchFences: number;
          pitWallModules: number;
          marshalPosts: number;
          checkpointGates: number;
          venueHero: string;
        }
      | undefined;
    const surfaceStats = this.circuit.userData.surfaceStats as
      | {
          terrainBands: number;
          racingGroove: string;
          wetSheen: string;
          edgeLines: string[];
          flowCues: number;
          gridSlots: number;
          puddles: number;
        }
      | undefined;

    if (stats) {
      this.renderer.domElement.dataset.circuitDressingPieces = String(stats.dynamicPieces);
      this.renderer.domElement.dataset.circuitCatchFences = String(stats.catchFences);
      this.renderer.domElement.dataset.circuitPitWallModules = String(stats.pitWallModules);
      this.renderer.domElement.dataset.circuitMarshalPosts = String(stats.marshalPosts);
      this.renderer.domElement.dataset.circuitCheckpointGates = String(stats.checkpointGates);
      this.renderer.domElement.dataset.circuitVenueHero = stats.venueHero;
    }

    if (surfaceStats) {
      this.renderer.domElement.dataset.surfaceTerrainBands = String(surfaceStats.terrainBands);
      this.renderer.domElement.dataset.surfaceRacingGroove = surfaceStats.racingGroove;
      this.renderer.domElement.dataset.surfaceWetSheen = surfaceStats.wetSheen;
      this.renderer.domElement.dataset.surfaceEdgeLines = surfaceStats.edgeLines.join(",");
      this.renderer.domElement.dataset.surfaceFlowCues = String(surfaceStats.flowCues);
      this.renderer.domElement.dataset.surfaceGridSlots = String(surfaceStats.gridSlots);
      this.renderer.domElement.dataset.surfacePuddles = String(surfaceStats.puddles);
    }
  }

  private applyAtmosphere(telemetry: RaceTelemetry) {
    const horizonMaterials = this.horizon.userData.materials as
      | { sky: THREE.MeshBasicMaterial; treeline: THREE.MeshBasicMaterial; relief?: THREE.MeshBasicMaterial }
      | undefined;
    const weatherMaterials = this.circuit.userData.weatherMaterials as
      | {
          asphalt: THREE.MeshStandardMaterial;
          grass: THREE.MeshBasicMaterial;
          runoff: THREE.MeshBasicMaterial;
          racingLine: THREE.MeshBasicMaterial;
          fence: THREE.MeshBasicMaterial;
          glass: THREE.MeshStandardMaterial;
          groove: THREE.MeshBasicMaterial;
          wetSheen: THREE.MeshBasicMaterial;
          puddle: THREE.MeshBasicMaterial;
          gridPaint: THREE.MeshBasicMaterial;
          edgePaint: THREE.MeshBasicMaterial;
          flowPaint: THREE.MeshBasicMaterial;
        }
      | undefined;
    this.renderer.setClearColor(telemetry.skyColor);
    this.scene.fog = new THREE.Fog(telemetry.fogColor, 150 - telemetry.roadWetness * 35, 880 - telemetry.rainIntensity * 250);
    this.hemi.color.set(telemetry.skyColor);
    this.hemi.groundColor.set(telemetry.grassColor);
    this.hemi.intensity = 1.25 + telemetry.lightIntensity * 0.18;
    this.sun.intensity = telemetry.lightIntensity;
    horizonMaterials?.sky.color.set(telemetry.skyColor);
    horizonMaterials?.treeline.color.set(telemetry.grassColor);
    if (horizonMaterials?.relief) {
      horizonMaterials.relief.opacity = telemetry.roadWetness > 0.7 ? 0.22 : 0.34;
    }

    if (weatherMaterials) {
      weatherMaterials.asphalt.color.set(telemetry.roadWetness > 0.4 ? "#d7e2df" : "#d6dedc");
      weatherMaterials.asphalt.emissive.set(telemetry.roadWetness > 0.7 ? "#303b3d" : "#222b2c");
      weatherMaterials.asphalt.emissiveIntensity = telemetry.roadWetness > 0.7 ? 0.34 : 0.12;
      weatherMaterials.asphalt.roughness = 0.86 - telemetry.roadWetness * 0.46;
      weatherMaterials.asphalt.metalness = 0.02 + telemetry.roadWetness * 0.16;
      weatherMaterials.grass.color.set(telemetry.roadWetness > 0.7 ? "#5c7065" : telemetry.grassColor);
      weatherMaterials.runoff.color.set(telemetry.roadWetness > 0.4 ? "#8a978f" : getActiveTrackLayout().runoffColor);
      weatherMaterials.racingLine.opacity = 0.08 + telemetry.roadWetness * 0.02;
      weatherMaterials.fence.opacity = 0.2 + telemetry.rainIntensity * 0.12;
      weatherMaterials.glass.color.set(telemetry.roadWetness > 0.4 ? "#7f9ca4" : "#8fa5aa");
      weatherMaterials.glass.opacity = 0.62 + telemetry.roadWetness * 0.16;
      weatherMaterials.groove.opacity = 0.14 + telemetry.roadWetness * 0.05;
      weatherMaterials.wetSheen.opacity = telemetry.roadWetness * (0.12 + telemetry.rainIntensity * 0.1);
      weatherMaterials.puddle.opacity = telemetry.roadWetness * 0.28;
      weatherMaterials.gridPaint.opacity = 0.82 - telemetry.roadWetness * 0.16;
      weatherMaterials.edgePaint.opacity = 0.52 + telemetry.roadWetness * 0.18;
      weatherMaterials.flowPaint.opacity = 0.28 + telemetry.roadWetness * 0.12;
      this.renderer.domElement.dataset.surfaceWetSheenOpacity = weatherMaterials.wetSheen.opacity.toFixed(2);
      this.renderer.domElement.dataset.surfacePuddleOpacity = weatherMaterials.puddle.opacity.toFixed(2);
    }
  }

  private buildHorizon() {
    const horizon = new THREE.Group();
    const layout = getActiveTrackLayout();
    horizon.name = `${layout.id}-venue-horizon`;

    const skyMaterial = new THREE.MeshBasicMaterial({
      color: "#bfd4dc",
      fog: false,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const treelineMaterial = new THREE.MeshBasicMaterial({
      color: layout.treeColor,
      fog: false,
      transparent: true,
      opacity: layout.id === "northstar" ? 0.12 : 0.48,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const reliefMaterial = new THREE.MeshBasicMaterial({
      color: layout.id === "mirage" ? "#8ea1a6" : layout.id === "northstar" ? "#8da19a" : "#839874",
      fog: false,
      transparent: true,
      opacity: layout.id === "northstar" ? 0.28 : 0.42,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2200, 540), skyMaterial);
    sky.name = "background-sky-plane";
    sky.renderOrder = -1000;
    sky.position.set(0, 250, -760);
    horizon.add(sky);

    const treeline = new THREE.Mesh(new THREE.PlaneGeometry(2200, layout.id === "northstar" ? 10 : 54), treelineMaterial);
    treeline.position.set(0, layout.id === "northstar" ? 3 : 22, layout.id === "northstar" ? -930 : -780);
    if (layout.id !== "northstar") {
      horizon.add(treeline);
    }

    if (layout.id !== "northstar") {
      this.addVenueSilhouette(horizon, layout.id, reliefMaterial);
    }
    horizon.userData.materials = { sky: skyMaterial, treeline: treelineMaterial, relief: reliefMaterial };
    horizon.userData.renderPolicy = "background-depth-safe";

    return horizon;
  }

  private addVenueSilhouette(horizon: THREE.Group, layoutId: string, material: THREE.Material) {
    if (layoutId === "mirage") {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(2200, 26), material);
      sea.name = "mirage-bay-sea-line";
      sea.position.set(0, 18, -746);
      horizon.add(sea);

      for (let index = 0; index < 18; index += 1) {
        const width = 18 + (index % 5) * 7;
        const height = 24 + ((index * 13) % 42);
        const tower = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        tower.name = "mirage-bay-skyline";
        tower.position.set(-420 + index * 52, 28 + height * 0.5, -744);
        horizon.add(tower);
      }
      return;
    }

    const peaks = layoutId === "northstar" ? 12 : 10;
    const baseY = layoutId === "northstar" ? 8 : 15;
    const spacing = layoutId === "northstar" ? 116 : 96;
    const heightBase = layoutId === "northstar" ? 10 : 24;

    for (let index = 0; index < peaks; index += 1) {
      const width = spacing * (1.25 + (index % 3) * 0.18);
      const height = heightBase + ((index * 19) % (layoutId === "northstar" ? 8 : 18));
      const shape = new THREE.Shape();
      shape.moveTo(-width * 0.5, 0);
      shape.lineTo(-width * 0.12, height * 0.72);
      shape.lineTo(width * 0.08, height);
      shape.lineTo(width * 0.5, 0);
      shape.lineTo(-width * 0.5, 0);
      const peak = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
      peak.name = layoutId === "northstar" ? "northstar-alpine-ridge" : "aurelia-foothill-ridge";
      peak.position.set(-520 + index * spacing, baseY, -746);
      horizon.add(peak);
    }
  }

  private buildSpeedStreaks() {
    const group = new THREE.Group();
    group.name = "peripheral-speed-streaks";

    const material = new THREE.MeshBasicMaterial({
      color: "#f6fff1",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    });

    for (let index = 0; index < 18; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 8 + (index % 4) * 2.2), material);
      mesh.name = "speed-streak";
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = (index % 3 - 1) * 0.1;
      mesh.position.set(index % 2 === 0 ? -7.6 - (index % 5) * 0.9 : 7.6 + (index % 5) * 0.9, 0.09, -6 - index * 7.5);
      group.add(mesh);
    }

    group.userData.material = material;
    return group;
  }

  private updateSpeedStreaks(
    carX: number,
    carY: number,
    carZ: number,
    worldYaw: number,
    speedRatio: number,
    slip: number,
    braking: number,
    draft: number,
    dirtyAir: number
  ) {
    const material = this.speedStreaks.userData.material as THREE.MeshBasicMaterial | undefined;
    if (material) {
      material.opacity = Math.max(0, speedRatio - 0.46) * 0.34 + slip * 0.08 + braking * 0.04 + draft * 0.16 + dirtyAir * 0.08;
      material.color.set(dirtyAir > 0.2 ? "#d8e0df" : draft > 0.03 ? "#c5fff4" : braking > 0.25 ? "#ffd7c8" : "#f6fff1");
    }

    this.speedStreaks.position.z = carZ + (performance.now() * 0.035 * (0.4 + speedRatio)) % 15;
    this.speedStreaks.position.x = carX;
    this.speedStreaks.position.y = carY;
    this.speedStreaks.rotation.y = worldYaw;
    this.speedStreaks.scale.z = 0.8 + speedRatio * 1.35;
  }

  private buildAirWake() {
    const group = new THREE.Group();
    group.name = "race-air-wake";

    const material = new THREE.MeshBasicMaterial({
      color: "#c5fff4",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 14; index += 1) {
      const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.16 + (index % 3) * 0.04, 4.8 + (index % 4) * 1.2), material);
      ribbon.name = "air-wake-ribbon";
      ribbon.rotation.x = -Math.PI / 2;
      ribbon.rotation.z = (index % 2 === 0 ? -1 : 1) * (0.16 + (index % 5) * 0.025);
      ribbon.position.set(((index % 7) - 3) * 0.82, 0.1 + (index % 3) * 0.045, -3.8 - index * 2.7);
      ribbon.userData.baseX = ribbon.position.x;
      ribbon.userData.baseZ = ribbon.position.z;
      ribbon.userData.phase = index * 0.43;
      group.add(ribbon);
    }

    group.userData.material = material;
    return group;
  }

  private updateAirWake(carX: number, carY: number, carZ: number, heading: number, draft: number, dirtyAir: number, speedRatio: number) {
    const material = this.airWake.userData.material as THREE.MeshBasicMaterial | undefined;
    const strength = clamp(draft * 0.36 + dirtyAir * 0.58, 0, 1);
    this.airWake.visible = strength > 0.015;
    if (material) {
      material.opacity = strength * (dirtyAir > draft ? 0.34 : 0.24);
      material.color.set(dirtyAir > draft ? "#dce2de" : "#b9fff2");
    }

    const time = performance.now() * 0.001;
    let visibleRibbons = 0;
    for (const ribbon of this.airWake.children) {
      const baseX = Number(ribbon.userData.baseX ?? ribbon.position.x);
      const baseZ = Number(ribbon.userData.baseZ ?? ribbon.position.z);
      const phase = Number(ribbon.userData.phase ?? 0);
      ribbon.visible = strength > 0.015;
      ribbon.position.x = baseX + Math.sin(time * 2.1 + phase) * (0.18 + dirtyAir * 0.42);
      ribbon.position.z = baseZ + ((time * (3.8 + speedRatio * 9.5) + phase * 2.2) % 6.2);
      ribbon.scale.set(0.74 + dirtyAir * 0.9, 1, 0.75 + speedRatio * 1.45 + draft * 0.6);
      if (ribbon.visible) visibleRibbons += 1;
    }

    this.airWake.position.set(carX, carY + 0.08, carZ);
    this.airWake.rotation.y = heading;
    this.renderer.domElement.dataset.airWakeIntensity = strength.toFixed(2);
    this.renderer.domElement.dataset.airWakeRibbons = String(visibleRibbons);
  }

  private buildTireSmoke() {
    const group = new THREE.Group();
    group.name = "tire-smoke-feedback";

    const material = new THREE.MeshBasicMaterial({
      color: "#f4f0e8",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 8; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42 + index * 0.05, 0.72 + index * 0.08), material);
      mesh.name = "tire-smoke-puff";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(index % 2 === 0 ? -0.9 : 0.9, 0.08, 1.4 + index * 0.52);
      group.add(mesh);
    }

    group.userData.material = material;
    return group;
  }

  private updateTireSmoke(
    carX: number,
    carY: number,
    carZ: number,
    heading: number,
    speedRatio: number,
    slip: number,
    wheelspin: number,
    lockup: number
  ) {
    const material = this.tireSmoke.userData.material as THREE.MeshBasicMaterial | undefined;
    const smokeStrength = Math.min(1, slip * 1.2 + wheelspin * 0.65 + lockup * 0.75);
    if (material) {
      material.opacity = smokeStrength * 0.22;
      material.color.set(lockup > wheelspin ? "#fff4e2" : "#eaf0e7");
    }

    this.tireSmoke.visible = smokeStrength > 0.025;
    this.tireSmoke.position.set(carX, carY, carZ);
    this.tireSmoke.rotation.y = heading;
    const pulse = 1 + Math.sin(performance.now() * 0.018) * 0.08;
    this.tireSmoke.scale.setScalar((0.65 + speedRatio * 0.75 + smokeStrength * 0.55) * pulse);
  }

  private buildBrakePressureTrail() {
    const group = new THREE.Group();
    group.name = "brake-pressure-trail";

    const material = new THREE.MeshBasicMaterial({
      color: "#ff7045",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 10; index += 1) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + (index % 3) * 0.035, 1.35 + index * 0.18), material);
      mark.name = "brake-pressure-mark";
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(index % 2 === 0 ? -0.9 : 0.9, 0.075, 0.98 + index * 0.42);
      mark.userData.phase = index * 0.47;
      group.add(mark);
    }

    group.userData.material = material;
    return group;
  }

  private updateBrakePressureTrail(
    carX: number,
    carY: number,
    carZ: number,
    heading: number,
    speedRatio: number,
    braking: number,
    lockup: number
  ) {
    const material = this.brakePressureTrail.userData.material as THREE.MeshBasicMaterial | undefined;
    const strength = clamp(braking * (0.34 + speedRatio * 0.72) + lockup * 0.42, 0, 1);
    this.brakePressureTrail.visible = strength > 0.035;
    if (material) {
      material.opacity = strength * 0.38;
      material.color.set(lockup > 0.22 ? "#fff0d2" : "#ff7045");
    }

    const time = performance.now() * 0.001;
    let visibleMarks = 0;
    for (const mark of this.brakePressureTrail.children) {
      const phase = Number(mark.userData.phase ?? 0);
      mark.visible = strength > 0.035;
      mark.scale.set(0.8 + lockup * 0.5, 1, 0.72 + speedRatio * 0.85 + strength * 0.35);
      mark.position.y = 0.07 + Math.sin(time * 7 + phase) * 0.012 * strength;
      mark.rotation.z = Math.sin(time * 5.6 + phase) * 0.025 * strength;
      if (mark.visible) visibleMarks += 1;
    }

    this.brakePressureTrail.position.set(carX, carY + 0.01, carZ);
    this.brakePressureTrail.rotation.y = heading;
    this.renderer.domElement.dataset.brakePressureTrail = strength.toFixed(2);
    this.renderer.domElement.dataset.brakePressureMarks = String(visibleMarks);
  }

  private buildProximityMarkers() {
    const group = new THREE.Group();
    group.name = "wheel-to-wheel-proximity-markers";

    const material = new THREE.MeshBasicMaterial({
      color: "#f3d348",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (const side of [-1, 1]) {
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 3.1), material);
      marker.name = side < 0 ? "left-proximity-marker" : "right-proximity-marker";
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(side * 1.36, 0.065, 0.12);
      group.add(marker);
    }

    group.userData.material = material;
    return group;
  }

  private updateProximityMarkers(
    carX: number,
    carY: number,
    carZ: number,
    heading: number,
    sideBySide: number,
    contactRisk: number
  ) {
    const material = this.proximityMarkers.userData.material as THREE.MeshBasicMaterial | undefined;
    const strength = Math.max(sideBySide * 0.72, contactRisk);
    this.proximityMarkers.visible = strength > 0.04;
    if (material) {
      material.opacity = 0.12 + strength * 0.34;
      material.color.set(contactRisk > 0.52 ? "#ff5d57" : "#f3d348");
    }

    this.proximityMarkers.position.set(carX, carY + 0.01, carZ);
    this.proximityMarkers.rotation.y = heading;
    this.proximityMarkers.scale.setScalar(0.9 + strength * 0.28);
  }

  private buildRacingLineAssist() {
    const group = new THREE.Group();
    group.name = "dynamic-racing-line-assist";

    for (let index = 0; index < RACING_LINE_SEGMENTS; index += 1) {
      const taper = 1 - index / RACING_LINE_SEGMENTS;
      const material = new THREE.MeshBasicMaterial({
        color: "#42f56f",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide
      });
      const chevron = new THREE.Group();
      chevron.name = "dynamic-racing-line-chevron";
      chevron.userData.material = material;

      for (const side of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.13 + taper * 0.05, 2.65 + taper * 0.9), material);
        bar.name = side < 0 ? "dynamic-racing-line-chevron-left" : "dynamic-racing-line-chevron-right";
        bar.rotation.x = -Math.PI / 2;
        bar.rotation.z = side * 0.48;
        bar.position.x = side * (0.28 + taper * 0.08);
        bar.position.z = -0.12;
        chevron.add(bar);
      }

      group.add(chevron);
    }

    return group;
  }

  private updateRacingLineAssist(telemetry: RaceTelemetry) {
    const visible = telemetry.assistName !== "Manual" && (telemetry.phase === "countdown" || telemetry.phase === "racing");
    this.racingLineAssist.visible = visible;
    if (!visible) {
      this.renderer.domElement.dataset.racingLineAssist = telemetry.assistName === "Manual" ? "manual-off" : "hidden";
      this.renderer.domElement.dataset.racingLineAssistStyle = "off";
      this.renderer.domElement.dataset.dynamicRacingLineSegments = "0";
      this.renderer.domElement.dataset.dynamicRacingLinePieces = "0";
      this.renderer.domElement.dataset.racingLineCue = "";
      return;
    }

    let visibleSegments = 0;
    let nearestCue = "commit";
    for (let index = 0; index < this.racingLineAssist.children.length; index += 1) {
      const chevron = this.racingLineAssist.children[index];
      const material = chevron.userData.material as THREE.MeshBasicMaterial | undefined;
      if (!material) continue;

      const lookAhead = 13 + index * 7.2;
      const distance = telemetry.car.z + lookAhead;
      const sample = sampleTrack(distance);
      const lateral = clamp(sample.racingLineOffset, -sample.halfWidth + 1.1, sample.halfWidth - 1.1);
      const point = trackWorldPointAt(distance, lateral);
      const pacePressure = telemetry.speedKph - sample.targetSpeedKph;
      const near = Math.max(0, 1 - index / this.racingLineAssist.children.length);
      const brakingPressure = sample.brakingZone || (pacePressure > 22 && sample.cornerPhase !== "exit" && sample.cornerPhase !== "flat");
      const apexPressure = sample.cornerPhase === "apex" || sample.cornerPhase === "turn-in";
      const exitPressure = sample.cornerPhase === "exit" || sample.cornerPhase === "flat";
      const cue = brakingPressure ? "brake" : apexPressure ? "apex" : exitPressure ? "exit" : "commit";
      if (index < 5) nearestCue = cue;

      chevron.visible = true;
      chevron.position.set(point.x, sample.elevation + 0.086, point.z);
      chevron.rotation.set(0, trackWorldHeadingAt(distance), 0);
      chevron.scale.setScalar(0.82 + near * 0.38 + telemetry.roadWetness * 0.05);
      material.color.set(cue === "brake" ? "#ff3b33" : cue === "apex" ? "#f3d348" : cue === "exit" ? "#42f56f" : "#20b7ff");
      material.opacity = (0.12 + near * 0.22) * (cue === "brake" ? 1.18 : 1) + telemetry.roadWetness * 0.04;
      visibleSegments += 1;
    }

    this.renderer.domElement.dataset.racingLineAssist = "dynamic";
    this.renderer.domElement.dataset.racingLineAssistStyle = "chevrons";
    this.renderer.domElement.dataset.dynamicRacingLineSegments = String(visibleSegments);
    this.renderer.domElement.dataset.dynamicRacingLinePieces = String(visibleSegments * RACING_LINE_CHEVRON_BARS);
    this.renderer.domElement.dataset.racingLineCue = nearestCue;
  }

  private buildRainStreaks() {
    const group = new THREE.Group();
    group.name = "weather-rain-streaks";

    const material = new THREE.MeshBasicMaterial({
      color: "#dce7ef",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 90; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 2.8 + (index % 4) * 0.55), material);
      mesh.name = "rain-streak";
      mesh.position.set(((index * 37) % 80) - 40, 3 + ((index * 17) % 24), -18 - ((index * 23) % 86));
      mesh.rotation.z = -0.24;
      mesh.rotation.y = ((index % 5) - 2) * 0.08;
      group.add(mesh);
    }

    group.userData.material = material;
    return group;
  }

  private updateRainStreaks(carX: number, carY: number, carZ: number, rainIntensity: number, speedRatio: number) {
    const material = this.rainStreaks.userData.material as THREE.MeshBasicMaterial | undefined;
    this.rainStreaks.visible = rainIntensity > 0.02;
    if (!material) return;

    material.opacity = rainIntensity * (0.2 + speedRatio * 0.18);
    this.rainStreaks.position.set(carX * 0.18, carY + 3.2, carZ - 10 - speedRatio * 10);
    const time = performance.now() * 0.001;
    for (let index = 0; index < this.rainStreaks.children.length; index += 1) {
      const streak = this.rainStreaks.children[index];
      const phase = (time * (18 + speedRatio * 36) + index * 5.7) % 110;
      streak.position.z = -18 - phase;
      streak.position.y = 3 + ((index * 17 + phase * 0.45) % 24);
    }
  }

  private buildLensRain() {
    const group = new THREE.Group();
    group.name = "camera-rain-lens";
    const texture = makeRainDropletTexture();

    const material = new THREE.MeshBasicMaterial({
      color: "#dfeef1",
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    const placements = [
      [-0.58, 0.28, 0.055, 0.145],
      [-0.42, -0.1, 0.038, 0.112],
      [-0.24, 0.18, 0.044, 0.126],
      [-0.08, -0.24, 0.032, 0.1],
      [0.1, 0.32, 0.046, 0.132],
      [0.28, -0.06, 0.034, 0.106],
      [0.46, 0.17, 0.052, 0.14],
      [0.62, -0.22, 0.036, 0.116],
      [-0.68, -0.28, 0.03, 0.092],
      [0.68, 0.3, 0.034, 0.1]
    ];

    placements.forEach(([x, y, width, height], index) => {
      const droplet = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      droplet.name = "rain-lens-droplet";
      droplet.position.set(x, y, -1.12 - (index % 3) * 0.01);
      droplet.rotation.z = (index % 2 === 0 ? -1 : 1) * (0.06 + (index % 4) * 0.018);
      droplet.renderOrder = 20;
      droplet.userData.baseX = x;
      droplet.userData.baseY = y;
      droplet.userData.speed = 0.08 + (index % 5) * 0.027;
      droplet.userData.phase = index * 0.37;
      group.add(droplet);
    });

    group.userData.material = material;
    group.userData.texture = texture;
    group.userData.dropletCount = placements.length;
    return group;
  }

  private updateLensRain(rainIntensity: number, roadWetness: number, speedRatio: number) {
    const material = this.lensRain.userData.material as THREE.MeshBasicMaterial | undefined;
    const strength = clamp(rainIntensity * (0.2 + roadWetness * 0.7) * (0.76 + speedRatio * 0.34), 0, 1);
    this.lensRain.visible = strength > 0.04;
    if (material) {
      material.opacity = strength * 0.24;
    }

    const time = performance.now() * 0.001;
    let visibleDroplets = 0;
    for (const child of this.lensRain.children) {
      const baseX = Number(child.userData.baseX ?? child.position.x);
      const baseY = Number(child.userData.baseY ?? child.position.y);
      const speed = Number(child.userData.speed ?? 0.1);
      const phase = Number(child.userData.phase ?? 0);
      const slide = ((time * speed * (0.9 + speedRatio * 1.4) + phase) % 0.74) - 0.37;
      child.position.x = baseX + Math.sin(time * 1.3 + phase) * 0.006 * strength;
      child.position.y = baseY - slide * strength;
      child.scale.setScalar(0.82 + strength * 0.36 + speedRatio * 0.08);
      child.visible = strength > 0.04;
      if (child.visible) visibleDroplets += 1;
    }

    this.renderer.domElement.dataset.lensRainDroplets = String(visibleDroplets);
    this.renderer.domElement.dataset.lensRainOpacity = (material?.opacity ?? 0).toFixed(2);
  }

  private buildWaterSpray() {
    const group = new THREE.Group();
    group.name = "wet-weather-spray";
    const texture = makeSoftMistTexture();

    const material = new THREE.MeshBasicMaterial({
      color: "#dce4e2",
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 14; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55 + index * 0.09, 1.1 + index * 0.16), material);
      mesh.name = "water-spray-plume";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(index % 2 === 0 ? -0.85 : 0.85, 0.08, 1.2 + index * 0.48);
      group.add(mesh);
    }

    group.userData.material = material;
    group.userData.texture = texture;
    return group;
  }

  private updateWaterSpray(
    carX: number,
    carY: number,
    carZ: number,
    heading: number,
    roadWetness: number,
    speedRatio: number,
    slip: number
  ) {
    const material = this.waterSpray.userData.material as THREE.MeshBasicMaterial | undefined;
    const sprayStrength = Math.min(1, roadWetness * (speedRatio * 0.92 + slip * 0.36));
    this.waterSpray.visible = sprayStrength > 0.03;
    if (material) {
      material.opacity = sprayStrength * 0.3;
    }

    this.waterSpray.position.set(carX, carY + 0.02, carZ + 0.25);
    this.waterSpray.rotation.y = heading;
    this.waterSpray.scale.set(0.8 + sprayStrength * 0.9, 0.8 + sprayStrength * 0.8, 0.9 + speedRatio * 1.4);
  }

  private updateRivalSpray(
    id: number,
    carX: number,
    carY: number,
    carZ: number,
    heading: number,
    roadWetness: number,
    speedKph: number,
    active: boolean
  ) {
    const spray = this.rivalSprays.get(id) ?? this.addRivalSpray(id);
    const speedRatio = clamp((speedKph - 55) / 190, 0, 1);
    const sprayStrength = active ? clamp(roadWetness * (0.18 + speedRatio * 0.9), 0, 1) : 0;
    const material = spray.userData.material as THREE.MeshBasicMaterial | undefined;
    spray.visible = sprayStrength > 0.03;
    if (material) {
      material.opacity = sprayStrength * 0.22;
    }

    spray.position.set(carX, carY + 0.02, carZ + 0.2);
    spray.rotation.y = heading;
    spray.scale.set(0.64 + sprayStrength * 0.7, 0.7 + sprayStrength * 0.46, 0.72 + speedRatio * 1.18);

    return sprayStrength;
  }
}
