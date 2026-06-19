import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import {
  getTrackCheckpoints,
  getTrackSectorEnds,
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

function makeCarGroundShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(96, 166, 8, 96, 166, 138);
    gradient.addColorStop(0, "rgba(4, 8, 7, 0.42)");
    gradient.addColorStop(0.34, "rgba(4, 8, 7, 0.26)");
    gradient.addColorStop(0.72, "rgba(4, 8, 7, 0.09)");
    gradient.addColorStop(1, "rgba(4, 8, 7, 0)");
    ctx.scale(1, 1.42);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 1.42);
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
  private readonly carGroundShadow = this.buildCarGroundShadow();
  private readonly cockpitFrame = this.buildCockpitFrame();
  private readonly cameraPosition = new THREE.Vector3(0, 5.8, 22.5);
  private readonly cameraTarget = new THREE.Vector3(0, 0.72, -16.5);
  private readonly desiredCameraPosition = new THREE.Vector3();
  private readonly desiredCameraTarget = new THREE.Vector3();
  private readonly carScreenPosition = new THREE.Vector3();
  private readonly frameGuardTarget = new THREE.Vector3();
  private readonly frameGuardCameraPosition = new THREE.Vector3();
  private readonly obstructionWorldPosition = new THREE.Vector3();
  private readonly rivals = new Map<number, ReturnType<typeof buildFormulaCarProxy>>();
  private readonly rivalSprays = new Map<number, THREE.Group>();
  private readonly rivalLabels = new Map<number, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>();
  private readonly handleResize = () => this.resize();
  private cameraMode: CameraMode = "chase";
  private cameraModeSnap = false;
  private cameraMotionLastMs = 0;
  private cameraMotionLastSpeedKph = 0;
  private cameraLongitudinalInertia = 0;
  private cameraLateralInertia = 0;
  private cameraVerticalInertia = 0;
  private cameraRoadFrameDrift = 0;
  private cameraSpeedDeltaKphPerSecond = 0;

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setClearColor("#c7d8df");
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "race-canvas";
    this.renderer.domElement.dataset.assetCar = "apex-procedural-f25";
    this.renderer.domElement.dataset.cameraMode = this.cameraMode;
    this.renderer.domElement.dataset.renderPipeline = "srgb-aces-soft-shadows";
    this.renderer.domElement.dataset.renderToneMapping = "aces";
    this.renderer.domElement.dataset.renderShadowType = "pcf-soft";
    this.parent.appendChild(this.renderer.domElement);
    this.syncHorizonTelemetry();

    this.scene.fog = new THREE.Fog("#c7d8df", 180, 920);
    this.scene.add(this.hemi);
    this.sun.position.set(-12, 30, -22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.camera.left = -42;
    this.sun.shadow.camera.right = 42;
    this.sun.shadow.camera.top = 42;
    this.sun.shadow.camera.bottom = -42;
    this.renderer.domElement.dataset.renderShadowMap = `${this.sun.shadow.mapSize.width}x${this.sun.shadow.mapSize.height}`;
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
    this.scene.add(this.carGroundShadow);
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
    this.renderer.domElement.dataset.carSteering = telemetry.car.steering.toFixed(3);
    this.renderer.domElement.dataset.carHeading = telemetry.car.heading.toFixed(3);
    this.renderer.domElement.dataset.carYawRate = telemetry.car.yawRate.toFixed(3);
    this.renderer.domElement.dataset.flowScore = telemetry.flowScore.toFixed(3);
    this.renderer.domElement.dataset.flowState = telemetry.flowState;
    this.renderer.domElement.dataset.surfaceName = telemetry.surfaceName;
    this.renderer.domElement.dataset.surfaceGripModifier = telemetry.surfaceGripModifier.toFixed(2);
    this.renderer.domElement.dataset.surfaceRumble = telemetry.surfaceRumble.toFixed(3);
    this.renderer.domElement.dataset.surfaceEdgeLoad = telemetry.surfaceEdgeLoad.toFixed(3);
    this.renderer.domElement.dataset.splitSurfaceLoad = telemetry.splitSurfaceLoad.toFixed(3);
    this.renderer.domElement.dataset.roadAdhesion = telemetry.roadAdhesion.toFixed(3);
    this.renderer.domElement.dataset.lateralScrub = telemetry.lateralScrub.toFixed(3);
    this.renderer.domElement.dataset.slipAngle = telemetry.slipAngle.toFixed(3);
    this.renderer.domElement.dataset.velocityYaw = telemetry.velocityYaw.toFixed(3);
    this.renderer.domElement.dataset.forwardBite = telemetry.forwardBite.toFixed(3);
    this.renderer.domElement.dataset.longitudinalGrip = telemetry.longitudinalGrip.toFixed(3);
    this.renderer.domElement.dataset.longitudinalSlipLoad = telemetry.longitudinalSlipLoad.toFixed(3);
    this.renderer.domElement.dataset.tireContactGrip = telemetry.tireContactGrip.toFixed(3);
    this.renderer.domElement.dataset.tireRunoffShare = telemetry.tireRunoffShare.toFixed(3);
    this.renderer.domElement.dataset.tireGroundContact = telemetry.tireGroundContact.toFixed(3);
    this.renderer.domElement.dataset.tireForceLoad = telemetry.tireForceLoad.toFixed(3);
    this.renderer.domElement.dataset.combinedSlipLoad = telemetry.combinedSlipLoad.toFixed(3);
    this.renderer.domElement.dataset.tireGripReserve = telemetry.tireGripReserve.toFixed(3);
    this.renderer.domElement.dataset.tirePressure = telemetry.tirePressure.toFixed(3);
    this.renderer.domElement.dataset.tireContactPatch = telemetry.tireContactPatch.toFixed(3);
    this.renderer.domElement.dataset.tirePressureLoad = telemetry.tirePressureLoad.toFixed(3);
    this.renderer.domElement.dataset.tireThermalLoad = telemetry.tireThermalLoad.toFixed(3);
    this.renderer.domElement.dataset.tireSaturation = telemetry.tireSaturation.toFixed(3);
    this.renderer.domElement.dataset.tireRelaxation = telemetry.tireRelaxation.toFixed(3);
    this.renderer.domElement.dataset.tireResponseLoad = telemetry.tireResponseLoad.toFixed(3);
    this.renderer.domElement.dataset.tireLoadFeedback = telemetry.tireLoadFeedback.toFixed(3);
    this.renderer.domElement.dataset.steeringLoadFeedback = telemetry.steeringLoadFeedback.toFixed(3);
    this.renderer.domElement.dataset.steeringRackLoad = telemetry.steeringRackLoad.toFixed(3);
    this.renderer.domElement.dataset.steeringVelocity = telemetry.steeringVelocity.toFixed(3);
    this.renderer.domElement.dataset.steeringImpulse = telemetry.steeringImpulse.toFixed(3);
    this.renderer.domElement.dataset.controlActuationLoad = telemetry.controlActuationLoad.toFixed(3);
    this.renderer.domElement.dataset.pedalPressureLoad = telemetry.pedalPressureLoad.toFixed(3);
    this.renderer.domElement.dataset.steeringRatio = telemetry.steeringRatio.toFixed(3);
    this.renderer.domElement.dataset.selfAlignTorque = telemetry.selfAlignTorque.toFixed(3);
    this.renderer.domElement.dataset.yawInertiaLoad = telemetry.yawInertiaLoad.toFixed(3);
    this.renderer.domElement.dataset.yawDamping = telemetry.yawDamping.toFixed(3);
    this.renderer.domElement.dataset.counterSteerLoad = telemetry.counterSteerLoad.toFixed(3);
    this.renderer.domElement.dataset.slipRecovery = telemetry.slipRecovery.toFixed(3);
    this.renderer.domElement.dataset.chassisStability = telemetry.chassisStability.toFixed(3);
    this.renderer.domElement.dataset.roadAlignment = telemetry.roadAlignment.toFixed(3);
    this.renderer.domElement.dataset.roadCamber = telemetry.roadCamber.toFixed(3);
    this.renderer.domElement.dataset.roadCamberLoad = telemetry.roadCamberLoad.toFixed(3);
    this.renderer.domElement.dataset.roadGrade = telemetry.roadGrade.toFixed(3);
    this.renderer.domElement.dataset.roadLoad = telemetry.roadLoad.toFixed(3);
    this.renderer.domElement.dataset.roadCompression = telemetry.roadCompression.toFixed(3);
    this.renderer.domElement.dataset.roadGuidanceLoad = telemetry.roadGuidanceLoad.toFixed(3);
    this.renderer.domElement.dataset.roadFeelFeedback = telemetry.roadFeelFeedback.toFixed(3);
    this.renderer.domElement.dataset.roadTextureLoad = telemetry.roadTextureLoad.toFixed(3);
    this.renderer.domElement.dataset.chassisHeave = telemetry.chassisHeave.toFixed(3);
    this.renderer.domElement.dataset.rideSettling = telemetry.rideSettling.toFixed(3);
    this.renderer.domElement.dataset.suspensionLoad = telemetry.suspensionLoad.toFixed(3);
    this.renderer.domElement.dataset.suspensionTravel = telemetry.suspensionTravel.toFixed(3);
    this.renderer.domElement.dataset.suspensionVelocity = telemetry.suspensionVelocity.toFixed(3);
    this.renderer.domElement.dataset.damperImpulse = telemetry.damperImpulse.toFixed(3);
    this.renderer.domElement.dataset.aeroPlatformLoad = telemetry.aeroPlatformLoad.toFixed(3);
    this.renderer.domElement.dataset.floorSealLoad = telemetry.floorSealLoad.toFixed(3);
    this.renderer.domElement.dataset.floorStrikeLoad = telemetry.floorStrikeLoad.toFixed(3);
    this.renderer.domElement.dataset.frontAeroLoad = telemetry.frontAeroLoad.toFixed(3);
    this.renderer.domElement.dataset.rearAeroLoad = telemetry.rearAeroLoad.toFixed(3);
    this.renderer.domElement.dataset.aeroBalance = telemetry.aeroBalance.toFixed(3);
    this.renderer.domElement.dataset.aeroWashout = telemetry.aeroWashout.toFixed(3);
    this.renderer.domElement.dataset.aeroBuffetLoad = telemetry.aeroBuffetLoad.toFixed(3);
    this.renderer.domElement.dataset.frontAxleLoad = telemetry.frontAxleLoad.toFixed(3);
    this.renderer.domElement.dataset.rearAxleLoad = telemetry.rearAxleLoad.toFixed(3);
    this.renderer.domElement.dataset.axleLoadSaturation = telemetry.axleLoadSaturation.toFixed(3);
    this.renderer.domElement.dataset.longitudinalLoadTransfer = telemetry.longitudinalLoadTransfer.toFixed(3);
    this.renderer.domElement.dataset.lateralLoadTransfer = telemetry.lateralLoadTransfer.toFixed(3);
    this.renderer.domElement.dataset.outsideTireLoad = telemetry.outsideTireLoad.toFixed(3);
    this.renderer.domElement.dataset.insideWheelUnload = telemetry.insideWheelUnload.toFixed(3);
    this.renderer.domElement.dataset.chassisPitch = telemetry.car.pitch.toFixed(3);
    this.renderer.domElement.dataset.chassisRoll = telemetry.car.roll.toFixed(3);
    this.renderer.domElement.dataset.trackRubber = telemetry.trackRubber.toFixed(3);
    this.renderer.domElement.dataset.dryingLine = telemetry.dryingLine.toFixed(3);
    this.renderer.domElement.dataset.trackEvolutionState = telemetry.trackEvolutionState;
    this.renderer.domElement.dataset.rubberedLineGrip = telemetry.rubberedLineGrip.toFixed(3);
    this.renderer.domElement.dataset.marbles = telemetry.marbles.toFixed(3);
    this.renderer.domElement.dataset.dirtyTirePickup = telemetry.dirtyTirePickup.toFixed(3);
    this.renderer.domElement.dataset.gripState = telemetry.gripState;
    this.renderer.domElement.dataset.draft = telemetry.draft.toFixed(3);
    this.renderer.domElement.dataset.dirtyAir = telemetry.dirtyAir.toFixed(3);
    this.renderer.domElement.dataset.rivalProximity = telemetry.rivalProximity.toFixed(3);
    this.renderer.domElement.dataset.sideBySide = telemetry.sideBySide.toFixed(3);
    this.renderer.domElement.dataset.contactRisk = telemetry.contactRisk.toFixed(3);
    this.renderer.domElement.dataset.frontWingDamage = telemetry.frontWingDamage.toFixed(3);
    this.renderer.domElement.dataset.downforceLoss = telemetry.downforceLoss.toFixed(3);
    this.renderer.domElement.dataset.damageState = telemetry.damageState;
    this.renderer.domElement.dataset.defensiveRivals = String(telemetry.defensiveRivals);
    this.renderer.domElement.dataset.nearestRivalGap = telemetry.nearestRivalGapMeters === null ? "" : telemetry.nearestRivalGapMeters.toFixed(1);
    this.renderer.domElement.dataset.racecraftState = telemetry.racecraftState;
    this.renderer.domElement.dataset.rainIntensity = telemetry.rainIntensity.toFixed(2);
    this.renderer.domElement.dataset.roadWetness = telemetry.roadWetness.toFixed(2);
    this.renderer.domElement.dataset.standingWater = telemetry.standingWater.toFixed(3);
    this.renderer.domElement.dataset.hydroplaneLoad = telemetry.hydroplaneLoad.toFixed(3);
    this.renderer.domElement.dataset.launchCharge = telemetry.launchCharge.toFixed(2);
    this.renderer.domElement.dataset.launchQuality = telemetry.launchQuality.toFixed(2);
    this.renderer.domElement.dataset.aeroBoostAvailable = String(telemetry.aeroBoostAvailable);
    this.renderer.domElement.dataset.aeroBoostActive = telemetry.aeroBoostActive.toFixed(2);
    this.renderer.domElement.dataset.aeroDragReduction = telemetry.aeroDragReduction.toFixed(2);
    this.renderer.domElement.dataset.shiftCut = telemetry.shiftCut.toFixed(3);
    this.renderer.domElement.dataset.tractionBite = telemetry.tractionBite.toFixed(3);
    this.renderer.domElement.dataset.rearTractionRotation = telemetry.rearTractionRotation.toFixed(3);
    this.renderer.domElement.dataset.driveTorqueLoad = telemetry.driveTorqueLoad.toFixed(3);
    this.renderer.domElement.dataset.differentialLock = telemetry.differentialLock.toFixed(3);
    this.renderer.domElement.dataset.insideRearSlip = telemetry.insideRearSlip.toFixed(3);
    this.renderer.domElement.dataset.engineBraking = telemetry.engineBraking.toFixed(3);
    this.renderer.domElement.dataset.trailBraking = telemetry.trailBraking.toFixed(3);
    this.renderer.domElement.dataset.thresholdBraking = telemetry.thresholdBraking.toFixed(3);
    this.renderer.domElement.dataset.liftOffRotationLoad = telemetry.liftOffRotationLoad.toFixed(3);
    this.renderer.domElement.dataset.throttlePickupLoad = telemetry.throttlePickupLoad.toFixed(3);
    this.renderer.domElement.dataset.powerUndersteerLoad = telemetry.powerUndersteerLoad.toFixed(3);
    this.renderer.domElement.dataset.pedalOverlapLoad = telemetry.pedalOverlapLoad.toFixed(3);
    this.renderer.domElement.dataset.brakeBalanceLoad = telemetry.brakeBalanceLoad.toFixed(3);
    this.renderer.domElement.dataset.frontLockRisk = telemetry.frontLockRisk.toFixed(3);
    this.renderer.domElement.dataset.rearBrakeStability = telemetry.rearBrakeStability.toFixed(3);
    this.renderer.domElement.dataset.brakeBite = telemetry.brakeBite.toFixed(3);
    this.renderer.domElement.dataset.powerState = telemetry.powerState;
    this.renderer.domElement.dataset.tireTemp = telemetry.tireTemp.toFixed(2);
    this.renderer.domElement.dataset.tireWear = telemetry.tireWear.toFixed(3);
    this.renderer.domElement.dataset.tireState = telemetry.tireState;
    this.renderer.domElement.dataset.fuelLoad = telemetry.fuelLoad.toFixed(3);
    this.renderer.domElement.dataset.fuelMassKg = telemetry.fuelMassKg.toFixed(1);
    this.renderer.domElement.dataset.fuelState = telemetry.fuelState;
    this.renderer.domElement.dataset.brakeTemp = telemetry.brakeTemp.toFixed(3);
    this.renderer.domElement.dataset.brakeFade = telemetry.brakeFade.toFixed(3);
    this.renderer.domElement.dataset.brakeState = telemetry.brakeState;
    this.renderer.domElement.dataset.lastSector = telemetry.lastSector === null ? "" : String(telemetry.lastSector);
    this.renderer.domElement.dataset.lastSectorTime = telemetry.lastSectorTime === null ? "" : telemetry.lastSectorTime.toFixed(2);
    this.renderer.domElement.dataset.lastSectorDelta = telemetry.lastSectorDelta === null ? "" : telemetry.lastSectorDelta.toFixed(2);
    this.renderer.domElement.dataset.sectorPaceScore = telemetry.sectorPaceScore.toFixed(3);
    this.renderer.domElement.dataset.sectorPaceState = telemetry.sectorPaceState;
    this.renderer.domElement.dataset.assistSteer = telemetry.assistSteer.toFixed(3);
    this.renderer.domElement.dataset.assistBrake = telemetry.assistBrake.toFixed(3);
    this.renderer.domElement.dataset.assistThrottleTrim = telemetry.assistThrottleTrim.toFixed(3);
    this.renderer.domElement.dataset.weather = telemetry.weatherName;
    this.renderer.domElement.dataset.trackName = telemetry.trackName;
    this.applyAtmosphere(telemetry);
    const carLateral = telemetry.carX;
    const carPoint = trackWorldPointAt(telemetry.car.z, carLateral);
    const currentTrack = sampleTrack(telemetry.car.z);
    const trackYaw = trackWorldHeadingAt(telemetry.car.z);
    const trackTangent = trackWorldTangentAt(telemetry.car.z);
    const trackNormal = { x: -trackTangent.z, z: trackTangent.x };
    const carX = carPoint.x;
    const carY = telemetry.car.y;
    const carZ = carPoint.z;
    this.renderer.domElement.dataset.carTrackLateral = carLateral.toFixed(2);
    this.renderer.domElement.dataset.carWorldX = carX.toFixed(2);
    this.renderer.domElement.dataset.carWorldY = carY.toFixed(2);
    this.renderer.domElement.dataset.carWorldZ = carZ.toFixed(2);
    const speedRatio = Math.min(1, telemetry.speedKph / 310);
    const now = performance.now();
    const frameSeconds =
      this.cameraMotionLastMs === 0 ? 1 / 60 : clamp((now - this.cameraMotionLastMs) / 1000, 1 / 120, 1 / 24);
    this.cameraSpeedDeltaKphPerSecond =
      this.cameraMotionLastMs === 0 ? 0 : (telemetry.speedKph - this.cameraMotionLastSpeedKph) / frameSeconds;
    this.cameraMotionLastMs = now;
    this.cameraMotionLastSpeedKph = telemetry.speedKph;
    this.car.position.set(carX, carY, carZ);
    const rumblePulse = Math.sin(now * 0.052) * telemetry.surfaceRumble;
    const texturePulse = Math.sin(now * 0.067 + telemetry.car.z * 0.021) * telemetry.roadTextureLoad;
    this.car.position.y +=
      Math.sin(now * 0.016) * speedRatio * 0.018 +
      telemetry.car.slip * 0.026 +
      rumblePulse * 0.032 -
      texturePulse * 0.014 +
      telemetry.chassisHeave * 0.16 -
      telemetry.suspensionTravel * 0.045 +
      telemetry.roadFeelFeedback * 0.018 +
      telemetry.damperImpulse * 0.014 +
      telemetry.floorStrikeLoad * -0.026 +
      telemetry.rideSettling * 0.01 +
      Math.max(0, 1 - telemetry.tireGroundContact) * 0.04 +
      Math.abs(telemetry.splitSurfaceLoad) * 0.012 +
      Math.abs(telemetry.rearTractionRotation) * 0.012 +
      telemetry.liftOffRotationLoad * 0.01 +
      telemetry.throttlePickupLoad * 0.012 +
      telemetry.powerUndersteerLoad * 0.014;
    this.car.rotation.y = trackYaw - telemetry.car.heading - telemetry.curve * 0.5;
    const tireLoadVisual = clamp(Math.max(telemetry.tireLoadFeedback, telemetry.combinedSlipLoad * 0.42), 0, 1);
    const visualPitch =
      telemetry.car.pitch +
      telemetry.car.braking * 0.035 -
      telemetry.brakeBalanceLoad * 0.018 -
      telemetry.pedalOverlapLoad * 0.018 -
      telemetry.car.throttle * speedRatio * 0.018 +
      telemetry.powerUndersteerLoad * 0.012 +
      telemetry.shiftCut * 0.018 +
      telemetry.tractionBite * 0.014 +
      telemetry.longitudinalLoadTransfer * 0.075 -
      telemetry.suspensionTravel * 0.028 +
      telemetry.suspensionVelocity * 0.02 +
      telemetry.chassisHeave * 0.08 +
      texturePulse * 0.014 +
      telemetry.rideSettling * 0.012 +
      telemetry.roadFeelFeedback * 0.018 +
      telemetry.damperImpulse * 0.012 +
      telemetry.floorStrikeLoad * -0.018 +
      telemetry.rearAeroLoad * 0.012 -
      telemetry.frontAeroLoad * 0.018 +
      Math.max(0, 1 - telemetry.tireGroundContact) * 0.024 +
      rumblePulse * 0.018;
    const yawInertiaDirection = Math.sign(telemetry.car.yawRate || telemetry.slipAngle || telemetry.car.steering || 1);
    const recoveryDirection = Math.sign(telemetry.car.steering || -telemetry.slipAngle || telemetry.car.yawRate || 1);
    const visualRoll =
      telemetry.car.roll -
      telemetry.car.yawRate * 0.3 +
      telemetry.car.understeer * 0.04 -
      telemetry.car.lockup * 0.024 -
      telemetry.frontLockRisk * 0.018 +
      telemetry.car.bank * 0.16 -
      telemetry.lateralLoadTransfer * 0.15 -
      tireLoadVisual * telemetry.car.yawRate * 0.08 +
      telemetry.roadFeelFeedback * Math.sign(telemetry.car.roll || telemetry.roadCamber || 1) * 0.018 +
      telemetry.roadCamberLoad * Math.sign(telemetry.roadCamber || telemetry.car.roll || 1) * 0.012 +
      telemetry.splitSurfaceLoad * 0.036 +
      telemetry.rearTractionRotation * 0.055 +
      telemetry.liftOffRotationLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.024 +
      telemetry.throttlePickupLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.018 +
      telemetry.powerUndersteerLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.022 +
      telemetry.insideRearSlip * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.026 -
      telemetry.differentialLock * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.01 +
      Math.max(0, 1 - telemetry.rearBrakeStability) * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.034 +
      telemetry.aeroBalance * 0.025 -
      telemetry.aeroWashout * Math.sign(telemetry.car.yawRate || telemetry.curve || 1) * 0.012 +
      telemetry.selfAlignTorque * 0.018 -
      telemetry.steeringRackLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.01 +
      telemetry.steeringVelocity * 0.01 -
      telemetry.steeringImpulse * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.008 +
      telemetry.yawInertiaLoad * yawInertiaDirection * 0.014 +
      telemetry.counterSteerLoad * recoveryDirection * 0.018 -
      telemetry.slipRecovery * recoveryDirection * 0.012 +
      Math.max(0, 1 - telemetry.chassisStability) * yawInertiaDirection * 0.016 +
      texturePulse * Math.sign(telemetry.car.roll || telemetry.car.steering || 1) * 0.012 +
      telemetry.rideSettling * Math.sign(telemetry.splitSurfaceLoad || telemetry.car.steering || 1) * 0.01 +
      rumblePulse * 0.014;
    this.car.rotation.x = visualPitch;
    this.car.rotation.z = visualRoll;
    this.renderer.domElement.dataset.carVisualPitch = visualPitch.toFixed(3);
    this.renderer.domElement.dataset.carVisualRoll = visualRoll.toFixed(3);
    this.animateFormulaCar(this.car, {
      distance: telemetry.car.z,
      speedKph: telemetry.speedKph,
      steering:
        telemetry.car.steering * 0.42 +
        telemetry.car.yawRate * 0.58 +
        telemetry.rearTractionRotation * 0.2 +
        telemetry.liftOffRotationLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.16 +
        telemetry.throttlePickupLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.14 +
        telemetry.powerUndersteerLoad * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * -0.16 +
        telemetry.insideRearSlip * Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * 0.16 +
        Math.sign(telemetry.car.steering || telemetry.car.yawRate || 1) * Math.max(0, 1 - telemetry.rearBrakeStability) * 0.18 +
        telemetry.selfAlignTorque * 0.08 +
        telemetry.steeringVelocity * 0.06,
      braking: telemetry.car.braking + telemetry.car.lockup * 0.65 + telemetry.frontLockRisk * 0.22 + telemetry.brakeTemp * 0.12,
      throttle: telemetry.car.throttle,
      wheelspin: telemetry.car.wheelspin,
      tireLoadFeedback: telemetry.tireLoadFeedback,
      axleLoadSaturation: telemetry.axleLoadSaturation,
      combinedSlipLoad: telemetry.combinedSlipLoad,
      tireGripReserve: telemetry.tireGripReserve,
      tirePressure: telemetry.tirePressure,
      tireContactPatch: telemetry.tireContactPatch,
      tirePressureLoad: telemetry.tirePressureLoad,
      counterSteerLoad: telemetry.counterSteerLoad,
      slipRecovery: telemetry.slipRecovery,
      chassisStability: telemetry.chassisStability,
      brakeBalanceLoad: telemetry.brakeBalanceLoad,
      frontLockRisk: telemetry.frontLockRisk,
      rearBrakeStability: telemetry.rearBrakeStability,
      driveTorqueLoad: telemetry.driveTorqueLoad,
      pedalOverlapLoad: telemetry.pedalOverlapLoad,
      differentialLock: telemetry.differentialLock,
      insideRearSlip: telemetry.insideRearSlip,
      tireGroundContact: telemetry.tireGroundContact,
      splitSurfaceLoad: telemetry.splitSurfaceLoad,
      rearTractionRotation: telemetry.rearTractionRotation,
      liftOffRotationLoad: telemetry.liftOffRotationLoad,
      throttlePickupLoad: telemetry.throttlePickupLoad,
      powerUndersteerLoad: telemetry.powerUndersteerLoad,
      tireResponseLoad: telemetry.tireResponseLoad,
      longitudinalSlipLoad: telemetry.longitudinalSlipLoad,
      hydroplaneLoad: telemetry.hydroplaneLoad,
      lateralLoadTransfer: telemetry.lateralLoadTransfer,
      outsideTireLoad: telemetry.outsideTireLoad,
      insideWheelUnload: telemetry.insideWheelUnload,
      suspensionTravel: telemetry.suspensionTravel,
      damperImpulse: telemetry.damperImpulse,
      floorSealLoad: telemetry.floorSealLoad,
      floorStrikeLoad: telemetry.floorStrikeLoad,
      roadTextureLoad: telemetry.roadTextureLoad,
      roadCamberLoad: telemetry.roadCamberLoad,
      roadGuidanceLoad: telemetry.roadGuidanceLoad,
      chassisHeave: telemetry.chassisHeave,
      rideSettling: telemetry.rideSettling,
      surfaceRumble: clamp(
        telemetry.surfaceRumble +
          telemetry.roadFeelFeedback * 0.34 +
          telemetry.hydroplaneLoad * 0.16 +
          telemetry.aeroBuffetLoad * 0.12 +
          telemetry.roadCamberLoad * 0.12 +
          telemetry.roadGuidanceLoad * 0.14 +
          telemetry.damperImpulse * 0.24 +
          telemetry.floorSealLoad * 0.08 +
          telemetry.floorStrikeLoad * 0.36 +
          telemetry.roadTextureLoad * 0.3 +
          telemetry.axleLoadSaturation * 0.18 +
          Math.abs(telemetry.chassisHeave) * 0.34 +
          telemetry.rideSettling * 0.22 +
          Math.max(0, 1 - telemetry.tireGroundContact) * 0.26 +
          Math.abs(telemetry.splitSurfaceLoad) * 0.22 +
          Math.abs(telemetry.rearTractionRotation) * 0.2 +
          telemetry.liftOffRotationLoad * 0.26 +
          telemetry.throttlePickupLoad * 0.22 +
          telemetry.powerUndersteerLoad * 0.26 +
          telemetry.counterSteerLoad * 0.24 +
          telemetry.slipRecovery * 0.18 +
          telemetry.tireResponseLoad * 0.2 +
          Math.max(0, 1 - telemetry.chassisStability) * 0.22 +
          telemetry.steeringImpulse * 0.24 +
          telemetry.controlActuationLoad * 0.12 +
          telemetry.pedalPressureLoad * 0.18 +
          Math.abs(telemetry.steeringVelocity) * 0.12 +
          telemetry.tirePressureLoad * 0.2 +
          telemetry.pedalOverlapLoad * 0.18 +
          telemetry.frontLockRisk * 0.3 +
          Math.max(0, 1 - telemetry.rearBrakeStability) * 0.22 +
          telemetry.insideRearSlip * 0.28 +
          telemetry.differentialLock * 0.12,
        0,
        1
      ),
      rainLight: telemetry.phase === "racing" ? telemetry.roadWetness * (0.46 + telemetry.rainIntensity * 0.34 + speedRatio * 0.2) : 0,
      ersDeploy: telemetry.phase === "racing" && telemetry.speedKph > 130 && telemetry.ers < 0.92 && telemetry.car.throttle > 0.35 ? 1 : 0,
      aeroOpen: telemetry.aeroBoostActive,
      frontAeroLoad: telemetry.frontAeroLoad,
      rearAeroLoad: telemetry.rearAeroLoad,
      aeroBalance: telemetry.aeroBalance,
      aeroWashout: telemetry.aeroWashout,
      steeringRackLoad: telemetry.steeringRackLoad,
      steeringVelocity: telemetry.steeringVelocity,
      steeringImpulse: telemetry.steeringImpulse,
      controlActuationLoad: telemetry.controlActuationLoad,
      pedalPressureLoad: telemetry.pedalPressureLoad,
      steeringRatio: telemetry.steeringRatio,
      selfAlignTorque: telemetry.selfAlignTorque,
      yawInertiaLoad: telemetry.yawInertiaLoad,
      yawDamping: telemetry.yawDamping,
      frontWingDamage: telemetry.frontWingDamage,
      instrument: true
    });
    this.renderer.domElement.dataset.wheelSpin = (telemetry.car.z * 3.2).toFixed(2);
    this.renderer.domElement.dataset.brakeGlow = clamp(telemetry.car.braking + telemetry.car.lockup * 0.65 + telemetry.frontLockRisk * 0.22 + telemetry.brakeTemp * 0.12, 0, 1).toFixed(2);
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
    this.renderer.domElement.dataset.rearAeroFlap = clamp(telemetry.aeroBoostActive + telemetry.aeroWashout * 0.22, 0, 1).toFixed(2);

    const carWorldYaw = trackYaw - telemetry.car.heading;
    this.updateCarGroundShadow(carX, carY, carZ, carWorldYaw, telemetry);
    const airBuffet = clamp(
      telemetry.dirtyAir * 0.48 +
        telemetry.draft * 0.18 +
        telemetry.contactRisk * 0.22 +
        telemetry.aeroBuffetLoad * 0.6 +
        telemetry.shiftCut * 0.08 +
        telemetry.aeroWashout * 0.18,
      0,
      1
    );
    this.updateSpeedStreaks(carX, carY, carZ, carWorldYaw, speedRatio, telemetry.car.slip, telemetry.car.braking, telemetry.draft, telemetry.dirtyAir);
    this.updateAirWake(carX, carY, carZ, carWorldYaw, telemetry.draft, telemetry.dirtyAir, telemetry.aeroBuffetLoad, speedRatio);
    this.updateTireSmoke(
      carX,
      carY,
      carZ,
      carWorldYaw,
      speedRatio,
      telemetry.car.slip,
      telemetry.car.wheelspin,
      telemetry.car.lockup,
      telemetry.rearTractionRotation,
      telemetry.liftOffRotationLoad,
      telemetry.throttlePickupLoad,
      telemetry.powerUndersteerLoad,
      telemetry.aeroWashout,
      telemetry.floorStrikeLoad
    );
    this.updateBrakePressureTrail(carX, carY, carZ, carWorldYaw, speedRatio, telemetry.car.braking, telemetry.car.lockup);
    this.updateProximityMarkers(carX, carY, carZ, carWorldYaw, telemetry.sideBySide, telemetry.contactRisk);
    this.updateRacingLineAssist(telemetry);
    this.updateCheckpointBeacon(telemetry);
    const podMode = this.cameraMode === "pod";
    const portraitView = podMode ? 0 : clamp((1.05 - this.camera.aspect) / 0.55, 0, 1);
    const rejoinFocus = podMode ? 0 : clamp((Math.abs(carLateral) - currentTrack.halfWidth) / 4.2, 0, 1);
    const roadSpeedFraming = podMode
      ? 0
      : clamp(
          speedRatio * 0.42 +
            telemetry.tireLoadFeedback * 0.2 +
            telemetry.rivalProximity * 0.16 +
            telemetry.sideBySide * 0.12 +
            (telemetry.brakingZone ? 0.12 : 0) -
            rejoinFocus * 0.34,
          0,
          1
        );
    const accelerationCue = clamp(this.cameraSpeedDeltaKphPerSecond / 900, -1, 1);
    const cameraLongitudinalTarget =
      telemetry.phase === "ready" || podMode
        ? 0
        : clamp(
            accelerationCue * 1.35 -
              telemetry.car.braking * 1.18 +
              telemetry.aeroPlatformLoad * 0.72 +
              (telemetry.rearAeroLoad - telemetry.frontAeroLoad) * 0.28 +
              telemetry.car.slip * 0.34,
            -1.7,
            1.85
          );
    const cameraLateralTarget =
      telemetry.phase === "ready" || podMode
        ? 0
        : clamp(
            -telemetry.car.yawRate * 1.55 +
              telemetry.slipAngle * 0.82 +
              telemetry.car.bank * 0.42 +
              telemetry.car.understeer * 0.18 +
              telemetry.splitSurfaceLoad * 0.38 -
              telemetry.rearTractionRotation * 0.42 +
              telemetry.liftOffRotationLoad * yawInertiaDirection * 0.26 +
              telemetry.throttlePickupLoad * yawInertiaDirection * 0.2 +
              telemetry.powerUndersteerLoad * yawInertiaDirection * -0.22 +
              telemetry.aeroBalance * 0.22 +
              telemetry.selfAlignTorque * 0.18 +
              telemetry.yawInertiaLoad * yawInertiaDirection * 0.28,
            -1.35,
            1.35
          );
    const cameraVerticalTarget =
      telemetry.phase === "ready" || podMode
        ? 0
        : clamp(
            telemetry.aeroPlatformLoad * 0.34 -
              telemetry.suspensionTravel * 0.68 -
              telemetry.car.braking * 0.18 +
              telemetry.car.slip * 0.12 +
              telemetry.surfaceRumble * 0.2 +
              telemetry.roadFeelFeedback * 0.16 +
              telemetry.damperImpulse * 0.18 +
              telemetry.suspensionVelocity * 0.08 +
              telemetry.roadTextureLoad * 0.16 +
              telemetry.chassisHeave * 0.22 +
              telemetry.rideSettling * 0.12 +
              (telemetry.frontAeroLoad + telemetry.rearAeroLoad) * 0.08 -
              telemetry.aeroWashout * 0.12 +
              Math.max(0, 1 - telemetry.tireGroundContact) * 0.2 +
              Math.abs(telemetry.splitSurfaceLoad) * 0.12,
            -0.34,
            0.44
          );
    const cameraInertiaBlend = 0.07 + speedRatio * 0.045 + telemetry.car.braking * 0.025;
    this.cameraLongitudinalInertia = THREE.MathUtils.lerp(this.cameraLongitudinalInertia, cameraLongitudinalTarget, cameraInertiaBlend);
    this.cameraLateralInertia = THREE.MathUtils.lerp(this.cameraLateralInertia, cameraLateralTarget, cameraInertiaBlend * 1.15);
    this.cameraVerticalInertia = THREE.MathUtils.lerp(this.cameraVerticalInertia, cameraVerticalTarget, cameraInertiaBlend * 0.9);
    const roadFrameDriftTarget =
      telemetry.phase === "ready" || podMode
        ? 0
        : clamp(
            (telemetry.slipAngle * 2.8 +
              telemetry.velocityYaw * 1.15 +
              telemetry.car.yawRate * 1.65 +
              telemetry.lateralLoadTransfer * 1.3 -
              telemetry.splitSurfaceLoad * 0.44 -
              telemetry.rearTractionRotation * 1.1 -
              telemetry.liftOffRotationLoad * yawInertiaDirection * 0.72 -
              telemetry.throttlePickupLoad * yawInertiaDirection * 0.55 -
              telemetry.powerUndersteerLoad * yawInertiaDirection * 0.42 -
              telemetry.aeroBalance * 0.5 -
              telemetry.aeroWashout * Math.sign(telemetry.car.yawRate || telemetry.curve || 1) * 0.35 -
              telemetry.selfAlignTorque * 0.38 -
              telemetry.yawInertiaLoad * yawInertiaDirection * 0.62 -
              telemetry.curve * 0.48) *
              speedRatio *
              (1 - rejoinFocus * 0.8),
            -2.35,
            2.35
          );
    this.cameraRoadFrameDrift = THREE.MathUtils.lerp(this.cameraRoadFrameDrift, roadFrameDriftTarget, cameraInertiaBlend * 0.9);
    this.car.visible = !podMode || telemetry.phase === "ready";
    this.renderer.domElement.dataset.externalCarVisible = String(this.car.visible);
    this.updateCockpitFrame(telemetry, podMode);
    const apexSampleDistance = telemetry.car.z + (podMode ? 42 + speedRatio * 62 : 58 + speedRatio * 84);
    const apexSample = sampleTrack(apexSampleDistance);
    const apexDirection = clamp(apexSample.curve * 28 + apexSample.racingLineOffset * 0.1, -1, 1);
    const rejoinApexBlend = 1 - rejoinFocus * 0.82;
    const cameraApexBias = apexDirection * (podMode ? 1.6 + speedRatio * 1.1 : 3.2 + speedRatio * 2.2) * rejoinApexBlend;
    const rejoinCameraLift = !podMode && (telemetry.surfaceName === "Runoff" || telemetry.surfaceName === "Gravel")
      ? (telemetry.surfaceName === "Gravel" ? 1.45 : 1.08) + speedRatio * 0.58 + telemetry.surfaceRumble * 0.28 + rejoinFocus * 0.76
      : 0;
    const fovTarget =
      (podMode ? 47 + speedRatio * 4 + telemetry.car.braking * 1.4 : 42 + speedRatio * 5.2 + telemetry.car.braking * 1.35) +
      Math.abs(apexDirection) * (podMode ? 1.2 : 2.4) +
      roadSpeedFraming * 1.8 +
      rejoinCameraLift * 1.1 +
      rejoinFocus * 3.4 +
      portraitView * 5.35 +
      Math.max(0, this.cameraLongitudinalInertia) * (podMode ? 0 : 0.54) +
      Math.abs(this.cameraLateralInertia) * (podMode ? 0 : 0.24) +
      telemetry.aeroPlatformLoad * (podMode ? 0 : 0.82) +
      telemetry.aeroWashout * (podMode ? 0.26 : 0.8) +
      telemetry.yawInertiaLoad * (podMode ? 0.18 : 0.42);
    this.camera.fov = fovTarget;

    const lookAhead =
      (podMode ? 24 + speedRatio * 32 : 10 + speedRatio * 18) +
      Math.abs(apexDirection) * (podMode ? 8 : 16) +
      roadSpeedFraming * (9.5 + speedRatio * 10) +
      portraitView * (10 + speedRatio * 12) +
      Math.max(0, this.cameraLongitudinalInertia) * (podMode ? 0 : 1.8) +
      telemetry.aeroPlatformLoad * speedRatio * (podMode ? 0 : 5.8) +
      telemetry.frontAeroLoad * speedRatio * (podMode ? 1.2 : 2.5);
    const powertrainLurch =
      telemetry.shiftCut * 0.9 +
      telemetry.tractionBite * 0.42 +
      Math.abs(telemetry.rearTractionRotation) * 0.24 +
      telemetry.liftOffRotationLoad * 0.18 +
      telemetry.throttlePickupLoad * 0.24 +
      telemetry.powerUndersteerLoad * 0.2;
    const powertrainLateralKick =
      telemetry.tractionBite * clamp(telemetry.car.heading * 2.2 + telemetry.car.yawRate * 0.9, -1, 1) +
      telemetry.rearTractionRotation * 0.56 +
      telemetry.liftOffRotationLoad * yawInertiaDirection * 0.38 +
      telemetry.throttlePickupLoad * yawInertiaDirection * 0.32 +
      telemetry.powerUndersteerLoad * yawInertiaDirection * -0.28 +
      telemetry.yawInertiaLoad * yawInertiaDirection * 0.22;
    const rejoinCameraLag = rejoinCameraLift * (1.8 + speedRatio * 0.8);
    const cameraLag = podMode
      ? 1.18 + speedRatio * 0.52 - telemetry.car.braking * 0.16 + powertrainLurch * 0.1
      : 4.35 +
        speedRatio * 2.4 +
        telemetry.car.throttle * 0.25 -
        telemetry.car.braking * 0.95 +
        powertrainLurch * 0.7 +
        this.cameraLongitudinalInertia +
        rejoinCameraLag +
        roadSpeedFraming * (2.05 + speedRatio * 1.4) +
        portraitView * (6.4 + speedRatio * 2.4);
    const cameraStructureLift = podMode ? 0 : this.cameraStructureLift(telemetry.car.z, speedRatio);
    const lateralShoulder = podMode
      ? carLateral * 0.045 - telemetry.car.yawRate * 0.08 - powertrainLateralKick * 0.08
      : carLateral * (0.18 + speedRatio * 0.06) * (1 - clamp(rejoinCameraLift * 0.18, 0, 0.34)) -
        telemetry.car.yawRate * 0.62 -
        powertrainLateralKick * 0.55 +
        this.cameraLateralInertia * 0.82 -
        this.cameraRoadFrameDrift * 0.26;
    const idealTargetLateral =
      (podMode ? carLateral * 0.08 + telemetry.car.yawRate * 0.34 - telemetry.curve * 0.4 : carLateral * 0.24 + telemetry.car.yawRate * 1.4 - telemetry.curve * 0.85) +
      apexSample.racingLineOffset * (podMode ? 0.28 : 0.46) +
      cameraApexBias +
      powertrainLateralKick * (podMode ? 0.22 : 1.65) +
      this.cameraRoadFrameDrift * (podMode ? 0.18 : 0.72);
    const roadRecoveryLateral = clamp(
      carLateral,
      -currentTrack.halfWidth + 1.35 + currentTrack.racingLineOffset * 0.12,
      currentTrack.halfWidth - 1.35 + currentTrack.racingLineOffset * 0.12
    );
    const roadRecoveryFocus = rejoinFocus * (podMode ? 0 : 1);
    const targetLateral = THREE.MathUtils.lerp(idealTargetLateral, roadRecoveryLateral, roadRecoveryFocus);
    const targetDistance = telemetry.car.z + lookAhead;
    const cameraPoint = {
      x: carX - trackTangent.x * cameraLag + trackNormal.x * lateralShoulder,
      z: carZ - trackTangent.z * cameraLag + trackNormal.z * lateralShoulder
    };
    const targetPoint = trackWorldPointAt(targetDistance, targetLateral);
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
          (podMode ? 1.34 : 3.08) -
          telemetry.car.braking * (podMode ? 0.06 : 0.14) +
          telemetry.car.slip * (podMode ? 0.08 : 0.18) +
          speedRatio * (podMode ? 0.12 : 0.1) +
          cameraStructureLift +
          rejoinCameraLift +
          roadSpeedFraming * (0.62 + speedRatio * 0.34) +
          portraitView * (2.15 + speedRatio * 0.55) +
          this.cameraVerticalInertia +
          powertrainLurch * (podMode ? 0.018 : 0.055) +
          telemetry.damperImpulse * (podMode ? 0.012 : 0.04) +
          telemetry.surfaceRumble * 0.08 +
          telemetry.roadTextureLoad * (podMode ? 0.018 : 0.045) +
          telemetry.chassisHeave * (podMode ? 0.12 : 0.22) +
          telemetry.rideSettling * (podMode ? 0.012 : 0.035) +
          Math.sin(now * 0.02) * airBuffet * (podMode ? 0.04 : 0.08),
        cameraPoint.z
      );
      this.desiredCameraTarget.set(
        targetPoint.x + Math.sin(now * 0.025) * airBuffet * (podMode ? 0.06 : 0.14),
        carY +
          (podMode ? 0.82 : 0.78) +
          cameraStructureLift * 0.18 +
          rejoinCameraLift * 0.34 +
          roadSpeedFraming * 0.22 +
          portraitView * 0.46 +
          this.cameraVerticalInertia * 0.34 +
          telemetry.car.slip * 0.18 +
          telemetry.damperImpulse * 0.035 +
          telemetry.roadTextureLoad * 0.032 +
          telemetry.chassisHeave * 0.16 +
          telemetry.rideSettling * 0.018 +
          Math.cos(now * 0.018) * airBuffet * 0.05,
        targetPoint.z
      );
      if (telemetry.cameraSnap || this.cameraModeSnap) {
        this.cameraPosition.copy(this.desiredCameraPosition);
        this.cameraTarget.copy(this.desiredCameraTarget);
        this.cameraModeSnap = false;
      } else {
        const positionFollow = (podMode ? 0.24 : 0.27) + speedRatio * (podMode ? 0.08 : 0.1) + telemetry.car.braking * 0.025;
        const targetFollow = (podMode ? 0.28 : 0.26) + speedRatio * (podMode ? 0.08 : 0.08);
        this.cameraPosition.lerp(this.desiredCameraPosition, positionFollow);
        this.cameraTarget.lerp(this.desiredCameraTarget, targetFollow);
      }
    }
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
    const cameraRoll = clamp(
      -telemetry.car.yawRate * (podMode ? 0.018 : 0.035) -
        telemetry.yawInertiaLoad * yawInertiaDirection * (podMode ? 0.004 : 0.009) -
        telemetry.car.bank * (podMode ? 0.04 : 0.055) +
        apexDirection * (podMode ? 0.008 : 0.016),
      podMode ? -0.032 : -0.044,
      podMode ? 0.032 : 0.044
    );
    this.camera.rotation.z += cameraRoll;
    this.camera.updateProjectionMatrix();
    const cameraFrameGuard = this.applyChaseFrameGuard(carX, carY, carZ, rejoinCameraLift, podMode, telemetry.phase, cameraRoll, roadSpeedFraming);
    this.updateRainStreaks(carX, carY, carZ, telemetry.rainIntensity, speedRatio);
    this.updateLensRain(telemetry.rainIntensity, telemetry.roadWetness, speedRatio);
    this.updateWaterSpray(
      carX,
      carY,
      carZ,
      carWorldYaw,
      clamp(telemetry.roadWetness + telemetry.standingWater * 0.38 + telemetry.hydroplaneLoad * 0.3, 0, 1),
      speedRatio,
      telemetry.car.slip
    );
    this.updateCameraObstructionCulling(carX, carZ);
    this.projectCarVisualAnchor();
    this.renderer.domElement.dataset.cameraWorldX = this.camera.position.x.toFixed(2);
    this.renderer.domElement.dataset.cameraWorldY = this.camera.position.y.toFixed(2);
    this.renderer.domElement.dataset.cameraWorldZ = this.camera.position.z.toFixed(2);
    this.renderer.domElement.dataset.cameraMode = this.cameraMode;
    this.renderer.domElement.dataset.cameraChaseDistance = Math.hypot(this.camera.position.x - carX, this.camera.position.z - carZ).toFixed(2);
    this.renderer.domElement.dataset.cameraBuffet = airBuffet.toFixed(2);
    this.renderer.domElement.dataset.cameraLookAhead = lookAhead.toFixed(2);
    this.renderer.domElement.dataset.cameraMotionRig = "inertial-chase-rig";
    this.renderer.domElement.dataset.cameraLongitudinalInertia = this.cameraLongitudinalInertia.toFixed(3);
    this.renderer.domElement.dataset.cameraLateralInertia = this.cameraLateralInertia.toFixed(3);
    this.renderer.domElement.dataset.cameraVerticalInertia = this.cameraVerticalInertia.toFixed(3);
    this.renderer.domElement.dataset.cameraRoadFrameDrift = this.cameraRoadFrameDrift.toFixed(3);
    this.renderer.domElement.dataset.cameraSpeedDeltaKphPerSecond = this.cameraSpeedDeltaKphPerSecond.toFixed(1);
    this.renderer.domElement.dataset.cameraApexBias = cameraApexBias.toFixed(3);
    this.renderer.domElement.dataset.cameraRoadSpeedFraming = roadSpeedFraming.toFixed(3);
    this.renderer.domElement.dataset.cameraStructureLift = cameraStructureLift.toFixed(3);
    this.renderer.domElement.dataset.cameraRejoinLift = rejoinCameraLift.toFixed(3);
    this.renderer.domElement.dataset.cameraRejoinFocus = rejoinFocus.toFixed(3);
    this.renderer.domElement.dataset.cameraRoadRecoveryFocus = roadRecoveryFocus.toFixed(3);
    this.renderer.domElement.dataset.cameraRoadTargetDelta = Math.abs(targetLateral - carLateral).toFixed(3);
    this.renderer.domElement.dataset.cameraRoll = cameraRoll.toFixed(3);
    this.renderer.domElement.dataset.cameraFov = this.camera.fov.toFixed(2);
    this.renderer.domElement.dataset.cameraFrameGuard = cameraFrameGuard.toFixed(3);
    this.renderer.domElement.dataset.cameraPortraitView = portraitView.toFixed(3);
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
        tireLoadFeedback: clamp(rival.speedKph / 320, 0, 1) * 0.28,
        axleLoadSaturation: 0,
        combinedSlipLoad: 0,
        tireGripReserve: 1,
        tirePressure: 1,
        tireContactPatch: 1,
        tirePressureLoad: 0,
        counterSteerLoad: 0,
        slipRecovery: 0,
        chassisStability: 1,
        brakeBalanceLoad: 0,
        frontLockRisk: 0,
        rearBrakeStability: 1,
        driveTorqueLoad: 0,
        pedalOverlapLoad: 0,
        differentialLock: 0,
        insideRearSlip: 0,
        tireGroundContact: 1,
        splitSurfaceLoad: 0,
        rearTractionRotation: 0,
        liftOffRotationLoad: 0,
        throttlePickupLoad: 0,
        powerUndersteerLoad: 0,
        tireResponseLoad: 0,
        longitudinalSlipLoad: 0,
        hydroplaneLoad: 0,
        lateralLoadTransfer: rival.heading * -0.12,
        outsideTireLoad: 0,
        insideWheelUnload: 0,
        suspensionTravel: 0,
        damperImpulse: 0,
        floorSealLoad: 0,
        floorStrikeLoad: 0,
        roadTextureLoad: 0,
        roadCamberLoad: 0,
        roadGuidanceLoad: 0,
        chassisHeave: 0,
        rideSettling: 0,
        surfaceRumble: 0,
        rainLight: telemetry.phase === "racing" ? telemetry.roadWetness * (0.42 + telemetry.rainIntensity * 0.34) : 0,
        ersDeploy: 0,
        aeroOpen: 0,
        frontAeroLoad: clamp(rival.speedKph / 320, 0, 1) * 0.22,
        rearAeroLoad: clamp(rival.speedKph / 320, 0, 1) * 0.2,
        aeroBalance: 0,
        aeroWashout: 0,
        steeringRackLoad: 0,
        steeringVelocity: 0,
        steeringImpulse: 0,
        controlActuationLoad: 0,
        pedalPressureLoad: 0,
        steeringRatio: 1,
        selfAlignTorque: 0,
        yawInertiaLoad: 0,
        yawDamping: 1,
        frontWingDamage: 0,
        instrument: false
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
    let largestRivalLabelScale = 0;
    for (const label of this.rivalLabels.values()) {
      if (!label.visible) continue;
      visibleRivalLabels += 1;
      if (!rivalLabelSample) rivalLabelSample = String(label.userData.labelText ?? "");
      largestRivalLabelScale = Math.max(largestRivalLabelScale, label.scale.x);
    }
    this.renderer.domElement.dataset.wetRivalSprays = String(visibleWetRivalSprays);
    this.renderer.domElement.dataset.wetRivalSprayStrength = strongestWetRivalSpray.toFixed(2);
    this.renderer.domElement.dataset.rivalLabelsVisible = String(visibleRivalLabels);
    this.renderer.domElement.dataset.rivalLabelSample = rivalLabelSample;
    this.renderer.domElement.dataset.rivalLabelMaxScale = largestRivalLabelScale.toFixed(2);

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

  private buildCarGroundShadow() {
    const texture = makeCarGroundShadowTexture();
    const material = new THREE.MeshBasicMaterial({
      color: "#111612",
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.8), material);
    shadow.name = "formula-car-ground-contact-shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 3;
    shadow.userData.material = material;
    shadow.userData.texture = texture;
    return shadow;
  }

  private updateCarGroundShadow(carX: number, carY: number, carZ: number, carWorldYaw: number, telemetry: RaceTelemetry) {
    const podMode = this.cameraMode === "pod" && telemetry.phase !== "ready";
    const speedRatio = clamp(telemetry.speedKph / 310, 0, 1);
    const roughnessLift = telemetry.surfaceRumble * 0.012;
    const shadowOpacity = podMode ? 0 : clamp(0.27 + speedRatio * 0.08 - telemetry.roadWetness * 0.06 + telemetry.car.slip * 0.04, 0.16, 0.36);
    const shadowLength = 0.9 + speedRatio * 0.18 + telemetry.car.slip * 0.1;
    const shadowWidth = 0.94 + telemetry.car.understeer * 0.08;

    this.carGroundShadow.visible = !podMode;
    this.carGroundShadow.position.set(carX, carY + 0.026 + roughnessLift, carZ);
    this.carGroundShadow.rotation.y = carWorldYaw;
    this.carGroundShadow.scale.set(shadowWidth, shadowLength, 1);

    const material = this.carGroundShadow.userData.material as THREE.MeshBasicMaterial | undefined;
    if (material) material.opacity = shadowOpacity;

    this.renderer.domElement.dataset.carGroundShadow = this.carGroundShadow.visible ? "planted" : "hidden";
    this.renderer.domElement.dataset.carGroundShadowOpacity = shadowOpacity.toFixed(3);
    this.renderer.domElement.dataset.carGroundShadowLength = shadowLength.toFixed(3);
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
    const label = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.08), material);
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
    const closeTrafficFade = clamp((Math.abs(gapMeters) - 6) / 28, 0.22, 1);
    label.visible = true;
    label.position.set(carX, carY + 3.15 + distanceFade * 0.42, carZ);
    label.lookAt(this.camera.position);
    label.scale.setScalar((0.54 + distanceFade * 0.34) * closeTrafficFade);
    label.material.opacity = (0.44 + distanceFade * 0.38) * closeTrafficFade;
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
    group.name = "low-chrome-checkpoint-beacon";
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

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.034, 8, 42), ringMaterial);
    outerRing.name = "checkpoint-beacon-outer-ring";
    outerRing.renderOrder = 6;
    group.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.026, 8, 32), ringMaterial);
    innerRing.name = "checkpoint-beacon-inner-ring";
    innerRing.renderOrder = 6;
    group.add(innerRing);

    for (const x of [-3.45, 3.45]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 4.45, 8), ringMaterial);
      post.name = "checkpoint-beacon-post";
      post.position.set(x, -0.48, 0);
      post.renderOrder = 6;
      group.add(post);
    }

    const overhead = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 6.9, 8), spokeMaterial);
    overhead.name = "checkpoint-beacon-overhead";
    overhead.position.y = 1.78;
    overhead.rotation.z = Math.PI / 2;
    overhead.renderOrder = 7;
    group.add(overhead);

    for (let index = 0; index < 4; index += 1) {
      const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.78), spokeMaterial);
      spoke.name = "checkpoint-beacon-spoke";
      spoke.position.y = index < 2 ? 2.28 : -2.28;
      spoke.position.x = index % 2 === 0 ? -0.68 : 0.68;
      spoke.renderOrder = 7;
      group.add(spoke);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 112;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelMaterial.map = texture;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.18), labelMaterial);
    label.name = "checkpoint-beacon-label";
    label.position.y = 3.55;
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
    this.renderer.domElement.dataset.nextCheckpointBeaconStyle = "low-chrome";
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
    const distanceFade = clamp(1 - ahead / 900, 0.24, 0.76);
    const proximityShrink = clamp(ahead / 220, 0.54, 1);
    const opacity = (0.24 + pulse * 0.12) * distanceFade;
    const spokeOpacity = (0.32 + pulse * 0.12) * distanceFade;
    const scale = (0.64 + pulse * 0.035 + clamp(ahead / 580, 0, 1) * 0.26) * proximityShrink;

    this.checkpointBeacon.visible = ahead > 6 && ahead < TRACK_LOOP_LENGTH - 4;
    this.renderer.domElement.dataset.nextCheckpointBeaconVisible = String(this.checkpointBeacon.visible);
    this.checkpointBeacon.position.set(point.x, track.elevation + 5.55, point.z);
    this.checkpointBeacon.rotation.y = heading;
    this.checkpointBeacon.scale.setScalar(scale);
    this.renderer.domElement.dataset.nextCheckpointBeaconScale = scale.toFixed(3);
    this.renderer.domElement.dataset.nextCheckpointBeaconOpacity = opacity.toFixed(3);
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
    const steerAngle = clamp(
      telemetry.car.yawRate * 0.95 -
        telemetry.car.heading * 0.28 +
        telemetry.selfAlignTorque * 0.18 +
        telemetry.steeringVelocity * 0.08,
      -0.62,
      0.62
    );
    if (wheel) wheel.rotation.z = -steerAngle;

    const brakeGlow = clamp(telemetry.car.braking + telemetry.car.lockup * 0.7, 0, 1);
    const glowMaterial = this.cockpitFrame.userData.glowMaterial as THREE.MeshBasicMaterial | undefined;
    if (glowMaterial) {
      glowMaterial.opacity = visible ? 0.16 + brakeGlow * 0.36 + telemetry.ers * 0.04 : 0;
      glowMaterial.color.set(brakeGlow > 0.25 ? "#ff3156" : "#69f7ff");
    }

    this.cockpitFrame.position.y =
      -0.42 -
      speedRatio * 0.025 +
      telemetry.car.braking * 0.018 -
      telemetry.suspensionTravel * 0.035 +
      Math.sin(performance.now() * 0.018) * speedRatio * 0.004;
    this.cockpitFrame.position.x = clamp(telemetry.carX / 44, -0.06, 0.06) + telemetry.car.yawRate * 0.015;
    this.cockpitFrame.rotation.x = clamp(telemetry.car.pitch * 0.32, -0.035, 0.035);
    this.cockpitFrame.rotation.z = clamp(telemetry.car.roll * 0.28 - telemetry.car.yawRate * 0.018 + telemetry.car.bank * 0.025, -0.042, 0.042);

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
      tireLoadFeedback: number;
      axleLoadSaturation: number;
      combinedSlipLoad: number;
      tireGripReserve: number;
      tirePressure: number;
      tireContactPatch: number;
      tirePressureLoad: number;
      counterSteerLoad: number;
      slipRecovery: number;
      chassisStability: number;
      brakeBalanceLoad: number;
      frontLockRisk: number;
      rearBrakeStability: number;
      driveTorqueLoad: number;
      pedalOverlapLoad: number;
      differentialLock: number;
      insideRearSlip: number;
      tireGroundContact: number;
      splitSurfaceLoad: number;
      rearTractionRotation: number;
      liftOffRotationLoad: number;
      throttlePickupLoad: number;
      powerUndersteerLoad: number;
      tireResponseLoad: number;
      longitudinalSlipLoad: number;
      hydroplaneLoad: number;
      lateralLoadTransfer: number;
      outsideTireLoad: number;
      insideWheelUnload: number;
      suspensionTravel: number;
      damperImpulse: number;
      floorSealLoad: number;
      floorStrikeLoad: number;
      roadTextureLoad: number;
      roadCamberLoad: number;
      roadGuidanceLoad: number;
      chassisHeave: number;
      rideSettling: number;
      surfaceRumble: number;
      rainLight: number;
      ersDeploy: number;
      aeroOpen: number;
      frontAeroLoad: number;
      rearAeroLoad: number;
      aeroBalance: number;
      aeroWashout: number;
      steeringRackLoad: number;
      steeringVelocity: number;
      steeringImpulse: number;
      controlActuationLoad: number;
      pedalPressureLoad: number;
      steeringRatio: number;
      selfAlignTorque: number;
      yawInertiaLoad: number;
      yawDamping: number;
      frontWingDamage: number;
      instrument: boolean;
    }
  ) {
    const longitudinalSlipLoad = clamp(state.longitudinalSlipLoad, 0, 1);
    const hydroplaneLoad = clamp(state.hydroplaneLoad, 0, 1);
    const spin = -state.distance * 3.2 - state.wheelspin * 1.4 - longitudinalSlipLoad * 0.7 - hydroplaneLoad * 0.5;
    const steerAngle = clamp(state.steering, -0.42, 0.42);
    const brakeGlow = clamp(state.braking * clamp(state.speedKph / 180, 0, 1), 0, 1);
    const wheelBlur = clamp((state.speedKph - 72) / 165 + state.wheelspin * 0.3, 0, 1);
    const rainLight = clamp(state.rainLight, 0, 1);
    const rainPulse = rainLight * (0.72 + Math.sin(performance.now() * 0.011 + state.distance * 0.025) * 0.28);
    const ersDeploy = clamp(state.ersDeploy, 0, 1);
    const ersPulse = ersDeploy * (0.72 + Math.sin(performance.now() * 0.018 + state.distance * 0.032) * 0.28);
    const aeroOpen = clamp(state.aeroOpen, 0, 1);
    const frontAeroLoad = clamp(state.frontAeroLoad, 0, 1.2);
    const rearAeroLoad = clamp(state.rearAeroLoad, 0, 1.2);
    const aeroBalance = clamp(state.aeroBalance, -0.6, 0.6);
    const aeroWashout = clamp(state.aeroWashout, 0, 1);
    const steeringRackLoad = clamp(state.steeringRackLoad, 0, 1);
    const steeringVelocity = clamp(state.steeringVelocity, -1, 1);
    const steeringImpulse = clamp(state.steeringImpulse, 0, 1);
    const controlActuationLoad = clamp(state.controlActuationLoad, 0, 1);
    const pedalPressureLoad = clamp(state.pedalPressureLoad, 0, 1);
    const steeringRatio = clamp(state.steeringRatio, 0.72, 1.08);
    const selfAlignTorque = clamp(state.selfAlignTorque, -1, 1);
    const yawInertiaLoad = clamp(state.yawInertiaLoad, 0, 1);
    const yawDamping = clamp(state.yawDamping, 0.2, 1.2);
    const frontWingDamage = clamp(state.frontWingDamage, 0, 1);
    const tireLoad = clamp(state.tireLoadFeedback, 0, 1);
    const axleLoadSaturation = clamp(state.axleLoadSaturation, 0, 1);
    const combinedSlipLoad = clamp(state.combinedSlipLoad, 0, 1);
    const tireGripReserve = clamp(state.tireGripReserve, 0.52, 1.04);
    const tirePressure = clamp(state.tirePressure, 0.86, 1.18);
    const tireContactPatch = clamp(state.tireContactPatch, 0.74, 1.1);
    const tirePressureLoad = clamp(state.tirePressureLoad, 0, 1);
    const counterSteerLoad = clamp(state.counterSteerLoad, 0, 1);
    const slipRecovery = clamp(state.slipRecovery, 0, 1);
    const chassisStability = clamp(state.chassisStability, 0.34, 1.08);
    const brakeBalanceLoad = clamp(state.brakeBalanceLoad, 0, 1);
    const frontLockRisk = clamp(state.frontLockRisk, 0, 1);
    const rearBrakeLightness = clamp(1 - state.rearBrakeStability, 0, 1);
    const driveTorqueLoad = clamp(state.driveTorqueLoad, 0, 1);
    const pedalOverlapLoad = clamp(state.pedalOverlapLoad, 0, 1);
    const differentialLock = clamp(state.differentialLock, 0, 1);
    const insideRearSlip = clamp(state.insideRearSlip, 0, 1);
    const tireGroundContact = clamp(state.tireGroundContact, 0, 1.08);
    const splitSurfaceLoad = clamp(state.splitSurfaceLoad, -1, 1);
    const rearTractionRotation = clamp(state.rearTractionRotation, -1, 1);
    const liftOffRotationLoad = clamp(state.liftOffRotationLoad, 0, 1);
    const throttlePickupLoad = clamp(state.throttlePickupLoad, 0, 1);
    const powerUndersteerLoad = clamp(state.powerUndersteerLoad, 0, 1);
    const tireResponseLoad = clamp(state.tireResponseLoad, 0, 1);
    const lateralLoad = clamp(state.lateralLoadTransfer, -0.6, 0.6);
    const outsideTireLoad = clamp(state.outsideTireLoad, 0, 1);
    const insideWheelUnload = clamp(state.insideWheelUnload, 0, 1);
    const roadTextureLoad = clamp(state.roadTextureLoad, 0, 1);
    const roadCamberLoad = clamp(state.roadCamberLoad, 0, 1);
    const roadGuidanceLoad = clamp(state.roadGuidanceLoad, 0, 1);
    const chassisHeave = clamp(state.chassisHeave, -0.24, 0.24);
    const rideSettling = clamp(state.rideSettling, 0, 1);
    const surfaceKick = clamp(
      state.surfaceRumble +
        roadTextureLoad * 0.2 +
        rideSettling * 0.12 +
        liftOffRotationLoad * 0.08 +
        throttlePickupLoad * 0.08 +
        powerUndersteerLoad * 0.09 +
        tireResponseLoad * 0.08 +
        longitudinalSlipLoad * 0.06 +
        hydroplaneLoad * 0.16 +
        outsideTireLoad * 0.1 +
        insideWheelUnload * 0.08 +
        roadGuidanceLoad * 0.1 +
        controlActuationLoad * 0.05 +
        pedalPressureLoad * 0.06 +
        roadCamberLoad * 0.04 +
        axleLoadSaturation * 0.07,
      0,
      1
    );
    const damperImpulse = clamp(state.damperImpulse, 0, 1);
    const floorSealLoad = clamp(state.floorSealLoad, 0, 1);
    const floorStrikeLoad = clamp(state.floorStrikeLoad, 0, 1);
    const suspensionCompression = clamp(
      state.suspensionTravel +
        tireLoad * 0.5 +
        damperImpulse * 0.18 +
        floorSealLoad * 0.05 +
        floorStrikeLoad * 0.16 +
        roadTextureLoad * 0.04 +
        Math.max(0, chassisHeave) * 0.1 +
        rideSettling * 0.04,
      0,
      1
    );
    const rearFlap = root.getObjectByName("rear-wing-upper-plane");
    const frontWing = root.getObjectByName("front-wing");
    let maxWheelSquash = 0;
    let loadedSideBias = 0;

    for (const wheelName of ["front-left-wheel", "front-right-wheel", "rear-left-wheel", "rear-right-wheel"]) {
      const wheel = root.getObjectByName(wheelName);
      if (!wheel) continue;

      const side = wheelName.includes("left") ? -1 : 1;
      const insideSideBias = Math.max(0, side * Math.sign(lateralLoad || state.steering || 1));
      const rearInsideBias = wheelName.startsWith("rear") ? clamp(side * Math.sign(state.steering || rearTractionRotation || 1), -1, 1) : 0;
      const liftOffSideBias = Math.sign(state.steering || rearTractionRotation || 1);
      const frontLoad = wheelName.startsWith("front")
        ? state.braking * 0.22 +
          brakeBalanceLoad * 0.16 +
          frontLockRisk * 0.1 +
          frontAeroLoad * 0.12 +
          liftOffRotationLoad * 0.12 -
          throttlePickupLoad * 0.04 -
          powerUndersteerLoad * 0.08
        : state.throttle * 0.08 +
          driveTorqueLoad * 0.08 -
          pedalOverlapLoad * 0.06 +
          rearAeroLoad * 0.1 -
          liftOffRotationLoad * 0.08 -
          throttlePickupLoad * 0.04 -
          powerUndersteerLoad * 0.03 -
          rearBrakeLightness * 0.08 -
          Math.max(0, rearInsideBias) * insideRearSlip * 0.16;
      const cornerLoad = clamp(
          tireLoad * 0.58 +
          axleLoadSaturation * 0.08 +
          outsideTireLoad * 0.12 +
          insideWheelUnload * 0.04 -
          insideSideBias * insideWheelUnload * 0.18 +
          roadGuidanceLoad * 0.08 +
          controlActuationLoad * 0.05 +
          pedalPressureLoad * 0.05 +
          longitudinalSlipLoad * 0.06 +
          combinedSlipLoad * 0.16 +
          brakeBalanceLoad * 0.12 +
          driveTorqueLoad * 0.08 +
          pedalOverlapLoad * 0.1 +
          suspensionCompression * 0.32 +
          roadTextureLoad * 0.04 +
          roadCamberLoad * 0.04 +
          rideSettling * 0.025 +
          floorSealLoad * 0.045 +
          frontLoad -
          side * lateralLoad * 0.55 +
          side * splitSurfaceLoad * 0.34 -
          side * rearTractionRotation * 0.22 +
          side * liftOffSideBias * liftOffRotationLoad * 0.18 +
          side * liftOffSideBias * throttlePickupLoad * 0.14 +
          side * liftOffSideBias * powerUndersteerLoad * 0.16 +
          tireResponseLoad * 0.06 +
          side * Math.sign(state.steering || -rearTractionRotation || 1) * counterSteerLoad * 0.14 -
          Math.max(0, 1 - chassisStability) * 0.12 +
          slipRecovery * 0.08 +
          tirePressureLoad * 0.1 -
          Math.max(0, 1 - tireContactPatch) * 0.16 +
          steeringImpulse * 0.012 +
          side * Math.sign(state.steering || selfAlignTorque || 1) * yawInertiaLoad * 0.18 +
          damperImpulse * 0.08 -
          floorStrikeLoad * 0.1 -
          hydroplaneLoad * 0.18 -
          Math.max(0, rearInsideBias) * insideRearSlip * 0.24 +
          Math.max(0, -rearInsideBias) * differentialLock * 0.08 -
          Math.max(0, 1 - tireGroundContact) * 0.28,
        0,
        1
      );
      const rawSquash =
        cornerLoad * 0.115 +
        surfaceKick * 0.018 +
        roadTextureLoad * 0.004 +
        roadCamberLoad * 0.006 +
        Math.abs(chassisHeave) * 0.016 +
        rideSettling * 0.003 +
        combinedSlipLoad * 0.008 +
        axleLoadSaturation * 0.01 +
        outsideTireLoad * 0.01 +
        insideWheelUnload * 0.006 -
        insideSideBias * insideWheelUnload * 0.018 +
        floorSealLoad * 0.006 +
        roadGuidanceLoad * 0.008 +
        controlActuationLoad * 0.006 +
        pedalPressureLoad * 0.007 +
        Math.max(0, 1 - tireGripReserve) * 0.012 +
        tirePressureLoad * 0.012 +
        Math.max(0, 1 - tireContactPatch) * 0.018 +
        Math.max(0, tirePressure - 1.04) * 0.03 +
        brakeBalanceLoad * 0.01 +
        driveTorqueLoad * 0.006 +
        pedalOverlapLoad * 0.006 +
        liftOffRotationLoad * 0.01 +
        throttlePickupLoad * 0.01 +
        powerUndersteerLoad * 0.012 +
        tireResponseLoad * 0.008 +
        longitudinalSlipLoad * 0.008 +
        hydroplaneLoad * 0.006 +
        counterSteerLoad * 0.01 +
        Math.max(0, 1 - chassisStability) * 0.014 -
        slipRecovery * 0.006 +
        (wheelName.startsWith("rear") ? differentialLock * 0.008 + insideRearSlip * 0.014 : 0) +
        (wheelName.startsWith("front") ? frontLockRisk * 0.014 : rearBrakeLightness * 0.008) +
        yawInertiaLoad * 0.01 +
        floorStrikeLoad * 0.012 +
        (wheelName.startsWith("front") ? steeringRackLoad * 0.01 + Math.abs(steeringVelocity) * 0.002 + (1.2 - yawDamping) * 0.004 : 0);
      const squash = clamp(rawSquash, 0, 0.155);
      maxWheelSquash = Math.max(maxWheelSquash, squash);
      loadedSideBias += side * cornerLoad;
      wheel.rotation.x = spin - (wheelName.startsWith("rear") ? insideRearSlip * (0.55 + Math.max(0, rearInsideBias) * 0.65) : 0);
      wheel.rotation.y = wheelName.startsWith("front") ? steerAngle * steeringRatio + selfAlignTorque * 0.045 + steeringVelocity * 0.025 : 0;
      wheel.rotation.z = -side * (0.015 + cornerLoad * 0.042 + tireResponseLoad * 0.012);
      wheel.scale.set(1 + squash * 0.12, 1 - squash, 1 + squash * 0.08);
    }
    loadedSideBias = clamp(loadedSideBias / 4, -1, 1);

    if (rearFlap) {
      rearFlap.rotation.x = -0.12 - state.throttle * 0.05 + state.braking * 0.13 + aeroOpen * 0.24 + aeroWashout * 0.08 - rearAeroLoad * 0.035;
      rearFlap.position.y = 0.14 - floorSealLoad * 0.018 + aeroWashout * 0.012;
    }

    if (frontWing) {
      frontWing.position.y = 0.16 - frontWingDamage * 0.055 - Math.max(0, aeroBalance) * 0.025 - floorSealLoad * 0.012;
      frontWing.rotation.x = frontWingDamage * 0.13 - frontAeroLoad * 0.025 + aeroWashout * 0.04;
      frontWing.rotation.z = Math.sin(state.distance * 0.07) * frontWingDamage * 0.035 + aeroBalance * 0.035;
      frontWing.scale.x = 1 - frontWingDamage * 0.075;
    }

    if (state.instrument) {
      this.renderer.domElement.dataset.frontWingVisualDamage = frontWingDamage.toFixed(3);
      this.renderer.domElement.dataset.frontWheelSteer = steerAngle.toFixed(3);
      this.renderer.domElement.dataset.tireVisualSquash = maxWheelSquash.toFixed(3);
      this.renderer.domElement.dataset.loadedWheelBias = loadedSideBias.toFixed(3);
      this.renderer.domElement.dataset.chassisVisualLoad = suspensionCompression.toFixed(3);
      this.renderer.domElement.dataset.axleLoadSaturationVisual = axleLoadSaturation.toFixed(3);
      this.renderer.domElement.dataset.floorSealVisualLoad = floorSealLoad.toFixed(3);
      this.renderer.domElement.dataset.outsideTireVisualLoad = outsideTireLoad.toFixed(3);
      this.renderer.domElement.dataset.insideWheelUnloadVisual = insideWheelUnload.toFixed(3);
      this.renderer.domElement.dataset.combinedSlipVisualLoad = combinedSlipLoad.toFixed(3);
      this.renderer.domElement.dataset.tireGripReserveVisual = tireGripReserve.toFixed(3);
      this.renderer.domElement.dataset.tirePressureVisual = tirePressure.toFixed(3);
      this.renderer.domElement.dataset.tireContactPatchVisual = tireContactPatch.toFixed(3);
      this.renderer.domElement.dataset.tirePressureVisualLoad = tirePressureLoad.toFixed(3);
      this.renderer.domElement.dataset.tireResponseVisualLoad = tireResponseLoad.toFixed(3);
      this.renderer.domElement.dataset.longitudinalSlipVisualLoad = longitudinalSlipLoad.toFixed(3);
      this.renderer.domElement.dataset.hydroplaneVisualLoad = hydroplaneLoad.toFixed(3);
      this.renderer.domElement.dataset.roadCamberVisualLoad = roadCamberLoad.toFixed(3);
      this.renderer.domElement.dataset.roadGuidanceVisualLoad = roadGuidanceLoad.toFixed(3);
      this.renderer.domElement.dataset.roadTextureVisualLoad = roadTextureLoad.toFixed(3);
      this.renderer.domElement.dataset.floorStrikeVisualLoad = floorStrikeLoad.toFixed(3);
      this.renderer.domElement.dataset.chassisHeaveVisual = chassisHeave.toFixed(3);
      this.renderer.domElement.dataset.rideSettlingVisual = rideSettling.toFixed(3);
      this.renderer.domElement.dataset.steeringVelocityVisual = steeringVelocity.toFixed(3);
      this.renderer.domElement.dataset.steeringImpulseVisual = steeringImpulse.toFixed(3);
      this.renderer.domElement.dataset.controlActuationVisualLoad = controlActuationLoad.toFixed(3);
      this.renderer.domElement.dataset.pedalPressureVisualLoad = pedalPressureLoad.toFixed(3);
      this.renderer.domElement.dataset.steeringRatioVisual = steeringRatio.toFixed(3);
      this.renderer.domElement.dataset.counterSteerVisualLoad = counterSteerLoad.toFixed(3);
      this.renderer.domElement.dataset.slipRecoveryVisual = slipRecovery.toFixed(3);
      this.renderer.domElement.dataset.chassisStabilityVisual = chassisStability.toFixed(3);
      this.renderer.domElement.dataset.brakeBalanceVisualLoad = brakeBalanceLoad.toFixed(3);
      this.renderer.domElement.dataset.frontLockRiskVisual = frontLockRisk.toFixed(3);
      this.renderer.domElement.dataset.rearBrakeLightnessVisual = rearBrakeLightness.toFixed(3);
      this.renderer.domElement.dataset.liftOffRotationVisualLoad = liftOffRotationLoad.toFixed(3);
      this.renderer.domElement.dataset.throttlePickupVisualLoad = throttlePickupLoad.toFixed(3);
      this.renderer.domElement.dataset.powerUndersteerVisualLoad = powerUndersteerLoad.toFixed(3);
      this.renderer.domElement.dataset.driveTorqueVisualLoad = driveTorqueLoad.toFixed(3);
      this.renderer.domElement.dataset.pedalOverlapVisualLoad = pedalOverlapLoad.toFixed(3);
      this.renderer.domElement.dataset.differentialLockVisual = differentialLock.toFixed(3);
      this.renderer.domElement.dataset.insideRearSlipVisual = insideRearSlip.toFixed(3);
      this.renderer.domElement.dataset.frontAeroVisualLoad = frontAeroLoad.toFixed(3);
      this.renderer.domElement.dataset.rearAeroVisualLoad = rearAeroLoad.toFixed(3);
      this.renderer.domElement.dataset.steeringRackVisualLoad = steeringRackLoad.toFixed(3);
      this.renderer.domElement.dataset.yawInertiaVisualLoad = yawInertiaLoad.toFixed(3);
      this.renderer.domElement.dataset.yawDampingVisual = yawDamping.toFixed(3);
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
    this.renderer.domElement.dataset.horizonSkySize = String(this.horizon.userData.skySize ?? "");
    const sky = this.horizon.getObjectByName("background-sky-dome");
    const skyMesh = sky instanceof THREE.Mesh ? sky : null;
    const material = skyMesh?.material instanceof THREE.MeshBasicMaterial ? skyMesh.material : null;
    this.renderer.domElement.dataset.horizonSkyDepthWrite = material ? String(material.depthWrite) : "";
    this.renderer.domElement.dataset.horizonSkyRenderOrder = skyMesh ? String(skyMesh.renderOrder) : "";
  }

  private syncCircuitDressingTelemetry() {
    const stats = this.circuit.userData.dressingStats as
      | {
          dynamicPieces: number;
          safetyBarrierModules: number;
          catchFences: number;
          pitWallModules: number;
          marshalPosts: number;
          checkpointGates: number;
          venueHero: string;
          timingBridge: string;
          timingBridgeClearance: number;
          timingBridgeDeckHeight: number;
        }
      | undefined;
    const surfaceStats = this.circuit.userData.surfaceStats as
      | {
          terrainBands: number;
          racingGroove: string;
          marbles: string[];
          wetSheen: string;
          edgeLines: string[];
          terrainOuterReach: number;
          terrainSkirtDrop: number;
          terrainOpacity: number;
          runoffOuterReach: number;
          technicalZones: number;
          flowCues: number;
          gridSlots: number;
          puddles: number;
        }
      | undefined;

    if (stats) {
      this.renderer.domElement.dataset.circuitDressingPieces = String(stats.dynamicPieces);
      this.renderer.domElement.dataset.circuitSafetyBarriers = String(stats.safetyBarrierModules);
      this.renderer.domElement.dataset.circuitCatchFences = String(stats.catchFences);
      this.renderer.domElement.dataset.circuitPitWallModules = String(stats.pitWallModules);
      this.renderer.domElement.dataset.circuitMarshalPosts = String(stats.marshalPosts);
      this.renderer.domElement.dataset.circuitCheckpointGates = String(stats.checkpointGates);
      this.renderer.domElement.dataset.circuitVenueHero = stats.venueHero;
      this.renderer.domElement.dataset.circuitTimingBridge = stats.timingBridge;
      this.renderer.domElement.dataset.circuitTimingBridgeClearance = stats.timingBridgeClearance.toFixed(1);
      this.renderer.domElement.dataset.circuitTimingBridgeDeckHeight = stats.timingBridgeDeckHeight.toFixed(1);
    }

    if (surfaceStats) {
      this.renderer.domElement.dataset.surfaceTerrainBands = String(surfaceStats.terrainBands);
      this.renderer.domElement.dataset.surfaceRacingGroove = surfaceStats.racingGroove;
      this.renderer.domElement.dataset.surfaceMarbles = surfaceStats.marbles.join(",");
      this.renderer.domElement.dataset.surfaceWetSheen = surfaceStats.wetSheen;
      this.renderer.domElement.dataset.surfaceEdgeLines = surfaceStats.edgeLines.join(",");
      this.renderer.domElement.dataset.surfaceTerrainReach = surfaceStats.terrainOuterReach.toFixed(1);
      this.renderer.domElement.dataset.surfaceTerrainSkirtDrop = surfaceStats.terrainSkirtDrop.toFixed(2);
      this.renderer.domElement.dataset.surfaceTerrainOpacity = surfaceStats.terrainOpacity.toFixed(2);
      this.renderer.domElement.dataset.surfaceRunoffReach = surfaceStats.runoffOuterReach.toFixed(1);
      this.renderer.domElement.dataset.surfaceTechnicalZones = String(surfaceStats.technicalZones);
      this.renderer.domElement.dataset.surfaceFlowCues = String(surfaceStats.flowCues);
      this.renderer.domElement.dataset.surfaceGridSlots = String(surfaceStats.gridSlots);
      this.renderer.domElement.dataset.surfacePuddles = String(surfaceStats.puddles);
    }
  }

  private cameraStructureLift(distance: number, speedRatio: number) {
    const structureDistances = [
      38,
      ...getTrackCheckpoints().map((checkpoint) => checkpoint.distance),
      ...getTrackSectorEnds().filter((sectorEnd) => sectorEnd < TRACK_LOOP_LENGTH)
    ];
    let strongest = 0;

    for (const structureDistance of structureDistances) {
      const normalizedDelta = ((distance - structureDistance + TRACK_LOOP_LENGTH / 2) % TRACK_LOOP_LENGTH + TRACK_LOOP_LENGTH) % TRACK_LOOP_LENGTH;
      const wrappedDelta = Math.abs(normalizedDelta - TRACK_LOOP_LENGTH / 2);
      const influence = clamp(1 - wrappedDelta / 36, 0, 1);
      strongest = Math.max(strongest, influence * influence);
    }

    return strongest * (0.58 + speedRatio * 0.44);
  }

  private applyChaseFrameGuard(
    carX: number,
    carY: number,
    carZ: number,
    rejoinCameraLift: number,
    podMode: boolean,
    phase: string,
    cameraRoll: number,
    roadSpeedFraming: number
  ) {
    if (podMode || phase === "ready") return 0;

    this.projectCarVisualAnchor();
    const horizontalGuardStart = 0.58 - roadSpeedFraming * 0.24;
    const bottomGuardStart = 0.5 - roadSpeedFraming * 0.08;
    const horizontalEscape = clamp((Math.abs(this.carScreenPosition.x) - horizontalGuardStart) / 0.46, 0, 1);
    const bottomEscape = clamp((-this.carScreenPosition.y - bottomGuardStart) / 0.26, 0, 1);
    const frameGuard = Math.max(horizontalEscape, bottomEscape);
    if (frameGuard <= 0.001) return 0;

    const cameraOffsetX = this.cameraPosition.x - carX;
    const cameraOffsetZ = this.cameraPosition.z - carZ;
    const cameraDistance = Math.max(0.001, Math.hypot(cameraOffsetX, cameraOffsetZ));
    const pullBack =
      horizontalEscape * (1.8 + roadSpeedFraming * 0.8) +
      bottomEscape * 2.35 +
      rejoinCameraLift * 0.34;
    this.frameGuardCameraPosition.set(
      carX + (cameraOffsetX / cameraDistance) * (cameraDistance + pullBack),
      Math.max(this.cameraPosition.y, carY + 3.18 + rejoinCameraLift * 0.34 + roadSpeedFraming * 0.36 + bottomEscape * 0.32),
      carZ + (cameraOffsetZ / cameraDistance) * (cameraDistance + pullBack)
    );
    this.cameraPosition.lerp(this.frameGuardCameraPosition, frameGuard * 0.42);
    this.camera.position.copy(this.cameraPosition);

    this.frameGuardTarget.set(carX, carY + 0.9 + rejoinCameraLift * 0.2 - bottomEscape * 0.42, carZ);
    this.cameraTarget.lerp(this.frameGuardTarget, frameGuard * 0.76);
    this.camera.lookAt(this.cameraTarget);
    this.camera.rotation.z += cameraRoll;
    this.camera.updateProjectionMatrix();
    return frameGuard;
  }

  private projectCarVisualAnchor() {
    this.carScreenPosition.set(this.car.position.x, this.car.position.y + 0.62, this.car.position.z).project(this.camera);
  }

  private updateCameraObstructionCulling(carX: number, carZ: number) {
    const cameraX = this.camera.position.x;
    const cameraZ = this.camera.position.z;
    const segmentX = carX - cameraX;
    const segmentZ = carZ - cameraZ;
    const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
    let hidden = 0;
    let candidates = 0;
    let hiddenBarriers = 0;
    let hiddenGates = 0;
    let hiddenBoards = 0;

    if (segmentLengthSq <= 0.001) return;

    const scan = (root: THREE.Object3D) => {
      root.traverse((object) => {
        if (!this.isCameraObstructionCandidate(object.name)) return;

        candidates += 1;
        object.getWorldPosition(this.obstructionWorldPosition);
        const toObjectX = this.obstructionWorldPosition.x - cameraX;
        const toObjectZ = this.obstructionWorldPosition.z - cameraZ;
        const t = clamp((toObjectX * segmentX + toObjectZ * segmentZ) / segmentLengthSq, 0, 1);
        const closestX = cameraX + segmentX * t;
        const closestZ = cameraZ + segmentZ * t;
        const lineDistance = Math.hypot(this.obstructionWorldPosition.x - closestX, this.obstructionWorldPosition.z - closestZ);
        const cameraDistance = Math.hypot(toObjectX, toObjectZ);
        const lineBlocked = t > 0.04 && t < 0.92 && lineDistance < 1.35 && cameraDistance < 42;
        const screenPosition = this.obstructionWorldPosition.project(this.camera);
        const inPlayableScreen =
          screenPosition.z > -1 &&
          screenPosition.z < 1 &&
          Math.abs(screenPosition.x) < 0.98 &&
          screenPosition.y > -0.68 &&
          screenPosition.y < 0.66;
        const gateInPlayfield =
          this.isGateObstructionCandidate(object.name) &&
          inPlayableScreen &&
          cameraDistance < 118;
        const barrierInForeground = this.isBarrierObstructionCandidate(object.name) && inPlayableScreen && cameraDistance < 42;
        const boardInForeground = this.isTracksideBoardObstructionCandidate(object.name) && inPlayableScreen && cameraDistance < 46;
        const shouldHide = lineBlocked || gateInPlayfield || barrierInForeground || boardInForeground;

        object.visible = !shouldHide;
        if (shouldHide) {
          hidden += 1;
          if (this.isBarrierObstructionCandidate(object.name)) hiddenBarriers += 1;
          if (this.isGateObstructionCandidate(object.name)) hiddenGates += 1;
          if (this.isTracksideBoardObstructionCandidate(object.name)) hiddenBoards += 1;
        }
      });
    };

    scan(this.circuit);
    scan(this.tracksideAssets);
    this.renderer.domElement.dataset.cameraObstructionCandidates = String(candidates);
    this.renderer.domElement.dataset.cameraObstructionCulled = String(hidden);
    this.renderer.domElement.dataset.cameraBarrierObstructionsCulled = String(hiddenBarriers);
    this.renderer.domElement.dataset.cameraGateObstructionsCulled = String(hiddenGates);
    this.renderer.domElement.dataset.cameraBoardObstructionsCulled = String(hiddenBoards);
  }

  private isCameraObstructionCandidate(name: string) {
    return (
      name === "kenney-light-post" ||
      name.endsWith("-post") ||
      this.isBarrierObstructionCandidate(name) ||
      this.isTracksideBoardObstructionCandidate(name) ||
      (this.isGateObstructionCandidate(name) &&
        (name.endsWith("-crossbar") ||
          name.endsWith("-left-upright") ||
          name.endsWith("-right-upright") ||
          name.includes("-panel-") ||
          name.endsWith("-sector-lamp")))
    );
  }

  private isGateObstructionCandidate(name: string) {
    return name.includes("checkpoint-gate") || name.includes("sector-timing-gate") || name.includes("timing-bridge");
  }

  private isBarrierObstructionCandidate(name: string) {
    return name.startsWith("layered-gp-safety-barrier-");
  }

  private isTracksideBoardObstructionCandidate(name: string) {
    return name === "apex-reference-board" || name === "corner-chevron-face" || name.startsWith("braking-reference-");
  }

  private applyAtmosphere(telemetry: RaceTelemetry) {
    const horizonMaterials = this.horizon.userData.materials as
      | { sky: THREE.MeshBasicMaterial; treeline: THREE.MeshBasicMaterial; relief?: THREE.MeshBasicMaterial }
      | undefined;
    const stormLightningMaterials = this.horizon.userData.stormLightningMaterials as THREE.MeshBasicMaterial[] | undefined;
    const weatherMaterials = this.circuit.userData.weatherMaterials as
      | {
          asphalt: THREE.MeshStandardMaterial;
          grass: THREE.MeshBasicMaterial;
          runoff: THREE.MeshBasicMaterial;
          racingLine: THREE.MeshBasicMaterial;
          fence: THREE.MeshBasicMaterial;
          glass: THREE.MeshStandardMaterial;
          groove: THREE.MeshBasicMaterial;
          marbles: THREE.MeshBasicMaterial;
          wetSheen: THREE.MeshBasicMaterial;
          puddle: THREE.MeshBasicMaterial;
          gridPaint: THREE.MeshBasicMaterial;
          edgePaint: THREE.MeshBasicMaterial;
          flowPaint: THREE.MeshBasicMaterial;
        }
      | undefined;
    const stormCharge = clamp((telemetry.rainIntensity - 0.55) / 0.45, 0, 1);
    const lightningPulse =
      Math.pow(Math.max(0, Math.sin(performance.now() * 0.0017 + telemetry.roadWetness * 3.4)), 18) +
      Math.pow(Math.max(0, Math.sin(performance.now() * 0.0026 + 1.7)), 26) * 0.58;
    const lightningFlash = stormCharge * (0.045 + lightningPulse * 0.36);

    this.renderer.setClearColor(telemetry.skyColor);
    this.scene.fog = new THREE.Fog(telemetry.fogColor, 150 - telemetry.roadWetness * 35, 880 - telemetry.rainIntensity * 250);
    this.hemi.color.set(telemetry.skyColor);
    this.hemi.groundColor.set(telemetry.grassColor);
    this.hemi.intensity = 1.25 + telemetry.lightIntensity * 0.18 + lightningFlash * 0.24;
    this.sun.intensity = telemetry.lightIntensity + lightningFlash * 1.1;
    if (stormLightningMaterials) {
      stormLightningMaterials.forEach((material, index) => {
        material.opacity = lightningFlash * (index % 3 === 0 ? 0.9 : 0.62);
      });
    }
    this.renderer.domElement.dataset.stormLightningBolts = String(this.horizon.userData.stormLightningBolts ?? 0);
    this.renderer.domElement.dataset.stormLightningFlash = lightningFlash.toFixed(3);
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
      weatherMaterials.groove.opacity = 0.14 + telemetry.roadWetness * 0.05 + telemetry.trackRubber * 0.16 + telemetry.rubberedLineGrip * 0.72;
      weatherMaterials.marbles.opacity = (0.04 + telemetry.trackRubber * 0.22 + telemetry.marbles * 0.28) * (1 - telemetry.roadWetness * 0.45);
      weatherMaterials.wetSheen.opacity = telemetry.roadWetness * (0.12 + telemetry.rainIntensity * 0.1) * (1 - telemetry.dryingLine * 0.28);
      weatherMaterials.puddle.opacity = telemetry.roadWetness * 0.28 * (1 - telemetry.dryingLine * 0.2);
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
      side: THREE.BackSide
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

    const skyDomeRadius = 6200;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(skyDomeRadius, 48, 24), skyMaterial);
    sky.name = "background-sky-dome";
    sky.renderOrder = -1000;
    horizon.add(sky);
    this.addStormLightning(horizon);

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
    horizon.userData.skySize = `dome:${skyDomeRadius}`;

    return horizon;
  }

  private addStormLightning(horizon: THREE.Group) {
    const group = new THREE.Group();
    group.name = "distant-storm-lightning";
    group.position.set(0, 0, -1700);
    const materials: THREE.MeshBasicMaterial[] = [];
    const bolts = [
      { x: -420, y: 510, scale: 1 },
      { x: 180, y: 560, scale: 0.78 },
      { x: 520, y: 465, scale: 0.64 }
    ];

    for (const [boltIndex, bolt] of bolts.entries()) {
      const material = new THREE.MeshBasicMaterial({
        color: "#e9fbff",
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide
      });
      materials.push(material);
      const segments = [
        { x: 0, y: 0, h: 120, r: -0.16 },
        { x: -22, y: -88, h: 86, r: 0.34 },
        { x: 20, y: -148, h: 62, r: -0.48 }
      ];

      for (const [segmentIndex, segment] of segments.entries()) {
        const branch = new THREE.Mesh(new THREE.PlaneGeometry(5.5 * bolt.scale, segment.h * bolt.scale), material);
        branch.name = `storm-lightning-${boltIndex + 1}-${segmentIndex + 1}`;
        branch.position.set(bolt.x + segment.x * bolt.scale, bolt.y + segment.y * bolt.scale, 0);
        branch.rotation.z = segment.r;
        branch.renderOrder = -950;
        group.add(branch);
      }
    }

    horizon.add(group);
    horizon.userData.stormLightningMaterials = materials;
    horizon.userData.stormLightningBolts = bolts.length;
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

    for (let index = 0; index < 24; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.07 + (index % 3) * 0.018, 9.5 + (index % 5) * 2.6), material);
      mesh.name = "speed-streak";
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = (index % 3 - 1) * 0.08;
      mesh.position.set(index % 2 === 0 ? -7.2 - (index % 6) * 0.78 : 7.2 + (index % 6) * 0.78, 0.092, -5 - index * 6.2);
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
    const motionCue = Math.max(0, speedRatio - 0.35) * 0.58;
    const speedCue = clamp(
      Math.max(motionCue > 0 ? 0.11 : 0, motionCue) +
        slip * 0.1 +
        braking * 0.045 +
        draft * 0.18 +
        dirtyAir * 0.1,
      0,
      0.42
    );
    if (material) {
      material.opacity = speedCue;
      material.color.set(dirtyAir > 0.2 ? "#d8e0df" : draft > 0.03 ? "#c5fff4" : braking > 0.25 ? "#ffd7c8" : "#f6fff1");
    }

    this.speedStreaks.position.z = carZ + (performance.now() * 0.052 * (0.42 + speedRatio)) % 17;
    this.speedStreaks.position.x = carX;
    this.speedStreaks.position.y = carY;
    this.speedStreaks.rotation.y = worldYaw;
    this.speedStreaks.scale.z = 0.86 + speedRatio * 1.7;
    this.speedStreaks.scale.x = 1 + speedRatio * 0.08;
    this.renderer.domElement.dataset.speedStreaks = "peripheral-ground-rush";
    this.renderer.domElement.dataset.speedStreakOpacity = speedCue.toFixed(3);
    this.renderer.domElement.dataset.speedStreakCount = String(this.speedStreaks.children.length);
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

  private updateAirWake(carX: number, carY: number, carZ: number, heading: number, draft: number, dirtyAir: number, aeroBuffetLoad: number, speedRatio: number) {
    const material = this.airWake.userData.material as THREE.MeshBasicMaterial | undefined;
    const strength = clamp(draft * 0.36 + dirtyAir * 0.58 + aeroBuffetLoad * 0.5, 0, 1);
    this.airWake.visible = strength > 0.015;
    if (material) {
      material.opacity = strength * (dirtyAir + aeroBuffetLoad > draft ? 0.34 : 0.24);
      material.color.set(dirtyAir + aeroBuffetLoad > draft ? "#dce2de" : "#b9fff2");
    }

    const time = performance.now() * 0.001;
    let visibleRibbons = 0;
    for (const ribbon of this.airWake.children) {
      const baseX = Number(ribbon.userData.baseX ?? ribbon.position.x);
      const baseZ = Number(ribbon.userData.baseZ ?? ribbon.position.z);
      const phase = Number(ribbon.userData.phase ?? 0);
      ribbon.visible = strength > 0.015;
      ribbon.position.x = baseX + Math.sin(time * 2.1 + phase) * (0.18 + dirtyAir * 0.42 + aeroBuffetLoad * 0.28);
      ribbon.position.z = baseZ + ((time * (3.8 + speedRatio * 9.5) + phase * 2.2) % 6.2);
      ribbon.scale.set(0.74 + dirtyAir * 0.9 + aeroBuffetLoad * 0.42, 1, 0.75 + speedRatio * 1.45 + draft * 0.6);
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
    lockup: number,
    rearTractionRotation: number,
    liftOffRotationLoad: number,
    throttlePickupLoad: number,
    powerUndersteerLoad: number,
    aeroWashout: number,
    floorStrikeLoad: number
  ) {
    const material = this.tireSmoke.userData.material as THREE.MeshBasicMaterial | undefined;
    const smokeStrength = Math.min(
      1,
      slip * 1.2 +
        wheelspin * 0.65 +
        lockup * 0.75 +
        Math.abs(rearTractionRotation) * 0.58 +
        liftOffRotationLoad * 0.5 +
        throttlePickupLoad * 0.46 +
        powerUndersteerLoad * 0.42 +
        aeroWashout * 0.16 +
        floorStrikeLoad * 0.22
    );
    if (material) {
      material.opacity = smokeStrength * 0.22;
      material.color.set(floorStrikeLoad > 0.16 ? "#ffe0b2" : lockup > wheelspin ? "#fff4e2" : "#eaf0e7");
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
      material.opacity = sprayStrength * 0.34;
    }

    this.waterSpray.position.set(carX, carY + 0.02, carZ + 0.25);
    this.waterSpray.rotation.y = heading;
    this.waterSpray.scale.set(0.82 + sprayStrength * 1.0, 0.82 + sprayStrength * 0.9, 0.95 + speedRatio * 1.72);
    this.renderer.domElement.dataset.playerWaterSpray = this.waterSpray.visible ? "active" : "idle";
    this.renderer.domElement.dataset.playerWaterSprayStrength = sprayStrength.toFixed(3);
    this.renderer.domElement.dataset.playerWaterSprayPlumes = String(this.waterSpray.children.length);
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
