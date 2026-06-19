import { RaceDirector } from "./RaceDirector";
import { TRACK_LOOP_LENGTH, getTrackCheckpoints, getTrackSectorEnds, sampleTrack, setActiveTrackLayout, standingWaterAt, terrainHeightAt, trackCurveAt } from "./trackPath";
import { DEFAULT_SESSION, type SessionConfig } from "../world/FictionalGpWorld";

export type RacePhase = "ready" | "countdown" | "racing" | "finished";

export type RaceActions = {
  steer: number;
  throttle: number;
  brake: number;
  ers: boolean;
  launch: boolean;
  recover: boolean;
  restart: boolean;
};

export type TrackSurfaceName = "Asphalt" | "Kerb" | "Runoff" | "Gravel";

export type RaceTelemetry = {
  phase: RacePhase;
  lap: number;
  laps: number;
  countdown: number;
  position: number;
  targetPosition: number;
  scenarioName: string;
  trackName: string;
  weatherName: string;
  surfaceGrip: number;
  surfaceName: TrackSurfaceName;
  surfaceGripModifier: number;
  surfaceRumble: number;
  surfaceEdgeLoad: number;
  splitSurfaceLoad: number;
  roadAdhesion: number;
  lateralScrub: number;
  slipAngle: number;
  velocityYaw: number;
  forwardBite: number;
  longitudinalGrip: number;
  longitudinalSlipLoad: number;
  tireContactGrip: number;
  tireRunoffShare: number;
  tireGroundContact: number;
  tireForceLoad: number;
  combinedSlipLoad: number;
  tireGripReserve: number;
  tirePressure: number;
  tireContactPatch: number;
  tirePressureLoad: number;
  tireSaturation: number;
  tireRelaxation: number;
  tireResponseLoad: number;
  tireCarcassFlex: number;
  tireLoadFeedback: number;
  steeringLoadFeedback: number;
  steeringRackLoad: number;
  steeringVelocity: number;
  steeringImpulse: number;
  controlActuationLoad: number;
  pedalPressureLoad: number;
  steeringRatio: number;
  selfAlignTorque: number;
  yawInertiaLoad: number;
  yawDamping: number;
  counterSteerLoad: number;
  slipRecovery: number;
  chassisStability: number;
  roadAlignment: number;
  roadCamber: number;
  roadCamberLoad: number;
  roadGrade: number;
  roadLoad: number;
  roadCompression: number;
  roadGuidanceLoad: number;
  roadFeelFeedback: number;
  roadTextureLoad: number;
  chassisHeave: number;
  rideSettling: number;
  suspensionLoad: number;
  suspensionTravel: number;
  suspensionVelocity: number;
  damperImpulse: number;
  aeroPlatformLoad: number;
  floorSealLoad: number;
  floorStrikeLoad: number;
  frontAeroLoad: number;
  rearAeroLoad: number;
  aeroBalance: number;
  aeroWashout: number;
  aeroBuffetLoad: number;
  aeroYawStall: number;
  frontAxleLoad: number;
  rearAxleLoad: number;
  axleLoadSaturation: number;
  longitudinalLoadTransfer: number;
  lateralLoadTransfer: number;
  outsideTireLoad: number;
  insideWheelUnload: number;
  brakeBalanceLoad: number;
  frontLockRisk: number;
  rearBrakeStability: number;
  roadWetness: number;
  standingWater: number;
  hydroplaneLoad: number;
  rainIntensity: number;
  trackRubber: number;
  dryingLine: number;
  trackEvolutionState: string;
  rubberedLineGrip: number;
  marbles: number;
  dirtyTirePickup: number;
  gripState: string;
  launchCharge: number;
  launchQuality: number;
  assistName: string;
  assistSteer: number;
  assistBrake: number;
  assistThrottleTrim: number;
  skyColor: string;
  fogColor: string;
  grassColor: string;
  lightIntensity: number;
  speedKph: number;
  gear: number;
  rpm: number;
  ers: number;
  aeroBoostAvailable: boolean;
  aeroBoostActive: number;
  aeroDragReduction: number;
  shiftCut: number;
  tractionBite: number;
  rearTractionRotation: number;
  driveTorqueLoad: number;
  differentialLock: number;
  insideRearSlip: number;
  engineBraking: number;
  trailBraking: number;
  thresholdBraking: number;
  liftOffRotationLoad: number;
  throttlePickupLoad: number;
  powerUndersteerLoad: number;
  pedalOverlapLoad: number;
  drivetrainCompliance: number;
  powerState: string;
  tireTemp: number;
  tireThermalLoad: number;
  tireWear: number;
  tireState: string;
  fuelLoad: number;
  fuelMassKg: number;
  fuelState: string;
  brakeTemp: number;
  brakeFade: number;
  brakeBite: number;
  brakeState: string;
  grip: number;
  flowScore: number;
  flowState: string;
  draft: number;
  dirtyAir: number;
  airState: string;
  racecraftState: string;
  rivalProximity: number;
  sideBySide: number;
  contactRisk: number;
  frontWingDamage: number;
  downforceLoss: number;
  damageState: string;
  defensiveRivals: number;
  nearestRivalGapMeters: number | null;
  onTrack: boolean;
  lapTime: number;
  bestLap: number | null;
  totalTime: number;
  delta: number;
  splitDelta: number | null;
  trackOffset: number;
  curve: number;
  carX: number;
  overtakeStreak: number;
  trackSection: string;
  trackSector: 1 | 2 | 3;
  trackCue: string;
  trackInstruction: string;
  cornerPhase: string;
  targetSpeedKph: number;
  paceDeltaKph: number;
  brakingZone: boolean;
  cleanLap: boolean;
  trackLimitWarnings: number;
  penaltySeconds: number;
  nextCheckpoint: string;
  nextCheckpointDistance: number;
  nextCheckpointIndex: number;
  checkpointCount: number;
  checkpointProgress: string;
  sectorSplits: [number | null, number | null, number | null];
  lastSector: 1 | 2 | 3 | null;
  lastSectorTime: number | null;
  lastSectorDelta: number | null;
  sectorPaceScore: number;
  sectorPaceState: string;
  lapValid: boolean;
  lapProgress: number;
  raceProgress: number;
  objective: string;
  message: string;
  cameraSnap: boolean;
  car: {
    x: number;
    y: number;
    z: number;
    bank: number;
    heading: number;
    yawRate: number;
    pitch: number;
    roll: number;
    slip: number;
    steering: number;
    braking: number;
    throttle: number;
    wheelspin: number;
    understeer: number;
    lockup: number;
  };
  leaderboard: Array<{
    position: number;
    driver: string;
    team: string;
    gap: number | null;
    accent: string;
    isPlayer: boolean;
  }>;
  rivals: Array<{
    id: number;
    driver: string;
    team: string;
    x: number;
    y: number;
    z: number;
    bank: number;
    heading: number;
    color: string;
    gap: number;
    speedKph: number;
  }>;
};

type RivalState = {
  id: number;
  driver: string;
  team: string;
  position: number;
  lane: number;
  distance: number;
  speed: number;
  pace: number;
  color: string;
  desiredLane: number;
  defending: boolean;
};

const LAP_LENGTH = TRACK_LOOP_LENGTH;
const LAPS = 3;
const MAX_SPEED = 310;
const GEAR_SPEED_LIMITS = [0, 68, 112, 154, 196, 238, 278, MAX_SPEED];
const RIVAL_GRID = [
  { driver: "Vega", team: "NOVA", color: "#24c7ff" },
  { driver: "Kade", team: "ORO", color: "#f4d35e" },
  { driver: "Sato", team: "LYNX", color: "#f7f7f2" },
  { driver: "Roux", team: "EMBER", color: "#ff7a2d" },
  { driver: "Iven", team: "VANTA", color: "#b88cff" },
  { driver: "Mira", team: "ATLAS", color: "#1fd17f" },
  { driver: "Vale", team: "PULSE", color: "#ff4f83" }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function approach(current: number, target: number, amount: number) {
  return current + (target - current) * clamp(amount, 0, 1);
}

function moveToward(current: number, target: number, maxDelta: number) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function surfaceReliefAt(track: ReturnType<typeof sampleTrack>, lateral: number) {
  const absoluteLateral = Math.abs(lateral);
  const kerbInnerEdge = track.halfWidth - 0.55;
  const kerbOuterEdge = track.halfWidth + 0.35;
  const kerbRampIn = clamp((absoluteLateral - kerbInnerEdge) / 0.32, 0, 1);
  const kerbRampOut = 1 - clamp((absoluteLateral - (kerbOuterEdge - 0.18)) / 0.52, 0, 1);
  const kerbCrown = Math.min(kerbRampIn, kerbRampOut) * 0.052;
  const shoulderDrop = -clamp((absoluteLateral - kerbOuterEdge) / 2.25, 0, 1) * 0.038;
  return kerbCrown + shoulderDrop;
}

function surfaceHeightAt(distance: number, lateral: number, track: ReturnType<typeof sampleTrack>, offset = 0) {
  const normalized = clamp(lateral / Math.max(1, track.halfWidth), -1.35, 1.35);
  const bankedRoad = track.elevation + track.bank * normalized + surfaceReliefAt(track, lateral);
  const terrain = terrainHeightAt(distance, lateral);
  const terrainBlend = clamp((Math.abs(lateral) - track.halfWidth - 1.9) / 2.2, 0, 1);
  return bankedRoad * (1 - terrainBlend) + terrain * terrainBlend + offset;
}

function surfaceBankAt(lateral: number, track: ReturnType<typeof sampleTrack>) {
  const runoffBlend = clamp((Math.abs(lateral) - track.halfWidth) / 2.65, 0, 1);
  return track.bank * (1 - runoffBlend * 0.5) - Math.sign(lateral) * runoffBlend * 0.035;
}

function createRivals(): RivalState[] {
  const fieldSize = RIVAL_GRID.length;
  return RIVAL_GRID.map((rival, index) => ({
    id: index + 1,
    driver: rival.driver,
    team: rival.team,
    position: index + 1,
    lane: ((index % 3) - 1) * 2.4,
    distance: 68 + (fieldSize - index - 1) * 54,
    speed: 154 - index * 7,
    pace: 0.96 - index * 0.035,
    color: rival.color,
    desiredLane: ((index % 3) - 1) * 2.4,
    defending: false
  }));
}

export class SimcadeRaceModel {
  private session: SessionConfig;
  private phase: RacePhase = "ready";
  private countdown = 0;
  private lap = 1;
  private position = 8;
  private speed = 0;
  private x = 0;
  private z = 0;
  private heading = 0;
  private lateralVelocity = 0;
  private yawRate = 0;
  private slip = 0;
  private wheelspin = 0;
  private understeer = 0;
  private lockup = 0;
  private launchCharge = 0;
  private launchQuality = 0;
  private draft = 0;
  private dirtyAir = 0;
  private rivalProximity = 0;
  private sideBySide = 0;
  private contactRisk = 0;
  private racecraftCooldown = 0;
  private damageMessageCooldown = 0;
  private raceControlCooldown = 0;
  private positionGainLockout = 0;
  private cameraSnapTimer = 0;
  private flowScore = 0.62;
  private surfaceRumble = 0;
  private surfaceEdgeLoad = 0;
  private splitSurfaceLoad = 0;
  private grip = 1;
  private roadAdhesion = 1;
  private lateralScrub = 0;
  private slipAngle = 0;
  private velocityYaw = 0;
  private forwardBite = 1;
  private longitudinalGrip = 1;
  private longitudinalSlipLoad = 0;
  private tireContactGrip = 1;
  private tireRunoffShare = 0;
  private tireGroundContact = 1;
  private tireForceLoad = 0;
  private combinedSlipLoad = 0;
  private tireGripReserve = 1;
  private tirePressure = 1;
  private tireContactPatch = 1;
  private tirePressureLoad = 0;
  private tireSaturation = 0;
  private tireRelaxation = 0;
  private tireResponseLoad = 0;
  private tireCarcassFlex = 0;
  private tireLoadFeedback = 0;
  private steeringLoadFeedback = 0;
  private steeringRackLoad = 0;
  private steeringVelocity = 0;
  private steeringImpulse = 0;
  private controlActuationLoad = 0;
  private pedalPressureLoad = 0;
  private steeringRatio = 1;
  private selfAlignTorque = 0;
  private yawInertiaLoad = 0;
  private yawDamping = 1;
  private counterSteerLoad = 0;
  private slipRecovery = 0;
  private chassisStability = 1;
  private roadAlignment = 1;
  private roadCamberLoad = 0;
  private roadGrade = 0;
  private roadLoad = 1;
  private roadCompression = 0;
  private roadGuidanceLoad = 0;
  private roadFeelFeedback = 0;
  private roadTextureLoad = 0;
  private roadTexturePhase = 0;
  private chassisHeave = 0;
  private rideSettling = 0;
  private suspensionLoad = 1;
  private suspensionTravel = 0;
  private suspensionVelocity = 0;
  private damperImpulse = 0;
  private aeroPlatformLoad = 0;
  private floorSealLoad = 0;
  private floorStrikeLoad = 0;
  private frontAeroLoad = 0;
  private rearAeroLoad = 0;
  private aeroBalance = 0;
  private aeroWashout = 0;
  private aeroBuffetLoad = 0;
  private aeroYawStall = 0;
  private frontAxleLoad = 1;
  private rearAxleLoad = 1;
  private axleLoadSaturation = 0;
  private longitudinalLoadTransfer = 0;
  private lateralLoadTransfer = 0;
  private outsideTireLoad = 0;
  private insideWheelUnload = 0;
  private brakeBalanceLoad = 0;
  private frontLockRisk = 0;
  private rearBrakeStability = 1;
  private standingWater = 0;
  private hydroplaneLoad = 0;
  private chassisPitch = 0;
  private chassisRoll = 0;
  private ers = 1;
  private aeroBoostAvailable = false;
  private aeroBoostActive = 0;
  private aeroDragReduction = 0;
  private currentGear = 1;
  private shiftCut = 0;
  private tractionBite = 0;
  private rearTractionRotation = 0;
  private driveTorqueLoad = 0;
  private differentialLock = 0;
  private insideRearSlip = 0;
  private engineBraking = 0;
  private trailBraking = 0;
  private thresholdBraking = 0;
  private liftOffRotationLoad = 0;
  private throttlePickupLoad = 0;
  private powerUndersteerLoad = 0;
  private pedalOverlapLoad = 0;
  private drivetrainCompliance = 0;
  private tireTemp = 0.52;
  private tireThermalLoad = 0;
  private tireWear = 0;
  private fuelLoad = 1;
  private brakeTemp = 0.34;
  private brakeFade = 0;
  private brakeBite = 0.896;
  private brakeReleaseShock = 0;
  private controlSteer = 0;
  private controlThrottle = 0;
  private controlBrake = 0;
  private lastSteering = 0;
  private trackRubber = 0;
  private dryingLine = 0;
  private dirtyTirePickup = 0;
  private frontWingDamage = 0;
  private downforceLoss = 0;
  private lapTime = 0;
  private bestLap: number | null = null;
  private splitDelta: number | null = null;
  private previousSectorTime = 0;
  private lastSector: 1 | 2 | 3 | null = null;
  private lastSectorTime: number | null = null;
  private lastSectorDelta: number | null = null;
  private sectorPaceScore = 0;
  private sectorPaceState = "Build sector";
  private totalTime = 0;
  private overtakeStreak = 0;
  private trackLimitWarnings = 0;
  private offTrackTime = 0;
  private cleanLap = true;
  private message = "Hold throttle to launch";
  private messageTimer = 0;
  private lastBrake = 0;
  private lastThrottle = 0;
  private latestAssist = { steer: 0, brake: 0, throttleTrim: 0 };
  private rivals = createRivals();
  private director = new RaceDirector(LAPS);

  constructor(session: SessionConfig = DEFAULT_SESSION) {
    this.session = session;
    setActiveTrackLayout(session.track.id);
    this.director.configure(getTrackCheckpoints(), getTrackSectorEnds(), TRACK_LOOP_LENGTH);
  }

  configure(session: SessionConfig) {
    this.session = session;
    if (this.phase === "ready") {
      setActiveTrackLayout(session.track.id);
      this.director.configure(getTrackCheckpoints(), getTrackSectorEnds(), TRACK_LOOP_LENGTH);
      this.reset();
    }
  }

  update(dt: number, actions: RaceActions): RaceTelemetry {
    if (this.phase === "ready" && (actions.launch || actions.throttle > 0.1)) {
      this.phase = "countdown";
      this.countdown = 2.8;
      this.message = "Formation ready";
      this.messageTimer = 1.4;
    }

    if (this.phase === "finished" && actions.restart) {
      this.reset();
      return this.telemetry();
    }

    if (this.phase === "countdown") {
      this.updateLaunchCharge(dt, actions.throttle);
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) {
        this.phase = "racing";
        this.applyLaunch();
        this.messageTimer = 1.2;
      }
    }

    if (this.phase === "racing") {
      if (actions.recover) {
        this.recoverToCircuit();
      } else {
        this.updateDriving(dt, actions);
      }
      this.updateRivals(dt);
      this.updateRaceDirector();
    }

    this.messageTimer = Math.max(0, this.messageTimer - dt);
    this.cameraSnapTimer = Math.max(0, this.cameraSnapTimer - dt);
    return this.telemetry();
  }

  telemetry(): RaceTelemetry {
    const delta = this.bestLap === null ? 0 : this.lapTime - this.bestLap;
    const track = sampleTrack(this.z);
    const carLateral = this.x - track.center;
    const gripContext = this.trackGripContext(track);
    const director = this.director.snapshot(this.z);
    return {
      phase: this.phase,
      lap: director.lap,
      laps: director.laps,
      countdown: this.countdown,
      position: this.position,
      targetPosition: 3,
      scenarioName: `${this.session.track.name} Sprint`,
      trackName: this.session.track.name,
      weatherName: this.session.weather.name,
      surfaceGrip: this.evolvedWeatherGrip(),
      surfaceName: this.drivingSurface(track).name,
      surfaceGripModifier: this.drivingSurface(track).grip,
      surfaceRumble: this.surfaceRumble,
      surfaceEdgeLoad: this.surfaceEdgeLoad,
      splitSurfaceLoad: this.splitSurfaceLoad,
      roadAdhesion: this.roadAdhesion,
      lateralScrub: this.lateralScrub,
      slipAngle: this.slipAngle,
      velocityYaw: this.velocityYaw,
      forwardBite: this.forwardBite,
      longitudinalGrip: this.longitudinalGrip,
      longitudinalSlipLoad: this.longitudinalSlipLoad,
      tireContactGrip: this.tireContactGrip,
      tireRunoffShare: this.tireRunoffShare,
      tireGroundContact: this.tireGroundContact,
      tireForceLoad: this.tireForceLoad,
      combinedSlipLoad: this.combinedSlipLoad,
      tireGripReserve: this.tireGripReserve,
      tirePressure: this.tirePressure,
      tireContactPatch: this.tireContactPatch,
      tirePressureLoad: this.tirePressureLoad,
      tireSaturation: this.tireSaturation,
      tireRelaxation: this.tireRelaxation,
      tireResponseLoad: this.tireResponseLoad,
      tireCarcassFlex: this.tireCarcassFlex,
      tireLoadFeedback: this.tireLoadFeedback,
      steeringLoadFeedback: this.steeringLoadFeedback,
      steeringRackLoad: this.steeringRackLoad,
      steeringVelocity: this.steeringVelocity,
      steeringImpulse: this.steeringImpulse,
      controlActuationLoad: this.controlActuationLoad,
      pedalPressureLoad: this.pedalPressureLoad,
      steeringRatio: this.steeringRatio,
      selfAlignTorque: this.selfAlignTorque,
      yawInertiaLoad: this.yawInertiaLoad,
      yawDamping: this.yawDamping,
      counterSteerLoad: this.counterSteerLoad,
      slipRecovery: this.slipRecovery,
      chassisStability: this.chassisStability,
      roadAlignment: this.roadAlignment,
      roadCamber: surfaceBankAt(carLateral, track),
      roadCamberLoad: this.roadCamberLoad,
      roadGrade: this.roadGrade,
      roadLoad: this.roadLoad,
      roadCompression: this.roadCompression,
      roadGuidanceLoad: this.roadGuidanceLoad,
      roadFeelFeedback: this.roadFeelFeedback,
      roadTextureLoad: this.roadTextureLoad,
      chassisHeave: this.chassisHeave,
      rideSettling: this.rideSettling,
      suspensionLoad: this.suspensionLoad,
      suspensionTravel: this.suspensionTravel,
      suspensionVelocity: this.suspensionVelocity,
      damperImpulse: this.damperImpulse,
      aeroPlatformLoad: this.aeroPlatformLoad,
      floorSealLoad: this.floorSealLoad,
      floorStrikeLoad: this.floorStrikeLoad,
      frontAeroLoad: this.frontAeroLoad,
      rearAeroLoad: this.rearAeroLoad,
      aeroBalance: this.aeroBalance,
      aeroWashout: this.aeroWashout,
      aeroBuffetLoad: this.aeroBuffetLoad,
      aeroYawStall: this.aeroYawStall,
      frontAxleLoad: this.frontAxleLoad,
      rearAxleLoad: this.rearAxleLoad,
      axleLoadSaturation: this.axleLoadSaturation,
      longitudinalLoadTransfer: this.longitudinalLoadTransfer,
      lateralLoadTransfer: this.lateralLoadTransfer,
      outsideTireLoad: this.outsideTireLoad,
      insideWheelUnload: this.insideWheelUnload,
      brakeBalanceLoad: this.brakeBalanceLoad,
      frontLockRisk: this.frontLockRisk,
      rearBrakeStability: this.rearBrakeStability,
      roadWetness: this.dynamicRoadWetness(),
      standingWater: this.standingWater,
      hydroplaneLoad: this.hydroplaneLoad,
      rainIntensity: this.session.weather.rainIntensity,
      trackRubber: this.trackRubber,
      dryingLine: this.dryingLine,
      trackEvolutionState: this.trackEvolutionState(),
      rubberedLineGrip: gripContext.rubberedLineGrip,
      marbles: gripContext.marbles,
      dirtyTirePickup: this.dirtyTirePickup,
      gripState: this.gripState(gripContext),
      launchCharge: this.launchCharge,
      launchQuality: this.launchQuality,
      assistName: this.session.assist.name,
      assistSteer: this.latestAssist.steer,
      assistBrake: this.latestAssist.brake,
      assistThrottleTrim: this.latestAssist.throttleTrim,
      skyColor: this.session.weather.skyColor,
      fogColor: this.session.weather.fogColor,
      grassColor: this.session.weather.grassColor,
      lightIntensity: this.session.weather.lightIntensity,
      speedKph: Math.round(this.speed),
      gear: this.gear(),
      rpm: this.rpm(),
      ers: this.ers,
      aeroBoostAvailable: this.aeroBoostAvailable,
      aeroBoostActive: this.aeroBoostActive,
      aeroDragReduction: this.aeroDragReduction,
      shiftCut: this.shiftCut,
      tractionBite: this.tractionBite,
      rearTractionRotation: this.rearTractionRotation,
      driveTorqueLoad: this.driveTorqueLoad,
      differentialLock: this.differentialLock,
      insideRearSlip: this.insideRearSlip,
      engineBraking: this.engineBraking,
      trailBraking: this.trailBraking,
      thresholdBraking: this.thresholdBraking,
      liftOffRotationLoad: this.liftOffRotationLoad,
      throttlePickupLoad: this.throttlePickupLoad,
      powerUndersteerLoad: this.powerUndersteerLoad,
      pedalOverlapLoad: this.pedalOverlapLoad,
      drivetrainCompliance: this.drivetrainCompliance,
      powerState: this.powerState(),
      tireTemp: this.tireTemp,
      tireThermalLoad: this.tireThermalLoad,
      tireWear: this.tireWear,
      tireState: this.tireState(),
      fuelLoad: this.fuelLoad,
      fuelMassKg: this.fuelMassKg(),
      fuelState: this.fuelState(),
      brakeTemp: this.brakeTemp,
      brakeFade: this.brakeFade,
      brakeBite: this.brakeBite,
      brakeState: this.brakeState(),
      grip: this.grip,
      flowScore: this.flowScore,
      flowState: this.flowState(),
      draft: this.draft,
      dirtyAir: this.dirtyAir,
      airState: this.airState(),
      racecraftState: this.racecraftState(),
      rivalProximity: this.rivalProximity,
      sideBySide: this.sideBySide,
      contactRisk: this.contactRisk,
      frontWingDamage: this.frontWingDamage,
      downforceLoss: this.downforceLoss,
      damageState: this.damageState(),
      defensiveRivals: this.defensiveRivalCount(),
      nearestRivalGapMeters: this.nearestRivalGapMeters(),
      onTrack: Math.abs(this.x - track.center) <= track.halfWidth,
      lapTime: this.lapTime,
      bestLap: this.bestLap,
      totalTime: this.totalTime,
      delta,
      splitDelta: this.splitDelta,
      trackOffset: this.z,
      curve: track.curve,
      carX: carLateral,
      overtakeStreak: this.overtakeStreak,
      trackSection: track.section.name,
      trackSector: track.section.sector,
      trackCue: this.trackCue(track),
      trackInstruction: track.section.instruction,
      cornerPhase: track.cornerPhase,
      targetSpeedKph: track.targetSpeedKph,
      paceDeltaKph: Math.round(this.speed - track.targetSpeedKph),
      brakingZone: track.brakingZone,
      cleanLap: this.cleanLap,
      trackLimitWarnings: this.trackLimitWarnings,
      penaltySeconds: director.penaltySeconds,
      nextCheckpoint: director.nextCheckpoint.name,
      nextCheckpointDistance: director.nextCheckpoint.distance,
      nextCheckpointIndex: director.checkpointIndex,
      checkpointCount: director.checkpointCount,
      checkpointProgress: `${Math.min(director.checkpointIndex + 1, director.checkpointCount)}/${director.checkpointCount}`,
      sectorSplits: director.sectorSplits,
      lastSector: this.lastSector,
      lastSectorTime: this.lastSectorTime,
      lastSectorDelta: this.lastSectorDelta,
      sectorPaceScore: this.sectorPaceScore,
      sectorPaceState: this.sectorPaceState,
      lapValid: director.lapValid,
      lapProgress: director.lapProgress,
      raceProgress: director.raceProgress,
      objective: this.position <= 3 ? "Hold podium pace" : `Catch P${Math.max(3, this.position - 1)}`,
      message: this.messageTimer > 0 ? this.message : "",
      cameraSnap: this.cameraSnapTimer > 0,
      car: {
        x: this.x,
        y: surfaceHeightAt(this.z, carLateral, track, 0.065),
        z: this.z,
        bank: surfaceBankAt(carLateral, track),
        heading: this.heading,
        yawRate: this.yawRate,
        pitch: this.chassisPitch,
        roll: this.chassisRoll,
        slip: this.slip,
        steering: this.phase === "racing" ? this.lastSteering : 0,
        braking: this.phase === "racing" ? this.lastBrake : 0,
        throttle: this.phase === "racing" ? this.lastThrottle : 0,
        wheelspin: this.wheelspin,
        understeer: this.understeer,
        lockup: this.lockup
      },
      leaderboard: this.leaderboard(),
      rivals: this.rivals.map((rival) => {
        const rivalTrack = sampleTrack(rival.distance);
        return {
          id: rival.id,
          driver: rival.driver,
          team: rival.team,
          x: rivalTrack.center + rival.lane,
          y: surfaceHeightAt(rival.distance, rival.lane, rivalTrack, 0.055),
          z: rival.distance,
          bank: surfaceBankAt(rival.lane, rivalTrack),
          heading: -trackCurveAt(rival.distance) * 0.8,
          color: rival.color,
          gap: (rival.distance - this.z) / 42,
          speedKph: Math.round(rival.speed)
        };
      })
    };
  }

  reset() {
    this.phase = "ready";
    this.countdown = 0;
    this.lap = 1;
    this.position = 8;
    this.speed = 0;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.lateralVelocity = 0;
    this.yawRate = 0;
    this.slip = 0;
    this.wheelspin = 0;
    this.understeer = 0;
    this.lockup = 0;
    this.launchCharge = 0;
    this.launchQuality = 0;
    this.draft = 0;
    this.dirtyAir = 0;
    this.aeroBuffetLoad = 0;
    this.rivalProximity = 0;
    this.sideBySide = 0;
    this.contactRisk = 0;
    this.racecraftCooldown = 0;
    this.damageMessageCooldown = 0;
    this.raceControlCooldown = 0;
    this.positionGainLockout = 0;
    this.cameraSnapTimer = 0;
    this.flowScore = 0.62;
    this.surfaceRumble = 0;
    this.surfaceEdgeLoad = 0;
    this.splitSurfaceLoad = 0;
    this.grip = 1;
    this.ers = 1;
    this.aeroBoostAvailable = false;
    this.aeroBoostActive = 0;
    this.aeroDragReduction = 0;
    this.currentGear = 1;
    this.shiftCut = 0;
    this.tractionBite = 0;
    this.engineBraking = 0;
    this.trailBraking = 0;
    this.thresholdBraking = 0;
    this.liftOffRotationLoad = 0;
    this.throttlePickupLoad = 0;
    this.powerUndersteerLoad = 0;
    this.pedalOverlapLoad = 0;
    this.drivetrainCompliance = 0;
    this.rearTractionRotation = 0;
    this.driveTorqueLoad = 0;
    this.differentialLock = 0;
    this.insideRearSlip = 0;
    this.tireTemp = 0.52;
    this.tireThermalLoad = 0;
    this.tireWear = 0;
    this.fuelLoad = 1;
    this.brakeTemp = 0.34;
    this.brakeFade = 0;
    this.brakeBite = 0.896;
    this.brakeReleaseShock = 0;
    this.controlSteer = 0;
    this.controlThrottle = 0;
    this.controlBrake = 0;
    this.lastSteering = 0;
    this.trackRubber = 0;
    this.dryingLine = 0;
    this.standingWater = 0;
    this.hydroplaneLoad = 0;
    this.dirtyTirePickup = 0;
    this.roadAdhesion = 1;
    this.lateralScrub = 0;
    this.slipAngle = 0;
    this.velocityYaw = 0;
    this.forwardBite = 1;
    this.longitudinalGrip = 1;
    this.longitudinalSlipLoad = 0;
    this.tireContactGrip = 1;
    this.tireRunoffShare = 0;
    this.tireGroundContact = 1;
    this.tireForceLoad = 0;
    this.combinedSlipLoad = 0;
    this.tireGripReserve = 1;
    this.tirePressure = 1;
    this.tireContactPatch = 1;
    this.tirePressureLoad = 0;
    this.tireSaturation = 0;
    this.tireRelaxation = 0;
    this.tireResponseLoad = 0;
    this.tireCarcassFlex = 0;
    this.tireLoadFeedback = 0;
    this.steeringLoadFeedback = 0;
    this.steeringRackLoad = 0;
    this.steeringVelocity = 0;
    this.steeringImpulse = 0;
    this.controlActuationLoad = 0;
    this.pedalPressureLoad = 0;
    this.steeringRatio = 1;
    this.selfAlignTorque = 0;
    this.yawInertiaLoad = 0;
    this.yawDamping = 1;
    this.counterSteerLoad = 0;
    this.slipRecovery = 0;
    this.chassisStability = 1;
    this.roadAlignment = 1;
    this.roadCamberLoad = 0;
    this.roadGrade = 0;
    this.roadLoad = 1;
    this.roadCompression = 0;
    this.roadGuidanceLoad = 0;
    this.roadFeelFeedback = 0;
    this.roadTextureLoad = 0;
    this.roadTexturePhase = 0;
    this.chassisHeave = 0;
    this.rideSettling = 0;
    this.suspensionLoad = 1;
    this.suspensionTravel = 0;
    this.suspensionVelocity = 0;
    this.damperImpulse = 0;
    this.aeroPlatformLoad = 0;
    this.floorSealLoad = 0;
    this.floorStrikeLoad = 0;
    this.frontAeroLoad = 0;
    this.rearAeroLoad = 0;
    this.aeroBalance = 0;
    this.aeroWashout = 0;
    this.aeroBuffetLoad = 0;
    this.aeroYawStall = 0;
    this.frontAxleLoad = 1;
    this.rearAxleLoad = 1;
    this.axleLoadSaturation = 0;
    this.longitudinalLoadTransfer = 0;
    this.lateralLoadTransfer = 0;
    this.outsideTireLoad = 0;
    this.insideWheelUnload = 0;
    this.brakeBalanceLoad = 0;
    this.frontLockRisk = 0;
    this.rearBrakeStability = 1;
    this.chassisPitch = 0;
    this.chassisRoll = 0;
    this.frontWingDamage = 0;
    this.downforceLoss = 0;
    this.lapTime = 0;
    this.bestLap = null;
    this.splitDelta = null;
    this.previousSectorTime = 0;
    this.lastSector = null;
    this.lastSectorTime = null;
    this.lastSectorDelta = null;
    this.sectorPaceScore = 0;
    this.sectorPaceState = "Build sector";
    this.totalTime = 0;
    this.overtakeStreak = 0;
    this.trackLimitWarnings = 0;
    this.offTrackTime = 0;
    this.cleanLap = true;
    this.message = "Hold throttle to launch";
    this.messageTimer = 0;
    this.lastBrake = 0;
    this.lastThrottle = 0;
    this.latestAssist = { steer: 0, brake: 0, throttleTrim: 0 };
    this.rivals = createRivals();
    this.director.reset();
  }

  private updateLaunchCharge(dt: number, throttle: number) {
    const target = clamp(throttle, 0, 1);
    const response = target > this.launchCharge ? 2.4 : 4.6;
    this.launchCharge = approach(this.launchCharge, target, dt * response);
    const ideal = this.idealLaunchCharge();
    this.launchQuality = clamp(1 - Math.abs(this.launchCharge - ideal) / 0.42, 0, 1);
  }

  private applyLaunch() {
    const ideal = this.idealLaunchCharge();
    const underCharge = clamp((ideal - this.launchCharge) / ideal, 0, 1);
    const overCharge = clamp((this.launchCharge - ideal) / Math.max(0.2, 1 - ideal), 0, 1);
    const quality = clamp(1 - underCharge * 0.86 - overCharge * (0.42 + this.session.weather.roadWetness * 0.5), 0.34, 1);
    const wetSpin = overCharge * (0.18 + this.session.weather.roadWetness * 0.82);

    this.launchQuality = quality;
    this.wheelspin = Math.max(this.wheelspin, wetSpin);
    this.slip = Math.max(this.slip, wetSpin * 0.58);
    this.grip = clamp(this.grip - wetSpin * 0.18, 0.52, 1);
    this.speed = Math.max(0, 26 + quality * 34 - wetSpin * 10);
    this.controlThrottle = Math.max(this.controlThrottle, this.launchCharge);
    this.controlBrake = 0;
    this.controlSteer = 0;
    this.cameraSnapTimer = 0.35;

    if (quality > 0.86) {
      this.message = "Perfect launch";
    } else if (overCharge > 0.34) {
      this.message = "Wheelspin off the line";
    } else if (underCharge > 0.36) {
      this.message = "Bogged launch";
    } else {
      this.message = "Lights out";
    }
  }

  private idealLaunchCharge() {
    return 0.74 - this.session.weather.roadWetness * 0.14;
  }

  private updateDriving(dt: number, actions: RaceActions) {
    const rawThrottleInput = clamp(actions.throttle, 0, 1);
    const rawBrakeInput = clamp(actions.brake, 0, 1);
    const rawSteerInput = clamp(actions.steer, -1, 1);
    const track = sampleTrack(this.z);
    const assist = this.drivingAssist(track, rawThrottleInput, rawBrakeInput, rawSteerInput);
    const throttleTarget = clamp(rawThrottleInput * (1 - assist.throttleTrim), 0, 1);
    const brakeTarget = clamp(Math.max(rawBrakeInput, assist.brake), 0, 1);
    const steerTarget = rawSteerInput;

    const surface = this.drivingSurface(track);
    const onTrack = surface.trackLegal;
    const carLateral = this.x - track.center;
    const offTrackDistance = Math.max(0, Math.abs(carLateral) - track.halfWidth);
    const offTrackSide = Math.sign(carLateral) || 1;
    const roadRecoveryNeed = clamp((offTrackDistance - 0.12) / 2.7, 0, 1);
    const tireContact = this.sampleTireContactPatch(carLateral);
    this.tireContactGrip = approach(this.tireContactGrip, tireContact.grip, dt * (tireContact.grip < this.tireContactGrip ? 12 : 6));
    this.tireRunoffShare = approach(this.tireRunoffShare, tireContact.runoffShare, dt * 12);
    const roadCamber = surfaceBankAt(carLateral, track);
    this.positionGainLockout = Math.max(0, this.positionGainLockout - dt);
    this.raceControlCooldown = Math.max(0, this.raceControlCooldown - dt);
    if (!onTrack) {
      this.positionGainLockout = Math.max(this.positionGainLockout, 3.4);
    }
    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const edgeTarget = clamp(this.trackEdgeLoad(track, surface, speedRatio) * 0.55 + tireContact.edgeLoad * 0.65 + tireContact.heightSpread * 0.18, 0, 1);
    this.surfaceEdgeLoad = approach(this.surfaceEdgeLoad, edgeTarget, dt * (edgeTarget > this.surfaceEdgeLoad ? 18 : 7));
    const contactRoughness = clamp(Math.max(surface.roughness, tireContact.roughness) + tireContact.heightSpread * 0.16, 0, 1);
    const splitSurfaceGate = clamp(tireContact.edgeLoad * 1.25 + tireContact.runoffShare * 0.65 + contactRoughness * 0.82, 0, 1);
    const splitSurfaceLoadTarget = clamp(
      (tireContact.sideBias * (0.58 + speedRatio * 0.34 + contactRoughness * 0.24) +
        tireContact.heightRollBias * (0.74 + speedRatio * 0.36)) *
        clamp(0.28 + speedRatio * 0.72, 0, 1) *
        splitSurfaceGate,
      -1,
      1
    );
    this.splitSurfaceLoad = approach(
      this.splitSurfaceLoad,
      splitSurfaceLoadTarget,
      dt * (Math.abs(splitSurfaceLoadTarget) > Math.abs(this.splitSurfaceLoad) ? 14 : 6)
    );
    this.updateTrackEvolution(dt, speedRatio, onTrack, contactRoughness);
    const roadWetness = this.dynamicRoadWetness();
    const standingWaterTarget = roadWetness * tireContact.standingWater * (1 - this.dryingLine * 0.28);
    this.standingWater = approach(this.standingWater, standingWaterTarget, dt * (standingWaterTarget > this.standingWater ? 18 : 7));
    const hydroplaneSpeedWindow = clamp((this.speed - 128) / 142, 0, 1);
    const hydroplaneWaterFilm = clamp(this.standingWater * 1.25 + roadWetness * 0.18 - this.dryingLine * 0.12, 0, 1);
    const hydroplaneContactRelief = clamp(1.08 - this.tireContactPatch * 0.34 + Math.max(0, this.tirePressure - 1.02) * 0.65, 0.68, 1.18);
    const hydroplaneLoadTarget = onTrack
      ? clamp(
          hydroplaneWaterFilm *
            hydroplaneSpeedWindow *
            hydroplaneContactRelief *
            clamp(0.72 + Math.max(throttleTarget, brakeTarget, Math.abs(steerTarget)) * 0.28, 0.72, 1),
          0,
          1
        )
      : 0;
    this.hydroplaneLoad = approach(
      this.hydroplaneLoad,
      hydroplaneLoadTarget,
      dt * (hydroplaneLoadTarget > this.hydroplaneLoad ? 13 : 5.2)
    );
    const gripContext = this.trackGripContext(track);
    this.updateDirtyTirePickup(dt, gripContext, speedRatio, onTrack, contactRoughness, roadWetness);
    const previousBrake = this.lastBrake;
    const previousThrottle = this.lastThrottle;
    const controls = this.updateControlResponse(
      dt,
      throttleTarget,
      brakeTarget,
      steerTarget,
      speedRatio,
      roadWetness,
      contactRoughness,
      Math.abs(assist.steer) + assist.brake + assist.throttleTrim
    );
    const throttle = controls.throttle;
    const brake = controls.brake;
    const counterSteerIntent =
      controls.steer !== 0 && Math.abs(this.slipAngle) > 0.045 && Math.sign(controls.steer) !== Math.sign(this.slipAngle);
    const highSpeedSteeringRatioWindow =
      onTrack && roadRecoveryNeed < 0.08 && brake < 0.18 && this.liftOffRotationLoad < 0.08 && !counterSteerIntent
        ? clamp((speedRatio - 0.58) / 0.28, 0, 1)
        : 0;
    const steeringRatioTarget = clamp(
      1 -
        highSpeedSteeringRatioWindow *
          (0.18 +
            this.steeringRackLoad * 0.04 +
            this.tireSaturation * 0.035 +
            this.frontLockRisk * 0.025) +
        roadRecoveryNeed * 0.12 +
        (onTrack ? 0 : 0.05),
      0.76,
      1.04
    );
    this.steeringRatio = approach(
      this.steeringRatio,
      steeringRatioTarget,
      dt * (steeringRatioTarget < this.steeringRatio ? 14 : counterSteerIntent ? 18 : 5.2)
    );
    const steeringRatioLoad = 1 - this.steeringRatio;
    const steer = clamp(controls.steer + assist.steer, -1, 1);
    const rawSteer = steer;
    this.lastSteering = steer;
    this.lastBrake = brake;
    this.lastThrottle = throttle;
    const boost = actions.ers && throttle > 0.1 && brake < 0.1 && this.ers > 0.03 ? 1 : 0;
    this.updateFuelLoad(dt, throttle, boost, speedRatio);
    this.updatePowertrainState(dt, throttle, brake, roadWetness, onTrack, contactRoughness);
    this.updateEngineBraking(dt, previousThrottle, throttle, throttleTarget, brake, speedRatio, roadWetness, onTrack);
    const fuelWeightPenalty = this.fuelLoad * 0.075;
    const overspeed = clamp((this.speed - track.targetSpeedKph) / 120, 0, 1);
    const grade = (sampleTrack(this.z + 14).elevation - sampleTrack(this.z - 14).elevation) / 28;
    const rearGrade = (sampleTrack(this.z - 8).elevation - sampleTrack(this.z - 38).elevation) / 30;
    const frontGrade = (sampleTrack(this.z + 38).elevation - sampleTrack(this.z + 8).elevation) / 30;
    const profileBend = clamp((frontGrade - rearGrade) * 12, -0.34, 0.34);
    const profileLoadTarget = clamp(1 + profileBend * speedRatio * speedRatio - this.surfaceEdgeLoad * 0.035, 0.72, 1.28);
    const previousRoadCompression = this.roadCompression;
    this.roadLoad = approach(this.roadLoad, profileLoadTarget, dt * (profileLoadTarget < this.roadLoad ? 9 : 7));
    this.roadCompression = approach(this.roadCompression, clamp(this.roadLoad - 1, -0.28, 0.28), dt * 8);
    this.roadGrade = approach(this.roadGrade, grade, dt * 7);
    const aeroBoostSpeedThreshold = 150 - roadWetness * 26;
    this.aeroBoostAvailable =
      onTrack &&
      track.section.kind === "straight" &&
      !track.brakingZone &&
      Math.abs(track.curve) < 0.045 &&
      this.speed > aeroBoostSpeedThreshold &&
      throttle > 0.52 &&
      brake < 0.08 &&
      this.grip > 0.48;
    const aeroTarget = this.aeroBoostAvailable && boost ? 1 : 0;
    this.aeroBoostActive = approach(this.aeroBoostActive, aeroTarget, dt * (aeroTarget > this.aeroBoostActive ? 18 : 5));
    this.aeroDragReduction = this.aeroBoostActive * (8 + speedRatio * speedRatio * 26);
    const air = this.raceAirEffect(track);
    this.draft = approach(this.draft, air.draft, dt * 4.2);
    this.dirtyAir = approach(this.dirtyAir, air.dirtyAir, dt * 5.4);
    const racecraft = this.racecraftPressure();
    this.rivalProximity = approach(this.rivalProximity, racecraft.proximity, dt * 7.2);
    this.sideBySide = approach(this.sideBySide, racecraft.sideBySide, dt * 8.2);
    this.contactRisk = approach(this.contactRisk, racecraft.contactRisk, dt * 9.5);
    const aeroBuffetTarget = onTrack
      ? clamp(
          (this.dirtyAir * 0.9 + this.sideBySide * 0.06) *
            Math.pow(speedRatio, 1.18) *
            (0.72 + Math.abs(steer) * 0.28),
          0,
          1
        )
      : 0;
    this.aeroBuffetLoad = approach(
      this.aeroBuffetLoad,
      aeroBuffetTarget,
      dt * (aeroBuffetTarget > this.aeroBuffetLoad ? 9.2 : 4.2)
    );
    this.racecraftCooldown = Math.max(0, this.racecraftCooldown - dt);
    this.damageMessageCooldown = Math.max(0, this.damageMessageCooldown - dt);
    if (this.contactRisk > 0.7 && this.racecraftCooldown === 0) {
      this.message = this.contactRisk > 0.88 ? "Avoid contact" : "Wheel to wheel";
      this.messageTimer = 0.85;
      this.racecraftCooldown = 2.1;
    }
    const contactImpact = clamp((this.contactRisk - 0.48) / 0.52, 0, 1) * clamp((this.speed - 80) / 170, 0, 1) * (0.35 + this.sideBySide * 0.65);
    if (contactImpact > 0.04) {
      const previousDamage = this.frontWingDamage;
      this.frontWingDamage = clamp(this.frontWingDamage + contactImpact * dt * 0.18, 0, 1);
      if (this.frontWingDamage > Math.max(0.16, previousDamage + 0.04) && this.damageMessageCooldown === 0) {
        this.message = this.frontWingDamage > 0.45 ? "Front wing damage" : "Front wing scrape";
        this.messageTimer = 1.2;
        this.damageMessageCooldown = 4;
      }
    }
    this.downforceLoss = this.frontWingDamage * (0.06 + speedRatio * 0.18);
    const yawSlipLoad = clamp(
      clamp((Math.abs(this.slipAngle) - 0.11) / 0.3, 0, 1) * 0.48 +
        clamp((Math.abs(this.yawRate) - 0.18) / 0.4, 0, 1) * 0.2 +
        Math.max(0, Math.abs(this.rearTractionRotation) - 0.06) * 0.32 +
        Math.max(0, this.counterSteerLoad - 0.08) * 0.12 +
        Math.max(0, this.lateralScrub - 0.18) * 0.18 +
        this.aeroBuffetLoad * 0.08,
      0,
      1
    );
    const aeroYawStallTarget = onTrack ? clamp(yawSlipLoad * Math.pow(speedRatio, 1.18), 0, 1) : 0;
    this.aeroYawStall = approach(
      this.aeroYawStall,
      aeroYawStallTarget,
      dt * (aeroYawStallTarget > this.aeroYawStall ? 8.5 : 4.6)
    );
    const aeroPlatformTarget = onTrack
      ? speedRatio *
        speedRatio *
        clamp(0.35 + this.roadAdhesion * 0.65, 0.25, 1) *
        (1 - this.surfaceEdgeLoad * 0.34) *
        (1 - this.tireRunoffShare * 0.38) *
        (1 - this.standingWater * 0.55) *
        (1 - this.hydroplaneLoad * 0.18) *
        (1 - this.downforceLoss * 0.75) *
        (1 - this.dirtyAir * 0.28)
      : 0;
    this.aeroPlatformLoad = approach(
      this.aeroPlatformLoad,
      aeroPlatformTarget,
      dt * (aeroPlatformTarget > this.aeroPlatformLoad ? 5.5 : 10)
    );
    const sealDisruption = clamp(
      this.surfaceEdgeLoad * 0.24 +
        this.tireRunoffShare * 0.22 +
        Math.max(0, 1 - this.tireGroundContact) * 0.3 +
        this.damperImpulse * 0.2 +
        this.floorStrikeLoad * 0.34 +
        this.roadTextureLoad * 0.08 +
        this.rideSettling * 0.08 +
        Math.abs(this.suspensionVelocity) * 0.08 +
        this.insideWheelUnload * 0.1 +
        this.standingWater * 0.18 +
        this.hydroplaneLoad * 0.12 +
        this.dirtyAir * 0.12,
      0,
      1
    );
    const floorSealTarget = onTrack
      ? clamp(this.aeroPlatformLoad * (0.64 + speedRatio * 0.36) * (1 - sealDisruption), 0, 1)
      : 0;
    this.floorSealLoad = approach(
      this.floorSealLoad,
      floorSealTarget,
      dt * (floorSealTarget > this.floorSealLoad ? 6.5 : 12.5)
    );
    const rideHeightAeroLoss = clamp(
      Math.max(0, 1 - this.tireGroundContact) * 0.58 +
        this.damperImpulse * 0.24 +
        this.floorStrikeLoad * 0.34 +
        Math.abs(this.suspensionVelocity) * 0.08 +
        this.roadTextureLoad * 0.08 +
        this.rideSettling * 0.07 +
        this.surfaceEdgeLoad * 0.16 +
        this.standingWater * 0.18 +
        this.hydroplaneLoad * 0.12 +
        this.downforceLoss * 0.7,
      0,
      1
    );
    const aeroWashoutTarget = clamp(
      this.dirtyAir * (0.38 + speedRatio * 0.36) +
        rideHeightAeroLoss * 0.55 +
        this.frontWingDamage * (0.24 + speedRatio * 0.22),
      0,
      1
    );
    this.aeroWashout = approach(this.aeroWashout, aeroWashoutTarget, dt * (aeroWashoutTarget > this.aeroWashout ? 10.5 : 5.8));
    const frontAeroTarget =
      this.aeroPlatformLoad *
      clamp(
        0.52 +
          speedRatio * 0.42 +
          Math.max(0, this.longitudinalLoadTransfer) * 0.14 -
          Math.max(0, -this.longitudinalLoadTransfer) * 0.08 -
          this.frontWingDamage * 0.46 -
          this.dirtyAir * 0.24 -
          this.aeroWashout * 0.34,
        0,
        1.15
      );
    const rearAeroTarget =
      this.aeroPlatformLoad *
      clamp(
        0.62 +
          speedRatio * 0.34 +
          Math.max(0, -this.longitudinalLoadTransfer) * 0.12 +
          throttle * 0.06 +
          this.aeroBoostActive * 0.08 -
          this.dirtyAir * 0.1 -
          this.downforceLoss * 0.2 -
          this.aeroWashout * 0.22,
        0,
        1.18
      );
    this.frontAeroLoad = approach(this.frontAeroLoad, frontAeroTarget, dt * (frontAeroTarget > this.frontAeroLoad ? 7.5 : 10));
    this.rearAeroLoad = approach(this.rearAeroLoad, rearAeroTarget, dt * (rearAeroTarget > this.rearAeroLoad ? 7 : 8.5));
    this.aeroBalance = approach(this.aeroBalance, clamp((this.frontAeroLoad - this.rearAeroLoad) * 0.85, -0.6, 0.6), dt * 8);
    const crestUnload = Math.max(0, 1 - this.roadLoad);
    const compressionLoad = Math.max(0, this.roadLoad - 1);
    const tireGroundContactTarget = onTrack
      ? clamp(
          1 -
            crestUnload * (0.82 + speedRatio * 0.26) -
            Math.max(0, -this.roadCompression) * (0.28 + speedRatio * 0.22) -
            Math.max(0, -this.suspensionVelocity) * (0.045 + speedRatio * 0.04) -
            this.damperImpulse * (0.025 + speedRatio * 0.035) -
            this.floorStrikeLoad * (0.03 + speedRatio * 0.045) -
            this.roadTextureLoad * (0.018 + speedRatio * 0.02) -
            this.rideSettling * 0.018 -
            this.surfaceEdgeLoad * 0.025 +
            compressionLoad * 0.06 -
            this.hydroplaneLoad * (0.08 + speedRatio * 0.08) +
            Math.max(0, this.suspensionVelocity) * 0.018 +
            this.aeroPlatformLoad * 0.11,
          0.68,
          1.08
        )
      : clamp(0.88 + this.tireContactGrip * 0.12 - this.surfaceEdgeLoad * 0.03, 0.78, 1);
    this.tireGroundContact = approach(
      this.tireGroundContact,
      tireGroundContactTarget,
      dt * (tireGroundContactTarget < this.tireGroundContact ? 13 : 6.5)
    );
    const throttleRelease = clamp((previousThrottle - throttle) * (0.72 + speedRatio * 0.52), 0, 1);
    const throttleRise = clamp((throttle - previousThrottle) * (0.78 + speedRatio * 0.56), 0, 1);
    const transferTarget = clamp(
      brake * (0.32 + speedRatio * 0.64) +
        throttleRelease * (0.22 + speedRatio * 0.28) +
        this.engineBraking * (0.1 + speedRatio * 0.24) -
        throttleRise * (0.1 + speedRatio * 0.16) * (1 - brake * 0.72) -
        throttle * (0.14 + speedRatio * 0.16) * (1 - brake * 0.72) -
        this.aeroPlatformLoad * 0.035,
      -0.28,
      0.42
    );
    this.longitudinalLoadTransfer = approach(
      this.longitudinalLoadTransfer,
      transferTarget,
      dt * (transferTarget > this.longitudinalLoadTransfer ? 8.5 : 6.2)
    );
    this.frontAxleLoad = approach(
      this.frontAxleLoad,
      clamp(1 + this.longitudinalLoadTransfer * 0.58 + this.frontAeroLoad * 0.12 - this.aeroWashout * 0.04 - this.downforceLoss * 0.12, 0.72, 1.34),
      dt * 8
    );
    this.rearAxleLoad = approach(
      this.rearAxleLoad,
      clamp(1 - this.longitudinalLoadTransfer * 0.5 + throttle * 0.08 + this.rearAeroLoad * 0.1 - this.aeroWashout * 0.03, 0.74, 1.3),
      dt * 8
    );
    const trailBrakeTarget = clamp(
      brake *
        Math.abs(steer) *
        speedRatio *
        (0.48 + speedRatio * 0.24) *
        (0.78 + this.frontAxleLoad * 0.22) *
        (1 - this.tireRunoffShare * 0.28) *
        (onTrack ? 1 : 0.55 + this.tireContactGrip * 0.28),
      0,
      1
    );
    this.trailBraking = approach(
      this.trailBraking,
      trailBrakeTarget,
      dt * (trailBrakeTarget > this.trailBraking ? 11 : 5.2)
    );
    const trailBrakeSupport = this.trailBraking * clamp(1 - this.lockup * 0.55 - roadWetness * 0.22, 0.35, 1);
    const trailBrakeInstability = this.trailBraking * (0.28 + this.lockup * 0.55 + roadWetness * 0.25);
    const pedalOverlapTarget = clamp(
      Math.min(throttleTarget, brakeTarget) *
        clamp((this.speed - 18) / 130, 0.12, 1) *
        (0.72 + speedRatio * 0.42) *
        (onTrack ? 1 : 0.58 + this.tireContactGrip * 0.28),
      0,
      1
    );
    this.pedalOverlapLoad = approach(
      this.pedalOverlapLoad,
      pedalOverlapTarget,
      dt * (pedalOverlapTarget > this.pedalOverlapLoad ? 13 : 4.6)
    );

    const driverDemand = Math.max(throttle, brake, Math.abs(steer));
    const tractionStress = throttle * speedRatio * (track.section.kind === "straight" ? 0.22 : track.section.difficulty);
    const cornerDemand = track.section.kind === "straight" ? 0.18 : track.section.difficulty;
    const liftOffRotationTarget = clamp(
      throttleRelease *
        Math.abs(steer) *
        speedRatio *
        (0.42 + speedRatio * 0.44 + cornerDemand * 0.34) *
        (0.78 + Math.max(0, this.longitudinalLoadTransfer) * 0.92 + this.engineBraking * 0.58) *
        3.8 *
        (1 - brake * 0.72) *
        (1 - this.pedalOverlapLoad * 0.28) *
        (onTrack ? 1 : 0.52 + this.tireContactGrip * 0.32),
      0,
      1
    );
    this.liftOffRotationLoad = approach(
      this.liftOffRotationLoad,
      liftOffRotationTarget,
      dt * (liftOffRotationTarget > this.liftOffRotationLoad ? 18 : 2.15 + throttle * 1.5 + this.throttlePickupLoad * 4.2)
    );
    const throttlePickupTarget = clamp(
      throttleRise *
        speedRatio *
        (0.42 + throttle * 0.38 + Math.abs(steer) * 0.24 + cornerDemand * 0.16) *
        (0.38 + this.liftOffRotationLoad * 1.16 + this.engineBraking * 0.42 + Math.max(0, this.longitudinalLoadTransfer) * 0.34) *
        5.6 *
        (1 - brake * 0.82) *
        (1 - this.pedalOverlapLoad * 0.28) *
        (onTrack ? 1 : 0.5 + this.tireContactGrip * 0.32),
      0,
      1
    );
    this.throttlePickupLoad = approach(
      this.throttlePickupLoad,
      throttlePickupTarget,
      dt * (throttlePickupTarget > this.throttlePickupLoad ? 15 : 2.35)
    );
    const throttlePickupSettle = this.throttlePickupLoad * clamp(1 - throttle * 0.18 - this.wheelspin * 0.34 - this.tireSaturation * 0.18, 0.28, 1);
    const throttlePickupShock = this.throttlePickupLoad * throttle * clamp(0.62 + this.liftOffRotationLoad * 0.8 + Math.abs(steer) * 0.24, 0.42, 1.35);
    const longitudinalForceDemand =
      throttle * (0.18 + speedRatio * 0.22 + boost * 0.08) +
      brake * (0.36 + speedRatio * 0.52) +
      this.pedalOverlapLoad * (0.22 + speedRatio * 0.3) +
      this.pedalPressureLoad * (0.035 + speedRatio * 0.08);
    const controlLoadForceDemand = this.controlActuationLoad * (0.035 + speedRatio * 0.075);
    const signedLateralLoadTarget = clamp(
      (steer * speedRatio * speedRatio * (0.34 + cornerDemand * 0.62) +
        track.curve * speedRatio * (0.95 + cornerDemand * 0.5) +
        this.lateralVelocity * 0.018) *
        (1 + this.aeroPlatformLoad * 0.16) *
        (1 - this.tireRunoffShare * 0.24),
      -0.42,
      0.42
    );
    this.lateralLoadTransfer = approach(
      this.lateralLoadTransfer,
      signedLateralLoadTarget,
      dt * (Math.abs(signedLateralLoadTarget) > Math.abs(this.lateralLoadTransfer) ? 9.2 : 5.4)
    );
    const lateralLoad = Math.abs(this.lateralLoadTransfer);
    const lateralLoadStress = Math.max(0, lateralLoad - 0.3);
    const outsideTireLoadTarget = onTrack
      ? clamp(
          clamp((lateralLoad - 0.08) / 0.34, 0, 1) *
            (0.64 + speedRatio * 0.36) *
            (0.74 + Math.abs(rawSteer) * 0.26) *
            clamp(0.82 + this.tireGroundContact * 0.18, 0.82, 1.04),
          0,
          1
        )
      : 0;
    this.outsideTireLoad = approach(
      this.outsideTireLoad,
      outsideTireLoadTarget,
      dt * (outsideTireLoadTarget > this.outsideTireLoad ? 10.5 : 5.8)
    );
    const insideWheelUnloadTarget = clamp(
      (this.outsideTireLoad * 0.34 +
        lateralLoadStress * 0.18 +
        this.surfaceEdgeLoad * 0.1 +
        Math.abs(this.splitSurfaceLoad) * 0.12 +
        tireContact.heightSpread * 0.16 +
        Math.max(0, 1 - this.tireGroundContact) * 0.12 +
        this.roadCamberLoad * 0.05 -
        this.aeroPlatformLoad * 0.1) *
        (onTrack ? 1 : 0.54 + this.tireContactGrip * 0.28),
      0,
      1
    );
    this.insideWheelUnload = approach(
      this.insideWheelUnload,
      insideWheelUnloadTarget,
      dt * (insideWheelUnloadTarget > this.insideWheelUnload ? 12 : 6.2)
    );
    const frontAxleOverload = clamp((this.frontAxleLoad - 1.15) / 0.18, 0, 1);
    const rearAxleOverload = clamp((this.rearAxleLoad - 1.13) / 0.18, 0, 1);
    const axleLoadSaturationTarget = onTrack
      ? clamp(
          frontAxleOverload * 0.58 +
            rearAxleOverload * 0.42 +
            lateralLoadStress * 0.18 +
            this.outsideTireLoad * 0.08 +
            this.insideWheelUnload * 0.04 +
            Math.max(0, 1 - this.tireGroundContact) * 0.12 +
            this.damperImpulse * 0.08,
          0,
          1
        )
      : 0;
    this.axleLoadSaturation = approach(
      this.axleLoadSaturation,
      axleLoadSaturationTarget,
      dt * (axleLoadSaturationTarget > this.axleLoadSaturation ? 12 : 9)
    );
    const powerUndersteerSpeedWindow = clamp((this.speed - 72) / 126, 0, 1);
    const powerUndersteerTarget = clamp(
      throttle *
        Math.abs(steer) *
        speedRatio *
        powerUndersteerSpeedWindow *
        (0.24 + cornerDemand * 0.54 + overspeed * 0.34) *
        (0.58 + Math.max(0, -this.longitudinalLoadTransfer) * 0.76 + this.throttlePickupLoad * 0.48 + this.tractionBite * 0.22) *
        (1 - brake * 0.84) *
        (1 - this.trailBraking * 0.38) *
        clamp(1.05 - this.frontAeroLoad * 0.18 - Math.max(0, this.longitudinalLoadTransfer) * 0.26, 0.58, 1.05) *
        (onTrack ? 1 : 0.48 + this.tireContactGrip * 0.34),
      0,
      1
    );
    this.powerUndersteerLoad = approach(
      this.powerUndersteerLoad,
      powerUndersteerTarget,
      dt * (powerUndersteerTarget > this.powerUndersteerLoad ? 10.5 : 4.2)
    );
    const frontLoadGrip = clamp(
      0.9 + this.frontAxleLoad * 0.1 - Math.max(0, this.frontAxleLoad - 1.18) * 0.22 - this.powerUndersteerLoad * 0.03,
      0.8,
      1.06
    );
    const rearLoadGrip = clamp(0.88 + this.rearAxleLoad * 0.12 - Math.max(0, this.rearAxleLoad - 1.16) * 0.18, 0.82, 1.07);
    const pressureGripFactor = clamp(0.94 + this.tireContactPatch * 0.08 - this.tirePressureLoad * 0.035, 0.9, 1.04);
    const rearTractionSupport = clamp(
      0.86 +
        this.rearAxleLoad * 0.14 -
        Math.max(0, this.longitudinalLoadTransfer) * 0.12 -
        this.engineBraking * 0.035 -
        trailBrakeInstability * 0.045 +
        throttlePickupSettle * 0.08 -
        throttlePickupShock * this.tireSaturation * 0.04 +
        (this.tireContactPatch - 1) * 0.06 -
        this.tirePressureLoad * 0.015 -
        this.insideWheelUnload * 0.012,
      0.78,
      1.08
    );
    const driveTorqueLoadTarget = clamp(
      throttle *
        speedRatio *
        (0.18 +
          boost * 0.18 +
          Math.max(0, -this.longitudinalLoadTransfer) * 0.42 +
          Math.abs(steer) * speedRatio * 0.2 +
          this.tractionBite * 0.2 +
          this.throttlePickupLoad * 0.16 +
          Math.max(0, 1 - this.tireGripReserve) * 0.22) *
        (1 - brake * 0.82) *
        (1 - this.pedalOverlapLoad * 0.32),
      0,
      1
    );
    this.driveTorqueLoad = approach(this.driveTorqueLoad, driveTorqueLoadTarget, dt * (driveTorqueLoadTarget > this.driveTorqueLoad ? 11 : 5.2));
    const insideRearUnload = clamp(
      lateralLoad * (0.75 + speedRatio * 0.35) +
        Math.abs(steer) * speedRatio * 0.18 +
        Math.max(0, 1.02 - this.rearAxleLoad) * 0.42 +
        Math.max(0, 1 - this.tireGroundContact) * 0.28 +
        this.surfaceEdgeLoad * 0.12 -
        this.insideWheelUnload * 0.18 -
        this.rearAeroLoad * 0.12,
      0,
      1
    );
    const insideRearSlipTarget = clamp(
      this.driveTorqueLoad *
        (0.12 +
          insideRearUnload * 0.78 +
          this.tractionBite * 0.22 +
          this.tireSaturation * 0.16 +
          this.standingWater * 0.22 +
          (gripContext.marbles + this.dirtyTirePickup) * 0.14) *
        (1 - brake * 0.86) *
        (1 + this.pedalOverlapLoad * 0.42),
      0,
      1
    );
    this.insideRearSlip = approach(this.insideRearSlip, insideRearSlipTarget, dt * (insideRearSlipTarget > this.insideRearSlip ? 13 : 5.6));
    const differentialLockTarget = clamp(
      this.driveTorqueLoad *
        (0.28 +
          speedRatio * 0.12 +
          Math.abs(steer) * 0.22 +
          this.insideRearSlip * 0.44 +
          this.tractionBite * 0.24 +
          boost * 0.16 -
          this.tireRunoffShare * 0.08) *
        (1 - brake * 0.78) *
        (1 - this.pedalOverlapLoad * 0.18),
      0,
      1
    );
    this.differentialLock = approach(
      this.differentialLock,
      differentialLockTarget,
      dt * (differentialLockTarget > this.differentialLock ? 10.5 : 4.8)
    );
    const drivetrainComplianceTarget = clamp(
      this.shiftCut * throttle * 0.18 +
        throttlePickupShock * 0.26 +
        this.driveTorqueLoad * this.tireSaturation * 0.18 +
        this.insideRearSlip * 0.2 +
        this.pedalOverlapLoad * 0.24 +
        this.differentialLock * Math.abs(steer) * 0.08 +
        boost * throttle * speedRatio * 0.04,
      0,
      1
    );
    this.drivetrainCompliance = approach(
      this.drivetrainCompliance,
      drivetrainComplianceTarget,
      dt * (drivetrainComplianceTarget > this.drivetrainCompliance ? 12 : 4.6)
    );
    const rearTractionSpeedWindow = clamp((speedRatio - 0.08) / 0.18, 0, 1);
    const rearRotationDemand =
      throttle *
      Math.abs(steer) *
      speedRatio *
      rearTractionSpeedWindow *
      (0.24 + cornerDemand * 0.64) *
      (1 - brake * 0.82) *
      (1 - this.pedalOverlapLoad * 0.26);
    const rearTractionSlipWindow = clamp(
      0.34 +
        this.tractionBite * 0.34 +
        this.tireSaturation * 0.3 +
        this.wheelspin * 0.24 +
        this.driveTorqueLoad * 0.08 +
        rearAxleOverload * 0.16 +
        this.insideRearSlip * 0.5 +
        this.differentialLock * 0.12 +
        this.liftOffRotationLoad * 0.18 +
        Math.max(0, 1.02 - rearTractionSupport) * 0.75 +
        Math.max(0, 1 - this.tireGroundContact) * 0.26 -
        this.aeroPlatformLoad * 0.12,
      0.18,
      1
    );
    const rearTractionRotationTarget = clamp(
      steer *
        (rearRotationDemand + this.liftOffRotationLoad * speedRatio * 0.22) *
        rearTractionSlipWindow *
        (onTrack ? 1 : 0.45 + this.tireContactGrip * 0.28) *
        clamp(0.72 + this.rearAxleLoad * 0.22, 0.72, 1.05) *
        clamp(1 - rearAxleOverload * 0.08 - this.axleLoadSaturation * 0.04, 0.86, 1) *
        pressureGripFactor *
        clamp(0.94 + this.differentialLock * 0.14 + this.insideRearSlip * 0.12, 0.92, 1.18),
      -0.42,
      0.42
    );
    this.rearTractionRotation = approach(
      this.rearTractionRotation,
      rearTractionRotationTarget,
      dt * (Math.abs(rearTractionRotationTarget) > Math.abs(this.rearTractionRotation) ? 9.5 : 4.8)
    );
    const brakeDiscipline = clamp((brake - 0.28) / 0.5, 0, 1) * clamp(1 - Math.max(0, brake - 0.82) * 4.9, 0.08, 1);
    const thresholdBrakeTarget = clamp(
      brake *
        speedRatio *
        brakeDiscipline *
        clamp(0.72 + this.frontAxleLoad * 0.2 - this.rearAxleLoad * 0.04, 0.72, 1.05) *
        pressureGripFactor *
        clamp(1 - this.lockup * 0.95 - this.brakeFade * 0.18, 0, 1) *
        clamp(0.92 + this.brakeBite * 0.08, 0.86, 1.01) *
        (1 - roadWetness * 0.28) *
        (onTrack ? 1 : 0.35 + this.tireContactGrip * 0.4),
      0,
      1
    );
    this.thresholdBraking = approach(
      this.thresholdBraking,
      thresholdBrakeTarget,
      dt * (thresholdBrakeTarget > this.thresholdBraking ? 9.5 : 4.8)
    );
    const thresholdBrakeSupport = this.thresholdBraking * clamp(1 - this.lockup * 0.75 - this.brakeFade * 0.22, 0.28, 1);
    const steeringLoadDemand =
      Math.pow(Math.abs(rawSteer), 1.25) *
      speedRatio *
      speedRatio *
      (0.92 + speedRatio * 1.35) *
      (onTrack ? 1 : 0.52 + this.tireContactGrip * 0.42) +
      this.steeringImpulse * speedRatio * (0.12 + speedRatio * 0.12);
    const lowSpeedSteerSurface = surface.name === "Asphalt" && this.tireRunoffShare < 0.08 ? 1 : surface.name === "Kerb" && this.tireRunoffShare < 0.18 ? 0.22 : 0;
    const lowSpeedSteerScrub = Math.pow(Math.abs(rawSteer), 1.25) * throttle * (1 - brake) * clamp((48 - this.speed) / 48, 0, 1) * lowSpeedSteerSurface;
    const lateralForceDemand =
      Math.abs(steer) * speedRatio * (0.26 + cornerDemand * 0.52) +
      steeringLoadDemand +
      lowSpeedSteerScrub * 0.86 +
      Math.abs(track.curve) * speedRatio * (3 + cornerDemand * 1.05) +
      Math.abs(this.lateralVelocity) * 0.018;
    const forceCapacity = clamp(
      this.tireContactGrip *
        (0.54 + this.grip * 0.46) *
        clamp(0.84 + this.roadLoad * 0.16, 0.84, 1.08) *
        (1 - roadWetness * 0.1) *
        (1 - this.standingWater * 0.2) *
        (1 - this.hydroplaneLoad * 0.14) *
        (1 - this.surfaceEdgeLoad * 0.12) *
        (1 - this.tireRunoffShare * 0.18) *
        clamp(0.82 + this.tireGroundContact * 0.18, 0.82, 1.04) *
        (1 - this.tireRelaxation * 0.03) *
        (1 + (this.frontAeroLoad + this.rearAeroLoad) * 0.13) *
        clamp(frontLoadGrip * 0.56 + rearLoadGrip * 0.44, 0.82, 1.08) *
        pressureGripFactor *
        (1 - this.aeroWashout * 0.08) *
        (1 - this.damperImpulse * 0.08) *
        (1 - this.floorStrikeLoad * 0.06) *
        (1 - this.downforceLoss * 0.45),
      0.24,
      1.18
    );
    const forceLoadTarget = clamp(Math.hypot(longitudinalForceDemand + controlLoadForceDemand, lateralForceDemand) / Math.max(0.24, forceCapacity), 0, 1.8);
    this.tireForceLoad = approach(this.tireForceLoad, forceLoadTarget, dt * (forceLoadTarget > this.tireForceLoad ? 12 : 7));
    const combinedSlipTarget = clamp((forceLoadTarget - 0.72) / 0.88, 0, 1);
    this.combinedSlipLoad = approach(this.combinedSlipLoad, combinedSlipTarget, dt * (combinedSlipTarget > this.combinedSlipLoad ? 13 : 5.5));
    const reservePressure = clamp((forceLoadTarget - 1.18) / 0.5, 0, 1);
    const tireGripReserveTarget = clamp(
      1 -
        this.combinedSlipLoad * 0.22 -
        reservePressure * 0.14 -
        this.tirePressureLoad * 0.04 -
        this.insideWheelUnload * 0.015 +
        (this.tireContactPatch - 1) * 0.06,
      0.52,
      1.04
    );
    this.tireGripReserve = approach(
      this.tireGripReserve,
      tireGripReserveTarget,
      dt * (tireGripReserveTarget < this.tireGripReserve ? 12 : 5.5)
    );
    const saturationTarget = clamp((forceLoadTarget - 0.74) / 0.72, 0, 1);
    this.tireSaturation = approach(this.tireSaturation, saturationTarget, dt * (saturationTarget > this.tireSaturation ? 14 : 6));
    const brakeEnergy = brake * speedRatio;
    const rearLightness = clamp(
      Math.max(0, 1.02 - this.rearAxleLoad) * 1.6 +
        Math.max(0, this.longitudinalLoadTransfer) * 0.72 +
        this.engineBraking * 0.22 +
        this.trailBraking * (0.32 + speedRatio * 0.28) +
        this.brakeReleaseShock * 0.22 +
        Math.max(0, 1 - this.tireGroundContact) * 0.22 -
        this.rearAeroLoad * 0.08,
      0,
      1
    );
    const frontLockRiskTarget = clamp(
      brakeEnergy *
        (0.12 +
          brake * 0.32 +
          Math.max(0, 1.03 - this.frontAxleLoad) * 0.28 +
          this.pedalOverlapLoad * 0.24 +
          this.pedalPressureLoad * 0.16 +
          frontAxleOverload * 0.34 +
          this.tireSaturation * 0.3 +
          Math.max(0, 1 - this.tireGripReserve) * 0.48 +
          this.tirePressureLoad * 0.1 +
          Math.max(0, 1 - this.tireGroundContact) * 0.32 +
          this.standingWater * (0.38 + speedRatio * 0.22) +
          this.hydroplaneLoad * (0.2 + speedRatio * 0.16) +
          this.brakeFade * 0.18 +
          Math.max(0, 0.82 - this.brakeBite) * 0.22 +
          this.surfaceEdgeLoad * 0.12 +
          this.dirtyTirePickup * 0.12) -
        thresholdBrakeSupport * 0.34 -
        trailBrakeSupport * 0.1,
      0,
      1
    );
    this.frontLockRisk = approach(this.frontLockRisk, frontLockRiskTarget, dt * (frontLockRiskTarget > this.frontLockRisk ? 14 : 6));
    const brakeBalanceLoadTarget = clamp(
      brakeEnergy *
        (0.22 +
          Math.max(0, this.longitudinalLoadTransfer) * 0.74 +
          this.pedalOverlapLoad * 0.32 +
          this.pedalPressureLoad * 0.12 +
          this.frontLockRisk * 0.36 +
          rearLightness * 0.26 +
          this.frontAeroLoad * 0.08 +
          this.tireSaturation * 0.16),
      0,
      1
    );
    this.brakeBalanceLoad = approach(this.brakeBalanceLoad, brakeBalanceLoadTarget, dt * (brakeBalanceLoadTarget > this.brakeBalanceLoad ? 13 : 5.8));
    const rearBrakeStabilityTarget = clamp(
      1 -
        brakeEnergy *
          (rearLightness * 0.46 +
            Math.abs(steer) * this.trailBraking * 0.44 +
            this.engineBraking * 0.12 +
            this.pedalOverlapLoad * 0.12 +
            this.pedalPressureLoad * 0.08 +
            this.brakeReleaseShock * 0.18 +
            roadWetness * 0.14) -
        Math.max(0, 1 - rearTractionSupport) * 0.22 -
        this.frontLockRisk * 0.08 +
        this.rearAeroLoad * 0.08,
      0.42,
      1.04
    );
    this.rearBrakeStability = approach(
      this.rearBrakeStability,
      rearBrakeStabilityTarget,
      dt * (rearBrakeStabilityTarget < this.rearBrakeStability ? 12 : 5.4)
    );
    const wheelspinTarget = onTrack
      ? clamp(
          throttle * (1 - this.grip) * (0.9 + track.section.difficulty * 0.55) +
            tractionStress * overspeed * 0.35 +
            Math.max(0, this.longitudinalLoadTransfer) * throttle * 0.18 +
            contactRoughness * throttle * 0.18 +
            (1 - this.tireContactGrip) * throttle * 0.22 +
            Math.max(0, 1 - this.tireGroundContact) * throttle * (0.18 + speedRatio * 0.16) +
            this.surfaceEdgeLoad * throttle * 0.12 +
            this.standingWater * throttle * (0.32 + speedRatio * 0.34) +
            this.hydroplaneLoad * throttle * (0.18 + speedRatio * 0.16) +
            this.tireSaturation * throttle * 0.34 +
            this.tireRelaxation * throttle * 0.08 +
            this.pedalPressureLoad * throttle * 0.08 +
            this.engineBraking * Math.abs(steer) * 0.08 +
            this.driveTorqueLoad * throttle * 0.1 +
            rearAxleOverload * throttle * 0.11 +
            throttlePickupShock * 0.34 -
            throttlePickupSettle * 0.08 +
            this.pedalOverlapLoad * 0.28 +
            this.insideRearSlip * 0.58 -
            this.differentialLock * 0.08 +
            Math.abs(this.rearTractionRotation) * throttle * 0.32 +
            (gripContext.marbles + this.dirtyTirePickup) * throttle * 0.18,
          0,
          1
        )
      : clamp(
          throttle * (0.48 + contactRoughness * 0.34) +
            speedRatio * 0.18 +
            this.tireRunoffShare * 0.12 +
            this.standingWater * throttle * 0.24 +
            this.hydroplaneLoad * throttle * 0.14 +
            this.tireSaturation * throttle * 0.22,
          0,
          1
        );
    const lockupTarget = onTrack
      ? clamp(
          brake *
            speedRatio *
            (0.18 +
              overspeed * 0.9 +
              (1 - this.grip) * 0.75 +
              Math.max(0, 1.04 - this.frontAxleLoad) * 0.32 +
              contactRoughness * 0.2 +
              (1 - this.tireContactGrip) * 0.26 +
              Math.max(0, 1 - this.tireGroundContact) * (0.16 + speedRatio * 0.14) +
              this.standingWater * (0.44 + speedRatio * 0.28) +
              this.hydroplaneLoad * (0.22 + speedRatio * 0.18) +
              this.tireSaturation * 0.42 +
              this.pedalOverlapLoad * 0.22 +
              this.pedalPressureLoad * 0.16 +
              this.tireRelaxation * 0.08 +
              this.frontLockRisk * 0.95 +
              this.dirtyTirePickup * 0.18) -
            thresholdBrakeSupport * (0.14 + this.frontAxleLoad * 0.04) -
            trailBrakeSupport * 0.1,
          0,
          1
        )
      : clamp(
          brake * (0.38 + contactRoughness * 0.26) +
            speedRatio * 0.18 +
            this.tireRunoffShare * 0.12 +
            this.standingWater * brake * 0.22 +
            this.hydroplaneLoad * brake * 0.14 +
            this.tireSaturation * brake * 0.24,
          0,
          1
        );
    const understeerTarget = clamp(
      Math.abs(steer) *
        speedRatio *
        (track.section.difficulty * 0.24 +
          overspeed * 0.82 +
          (1 - this.grip) * 0.7 +
          this.standingWater * 0.38 +
          this.hydroplaneLoad * 0.28 +
          this.tireSaturation * 0.52 +
          Math.max(0, 1 - this.tireGroundContact) * 0.18 +
          this.tireRelaxation * 0.1 +
          this.powerUndersteerLoad * 0.52 +
          Math.abs(this.rearTractionRotation) * 0.08 +
          this.frontLockRisk * 0.36 +
          Math.max(0, -this.aeroBalance) * 0.34 +
          this.aeroWashout * 0.18 +
          lateralLoadStress * 0.04 +
          trailBrakeInstability * 0.08 +
          this.dirtyTirePickup * 0.2),
      0,
      1
    );

    this.wheelspin = approach(this.wheelspin, wheelspinTarget, dt * 7.5);
    this.lockup = approach(this.lockup, lockupTarget, dt * 10);
    this.understeer = approach(this.understeer, understeerTarget, dt * 6);
    const longitudinalSlipLoadTarget = clamp(
      (this.wheelspin * 0.54 +
        this.lockup * 0.64 +
        this.frontLockRisk * brake * 0.22 +
        Math.max(0, 1 - this.rearBrakeStability) * brake * 0.16 +
        this.pedalPressureLoad * 0.14 +
        this.driveTorqueLoad * throttle * 0.12 +
        this.insideRearSlip * throttle * 0.18 +
        Math.max(0, 1 - this.longitudinalGrip) * 0.08 +
        this.standingWater * speedRatio * Math.max(throttle, brake) * 0.16 +
        this.hydroplaneLoad * Math.max(throttle, brake) * 0.22 -
        thresholdBrakeSupport * 0.08 -
        throttlePickupSettle * 0.06) *
        (onTrack ? 0.78 : 0.32),
      0,
      1
    );
    this.longitudinalSlipLoad = approach(
      this.longitudinalSlipLoad,
      longitudinalSlipLoadTarget,
      dt * (longitudinalSlipLoadTarget > this.longitudinalSlipLoad ? 11.5 : 4.4)
    );
    const previousSlipAngleLoad = clamp((Math.abs(this.slipAngle) - 0.085) / 0.395, 0, 1);
    const selfAlignTorqueTarget = clamp(
      (-this.slipAngle * (0.62 + speedRatio * 1.25) -
        this.yawRate * (0.22 + speedRatio * 0.18) -
        steer * this.understeer * 0.22 -
        this.splitSurfaceLoad * 0.08 +
        roadCamber * (0.08 + speedRatio * 0.1)) *
        clamp(0.55 + this.frontAxleLoad * 0.34 + this.frontAeroLoad * 0.16 - this.aeroWashout * 0.12, 0.35, 1.05) *
        (onTrack ? 1 : 0.42 + this.tireContactGrip * 0.34),
      -1,
      1
    );
    this.selfAlignTorque = approach(
      this.selfAlignTorque,
      selfAlignTorqueTarget,
      dt * (Math.abs(selfAlignTorqueTarget) > Math.abs(this.selfAlignTorque) ? 11 : 7)
    );
    const steeringRackLoadTarget = clamp(
      steeringLoadDemand * 0.34 +
        previousSlipAngleLoad * 0.22 +
        this.tireSaturation * 0.2 +
        this.understeer * 0.18 +
        Math.abs(this.selfAlignTorque) * 0.28 +
        Math.abs(this.steeringVelocity) * 0.16 +
        this.steeringImpulse * 0.28 +
        this.controlActuationLoad * 0.16 +
        this.frontAeroLoad * 0.1 -
        this.wheelspin * 0.08,
      0,
      1
    );
    this.steeringRackLoad = approach(
      this.steeringRackLoad,
      steeringRackLoadTarget,
      dt * (steeringRackLoadTarget > this.steeringRackLoad ? 12 : 5.6)
    );
    const brakeReleaseImpulse = clamp((previousBrake - brake) * speedRatio * (0.72 + this.lockup * 0.58), 0, 1);
    this.brakeReleaseShock = Math.max(this.brakeReleaseShock, brakeReleaseImpulse);
    this.brakeReleaseShock = approach(this.brakeReleaseShock, 0, dt * 2.3);
    this.updateTireState(dt, speedRatio, throttle, brake, Math.abs(steer), contactRoughness, onTrack);
    this.updateBrakeState(dt, brake, speedRatio, roadWetness);

    const torqueCurve = this.engineTorqueCurve();
    const shiftInterruption = 1 - this.shiftCut * 0.54;
    const steeringPowerTrim = clamp(steeringLoadDemand * 0.34 + lowSpeedSteerScrub * 0.3, 0, 0.58);
    const standingStartTraction =
      clamp(0.34 + speedRatio * 2.4 + this.longitudinalGrip * 0.18 - roadWetness * 0.16, 0.32, 1) *
      (1 - lowSpeedSteerScrub * 0.28) *
      clamp(0.86 + this.tireGroundContact * 0.14, 0.86, 1.04);
    const tractionDelivery =
      (1 - this.tractionBite * 0.2) *
      clamp(0.62 + this.longitudinalGrip * 0.43 - this.tireSaturation * 0.08 - this.tireRelaxation * 0.035, 0.52, 1.06) *
      clamp(0.94 + this.tireGripReserve * 0.08, 0.88, 1.02) *
      rearTractionSupport *
      clamp(
        1 +
          throttlePickupSettle * 0.05 +
          this.differentialLock * 0.035 -
          this.insideRearSlip * 0.16 -
          this.driveTorqueLoad * this.tireSaturation * 0.08 -
          throttlePickupShock * this.tireSaturation * 0.04,
        0.78,
        1.06
      ) *
      clamp(0.86 + this.tireGroundContact * 0.14, 0.86, 1.04) *
      (1 - this.tireRelaxation * 0.03) *
      (1 - this.pedalOverlapLoad * 0.24) *
      (1 - steeringPowerTrim) *
      standingStartTraction;
    const acceleration =
      throttle * (122 - speedRatio * 52) * torqueCurve * shiftInterruption * tractionDelivery * (1 - this.wheelspin * 0.24) * (1 - fuelWeightPenalty);
    const engineBrakeDrag =
      this.engineBraking * (16 + speedRatio * 62) * (1 - brake * 0.45) * (1 + Math.abs(steer) * speedRatio * 0.2) * (onTrack ? 1 : 0.62 + this.tireContactGrip * 0.28);
    const brakingGrip = clamp(
      0.58 +
        this.longitudinalGrip * 0.5 +
        this.frontAeroLoad * 0.11 -
        this.aeroWashout * 0.05 -
        Math.max(0, 1 - this.tireGroundContact) * 0.1 -
        Math.max(0, 1.02 - this.frontAxleLoad) * 0.16 -
        this.surfaceEdgeLoad * 0.08 -
        this.standingWater * 0.12 -
        this.tireSaturation * 0.12 -
        this.frontLockRisk * 0.1 -
        this.tireRelaxation * 0.035 +
        thresholdBrakeSupport * 0.16 -
        this.pedalOverlapLoad * 0.08,
      0.38,
      1.08
    );
    const braking = brake * 248 * brakingGrip * (1 - this.lockup * 0.3) * (1 - fuelWeightPenalty * 0.45) * this.brakeBite * (1 + thresholdBrakeSupport * 0.08);
    const boostPower = boost * 86;
    const aeroPower = this.aeroBoostActive * throttle * (10 + speedRatio * 22);
    const draftPower = this.draft * throttle * (16 + speedRatio * 28);
    const drag = 0.045 * this.speed + speedRatio * speedRatio * 38 + this.aeroPlatformLoad * (3 + speedRatio * 9) + this.floorStrikeLoad * (10 + speedRatio * 44);
    const gradeForce = -grade * (78 + speedRatio * 44);
    const instabilityDrag =
      (this.wheelspin * 18 +
        this.lockup * 24 +
        this.understeer * 14 +
        this.surfaceEdgeLoad * 6 +
        Math.max(0, 1 - this.tireGroundContact) * 8 +
        this.tireSaturation * 10 +
        this.pedalOverlapLoad * 9 +
        this.tireRelaxation * 5 +
        this.steeringRackLoad * 3 +
        this.throttlePickupLoad * 3 +
        Math.abs(this.rearTractionRotation) * 4) *
      driverDemand;
    const highSpeedSteeringWindow = clamp((this.speed - 190) / 95, 0, 1);
    const steeringScrubDrag =
      Math.pow(Math.abs(rawSteer), 1.5) *
      speedRatio *
      speedRatio *
      highSpeedSteeringWindow *
      throttle *
      (1 - brake * 0.82) *
      (0.18 + this.tireSaturation * 0.82) *
      (68 + speedRatio * 142) *
      (onTrack ? 1 : 0.42 + this.tireContactGrip * 0.34);
    const racecraftDrag = this.contactRisk * (8 + speedRatio * 18) + this.sideBySide * Math.abs(steer) * 6 + this.frontWingDamage * (5 + speedRatio * 18);
    const recoverySteerTowardRoad = clamp(-rawSteer * offTrackSide, -1, 1);
    const recoverySteerPenalty =
      recoverySteerTowardRoad >= 0 ? clamp(Math.abs(rawSteer) * 0.22, 0, 0.34) : clamp(Math.abs(rawSteer) * 1.75, 0, 1);
    const settledRecoveryInput = throttle * (1 - recoverySteerPenalty);
    const recoverySteerGrip = clamp((recoverySteerTowardRoad - 0.08) / 0.92, 0, 1);
    const lowSpeedRecoveryWindow = clamp((92 - this.speed) / 92, 0.35, 1);
    const crawlRecoveryWindow = clamp((34 - this.speed) / 34, 0, 1);
    const looseSurfaceRecoveryRelief = onTrack
      ? 0
      : clamp((72 - this.speed) / 72, 0, 1) *
        settledRecoveryInput *
        clamp((surface.name === "Gravel" ? 0.32 : 0.58) + recoverySteerGrip * (surface.name === "Gravel" ? 0.54 : 0.28), 0, 0.82);
    const looseSurfaceRecoveryDrive = onTrack
      ? 0
      : settledRecoveryInput * (surface.name === "Gravel" ? 78 : 110) * (0.42 + roadRecoveryNeed * 0.58) * lowSpeedRecoveryWindow;
    const looseSurfaceCrawlDrive = onTrack ? 0 : throttle * recoverySteerGrip * (surface.name === "Gravel" ? 188 : 112) * crawlRecoveryWindow;
    const kerbCrawlDrive =
      onTrack && surface.name === "Kerb"
        ? throttle * (1 - brake) * crawlRecoveryWindow * 68 * clamp(0.55 + this.tireContactGrip * 0.32 - this.tireRelaxation * 0.12, 0.42, 1)
        : 0;
    const crawlDragCut = onTrack ? 0 : recoverySteerGrip * settledRecoveryInput * crawlRecoveryWindow * (surface.name === "Gravel" ? 0.42 : 0.28);
    const offTrackDrag = Math.max(surface.drag, tireContact.drag) * (onTrack ? 1 : (1.18 + roadWetness * 0.34) * (1 - looseSurfaceRecoveryRelief) * (1 - crawlDragCut));
    this.surfaceRumble = approach(
      this.surfaceRumble,
      clamp(
        contactRoughness * clamp(0.25 + speedRatio, 0, 1) +
          this.surfaceEdgeLoad * 0.42 +
          Math.abs(this.splitSurfaceLoad) * 0.18 +
          this.standingWater * speedRatio * 0.08,
        0,
        1
      ),
      dt * 12
    );

    this.speed +=
      (acceleration +
        boostPower +
        aeroPower +
        draftPower +
        kerbCrawlDrive +
        looseSurfaceRecoveryDrive +
        looseSurfaceCrawlDrive +
        gradeForce -
        braking -
        engineBrakeDrag -
        Math.max(0, drag - this.aeroDragReduction) -
        instabilityDrag -
        steeringScrubDrag -
        racecraftDrag -
        offTrackDrag) *
      dt;
    this.speed = clamp(this.speed, 0, MAX_SPEED);
    this.ers = clamp(this.ers + brake * 0.28 * dt + 0.025 * dt - boost * 0.38 * dt - this.aeroBoostActive * 0.07 * dt, 0, 1);

    const cornerLoad = Math.abs(track.curve) * speedRatio * (3.2 + track.section.difficulty * 1.2);
    const camberLoad = Math.abs(roadCamber) * (0.16 + speedRatio * 0.2);
    const roadCamberLoadTarget = clamp(
      Math.abs(roadCamber) *
        (0.24 + speedRatio * 1.4) *
        clamp(0.44 + this.tireGroundContact * 0.42 + this.roadAdhesion * 0.24, 0.35, 1.08) *
        (onTrack ? 1 : 0.42 + this.tireContactGrip * 0.3),
      0,
      1
    );
    this.roadCamberLoad = approach(
      this.roadCamberLoad,
      roadCamberLoadTarget,
      dt * (roadCamberLoadTarget > this.roadCamberLoad ? 10.5 : 4.8)
    );
    const rollingGuidanceForce =
      clamp(Math.max((this.speed - 5) / 48, throttle * (1 - brake) * 0.58), 0, 1) *
      clamp(0.45 + this.roadAdhesion * 0.55, 0.35, 1.04);
    const lineGuidanceError = Math.abs(this.x - track.center - track.racingLineOffset);
    const lineGuidanceLoad = clamp(lineGuidanceError / Math.max(2.2, track.halfWidth * 0.46), 0, 1);
    const roadGuidanceTarget = clamp(
      (lineGuidanceLoad * (onTrack ? 0.34 : 0.12) +
        roadRecoveryNeed * 0.58 +
        this.roadCamberLoad * 0.18 +
        Math.abs(this.splitSurfaceLoad) * 0.08) *
        rollingGuidanceForce *
        (1 - Math.abs(rawSteer) * 0.28),
      0,
      1
    );
    this.roadGuidanceLoad = approach(
      this.roadGuidanceLoad,
      roadGuidanceTarget,
      dt * (roadGuidanceTarget > this.roadGuidanceLoad ? 10.8 : 5.2)
    );
    const textureExcitationTarget = clamp(
      contactRoughness * speedRatio * 0.42 +
        this.surfaceEdgeLoad * 0.24 +
        Math.abs(this.splitSurfaceLoad) * 0.2 +
        this.standingWater * speedRatio * 0.18 +
        this.floorStrikeLoad * 0.24 +
        Math.max(0, 1 - this.tireGroundContact) * 0.18 +
        Math.abs(this.suspensionVelocity) * 0.09,
      0,
      1
    );
    this.roadTextureLoad = approach(
      this.roadTextureLoad,
      textureExcitationTarget,
      dt * (textureExcitationTarget > this.roadTextureLoad ? 13 : 3.4)
    );
    this.roadTexturePhase += (7.2 + speedRatio * 12.5 + contactRoughness * 5.5 + this.surfaceEdgeLoad * 3.2) * dt;
    const textureWave = Math.sin(this.roadTexturePhase) * this.roadTextureLoad;
    const shortTextureWave = Math.sin(this.roadTexturePhase * 2.35 + this.z * 0.012) * this.roadTextureLoad;
    const heaveTarget = clamp(
      textureWave * (0.055 + speedRatio * 0.13) + shortTextureWave * (0.018 + speedRatio * 0.045),
      -0.24,
      0.24
    );
    this.chassisHeave = approach(this.chassisHeave, heaveTarget, dt * 17);
    const rideSettlingTarget = clamp(
      this.roadTextureLoad * 0.48 +
        Math.abs(this.chassisHeave) * 2.6 +
        this.damperImpulse * 0.18 +
        this.floorStrikeLoad * 0.18 +
        Math.max(0, 1 - this.tireGroundContact) * 0.2,
      0,
      1
    );
    this.rideSettling = approach(this.rideSettling, rideSettlingTarget, dt * (rideSettlingTarget > this.rideSettling ? 10.5 : 3.6));
    const suspensionOscillation =
      Math.sin(this.z * 0.095 + this.lateralVelocity * 0.12) * contactRoughness * speedRatio * 0.14 + this.chassisHeave * 0.58;
    const loadTarget = clamp(
      1 +
        speedRatio * speedRatio * 0.2 +
        brake * (0.16 + speedRatio * 0.08) -
        throttle * 0.035 +
        Math.abs(this.longitudinalLoadTransfer) * 0.08 +
        lateralLoad * (0.025 + speedRatio * 0.025) +
        camberLoad +
        Math.max(0, this.roadCompression) * (0.5 + speedRatio * 0.45) -
        Math.max(0, -this.roadCompression) * (0.44 + speedRatio * 0.32) +
        this.aeroPlatformLoad * 0.18 +
        this.tireGroundContact * 0.03 -
        Math.max(0, 1 - this.tireGroundContact) * 0.1 +
        cornerLoad * 0.08 +
        contactRoughness * 0.1 +
        this.surfaceEdgeLoad * 0.16 +
        Math.abs(this.splitSurfaceLoad) * 0.1 +
        tireContact.heightSpread * speedRatio * 0.12 +
        this.roadTextureLoad * 0.045 +
        this.rideSettling * 0.032 +
        this.floorStrikeLoad * 0.055 +
        this.pedalOverlapLoad * 0.035 +
        suspensionOscillation -
        roadWetness * 0.035,
      0.62,
      1.42
    );
    this.suspensionLoad = approach(this.suspensionLoad, loadTarget, dt * (contactRoughness > 0.2 ? 11 : 7));
    const previousSuspensionTravel = this.suspensionTravel;
    this.suspensionTravel = approach(
      this.suspensionTravel,
      clamp(
        (this.suspensionLoad - 1) * 0.44 +
          contactRoughness * speedRatio * 0.12 +
          this.surfaceEdgeLoad * 0.08 +
          Math.abs(this.splitSurfaceLoad) * 0.045 +
          this.roadTextureLoad * 0.045 +
          this.chassisHeave * 0.12 +
          this.rideSettling * 0.028 +
          this.floorStrikeLoad * 0.05 +
          this.aeroPlatformLoad * 0.025 +
          tireContact.heightSpread * speedRatio * 0.075 +
          Math.max(0, this.roadCompression) * 0.1 -
          Math.max(0, -this.roadCompression) * 0.08 +
          brake * 0.035 -
          throttle * 0.02,
        -0.24,
        0.36
      ),
      dt * 9
    );
    const rawSuspensionVelocity = clamp((this.suspensionTravel - previousSuspensionTravel) / Math.max(dt, 1 / 120), -1.4, 1.4);
    const roadCompressionVelocity = clamp((this.roadCompression - previousRoadCompression) / Math.max(dt, 1 / 120), -1.2, 1.2);
    const suspensionVelocityTarget = clamp(
      rawSuspensionVelocity * 0.78 + roadCompressionVelocity * 0.22 + suspensionOscillation * 0.4 + this.chassisHeave * 0.38,
      -1,
      1
    );
    this.suspensionVelocity = approach(
      this.suspensionVelocity,
      suspensionVelocityTarget,
      dt * (Math.abs(suspensionVelocityTarget) > Math.abs(this.suspensionVelocity) ? 14 : 5.5)
    );
    const damperImpulseTarget = clamp(
      Math.abs(this.suspensionVelocity) * (0.55 + speedRatio * 0.45) +
        contactRoughness * speedRatio * 0.12 +
        this.surfaceEdgeLoad * 0.08 +
        Math.abs(this.splitSurfaceLoad) * 0.08 +
        this.roadTextureLoad * 0.075 +
        this.floorStrikeLoad * 0.16 +
        Math.abs(this.chassisHeave) * 0.24 +
        this.rideSettling * 0.045,
      0,
      1
    );
    this.damperImpulse = approach(
      this.damperImpulse,
      damperImpulseTarget,
      dt * (damperImpulseTarget > this.damperImpulse ? 15 : 4.5)
    );
    const floorRideHeightLoad =
      Math.max(0, this.suspensionTravel - 0.2) * 1.75 + Math.abs(this.chassisHeave) * 0.24 + this.aeroPlatformLoad * 0.035;
    const floorImpactGate = clamp(
      Math.max(0, this.roadCompression - 0.05) * 2.4 +
        Math.max(0, this.damperImpulse - 0.16) * 1.85 +
        this.surfaceEdgeLoad * 0.42 +
        Math.max(0, this.roadTextureLoad - 0.16) * 0.3 +
        tireContact.heightSpread * speedRatio * 0.34 -
        0.08,
      0,
      1
    );
    const floorStrikeTarget = clamp(
      floorRideHeightLoad * floorImpactGate * clamp((this.speed - 96) / 170, 0, 1) * (onTrack ? 1 : 0.72 + this.tireContactGrip * 0.22),
      0,
      1
    );
    this.floorStrikeLoad = approach(
      this.floorStrikeLoad,
      floorStrikeTarget,
      dt * (floorStrikeTarget > this.floorStrikeLoad ? 16 : 4.2)
    );
    const roadFeelFeedbackTarget = clamp(
      Math.abs(this.roadCompression) * 2.1 +
        Math.max(0, this.suspensionLoad - 1) * 0.62 +
        Math.abs(this.suspensionTravel) * 0.86 +
        this.damperImpulse * 0.65 +
        this.floorStrikeLoad * 0.42 +
        Math.max(0, 1 - this.tireGroundContact) * 0.26 +
        contactRoughness * speedRatio * 0.3 +
        this.surfaceEdgeLoad * 0.18 +
        Math.abs(this.splitSurfaceLoad) * 0.18 +
        this.roadTextureLoad * 0.24 +
        Math.abs(this.chassisHeave) * 0.38 +
        this.rideSettling * 0.18 +
        this.roadCamberLoad * 0.2 +
        this.roadGuidanceLoad * 0.22 +
        this.hydroplaneLoad * 0.18 +
        this.aeroBuffetLoad * 0.1 +
        Math.abs(roadCamber) * speedRatio * 0.12,
      0,
      1
    );
    this.roadFeelFeedback = approach(
      this.roadFeelFeedback,
      roadFeelFeedbackTarget,
      dt * (roadFeelFeedbackTarget > this.roadFeelFeedback ? 11.5 : 5.4)
    );
    const weatherGrip = this.evolvedWeatherGrip() * this.tireContactGrip;
    const tireTempPenalty =
      this.tireTemp < 0.38 ? (0.38 - this.tireTemp) * 0.5 : this.tireTemp > 0.86 ? (this.tireTemp - 0.86) * 0.85 : 0;
    const tireHeatSoakPenalty = this.tireHeatStress() * (0.018 + speedRatio * 0.012);
    const tireGripFactor = clamp(
      1 -
        tireTempPenalty -
        tireHeatSoakPenalty -
        this.tireWear * 0.18 +
        gripContext.rubberedLineGrip -
        gripContext.marbles * 0.07 -
        this.dirtyTirePickup * 0.14,
      0.7,
      1.08
    );
    const damageGripFactor = clamp(1 - this.frontWingDamage * (0.12 + speedRatio * 0.18) - this.aeroWashout * 0.08, 0.68, 1);
    const fuelGripFactor = clamp(1 - this.fuelLoad * 0.025, 0.96, 1);
    const loadGripFactor = clamp(
      0.88 +
        this.suspensionLoad * 0.14 -
        Math.abs(this.suspensionLoad - 1) * 0.1 -
        contactRoughness * 0.05 -
        Math.max(0, 1 - this.roadLoad) * 0.24 +
        Math.max(0, this.roadLoad - 1) * 0.08 +
        (this.frontAeroLoad + this.rearAeroLoad) * 0.035 -
        this.floorStrikeLoad * 0.07 -
        this.aeroWashout * 0.04,
      0.7,
      1.12
    );
    const wetPenalty =
      roadWetness * (brake * 0.08 + throttle * 0.04 + Math.abs(steer) * 0.05) +
      this.standingWater * (brake * 0.12 + throttle * 0.08 + Math.abs(steer) * 0.1) +
      this.hydroplaneLoad * (brake * 0.08 + throttle * 0.05 + Math.abs(steer) * 0.07);
    const bankingSupport = 1 + Math.min(0.12, Math.abs(roadCamber) * 0.24);
    const dirtyAirPenalty = this.dirtyAir * (0.1 + speedRatio * 0.14);
    const gripTarget = onTrack
      ? clamp(
          (1 - brake * 0.08 - speedRatio * Math.abs(steer) * 0.23 - cornerLoad - overspeed * track.section.difficulty * 0.32) *
            weatherGrip *
            tireGripFactor *
            damageGripFactor *
            fuelGripFactor *
            loadGripFactor *
            pressureGripFactor *
            clamp(frontLoadGrip * 0.62 + rearLoadGrip * 0.38, 0.86, 1.06) *
            bankingSupport -
            wetPenalty -
            dirtyAirPenalty -
            this.powerUndersteerLoad * (0.015 + speedRatio * 0.018) -
            this.tireRelaxation * 0.035 -
            this.floorStrikeLoad * 0.045,
          0.34,
          1
        )
      : 0.42 * weatherGrip;
    this.grip = approach(this.grip, gripTarget, dt * 5.5);
    const contactDemand = clamp(
      throttle * 0.08 +
        brake * 0.24 +
        boost * 0.08 +
        Math.abs(rawSteer) * speedRatio * 0.34 +
        this.wheelspin * 0.18 +
        this.lockup * 0.18 +
        this.surfaceEdgeLoad * 0.2 +
        Math.abs(this.splitSurfaceLoad) * 0.16 +
        Math.max(0, 1 - this.tireGroundContact) * 0.11 +
        this.standingWater * (0.18 + speedRatio * 0.22) +
        this.hydroplaneLoad * (0.12 + speedRatio * 0.16) +
        this.tireSaturation * 0.2 +
        this.tireRelaxation * 0.06 +
        this.pedalOverlapLoad * 0.18 +
        Math.abs(this.rearTractionRotation) * 0.08 +
        this.engineBraking * (0.045 + Math.abs(rawSteer) * 0.045) +
        this.liftOffRotationLoad * 0.085 +
        trailBrakeInstability * 0.07 +
        lateralLoadStress * 0.045,
      0,
      0.86
    );
    const roadCenterDistance = clamp(Math.abs(this.x - track.center) / Math.max(1, track.halfWidth + 2.65), 0, 1);
    const contactTarget = onTrack
      ? clamp(this.grip * this.tireContactGrip * (1 - contactDemand) + (1 - roadCenterDistance) * 0.1, 0.18, 1.08)
      : clamp(this.grip * this.tireContactGrip * (0.42 + this.tireContactGrip * 0.34) * (1 - contactDemand * 0.44), 0.12, 0.72);
    this.roadAdhesion = approach(this.roadAdhesion, contactTarget, dt * (onTrack ? 8 : 5.2));

    const steerAuthority =
      (0.78 - speedRatio * 0.44) *
      this.roadAdhesion *
      (1 + this.frontAeroLoad * 0.18) *
      frontLoadGrip *
      (1 - this.aeroWashout * 0.18) *
      (1 - this.aeroBuffetLoad * 0.025) *
      (1 - this.understeer * 0.35) *
      clamp(0.94 + this.tireGripReserve * 0.08, 0.88, 1.02) *
      (1 - this.tireSaturation * 0.24) *
      (1 - this.tireRelaxation * 0.08) *
      (1 - this.frontLockRisk * 0.22) *
      clamp(0.84 + this.tireGroundContact * 0.16, 0.84, 1.04) *
      (1 - Math.abs(this.splitSurfaceLoad) * 0.12) *
      (1 + trailBrakeSupport * 0.1) *
      (1 - clamp(brake * speedRatio * (0.44 + this.lockup * 0.82 + this.tireSaturation * 0.28), 0, 0.82)) *
      (1 - this.downforceLoss * 0.5) *
      (1 - this.fuelLoad * 0.035) *
      (1 - this.dirtyTirePickup * 0.08);
    const rollingSteerFactor = clamp((this.speed - 4) / 32, 0, 1) * (1 - lowSpeedSteerScrub * 0.28);
    const splitSurfaceYawTug =
      this.splitSurfaceLoad *
      speedRatio *
      (0.025 + contactRoughness * 0.055 + this.surfaceEdgeLoad * 0.035) *
      clamp(1 - brake * 0.36, 0.45, 1);
    const rearTractionYaw =
      this.rearTractionRotation * (0.12 + speedRatio * 0.12) * clamp(1 - this.lockup * 0.42, 0.45, 1) * rollingSteerFactor;
    const rackResistance = clamp(1 - this.steeringRackLoad * 0.06 - Math.abs(this.selfAlignTorque) * 0.035 - this.steeringImpulse * 0.012, 0.86, 1);
    const selfAlignYaw =
      this.selfAlignTorque * speedRatio * (0.035 + this.frontAeroLoad * 0.026) * clamp(1 - Math.abs(rawSteer) * 0.62, 0.25, 1);
    const brakeStabilityYaw =
      Math.sign(steer) *
      Math.max(0, 1 - this.rearBrakeStability) *
      brake *
      speedRatio *
      (0.045 + this.trailBraking * 0.055) *
      rollingSteerFactor;
    const liftOffYaw =
      Math.sign(steer) *
      this.liftOffRotationLoad *
      speedRatio *
      (0.34 + this.engineBraking * 0.14 + Math.max(0, this.longitudinalLoadTransfer) * 0.09) *
      clamp(1 - this.lockup * 0.36, 0.42, 1) *
      rollingSteerFactor;
    const metersPerSecond = this.speed * (1000 / 3600);
    const curveFollow = track.curve * metersPerSecond * 0.9;
    const targetYawRate =
      steer * steerAuthority * rollingSteerFactor * rackResistance +
      Math.sign(steer) * trailBrakeSupport * speedRatio * 0.095 +
      splitSurfaceYawTug +
      rearTractionYaw +
      liftOffYaw +
      brakeStabilityYaw +
      selfAlignYaw;
    const yawMoment = targetYawRate - this.yawRate;
    const yawInertiaFactor = clamp(
      0.72 +
        speedRatio * 0.42 +
        Math.abs(this.lateralVelocity) * 0.012 +
        this.fuelLoad * 0.035 +
        this.tireRelaxation * 0.12 +
        this.aeroWashout * 0.08 +
        this.aeroBuffetLoad * 0.025 -
        this.frontAeroLoad * 0.1,
      0.58,
      1.26
    );
    const yawResponseRate = clamp(
      (5.7 + this.frontAeroLoad * 1.1 + trailBrakeSupport * 1.2 + Math.abs(this.selfAlignTorque) * 0.55) /
        yawInertiaFactor -
        this.tireSaturation * 0.9 -
        this.lockup * 0.5,
      2.7,
      8.2
    );
    this.yawDamping = clamp(
      0.52 +
        this.roadAdhesion * 0.34 +
        this.tireGroundContact * 0.16 +
        this.frontAeroLoad * 0.18 +
        this.slipRecovery * 0.18 +
        throttlePickupSettle * 0.12 +
        Math.abs(this.selfAlignTorque) * 0.12 -
        this.tireSaturation * 0.22 -
        this.lockup * 0.14 -
        this.aeroWashout * 0.08 -
        this.aeroBuffetLoad * 0.025,
      0.2,
      1.2
    );
    this.yawRate += yawMoment * yawResponseRate * dt;
    this.yawRate = approach(this.yawRate, targetYawRate, dt * (1.05 + this.yawDamping * 1.35));
    this.yawRate = approach(this.yawRate, 0, dt * this.slipRecovery * (0.58 + speedRatio * 0.42));
    this.yawRate = approach(this.yawRate, 0, dt * throttlePickupSettle * (0.18 + speedRatio * 0.24));
    this.yawRate = approach(this.yawRate, 0, dt * this.yawDamping * (0.14 + speedRatio * 0.18));
    this.yawRate = clamp(this.yawRate, -0.74, 0.74);
    const yawInertiaLoadTarget = clamp(
      Math.abs(yawMoment) * (0.72 + speedRatio * 0.46) +
        Math.abs(this.yawRate) * speedRatio * 0.22 +
        Math.abs(this.lateralVelocity - curveFollow) * 0.016 +
        this.tireSaturation * 0.16 -
        this.tireGripReserve * 0.04 -
        this.yawDamping * 0.08 +
        this.steeringImpulse * 0.12 +
        this.liftOffRotationLoad * 0.16,
      0,
      1
    );
    this.yawInertiaLoad = approach(this.yawInertiaLoad, yawInertiaLoadTarget, dt * (yawInertiaLoadTarget > this.yawInertiaLoad ? 10 : 5));
    this.heading += (this.yawRate + racecraft.squeeze * this.contactRisk * 0.045) * dt;
    const steeringCommitment = clamp(Math.abs(steer) * 1.18 + this.slip * 0.42 + this.wheelspin * 0.2, 0, 1);
    const selfAlignTarget = -track.curve * (0.14 + speedRatio * 0.1);
    const selfAlignRate =
      (onTrack ? 1.25 + this.grip * 2.2 : 0.42 + this.tireContactGrip * 0.7) *
      (0.32 + speedRatio * 0.86) *
      (1 - steeringCommitment * 0.62);
    this.heading = approach(this.heading, selfAlignTarget, dt * selfAlignRate);
    this.heading = clamp(this.heading, -0.72, 0.72);
    this.slip = clamp(
      Math.max(
        Math.abs(this.yawRate) * speedRatio * (1.25 - this.grip),
        this.wheelspin * 0.45,
        this.lockup * 0.55,
        this.understeer * 0.62,
        this.tireSaturation * 0.42,
        Math.abs(this.rearTractionRotation) * 0.48,
        this.liftOffRotationLoad * 0.34,
        Math.abs(this.slipAngle) * 0.78
      ),
      0,
      1
    );

    const roadRelativeVelocityYaw = Math.atan2(this.lateralVelocity - curveFollow, Math.max(6, metersPerSecond));
    this.velocityYaw = approach(this.velocityYaw, roadRelativeVelocityYaw, dt * 10);
    const slipAngleTarget = clamp(this.heading - this.velocityYaw, -0.72, 0.72);
    this.slipAngle = approach(this.slipAngle, slipAngleTarget, dt * (Math.abs(slipAngleTarget) > Math.abs(this.slipAngle) ? 12 : 7));
    let slipAngleLoad = clamp((Math.abs(this.slipAngle) - 0.085) / 0.395, 0, 1);
    const rotationDirection = Math.sign(this.slipAngle || this.yawRate || this.rearTractionRotation || steer || 1);
    const counterInput = clamp((-steer * rotationDirection - 0.08) / 0.78, 0, 1);
    const crossedInput = clamp((steer * rotationDirection - 0.08) / 0.78, 0, 1);
    const rotationRecoveryWindow = clamp((Math.abs(this.slipAngle) + Math.abs(this.yawRate) * 0.52 + Math.abs(this.rearTractionRotation) * 0.32 - 0.045) / 0.52, 0, 1);
    const counterSteerTarget = clamp(
      counterInput *
        rotationRecoveryWindow *
        speedRatio *
        (0.42 + this.roadAdhesion * 0.36 + this.tireGripReserve * 0.22) *
        (1 - this.lockup * 0.42) *
        (1 - this.frontLockRisk * 0.2),
      0,
      1
    );
    this.counterSteerLoad = approach(
      this.counterSteerLoad,
      counterSteerTarget,
      dt * (counterSteerTarget > this.counterSteerLoad ? 12 : 5.2)
    );
    const slipRecoveryTarget = clamp(
      this.counterSteerLoad *
        (0.36 +
          this.yawDamping * 0.28 +
          this.tireGripReserve * 0.18 +
          this.rearBrakeStability * 0.1 -
          this.insideRearSlip * 0.12 -
          roadWetness * 0.12),
      0,
      1
    );
    this.slipRecovery = approach(this.slipRecovery, slipRecoveryTarget, dt * (slipRecoveryTarget > this.slipRecovery ? 11 : 4.8));
    this.slipAngle = approach(this.slipAngle, 0, dt * this.slipRecovery * (0.42 + speedRatio * 0.5));
    slipAngleLoad = clamp((Math.abs(this.slipAngle) - 0.085) / 0.395, 0, 1);
    const chassisStabilityTarget = clamp(
      1 -
        slipAngleLoad * 0.34 -
        this.yawInertiaLoad * 0.14 -
        this.tireSaturation * 0.18 -
        Math.abs(this.rearTractionRotation) * 0.16 -
        this.liftOffRotationLoad * 0.24 -
        this.insideRearSlip * 0.14 -
        Math.max(0, 1 - this.rearBrakeStability) * 0.12 -
        crossedInput * rotationRecoveryWindow * 0.12 +
        this.slipRecovery * 0.28 +
        this.yawDamping * 0.06,
      0.34,
      1.08
    );
    this.chassisStability = approach(
      this.chassisStability,
      chassisStabilityTarget,
      dt * (chassisStabilityTarget < this.chassisStability ? 10.5 : 5.2)
    );
    this.slip = Math.max(this.slip, slipAngleLoad * 0.5);
    const tireRelaxationTarget = clamp(
      this.tireSaturation * 0.36 +
        this.lateralScrub * 0.32 +
        slipAngleLoad * 0.3 +
        this.steeringRackLoad * 0.08 +
        this.steeringImpulse * 0.16 +
        Math.abs(this.steeringVelocity) * 0.06 +
        this.powerUndersteerLoad * 0.18 +
        this.lockup * 0.22 +
        this.frontLockRisk * 0.16 +
        this.wheelspin * 0.18 +
        this.driveTorqueLoad * 0.06 +
        this.pedalOverlapLoad * 0.16 +
        this.pedalPressureLoad * 0.14 +
        this.longitudinalSlipLoad * 0.08 +
        this.insideRearSlip * 0.18 +
        this.insideWheelUnload * 0.035 +
        this.tirePressureLoad * 0.14 +
        this.tireHeatStress() * 0.08 +
        this.differentialLock * Math.abs(rawSteer) * 0.06 +
        throttlePickupShock * 0.12 +
        Math.abs(this.rearTractionRotation) * 0.14 +
        this.liftOffRotationLoad * 0.34 +
        Math.max(0, 1 - this.rearBrakeStability) * 0.16 +
        Math.max(0, 1 - this.chassisStability) * 0.12 -
        this.slipRecovery * 0.18 -
        this.damperImpulse * 0.16 +
        this.surfaceEdgeLoad * 0.12 +
        Math.abs(this.splitSurfaceLoad) * 0.16 +
        Math.max(0, 1 - this.tireGroundContact) * 0.14 +
        this.standingWater * (0.12 + speedRatio * 0.1) +
        this.hydroplaneLoad * (0.12 + speedRatio * 0.1) +
        this.brakeReleaseShock * 0.18 +
        this.engineBraking * (0.06 + Math.abs(rawSteer) * 0.05) +
        trailBrakeInstability * 0.085 +
        lateralLoadStress * 0.085,
      0,
      1
    );
    this.tireRelaxation = approach(
      this.tireRelaxation,
      tireRelaxationTarget,
      dt * (tireRelaxationTarget > this.tireRelaxation ? 8.8 + speedRatio * 2.2 : 2.45 - roadWetness * 0.55)
    );
    const tireResponseLoadTarget = clamp(
      this.tireRelaxation * 0.28 +
        this.tireHeatStress() * 0.08 +
        this.steeringImpulse * 0.3 +
        Math.abs(this.steeringVelocity) * 0.16 +
        this.controlActuationLoad * 0.16 +
        this.pedalPressureLoad * 0.12 +
        this.combinedSlipLoad * 0.14 +
        lateralLoadStress * 0.12 +
        this.insideWheelUnload * 0.05 +
        Math.max(0, 1 - this.tireGroundContact) * 0.16 +
        this.hydroplaneLoad * 0.14 +
        roadWetness * speedRatio * 0.08 -
        this.slipRecovery * 0.18 -
        Math.max(0, this.chassisStability - 1) * 0.08,
      0,
      1
    );
    this.tireResponseLoad = approach(
      this.tireResponseLoad,
      tireResponseLoadTarget,
      dt * (tireResponseLoadTarget > this.tireResponseLoad ? 10.5 + speedRatio * 2 : 3.2 - roadWetness * 0.45)
    );
    const tireCarcassFlexTarget = clamp(
      this.tireResponseLoad * 0.24 +
        this.tireSaturation * 0.22 +
        this.combinedSlipLoad * 0.18 +
        this.lockup * 0.18 +
        this.wheelspin * 0.14 +
        this.frontLockRisk * 0.12 +
        this.tirePressureLoad * 0.14 +
        this.damperImpulse * 0.16 +
        this.floorStrikeLoad * 0.18 +
        Math.max(0, 1 - this.tireGroundContact) * 0.14 +
        this.surfaceEdgeLoad * 0.1 +
        Math.abs(this.splitSurfaceLoad) * 0.12 +
        this.hydroplaneLoad * 0.12 +
        this.outsideTireLoad * 0.08 +
        this.pedalOverlapLoad * 0.1 -
        this.slipRecovery * 0.12,
      0,
      1
    );
    this.tireCarcassFlex = approach(
      this.tireCarcassFlex,
      tireCarcassFlexTarget,
      dt * (tireCarcassFlexTarget > this.tireCarcassFlex ? 9.8 + speedRatio * 1.4 : 2.1 - roadWetness * 0.35)
    );

    const steeringSlipLimit = clamp(
      this.grip -
        this.understeer * 0.24 -
        this.powerUndersteerLoad * 0.06 -
        this.lockup * 0.12 -
        this.tireSaturation * 0.2 -
        this.tireHeatStress() * 0.015 -
        this.tireRelaxation * 0.07 -
        slipAngleLoad * 0.16 +
        this.slipRecovery * 0.1 +
        this.chassisStability * 0.025,
      0.2,
      1
    );
    const steeringLoad = 1 - clamp(speedRatio * 0.38 + this.wheelspin * 0.12, 0, 0.52);
    const lineError = this.x - track.center - track.racingLineOffset * (onTrack ? 0.42 : 0.16);
    const rollingRoadForce = clamp(Math.max((this.speed - 2) / 24, throttle * (1 - brake) * 0.65), 0, 1);
    const roadGuidanceAuthority = 1 + this.roadGuidanceLoad * (onTrack ? 0.22 : 0.08);
    const roadCentering =
      -lineError *
      this.roadAdhesion *
      (onTrack ? 0.22 + speedRatio * 0.48 : 0.08 + speedRatio * 0.16) *
      (1 - Math.abs(rawSteer)) *
      rollingRoadForce *
      roadGuidanceAuthority;
    const roadRecoveryPull =
      -offTrackSide *
      roadRecoveryNeed *
      (0.78 + speedRatio * 1.84) *
      (1 - Math.abs(rawSteer) * 0.32) *
      rollingRoadForce *
      roadGuidanceAuthority;
    const camberForce = -roadCamber * (0.32 + speedRatio * 0.92) * (onTrack ? 1 : 1.16) * (1 - Math.abs(rawSteer) * 0.5) * rollingRoadForce;
    const splitGripPull = tireContact.sideBias * speedRatio * (0.42 + contactRoughness * 0.6) * (1 - Math.abs(rawSteer) * 0.35) * rollingRoadForce;
    const splitSurfaceTug =
      this.splitSurfaceLoad * speedRatio * (0.56 + contactRoughness * 1.05 + this.surfaceEdgeLoad * 0.46) * (1 - Math.abs(rawSteer) * 0.26) * rollingRoadForce;
    const rearTractionSideSlip =
      this.rearTractionRotation *
      speedRatio *
      (0.82 + cornerDemand * 0.52 + this.differentialLock * 0.14 + this.insideRearSlip * 0.18) *
      (1 - brake * 0.64) *
      rollingRoadForce;
    const liftOffSideSlip =
      Math.sign(steer) *
      this.liftOffRotationLoad *
      speedRatio *
      (0.64 + this.engineBraking * 0.42 + Math.max(0, this.longitudinalLoadTransfer) * 0.32) *
      rollingRoadForce;
    const rearBrakeSideSlip =
      Math.sign(steer) *
      Math.max(0, 1 - this.rearBrakeStability) *
      brake *
      speedRatio *
      (0.38 + this.trailBraking * 1.2) *
      rollingRoadForce;
    const brakeSteeringRelease = 1 - clamp(brake * speedRatio * (0.48 + this.lockup * 0.86 + this.tireSaturation * 0.32), 0, 0.84);
    const steeringSaturationPush =
      Math.sign(rawSteer) * clamp((Math.abs(rawSteer) - 0.82) / 0.18, 0, 1) * speedRatio * (4.2 + speedRatio * 4.8) * rollingSteerFactor * brakeSteeringRelease;
    const chassisTravelBlend = (0.36 + this.roadAdhesion * 0.18) * (onTrack ? 1 : 0.58 + this.tireContactGrip * 0.28);
    const tireResponseGrip = clamp(1 - this.tireResponseLoad * (0.06 + speedRatio * 0.07) + this.frontAeroLoad * 0.025, 0.84, 1.04);
    const steeringSideForce =
      steer *
      (0.86 + speedRatio * 1.18) *
      steeringSlipLimit *
      steeringLoad *
      clamp(0.94 + this.tireGripReserve * 0.08, 0.88, 1.02) *
      this.roadAdhesion *
      tireResponseGrip *
      rollingSteerFactor *
      brakeSteeringRelease *
      clamp(1 - this.powerUndersteerLoad * 0.035 - this.steeringRackLoad * 0.03 - this.steeringImpulse * 0.008, 0.92, 1);
    const lateralIntent =
      Math.sin(this.heading) * metersPerSecond * chassisTravelBlend +
      steeringSideForce +
      curveFollow +
      camberForce +
      splitGripPull +
      splitSurfaceTug +
      rearTractionSideSlip +
      liftOffSideSlip +
      rearBrakeSideSlip +
      roadCentering +
      roadRecoveryPull +
      steeringSaturationPush +
      racecraft.squeeze * this.contactRisk * 0.72;
    const lateralAccelLimit =
      (7.4 + speedRatio * 10.6) *
      this.roadAdhesion *
      tireResponseGrip *
      clamp(0.94 + this.tireGripReserve * 0.08, 0.88, 1.02) *
      clamp(0.92 + this.chassisStability * 0.08 + this.slipRecovery * 0.04, 0.82, 1.04) *
      (onTrack ? 1 : 0.5 + this.tireContactGrip * 0.34);
    this.lateralVelocity = moveToward(this.lateralVelocity, lateralIntent, lateralAccelLimit * clamp(0.82 + this.tireGroundContact * 0.18, 0.82, 1.04) * dt);
    const slipVelocity = Math.abs(this.lateralVelocity - curveFollow);
    const scrubDeadzone = onTrack ? 1.25 + this.roadAdhesion * 1.1 : 0.35;
    const scrubTarget = clamp(
      Math.max(0, slipVelocity - scrubDeadzone) / (8.2 + speedRatio * 21 + this.roadAdhesion * 5) +
        Math.max(0, 0.58 - this.roadAdhesion) * 0.42 +
        this.tireSaturation * 0.1 +
        this.tireRelaxation * 0.04 +
        this.steeringRackLoad * 0.06 +
        this.steeringImpulse * 0.055 +
        this.controlActuationLoad * 0.035 +
        trailBrakeInstability * 0.035 +
        lateralLoadStress * 0.028 +
        slipAngleLoad * 0.12 +
        this.tirePressureLoad * 0.1 +
        this.surfaceEdgeLoad * 0.12 +
        Math.abs(this.splitSurfaceLoad) * 0.14 +
        Math.abs(this.rearTractionRotation) * 0.12 +
        this.liftOffRotationLoad * 0.09 +
        Math.max(0, 1 - this.chassisStability) * 0.12 -
        this.slipRecovery * 0.16 +
        Math.max(0, 1 - this.tireGroundContact) * 0.1,
      0,
      1
    );
    this.lateralScrub = approach(this.lateralScrub, scrubTarget, dt * 9);
    const tireLoadFeedbackTarget = clamp(
      this.tireForceLoad * 0.24 +
        this.combinedSlipLoad * 0.12 +
        this.tireSaturation * 0.28 +
        this.lateralScrub * 0.36 +
        slipAngleLoad * 0.22 +
        lateralLoadStress * 0.16 +
        this.tireRelaxation * 0.14 +
        this.tireResponseLoad * 0.12 +
        this.tireCarcassFlex * 0.16 +
        this.tireHeatStress() * 0.05 +
        this.axleLoadSaturation * 0.16 +
        this.outsideTireLoad * 0.08 +
        this.insideWheelUnload * 0.05 +
        this.controlActuationLoad * 0.12 +
        this.pedalPressureLoad * 0.08 +
        steeringRatioLoad * 0.08 +
        this.roadCamberLoad * 0.08 +
        this.tirePressureLoad * 0.12 +
        this.drivetrainCompliance * 0.08 +
        Math.max(0, 1 - this.tireContactPatch) * 0.08 +
        Math.max(0, 1 - this.chassisStability) * 0.12 -
        this.slipRecovery * 0.1 +
        this.damperImpulse * 0.12 +
        this.roadGuidanceLoad * 0.1 +
        this.surfaceEdgeLoad * 0.08 +
        Math.abs(this.splitSurfaceLoad) * 0.12 +
        this.hydroplaneLoad * 0.1 +
        this.powerUndersteerLoad * 0.12 +
        this.throttlePickupLoad * 0.1 +
        Math.abs(this.rearTractionRotation) * 0.12 +
        this.liftOffRotationLoad * 0.11 +
        Math.max(0, 1 - this.tireGroundContact) * 0.08,
      0,
      1
    );
    this.tireLoadFeedback = approach(
      this.tireLoadFeedback,
      tireLoadFeedbackTarget,
      dt * (tireLoadFeedbackTarget > this.tireLoadFeedback ? 12 : 4.8)
    );
    const steeringLoadFeedbackTarget = clamp(
      Math.pow(Math.abs(rawSteer), 0.82) *
        speedRatio *
        (0.18 +
          this.tireForceLoad * 0.28 +
          this.combinedSlipLoad * 0.1 +
          this.tireSaturation * 0.22 +
          this.tireLoadFeedback * 0.2 +
          this.tireResponseLoad * 0.14 +
          this.tireCarcassFlex * 0.12 +
          slipAngleLoad * 0.16 +
          lateralLoadStress * 0.12 +
          this.axleLoadSaturation * 0.12 +
          this.outsideTireLoad * 0.08 +
          this.insideWheelUnload * 0.04 +
          steeringRatioLoad * 0.18 +
          this.roadCamberLoad * 0.1 +
          this.roadGuidanceLoad * 0.1 +
          this.frontAxleLoad * 0.08) *
        (onTrack ? 1 : 0.45 + this.tireContactGrip * 0.35) *
        clamp(1.08 - this.wheelspin * 0.18 - this.lockup * 0.24, 0.54, 1.08) +
        this.steeringRackLoad * 0.18 +
        this.steeringImpulse * 0.22 +
        this.controlActuationLoad * 0.14 +
        Math.abs(this.steeringVelocity) * 0.12 +
        Math.abs(this.selfAlignTorque) * speedRatio * 0.12,
      0,
      1
    );
    this.steeringLoadFeedback = approach(
      this.steeringLoadFeedback,
      steeringLoadFeedbackTarget,
      dt * (steeringLoadFeedbackTarget > this.steeringLoadFeedback ? 10.5 : 5.2)
    );
    const scrubPenalty = Math.max(0, this.lateralScrub - 0.06);
    this.dirtyTirePickup = clamp(
      this.dirtyTirePickup + (scrubPenalty * Math.abs(rawSteer) * 0.46 + (onTrack ? 0 : surface.roughness * 0.16)) * speedRatio * dt,
      0,
      1
    );
    this.slip = Math.max(this.slip, scrubPenalty * 1.05);
    this.speed = clamp(this.speed - scrubPenalty * (7 + speedRatio * 24) * dt, 0, MAX_SPEED);
    const alignmentSlip = Math.abs(this.lateralVelocity - curveFollow);
    const alignmentTarget = clamp(
      Math.cos(this.heading) -
        alignmentSlip / Math.max(12, metersPerSecond * 0.9) -
        scrubPenalty * 0.34 -
        slipAngleLoad * 0.18 -
        (onTrack ? 0 : 0.08) +
        this.slipRecovery * 0.12,
      0.32,
      1
    );
    this.roadAlignment = approach(this.roadAlignment, alignmentTarget, dt * (onTrack ? 8 : 5.5));
    const biteTarget = clamp(
      this.roadAlignment * (0.54 + this.roadAdhesion * 0.46) -
        scrubPenalty * 0.28 -
        slipAngleLoad * 0.1 -
        this.wheelspin * 0.1 -
        this.lockup * 0.08 -
        this.tireSaturation * 0.12 -
        this.tireRelaxation * 0.05 -
        Math.abs(this.rearTractionRotation) * 0.03,
      0.28,
      1.04
    );
    this.forwardBite = approach(this.forwardBite, biteTarget, dt * (biteTarget < this.forwardBite ? 9 : 5));
    const longitudinalGripTarget = clamp(
      this.forwardBite * (0.48 + this.roadAdhesion * 0.52) * this.tireContactGrip -
        (1 - this.tireContactGrip) * 0.18 -
        this.surfaceEdgeLoad * 0.16 -
        Math.abs(this.splitSurfaceLoad) * 0.08 -
        Math.abs(this.rearTractionRotation) * 0.04 -
        this.insideWheelUnload * 0.015 -
        Math.max(0, 1 - this.tireGroundContact) * 0.1 -
        Math.max(0, this.longitudinalLoadTransfer) * 0.08 +
        Math.max(0, -this.longitudinalLoadTransfer) * 0.05 -
        Math.max(0, 1 - this.roadLoad) * 0.16 +
        Math.max(0, this.roadLoad - 1) * 0.04 -
        this.damperImpulse * 0.045 -
        this.tireSaturation * 0.12 -
        this.tireRelaxation * 0.04 -
        this.pedalOverlapLoad * 0.12 -
        slipAngleLoad * 0.1 -
        this.wheelspin * 0.08 -
        this.lockup * 0.06 -
        this.frontLockRisk * 0.08 -
        Math.max(0, 1 - this.rearBrakeStability) * 0.035 -
        this.insideRearSlip * 0.09 -
        this.driveTorqueLoad * this.tireSaturation * 0.035 +
        this.differentialLock * 0.025 -
        this.brakeReleaseShock * 0.22 -
        this.engineBraking * (0.035 + Math.abs(rawSteer) * 0.03) -
        trailBrakeInstability * 0.04 -
        this.standingWater * 0.14 +
        thresholdBrakeSupport * 0.05 -
        this.hydroplaneLoad * 0.06 -
        roadWetness * (onTrack ? 0.025 : 0.075),
      onTrack ? 0.42 : 0.2,
      1.08
    );
    this.longitudinalGrip = approach(
      this.longitudinalGrip,
      longitudinalGripTarget,
      dt * (longitudinalGripTarget < this.longitudinalGrip ? 10 : 5)
    );
    const pitchTarget = clamp(
      -this.roadGrade * 2.6 +
        this.roadCompression * 0.2 +
        brake * 0.04 -
        this.brakeBalanceLoad * 0.025 -
        throttle * speedRatio * 0.028 +
        this.longitudinalLoadTransfer * 0.075 +
        this.engineBraking * 0.035 +
        this.pedalOverlapLoad * 0.025 +
        this.suspensionTravel * 0.08 +
        this.suspensionVelocity * 0.03 +
        this.brakeReleaseShock * 0.03,
      -0.15,
      0.15
    );
    const rollTarget = clamp(
      -roadCamber * 0.48 -
        this.yawRate * 0.24 -
        Math.sign(this.lateralLoadTransfer || rawSteer) * lateralLoad * 0.11 -
        Math.sign(this.lateralVelocity || rawSteer) * this.lateralScrub * 0.08 +
        this.splitSurfaceLoad * 0.06 +
        Math.max(0, 1 - this.rearBrakeStability) * Math.sign(rawSteer || this.yawRate || 1) * 0.028 +
        this.rearTractionRotation * -0.07 +
        this.insideRearSlip * Math.sign(rawSteer || this.yawRate || 1) * -0.035 +
        contactRoughness * speedRatio * 0.04 +
        tireContact.heightRollBias * speedRatio * 0.42,
      -0.16,
      0.16
    );
    this.chassisPitch = approach(this.chassisPitch, pitchTarget, dt * 8);
    this.chassisRoll = approach(this.chassisRoll, rollTarget, dt * 9);
    const slipAngleProgressLoss = slipAngleLoad * (onTrack ? 0.05 : 0.1);
    const rollingProgress = onTrack
      ? clamp(0.76 + this.forwardBite * 0.24 - Math.abs(this.heading) * 0.018 - scrubPenalty * 0.04 - slipAngleProgressLoss, 0.74, 1.02)
      : clamp(0.42 + this.forwardBite * 0.32 - Math.abs(this.heading) * 0.06 - scrubPenalty * 0.14 - slipAngleProgressLoss, 0.32, 0.82);
    this.z += metersPerSecond * dt * 1.55 * rollingProgress;
    this.x += this.lateralVelocity * dt;
    if (this.session.assist.steeringHelp > 0) {
      const rejoinNeed = clamp((Math.abs(this.x - track.center) - track.halfWidth + 0.1) / 3.4, 0, 1);
      const rejoinTarget = track.center + track.racingLineOffset * 0.35;
      const rejoinRate = this.session.assist.steeringHelp * rejoinNeed * (onTrack ? 2.4 + speedRatio * 2.2 : 7.5 + speedRatio * 4.2);
      this.x = approach(this.x, rejoinTarget, dt * rejoinRate);
      this.lateralVelocity = approach(this.lateralVelocity, 0, dt * this.session.assist.steeringHelp * rejoinNeed * (onTrack ? 2.8 : 6.5));
    }
    this.keepCarInsideRecoveryApron(track, dt, speedRatio);
    this.lapTime += dt;
    this.totalTime += dt;
    this.updateFlowScore(dt, track, onTrack);
    this.updateTrackLimits(dt, onTrack);
  }

  private updateControlResponse(
    dt: number,
    throttleTarget: number,
    brakeTarget: number,
    steerTarget: number,
    speedRatio: number,
    roadWetness: number,
    contactRoughness: number,
    assistActivity: number
  ) {
    const gripConfidence = clamp(
      0.58 + this.roadAdhesion * 0.32 - this.tireSaturation * 0.18 - this.standingWater * 0.1,
      0.42,
      1
    );
    const throttleRise = 14 * gripConfidence * (1 - roadWetness * 0.1);
    const throttleFall = 10.5;
    const previousThrottle = this.controlThrottle;
    const previousBrake = this.controlBrake;
    this.controlThrottle = approach(
      this.controlThrottle,
      throttleTarget,
      dt * (throttleTarget > this.controlThrottle ? throttleRise : throttleFall)
    );

    const brakeRise = 19 - roadWetness * 1.4 + this.brakeTemp;
    const brakeFall = 7.4 + this.brakeReleaseShock * 1.6;
    this.controlBrake = approach(this.controlBrake, brakeTarget, dt * (brakeTarget > this.controlBrake ? brakeRise : brakeFall));

    const oppositeLock = this.controlSteer !== 0 && steerTarget !== 0 && Math.sign(this.controlSteer) !== Math.sign(steerTarget);
    const steeringReturn = steerTarget === 0;
    const speedDamping = clamp(1 - speedRatio * 0.42, 0.5, 1);
    const surfaceDamping = clamp(gripConfidence - contactRoughness * 0.08, 0.38, 1);
    const assistResponseBoost = clamp(assistActivity * 2.8, 0, 3.2);
    const steeringRate = steeringReturn
      ? 9.8 + speedRatio * 2.2 + this.steeringLoadFeedback * 3.4 + Math.abs(this.selfAlignTorque) * 2.4
      : oppositeLock
        ? 9.4 + speedRatio * 2.8
        : 12.4 * speedDamping * surfaceDamping + 1.55 + assistResponseBoost;
    const previousSteer = this.controlSteer;
    this.controlSteer = approach(this.controlSteer, steerTarget, dt * steeringRate);
    const rawSteeringVelocity = clamp((this.controlSteer - previousSteer) / Math.max(dt, 1 / 120), -2.6, 2.6);
    const steeringVelocityTarget = clamp(rawSteeringVelocity / 2.2, -1, 1);
    this.steeringVelocity = approach(
      this.steeringVelocity,
      steeringVelocityTarget,
      dt * (Math.abs(steeringVelocityTarget) > Math.abs(this.steeringVelocity) ? 18 : 7.2)
    );
    const steeringLag = Math.abs(steerTarget - this.controlSteer);
    const throttleLag = Math.abs(throttleTarget - this.controlThrottle);
    const brakeLag = Math.abs(brakeTarget - this.controlBrake);
    const pedalLag = Math.max(throttleLag, brakeLag);
    const pedalCrossover = Math.min(throttleTarget, brakeTarget) * (0.38 + speedRatio * 0.5);
    const throttlePressureRate = Math.abs(this.controlThrottle - previousThrottle) / Math.max(dt, 1 / 120);
    const brakePressureRate = Math.abs(this.controlBrake - previousBrake) / Math.max(dt, 1 / 120);
    const pedalPressureTarget = clamp(
      brakePressureRate * (0.035 + speedRatio * 0.026) +
        throttlePressureRate * (0.022 + speedRatio * 0.016) +
        Math.max(0, brakeLag - 0.1) * (0.22 + speedRatio * 0.16) +
        Math.max(0, throttleLag - 0.12) * (0.14 + speedRatio * 0.12) +
        pedalCrossover * 0.24 +
        brakeTarget * roadWetness * 0.04,
      0,
      1
    );
    this.pedalPressureLoad = approach(
      this.pedalPressureLoad,
      pedalPressureTarget,
      dt * (pedalPressureTarget > this.pedalPressureLoad ? 13 : 3.8 - roadWetness * 0.35)
    );
    const reversalLoad = oppositeLock ? clamp(Math.abs(steerTarget - previousSteer) * 0.42, 0, 1) : 0;
    const steeringImpulseTarget = clamp(
      Math.abs(this.steeringVelocity) * (0.42 + speedRatio * 0.34) +
        steeringLag * (0.12 + speedRatio * 0.12) +
        reversalLoad +
        contactRoughness * speedRatio * 0.05,
      0,
      1
    );
    this.steeringImpulse = approach(
      this.steeringImpulse,
      steeringImpulseTarget,
      dt * (steeringImpulseTarget > this.steeringImpulse ? 14 : 4.4)
    );
    const controlActuationTarget = clamp(
      Math.max(0, steeringLag - 0.08) * (0.22 + speedRatio * 0.32) +
        Math.max(0, pedalLag - 0.12) * (0.28 + speedRatio * 0.24) +
        pedalCrossover * 0.42 +
        reversalLoad * 0.36 +
        contactRoughness * speedRatio * 0.06,
      0,
      1
    );
    this.controlActuationLoad = approach(
      this.controlActuationLoad,
      controlActuationTarget,
      dt * (controlActuationTarget > this.controlActuationLoad ? 16 : 5.2)
    );

    return {
      throttle: this.controlThrottle,
      brake: this.controlBrake,
      steer: this.controlSteer
    };
  }

  private keepCarInsideRecoveryApron(track: ReturnType<typeof sampleTrack>, dt: number, speedRatio: number) {
    const lateral = this.x - track.center;
    const apronReach = track.halfWidth + (this.session.assist.steeringHelp > 0 ? 0.72 : 2.65);
    const overflow = Math.abs(lateral) - apronReach;

    if (overflow <= 0) {
      this.x = clamp(this.x, track.center - apronReach, track.center + apronReach);
      return;
    }

    const side = Math.sign(lateral) || 1;
    this.x = track.center + side * apronReach;
    if (this.lateralVelocity * side > 0) {
      this.lateralVelocity = approach(this.lateralVelocity, -side * Math.min(1.2, overflow * 0.65), dt * (10 + speedRatio * 8));
    }
    this.heading = approach(this.heading, -track.curve * 0.18 - side * 0.06, dt * (1.4 + speedRatio * 1.8));
    const apronImpact = clamp(overflow / 2.4, 0, 1);
    const lateralStrike = clamp(Math.abs(this.lateralVelocity) / 8, 0, 1);
    const apronDrag = (24 + speedRatio * 58) * (0.38 + apronImpact * 0.62) * (0.4 + lateralStrike * 0.6);
    this.speed = Math.max(0, this.speed - apronDrag * dt);
    this.lateralScrub = Math.max(this.lateralScrub, clamp(0.14 + apronImpact * 0.36 + lateralStrike * 0.18, 0, 0.72));
    this.surfaceRumble = Math.max(this.surfaceRumble, clamp(0.18 + apronImpact * 0.34 + speedRatio * 0.18, 0, 0.82));
    this.splitSurfaceLoad = approach(this.splitSurfaceLoad, side * clamp(0.18 + apronImpact * 0.42 + lateralStrike * 0.12, 0, 0.72), dt * 12);
    this.tireSaturation = Math.max(this.tireSaturation, clamp(apronImpact * 0.2 + lateralStrike * 0.16, 0, 0.5));
    this.tireRelaxation = Math.max(this.tireRelaxation, clamp(apronImpact * 0.08 + lateralStrike * 0.08, 0, 0.28));
  }

  private recoverToCircuit() {
    const track = sampleTrack(this.z);
    this.x = track.center + track.racingLineOffset * 0.25;
    this.heading = -track.curve * 0.16;
    this.lateralVelocity = 0;
    this.yawRate = 0;
    this.speed = Math.max(this.speed, 58);
    this.slip = 0.08;
    this.wheelspin = 0;
    this.understeer = 0;
    this.lockup = 0;
    this.brakeReleaseShock = 0;
    this.controlSteer = 0;
    this.controlThrottle = 0;
    this.controlBrake = 0;
    this.lastSteering = 0;
    this.engineBraking = 0;
    this.trailBraking = 0;
    this.thresholdBraking = 0;
    this.liftOffRotationLoad = 0;
    this.throttlePickupLoad = 0;
    this.powerUndersteerLoad = 0;
    this.pedalOverlapLoad = 0;
    this.drivetrainCompliance = 0;
    this.rearTractionRotation = 0;
    this.driveTorqueLoad = 0;
    this.differentialLock = 0;
    this.insideRearSlip = 0;
    this.grip = Math.max(this.grip, 0.62);
    this.surfaceRumble = 0;
    this.surfaceEdgeLoad = 0;
    this.splitSurfaceLoad = 0;
    this.hydroplaneLoad = 0;
    this.roadAdhesion = Math.max(this.roadAdhesion, 0.72);
    this.lateralScrub = 0;
    this.slipAngle = 0;
    this.velocityYaw = 0;
    this.forwardBite = Math.max(this.forwardBite, 0.82);
    this.longitudinalGrip = Math.max(this.longitudinalGrip, 0.82);
    this.tireContactGrip = Math.max(this.tireContactGrip, 0.82);
    this.tireRunoffShare = 0;
    this.tireGroundContact = Math.max(this.tireGroundContact, 0.9);
    this.combinedSlipLoad = 0;
    this.tireGripReserve = Math.max(this.tireGripReserve, 0.82);
    this.tirePressure = 1;
    this.tireContactPatch = Math.max(this.tireContactPatch, 0.92);
    this.tirePressureLoad = 0;
    this.tireThermalLoad = Math.min(this.tireThermalLoad, 0.22);
    this.tireRelaxation = 0;
    this.tireResponseLoad = 0;
    this.tireCarcassFlex = 0;
    this.tireLoadFeedback = 0;
    this.steeringLoadFeedback = 0;
    this.steeringRackLoad = 0;
    this.steeringVelocity = 0;
    this.steeringImpulse = 0;
    this.controlActuationLoad = 0;
    this.pedalPressureLoad = 0;
    this.steeringRatio = 1;
    this.selfAlignTorque = 0;
    this.yawInertiaLoad = 0;
    this.yawDamping = 1;
    this.counterSteerLoad = 0;
    this.slipRecovery = 0;
    this.chassisStability = 1;
    this.roadAlignment = Math.max(this.roadAlignment, 0.88);
    this.roadCamberLoad = 0;
    this.roadLoad = Math.max(this.roadLoad, 0.92);
    this.roadCompression = 0;
    this.roadGuidanceLoad = 0;
    this.roadFeelFeedback = 0;
    this.roadTextureLoad = 0;
    this.roadTexturePhase = 0;
    this.chassisHeave = 0;
    this.rideSettling = 0;
    this.suspensionLoad = Math.max(this.suspensionLoad, 0.9);
    this.suspensionTravel = 0;
    this.suspensionVelocity = 0;
    this.damperImpulse = 0;
    this.floorSealLoad = 0;
    this.floorStrikeLoad = 0;
    this.frontAeroLoad = 0;
    this.rearAeroLoad = 0;
    this.aeroBalance = 0;
    this.aeroWashout = 0;
    this.aeroBuffetLoad = 0;
    this.frontAxleLoad = Math.max(this.frontAxleLoad, 0.92);
    this.rearAxleLoad = Math.max(this.rearAxleLoad, 0.92);
    this.axleLoadSaturation = 0;
    this.longitudinalLoadTransfer = 0;
    this.lateralLoadTransfer = 0;
    this.outsideTireLoad = 0;
    this.insideWheelUnload = 0;
    this.brakeBalanceLoad = 0;
    this.frontLockRisk = 0;
    this.rearBrakeStability = 1;
    this.chassisPitch = 0;
    this.chassisRoll = 0;
    this.cleanLap = false;
    this.positionGainLockout = Math.max(this.positionGainLockout, 2.8);
    this.offTrackTime = -2.4;
    this.director.addPenalty(4);
    this.message = "Recovered to track: +4s";
    this.messageTimer = 1.3;
    this.cameraSnapTimer = 0.45;
    this.latestAssist = { steer: 0, brake: 0, throttleTrim: 0 };
  }

  private surfaceForLateral(track: ReturnType<typeof sampleTrack>, lateralFromCenter: number) {
    const lateral = Math.abs(lateralFromCenter);
    const legalEdge = track.halfWidth;

    if (lateral <= legalEdge - 0.55) {
      return { name: "Asphalt" as const, grip: 1, roughness: 0, drag: 0, trackLegal: true };
    }

    if (lateral <= legalEdge + 0.35) {
      return { name: "Kerb" as const, grip: 0.94, roughness: 0.52, drag: 6, trackLegal: true };
    }

    if (lateral <= legalEdge + 2.25) {
      return { name: "Runoff" as const, grip: 0.72, roughness: 0.38, drag: 48, trackLegal: false };
    }

    return { name: "Gravel" as const, grip: 0.54, roughness: 0.82, drag: 112, trackLegal: false };
  }

  private drivingSurface(track: ReturnType<typeof sampleTrack>) {
    return this.surfaceForLateral(track, this.x - track.center);
  }

  private sampleTireContactPatch(carLateral: number) {
    const wheelHalfTrack = 1.08;
    const axleOffsets = [-1.55, 1.55];
    let grip = 0;
    let roughness = 0;
    let drag = 0;
    let runoffShare = 0;
    let edgeLoad = 0;
    let sideBias = 0;
    let heightRollBias = 0;
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let standingWater = 0;
    let count = 0;

    for (const axleOffset of axleOffsets) {
      const wheelTrack = sampleTrack(this.z + axleOffset);
      const axleCenterLateral = this.x - wheelTrack.center;
      const axleCenterHeight = surfaceHeightAt(this.z + axleOffset, axleCenterLateral, wheelTrack);
      for (const side of [-1, 1]) {
        const wheelLateral = axleCenterLateral + side * wheelHalfTrack;
        const wheelSurface = this.surfaceForLateral(wheelTrack, wheelLateral);
        const wheelHeight = surfaceHeightAt(this.z + axleOffset, wheelLateral, wheelTrack);
        const wheelStandingWater = standingWaterAt(this.z + axleOffset, wheelLateral);
        const asphaltEdge = wheelTrack.halfWidth - 0.55;
        const kerbOuterEdge = wheelTrack.halfWidth + 0.35;
        const wheelAbs = Math.abs(wheelLateral);
        const asphaltStrike = clamp(1 - Math.abs(wheelAbs - asphaltEdge) / 0.7, 0, 1);
        const kerbDrop = clamp(1 - Math.abs(wheelAbs - kerbOuterEdge) / 0.85, 0, 1);
        const surfaceBite = wheelSurface.name === "Kerb" ? 0.16 : wheelSurface.name === "Runoff" ? 0.12 : wheelSurface.name === "Gravel" ? 0.18 : 0;

        grip += wheelSurface.grip;
        roughness += wheelSurface.roughness;
        drag += wheelSurface.drag;
        runoffShare += wheelSurface.trackLegal ? 0 : 1;
        edgeLoad += Math.max(asphaltStrike * 0.62, kerbDrop * 0.56, surfaceBite);
        sideBias += side * (1 - wheelSurface.grip + wheelSurface.roughness * 0.18);
        heightRollBias += side * (wheelHeight - axleCenterHeight);
        minHeight = Math.min(minHeight, wheelHeight);
        maxHeight = Math.max(maxHeight, wheelHeight);
        standingWater += wheelStandingWater;
        count += 1;
      }
    }

    const heightSpread = Number.isFinite(minHeight) ? clamp((maxHeight - minHeight) * 8.4, 0, 1) : 0;

    return {
      grip: grip / count,
      roughness: roughness / count,
      drag: drag / count,
      runoffShare: runoffShare / count,
      edgeLoad: clamp(edgeLoad / count + heightSpread * 0.2 + Math.abs(carLateral) / Math.max(1, sampleTrack(this.z).halfWidth + 4) * 0.04, 0, 1),
      sideBias: clamp(sideBias / count, -1, 1),
      heightSpread,
      heightRollBias: clamp((heightRollBias / count) * 7.5, -0.28, 0.28),
      standingWater: standingWater / count
    };
  }

  private trackEdgeLoad(track: ReturnType<typeof sampleTrack>, surface: ReturnType<SimcadeRaceModel["drivingSurface"]>, speedRatio: number) {
    const lateral = Math.abs(this.x - track.center);
    const asphaltEdge = track.halfWidth - 0.55;
    const kerbOuterEdge = track.halfWidth + 0.35;
    const asphaltStrike = clamp(1 - Math.abs(lateral - asphaltEdge) / 0.62, 0, 1);
    const kerbDrop = clamp(1 - Math.abs(lateral - kerbOuterEdge) / 0.78, 0, 1);
    const crossingSpeed = clamp(Math.abs(this.lateralVelocity) / 7.2, 0, 1);
    const surfaceBite = surface.name === "Kerb" ? 0.18 : surface.name === "Runoff" ? 0.1 : surface.name === "Gravel" ? 0.14 : 0;
    return clamp((asphaltStrike * 0.72 + kerbDrop * 0.54) * (0.25 + speedRatio * 0.75) * (0.35 + crossingSpeed * 0.65) + surfaceBite * speedRatio, 0, 1);
  }

  private trackGripContext(track: ReturnType<typeof sampleTrack>) {
    const lineError = Math.abs(this.x - track.center - track.racingLineOffset);
    const lineQuality = clamp(1 - lineError / Math.max(2.8, track.halfWidth * 0.5), 0, 1);
    const offLine = clamp((lineError - Math.max(2.1, track.halfWidth * 0.36)) / Math.max(1.8, track.halfWidth * 0.32), 0, 1);
    const dryBias = 1 - this.dynamicRoadWetness() * 0.55;
    const rubberedLineGrip = lineQuality * this.trackRubber * (0.035 + dryBias * 0.035);
    const pickupDebris = this.dirtyTirePickup * offLine * 0.028;
    const marbles = offLine * this.trackRubber * (0.42 + this.tireWear * 0.5) * dryBias + pickupDebris;

    return { lineError, lineQuality, offLine, rubberedLineGrip, marbles };
  }

  private updateDirtyTirePickup(
    dt: number,
    gripContext: ReturnType<SimcadeRaceModel["trackGripContext"]>,
    speedRatio: number,
    onTrack: boolean,
    surfaceRoughness: number,
    roadWetness: number
  ) {
    const looseSurfacePickup = onTrack ? 0 : surfaceRoughness * (0.14 + speedRatio * 0.66);
    const pickup = gripContext.marbles * speedRatio * (1 - gripContext.lineQuality * 0.72) * (0.8 + this.tireWear * 0.28) + looseSurfacePickup;
    const cleanLineScrub = gripContext.lineQuality * (1 - gripContext.offLine) * speedRatio * (0.72 + roadWetness * 0.12);
    const wetWash = roadWetness * 0.025;
    this.dirtyTirePickup = clamp(this.dirtyTirePickup + pickup * dt - (cleanLineScrub + wetWash) * dt, 0, 1);
  }

  private drivingAssist(track: ReturnType<typeof sampleTrack>, throttle: number, brake: number, steer: number) {
    const assist = this.session.assist;
    if (assist.steeringHelp === 0 && assist.throttleHelp === 0 && assist.brakeHelp === 0) {
      this.latestAssist = { steer: 0, brake: 0, throttleTrim: 0 };
      return this.latestAssist;
    }

    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const roadWetness = this.dynamicRoadWetness();
    const lookaheadDistance = 34 + speedRatio * 86 + roadWetness * 18;
    const futureTrack = sampleTrack(this.z + lookaheadDistance);
    const lineError = this.x - track.center - track.racingLineOffset;
    const lateralError = this.x - track.center;
    const offTrackAmount = clamp((Math.abs(lateralError) - track.halfWidth - 0.2) / 3.2, 0, 1);
    const edgeGuardAmount = clamp((Math.abs(lateralError) - track.halfWidth * 0.88) / Math.max(2.2, track.halfWidth * 0.36), 0, 1);
    const futureLineError = this.x - futureTrack.center - futureTrack.racingLineOffset;
    const blendedLineError = lineError * 0.42 + futureLineError * 0.58;
    const lineCorrection = clamp(-blendedLineError / Math.max(3.4, track.halfWidth * 0.72), -1, 1);
    const rejoinCorrection = clamp(-lateralError / Math.max(2.2, track.halfWidth * 0.54), -1, 1);
    const driverOverride = clamp(Math.abs(steer) * 1.25 + brake * 0.75, 0, 1);
    const handsOffTrust = 1 - driverOverride;
    const upcomingNeed = futureTrack.section.kind === "straight" ? 0.12 : clamp(futureTrack.section.difficulty, 0.32, 1);
    const cornerNeed = Math.max(track.section.kind === "straight" ? 0.12 : clamp(track.section.difficulty, 0.32, 1), upcomingNeed * (0.72 + speedRatio * 0.28));
    const stabilityBoost = 1 + handsOffTrust * (0.36 + roadWetness * 0.26);
    const steeringAssist = lineCorrection * assist.steeringHelp * cornerNeed * stabilityBoost * (1 - driverOverride * 0.72);
    const rejoinAssist =
      rejoinCorrection *
      assist.steeringHelp *
      Math.max(offTrackAmount, edgeGuardAmount * 0.24) *
      (1.18 + roadWetness * 0.28) *
      (1 - driverOverride * 0.45);
    const blendedSteerAssist = Math.abs(rejoinAssist) > Math.abs(steeringAssist) ? rejoinAssist : steeringAssist;
    const targetSpeed = Math.min(track.targetSpeedKph, futureTrack.targetSpeedKph);
    const paceOvershoot = clamp((this.speed - targetSpeed) / 86, 0, 1);
    const brakingWindow = track.brakingZone ? 1 : track.cornerPhase === "turn-in" ? 0.42 : 0;
    const upcomingBrakeWindow = futureTrack.brakingZone || futureTrack.cornerPhase === "turn-in" ? 0.82 : futureTrack.section.kind === "straight" ? 0 : 0.42;
    const weatherSafety = 0.35 + roadWetness * 0.65;
    const brakeAssist = clamp(
      assist.brakeHelp *
        Math.max(paceOvershoot * Math.max(brakingWindow, upcomingBrakeWindow * handsOffTrust * weatherSafety), Math.max(offTrackAmount, edgeGuardAmount * 0.2) * speedRatio * 0.74) *
        (1 - brake) *
        (0.35 + throttle * 0.65) *
        (1 + handsOffTrust * (0.25 + roadWetness * 0.5)),
      0,
      assist.brakeHelp * (1.25 + roadWetness * 0.75)
    );
    const throttleTrim =
      assist.throttleHelp *
      paceOvershoot *
      cornerNeed *
      clamp(speedRatio + 0.12, 0, 1) *
      (track.section.kind === "straight" && futureTrack.section.kind === "straight" ? 0.16 : 1) *
      (0.78 + handsOffTrust * (0.3 + roadWetness * 0.38));
    const rejoinThrottleTrim =
      assist.throttleHelp * Math.max(offTrackAmount, edgeGuardAmount * 0.25) * clamp(0.42 + speedRatio * 0.54 + roadWetness * 0.24, 0, 1);
    const finalThrottleTrim = clamp(Math.max(throttleTrim, rejoinThrottleTrim), 0, 0.94);

    this.latestAssist = {
      steer: Math.abs(blendedSteerAssist) < 0.01 ? 0 : clamp(blendedSteerAssist, -0.86, 0.86),
      brake: brakeAssist < 0.01 ? 0 : brakeAssist,
      throttleTrim: finalThrottleTrim < 0.01 ? 0 : finalThrottleTrim
    };
    return this.latestAssist;
  }

  private updateFlowScore(dt: number, track: ReturnType<typeof sampleTrack>, onTrack: boolean) {
    const paceError = Math.abs(this.speed - track.targetSpeedKph);
    const paceScore = clamp(1 - paceError / (track.section.kind === "straight" ? 150 : 92), 0, 1);
    const lineError = Math.abs(this.x - track.center - track.racingLineOffset);
    const lineScore = clamp(1 - lineError / Math.max(3.8, track.halfWidth * 0.84), 0, 1);
    const carCalm = clamp(
      1 -
        this.slip * 0.76 -
        this.lockup * 0.72 -
        this.wheelspin * 0.62 -
        this.understeer * 0.58 -
        this.tireRelaxation * 0.18 -
        Math.abs(this.lateralLoadTransfer) * 0.18 -
        this.frontWingDamage * 0.24 -
        this.dirtyTirePickup * 0.18,
      0,
      1
    );
    const raceRoom = clamp(1 - this.contactRisk * 0.68 - this.dirtyAir * 0.18, 0, 1);
    const sectionWeight = track.section.kind === "straight" ? 0.74 : 1;
    const recoverySurface = this.drivingSurface(track);
    const recoveryFloor = recoverySurface.name === "Gravel" ? 0.08 : 0.15;
    const target = onTrack
      ? clamp((paceScore * 0.3 + lineScore * 0.3 + carCalm * 0.28 + raceRoom * 0.12) * sectionWeight + 0.08, 0, 1)
      : recoveryFloor;
    this.flowScore = approach(this.flowScore, target, dt * (target > this.flowScore ? 0.82 : 2.9));
  }

  private updateTireState(dt: number, speedRatio: number, throttle: number, brake: number, steerDemand: number, surfaceRoughness: number, onTrack: boolean) {
    const roadWetness = this.dynamicRoadWetness();
    const slideHeat =
      this.tireSaturation * 0.38 +
      this.lateralScrub * 0.32 +
      this.wheelspin * 0.48 +
      this.lockup * 0.54 +
      this.longitudinalSlipLoad * 0.22 +
      this.frontLockRisk * 0.24 +
      this.insideRearSlip * 0.18 +
      this.powerUndersteerLoad * 0.16 +
      this.throttlePickupLoad * 0.12 +
      this.liftOffRotationLoad * 0.16;
    const wetCooling =
      roadWetness * (0.1 + speedRatio * 0.06) +
      this.standingWater * 0.14 +
      this.hydroplaneLoad * 0.08 +
      (1 - throttle) * 0.04;
    const thermalTarget = onTrack
      ? clamp(
          slideHeat +
            Math.max(0, this.tireTemp - 0.72) * 0.72 +
            Math.max(0, this.tirePressure - 1.04) * 0.34 +
            surfaceRoughness * speedRatio * 0.08 -
            wetCooling,
          0,
          1
        )
      : clamp(slideHeat * 0.7 + surfaceRoughness * speedRatio * 0.12 - roadWetness * 0.08, 0, 0.72);
    this.tireThermalLoad = approach(
      this.tireThermalLoad,
      thermalTarget,
      dt * (thermalTarget > this.tireThermalLoad ? 2.7 + speedRatio * 1.1 : 0.62 + roadWetness * 0.42)
    );
    const thermalStress = this.tireHeatStress();
    const heatLoad =
      speedRatio * 0.16 +
      steerDemand * speedRatio * 0.22 +
      brake * 0.24 +
      this.wheelspin * 0.34 +
      this.lockup * 0.42 +
      thermalStress * 0.08 +
      surfaceRoughness * 0.12;
    const cooling = roadWetness * 0.16 + (1 - throttle) * 0.035;
    const targetTemp = clamp(0.42 + heatLoad - cooling, 0.2, 1.08);
    this.tireTemp = approach(this.tireTemp, targetTemp, dt * (targetTemp > this.tireTemp ? 1.55 : 0.95));

    const loadPressure =
      Math.max(0, this.suspensionLoad - 1) * 0.1 +
      Math.abs(this.lateralLoadTransfer) * 0.08 +
      this.tireForceLoad * 0.045 +
      this.aeroPlatformLoad * 0.035 +
      brake * speedRatio * 0.03 +
      surfaceRoughness * speedRatio * 0.025;
    const pressureTarget = clamp(
      0.92 +
        this.tireTemp * 0.13 +
        speedRatio * speedRatio * 0.05 +
        loadPressure +
        thermalStress * 0.012 +
        this.dirtyTirePickup * 0.018 +
        this.tireWear * 0.025 -
        roadWetness * 0.052 -
        this.standingWater * 0.035,
      0.86,
      1.18
    );
    const previousPressure = this.tirePressure;
    this.tirePressure = approach(this.tirePressure, pressureTarget, dt * (pressureTarget > this.tirePressure ? 0.9 : 1.35));
    const highPressure = Math.max(0, this.tirePressure - 1.04);
    const lowPressure = Math.max(0, 0.96 - this.tirePressure);
    const pressureChange = Math.abs(this.tirePressure - previousPressure) / Math.max(dt, 1 / 120);
    this.tirePressureLoad = approach(
      this.tirePressureLoad,
      clamp(
        highPressure * 4.2 +
          lowPressure * 3.2 +
          pressureChange * 0.08 +
          Math.max(0, this.suspensionLoad - 1.12) * 0.28 +
          surfaceRoughness * speedRatio * 0.12 +
          this.roadTextureLoad * speedRatio * 0.08 +
          this.rideSettling * 0.04 +
          thermalStress * 0.04 +
          this.tireForceLoad * 0.055,
        0,
        1
      ),
      dt * (pressureTarget > this.tirePressure ? 5.8 : 4.2)
    );
    const contactPatchTarget = clamp(
      1 +
        Math.max(0, 1 - this.tirePressure) * 0.2 -
        highPressure * 1.15 -
        lowPressure * 0.35 +
        Math.max(0, this.suspensionLoad - 1) * 0.055 +
        this.aeroPlatformLoad * 0.025 -
        Math.max(0, 1 - this.tireGroundContact) * 0.16 -
        thermalStress * 0.008 -
        surfaceRoughness * 0.035 -
        this.roadTextureLoad * 0.018 -
        this.rideSettling * 0.012,
      0.74,
      1.1
    );
    this.tireContactPatch = approach(
      this.tireContactPatch,
      contactPatchTarget,
      dt * (contactPatchTarget < this.tireContactPatch ? 6.8 : 4.2)
    );

    const wearRate =
      0.00025 +
      speedRatio * 0.00045 +
      thermalStress * 0.0007 +
      this.wheelspin * 0.0048 +
      this.lockup * 0.0062 +
      this.understeer * 0.0022 +
      (onTrack ? 0 : 0.002 + surfaceRoughness * 0.0025);
    this.tireWear = clamp(this.tireWear + wearRate * dt, 0, 1);
  }

  private tireHeatStress() {
    const peakAbuse = Math.max(this.frontLockRisk, this.insideRearSlip);
    return Math.max(0, this.tireThermalLoad - 0.72) * clamp((peakAbuse - 0.88) / 0.12, 0, 1);
  }

  private updateFuelLoad(dt: number, throttle: number, boost: number, speedRatio: number) {
    const burnRate = throttle * (0.0028 + speedRatio * 0.0052) + boost * 0.0024;
    this.fuelLoad = clamp(this.fuelLoad - burnRate * dt, 0.38, 1);
  }

  private updateEngineBraking(
    dt: number,
    previousThrottle: number,
    throttle: number,
    throttleTarget: number,
    brake: number,
    speedRatio: number,
    roadWetness: number,
    onTrack: boolean
  ) {
    const lowGearLoad = clamp((6 - this.currentGear) / 5, 0, 1);
    const driverLift = clamp(1 - Math.max(throttle, throttleTarget), 0, 1);
    const throttleDrop = throttleTarget < 0.45 ? clamp(previousThrottle - throttle, 0, 1) : 0;
    const coastLoad = clamp(driverLift * (1 - brake * 0.7) * speedRatio * (0.12 + lowGearLoad * 0.28), 0, 1);
    const liftImpulse = throttleDrop * (0.22 + speedRatio * 0.24 + lowGearLoad * 0.16) * (1 - brake * 0.45);
    const wetStabilityTrim = 1 - roadWetness * 0.16;
    const surfaceTrim = onTrack ? 1 : 0.55;
    const target = clamp((coastLoad + liftImpulse + this.shiftCut * driverLift * 0.08) * wetStabilityTrim * surfaceTrim, 0, 1);
    this.engineBraking = approach(this.engineBraking, target, dt * (target > this.engineBraking ? 9.5 : 3.4));
  }

  private updatePowertrainState(dt: number, throttle: number, brake: number, roadWetness: number, onTrack: boolean, surfaceRoughness: number) {
    this.shiftCut = Math.max(0, this.shiftCut - dt * 7.8);

    const nextGear = Math.min(7, this.currentGear + 1);
    const previousGear = Math.max(1, this.currentGear - 1);
    const upshiftAt = GEAR_SPEED_LIMITS[this.currentGear] - 4 + throttle * 6;
    const downshiftAt = GEAR_SPEED_LIMITS[previousGear] - 16 - brake * 8;

    if (this.currentGear < 7 && this.speed > upshiftAt && throttle > 0.18) {
      this.currentGear = nextGear;
      this.shiftCut = Math.max(this.shiftCut, 1);
    } else if (this.currentGear > 1 && this.speed < downshiftAt) {
      this.currentGear = previousGear;
      this.shiftCut = Math.max(this.shiftCut, 0.55);
    }

    const lowGearLoad = clamp((5 - this.currentGear) / 4, 0, 1);
    const wetWheelLoad = roadWetness * throttle * (0.16 + lowGearLoad * 0.2);
    const lowGripLoad = (1 - this.grip) * throttle * (0.28 + lowGearLoad * 0.22);
    const contactLossLoad = (1 - this.roadAdhesion) * throttle * (0.16 + lowGearLoad * 0.16);
    const edgeLoad = this.surfaceEdgeLoad * throttle * (0.12 + lowGearLoad * 0.08);
    const gearTorqueLoad = throttle * lowGearLoad * (0.12 + roadWetness * 0.1);
    const roughLoad = onTrack ? surfaceRoughness * throttle * 0.12 : surfaceRoughness * (0.22 + throttle * 0.18);
    const shiftRecoveryLoad = this.shiftCut * throttle * 0.16;
    const biteTarget = clamp(
      wetWheelLoad +
        lowGripLoad +
        contactLossLoad +
        edgeLoad +
        gearTorqueLoad +
        roughLoad +
        shiftRecoveryLoad +
        this.pedalOverlapLoad * 0.18 +
        this.wheelspin * 0.36 +
        Math.abs(this.rearTractionRotation) * 0.28,
      0,
      1
    );
    this.tractionBite = approach(this.tractionBite, biteTarget, dt * (biteTarget > this.tractionBite ? 7.4 : 4.8));
  }

  private engineTorqueCurve() {
    const lower = GEAR_SPEED_LIMITS[this.currentGear - 1] ?? 0;
    const upper = GEAR_SPEED_LIMITS[this.currentGear] ?? MAX_SPEED;
    const gearProgress = clamp((this.speed - lower) / Math.max(1, upper - lower), 0, 1);
    const midRangePunch = Math.sin(gearProgress * Math.PI) * 0.28;
    const lowGearPunch = this.currentGear <= 2 ? 0.08 : 0;
    const redlineTailoff = clamp((gearProgress - 0.9) / 0.1, 0, 1) * 0.18;
    return clamp(0.82 + midRangePunch + lowGearPunch - redlineTailoff, 0.74, 1.16);
  }

  private updateBrakeState(dt: number, brake: number, speedRatio: number, roadWetness: number) {
    const heat = brake * speedRatio * (0.32 + brake * 0.42 + this.lockup * 0.18 + this.pedalOverlapLoad * 0.16);
    const cooling = (1 - brake) * (0.08 + speedRatio * 0.12) + roadWetness * 0.04;
    this.brakeTemp = clamp(this.brakeTemp + (heat - cooling) * dt * 0.34, 0.16, 1.1);
    this.brakeFade = clamp((this.brakeTemp - 0.86) / 0.2, 0, 1);
    const biteTarget = clamp(0.78 + this.brakeTemp * 0.34 - this.brakeFade * 0.2, 0.72, 1.05);
    this.brakeBite = approach(this.brakeBite, biteTarget, dt * (biteTarget > this.brakeBite ? 3.8 : 5.2));
  }

  private fuelMassKg() {
    return 18 + this.fuelLoad * 42;
  }

  private updateTrackEvolution(dt: number, speedRatio: number, onTrack: boolean, surfaceRoughness: number) {
    if (!onTrack || this.phase !== "racing") return;

    const cleanLoad = clamp(speedRatio * (1 - surfaceRoughness * 0.55) * (1 - this.slip * 0.35), 0, 1);
    const wetness = this.dynamicRoadWetness();
    const rubberRate = cleanLoad * (0.0042 + speedRatio * 0.0048) * (1 - wetness * 0.62);
    const dryingRate = cleanLoad * this.session.weather.roadWetness * (0.01 + (1 - this.session.weather.rainIntensity) * 0.012);
    const rainWash = this.session.weather.rainIntensity * 0.0018;

    this.trackRubber = clamp(this.trackRubber + rubberRate * dt - rainWash * dt, 0, 1);
    this.dryingLine = clamp(this.dryingLine + dryingRate * dt - this.session.weather.rainIntensity * 0.0008 * dt, 0, 1);
  }

  private dynamicRoadWetness() {
    return clamp(this.session.weather.roadWetness - this.dryingLine * (0.12 + (1 - this.session.weather.rainIntensity) * 0.18), 0, 1);
  }

  private evolvedWeatherGrip() {
    const rubberGrip = this.trackRubber * (0.035 + (1 - this.dynamicRoadWetness()) * 0.025);
    const dryLineGrip = this.dryingLine * this.session.weather.roadWetness * 0.035;
    return clamp(this.session.weather.gripMultiplier + rubberGrip + dryLineGrip, 0.64, 1.06);
  }

  private updateTrackLimits(dt: number, onTrack: boolean) {
    if (onTrack) {
      this.offTrackTime = 0;
      return;
    }

    this.offTrackTime += dt;
    if (this.offTrackTime > 1.15) {
      this.cleanLap = false;
      this.trackLimitWarnings += 1;
      this.director.addPenalty(5);
      this.offTrackTime = -3.2;
      this.message = this.trackLimitWarnings >= 3 ? "+5s penalty: lap invalidated" : "+5s track limits";
      this.messageTimer = 1.3;
    }
  }

  private gear() {
    return this.currentGear;
  }

  private rpm() {
    const gear = this.currentGear;
    const lower = GEAR_SPEED_LIMITS[gear - 1] ?? 0;
    const upper = GEAR_SPEED_LIMITS[gear] ?? MAX_SPEED;
    const gearProgress = clamp((this.speed - lower) / Math.max(1, upper - lower), 0, 1);
    return Math.round(4300 + gearProgress * 5600 + this.slip * 760 - this.shiftCut * 850);
  }

  private updateRivals(dt: number) {
    const playerTrack = sampleTrack(this.z);
    const playerCanGainPosition =
      this.drivingSurface(playerTrack).trackLegal && this.positionGainLockout === 0 && this.speed > 36 && this.phase === "racing";

    for (const rival of this.rivals) {
      const track = sampleTrack(rival.distance);
      const targetSpeed = clamp(track.targetSpeedKph * rival.pace + 10, 76, 282);
      rival.speed = approach(rival.speed, targetSpeed, dt * (rival.speed > targetSpeed ? 2.4 : 0.65));
      this.updateRivalLane(rival, track, dt);
      rival.distance += rival.speed * (1000 / 3600) * dt * 1.48;
      if (rival.position === this.position - 1 && rival.distance < this.z - 60 && this.position > 1) {
        if (!playerCanGainPosition) {
          rival.distance = Math.max(rival.distance, this.z + 48 + rival.id * 7);
          rival.speed = Math.max(rival.speed, this.speed * 0.82);
          rival.defending = false;
          if (this.raceControlCooldown === 0) {
            this.message = "Race control: give it back";
            this.messageTimer = 1.2;
            this.raceControlCooldown = 2.8;
          }
          continue;
        }

        const oldPosition = this.position;
        this.position -= 1;
        rival.position = oldPosition;
        this.overtakeStreak += 1;
        rival.distance = this.z - 70 - rival.id * 8;
        rival.lane = (((rival.id + this.position) % 3) - 1) * 2.4;
        rival.desiredLane = rival.lane;
        rival.defending = false;
        this.message = `Passed ${rival.driver} for P${this.position}`;
        this.messageTimer = 1.2;
      }
    }
  }

  private updateRivalLane(rival: RivalState, track: ReturnType<typeof sampleTrack>, dt: number) {
    const playerGap = rival.distance - this.z;
    const playerLane = this.x - track.center;
    const rivalX = track.center + rival.lane;
    const lateralGap = Math.abs(rivalX - this.x);
    const baseLane = clamp(track.racingLineOffset + ((rival.id % 3) - 1) * 0.55, -3.1, 3.1);
    const alongside = Math.abs(playerGap) < 20 && lateralGap < 6.2;
    const pressured = playerGap > 0 && playerGap < 125 && lateralGap < 8.5;

    rival.defending = pressured || alongside;
    if (alongside) {
      const spaceDirection = rivalX >= this.x ? 1 : -1;
      rival.desiredLane = clamp(playerLane + spaceDirection * 3.1, -4.2, 4.2);
    } else if (pressured) {
      rival.desiredLane = clamp(baseLane * 0.58 + playerLane * 0.42, -3.8, 3.8);
    } else {
      rival.desiredLane = baseLane;
    }

    const laneResponse = rival.defending ? 1.9 : 0.72;
    rival.lane = approach(rival.lane, rival.desiredLane, dt * laneResponse);
  }

  private raceAirEffect(track: ReturnType<typeof sampleTrack>) {
    let draft = 0;
    let dirtyAir = 0;

    for (const rival of this.rivals) {
      const gap = rival.distance - this.z;
      if (gap <= 0 || gap > 220) continue;

      const rivalTrack = sampleTrack(rival.distance);
      const lateralGap = Math.abs(rivalTrack.center + rival.lane - this.x);
      const alignment = clamp((6.2 - lateralGap) / 6.2, 0, 1);
      const wake = clamp((220 - gap) / 190, 0, 1) * alignment;
      draft = Math.max(draft, wake * clamp((gap - 6) / 28, 0, 1));

      const cornerWake = track.section.kind === "straight" ? 0.18 : 1;
      dirtyAir = Math.max(dirtyAir, wake * clamp((58 - gap) / 42, 0, 1) * cornerWake);
    }

    return { draft: clamp(draft, 0, 1), dirtyAir: clamp(dirtyAir, 0, 1) };
  }

  private racecraftPressure() {
    let proximity = 0;
    let sideBySide = 0;
    let contactRisk = 0;
    let squeeze = 0;

    for (const rival of this.rivals) {
      const gap = rival.distance - this.z;
      if (gap < -24 || gap > 72) continue;

      const rivalTrack = sampleTrack(rival.distance);
      const rivalX = rivalTrack.center + rival.lane;
      const lateralGap = Math.abs(rivalX - this.x);
      const longitudinalPressure = clamp(1 - Math.abs(gap) / 72, 0, 1);
      const lateralPressure = clamp(1 - lateralGap / 8.2, 0, 1);
      const alongsidePressure = clamp(1 - Math.abs(gap) / 18, 0, 1) * clamp(1 - lateralGap / 6.2, 0, 1);
      const contactPressure = clamp(1 - Math.abs(gap) / 12, 0, 1) * clamp(1 - lateralGap / 4.4, 0, 1);

      proximity = Math.max(proximity, longitudinalPressure * lateralPressure);
      sideBySide = Math.max(sideBySide, alongsidePressure);
      contactRisk = Math.max(contactRisk, contactPressure);

      if (contactPressure > 0.2) {
        const directionAwayFromRival = this.x >= rivalX ? 1 : -1;
        squeeze += directionAwayFromRival * contactPressure;
      }
    }

    return { proximity: clamp(proximity, 0, 1), sideBySide: clamp(sideBySide, 0, 1), contactRisk: clamp(contactRisk, 0, 1), squeeze: clamp(squeeze, -1, 1) };
  }

  private defensiveRivalCount() {
    return this.rivals.filter((rival) => rival.defending).length;
  }

  private nearestRivalGapMeters() {
    let nearest: number | null = null;
    for (const rival of this.rivals) {
      const gap = rival.distance - this.z;
      if (Math.abs(gap) > 260) continue;
      if (nearest === null || Math.abs(gap) < Math.abs(nearest)) {
        nearest = gap;
      }
    }

    return nearest;
  }

  private leaderboard() {
    const player = {
      position: this.position,
      driver: "You",
      team: "APEX",
      gap: null,
      accent: "#e20e3b",
      isPlayer: true
    };
    const rivals = this.rivals.map((rival) => ({
      position: rival.position,
      driver: rival.driver,
      team: rival.team,
      gap: (rival.distance - this.z) / 42,
      accent: rival.color,
      isPlayer: false
    }));

    const sorted = [...rivals, player].sort((left, right) => left.position - right.position);
    if (this.position <= 5) return sorted.slice(0, 6);

    const focused = [
      ...sorted.slice(0, 3),
      ...sorted.filter((entry) => entry.position >= this.position - 1 && entry.position <= this.position + 1)
    ];
    return focused.filter((entry, index) => focused.findIndex((item) => item.position === entry.position) === index).slice(0, 6);
  }

  private airState() {
    if (this.dirtyAir > 0.16) return "Dirty air";
    if (this.draft > 0.03) return "Slipstream";
    return "Clean air";
  }

  private racecraftState() {
    if (this.frontWingDamage > 0.24) return "Wing damage";
    if (this.contactRisk > 0.64) return "Contact risk";
    if (this.sideBySide > 0.32) return "Wheel to wheel";
    if (this.rivalProximity > 0.24) return "Closing rival";
    return this.airState();
  }

  private flowState() {
    if (!this.cleanLap || this.flowScore < 0.28) return "Reset rhythm";
    if (this.flowScore > 0.74) return "In the zone";
    if (this.flowScore > 0.48) return "Good rhythm";
    return "Untidy";
  }

  private tireState() {
    if (this.tireWear > 0.68) return "Worn tires";
    if (this.tireTemp > 0.88) return "Tires hot";
    if (this.tireTemp < 0.38) return "Cold tires";
    if (this.tireTemp > 0.62 && this.tireTemp < 0.84) return "Tires ready";
    return "Tires stable";
  }

  private fuelState() {
    if (this.fuelLoad > 0.82) return "Heavy fuel";
    if (this.fuelLoad > 0.62) return "Fuel coming down";
    return "Light car";
  }

  private brakeState() {
    if (this.brakeFade > 0.35) return "Brake fade";
    if (this.brakeTemp > 0.72) return "Brakes hot";
    if (this.brakeTemp < 0.28) return "Cold brakes";
    return "Brakes ready";
  }

  private powerState() {
    if (this.shiftCut > 0.32) return "Shift cut";
    if (this.engineBraking > 0.11) return "Engine braking";
    if (this.throttlePickupLoad > 0.12) return "Throttle pickup";
    if (this.powerUndersteerLoad > 0.12) return "Power understeer";
    if (this.pedalOverlapLoad > 0.18) return "Pedal overlap";
    if (this.trailBraking > 0.08) return "Trail braking";
    if (this.thresholdBraking > 0.16) return "Threshold braking";
    if (this.insideRearSlip > 0.16) return "Inside rear slip";
    if (this.differentialLock > 0.18) return "Diff locking";
    if (Math.abs(this.rearTractionRotation) > 0.16) return "Rear rotation";
    if (this.tractionBite > 0.42) return "Traction limited";
    if (this.rpm() > 9200) return "Near redline";
    return "Power hooked";
  }

  private gripState(gripContext: ReturnType<SimcadeRaceModel["trackGripContext"]>) {
    if (this.dirtyTirePickup > 0.12) return "Dirty tires";
    if (gripContext.marbles > 0.005) return "Marbles offline";
    if (gripContext.rubberedLineGrip > 0.01) return "Rubbered line";
    return this.trackEvolutionState();
  }

  private trackEvolutionState() {
    if (this.session.weather.roadWetness > 0.04 && this.dryingLine > 0.018) return "Drying line";
    if (this.trackRubber > 0.28) return "Rubbered in";
    if (this.trackRubber > 0.08) return "Rubber building";
    if (this.session.weather.roadWetness > 0.18) return "Wet track";
    return this.session.weather.roadWetness > 0.04 ? "Damp track" : "Green track";
  }

  private damageState() {
    if (this.frontWingDamage > 0.42) return "Wing damaged";
    if (this.frontWingDamage > 0.16) return "Wing wounded";
    if (this.frontWingDamage > 0.025) return "Wing scraped";
    return "Wing clean";
  }

  private trackCue(track: ReturnType<typeof sampleTrack>) {
    if (track.brakingZone) {
      return this.speed > track.targetSpeedKph + 28 ? "Brake now" : "Trail to apex";
    }

    const surface = this.drivingSurface(track);
    if (surface.name === "Gravel") return "Gravel trap";
    if (surface.name === "Runoff") return "Rejoin safely";
    if (surface.name === "Kerb") return "Kerb strike";

    if (this.dirtyAir > 0.28 && track.section.kind !== "straight") {
      return "Washout risk";
    }

    if (track.section.kind === "straight") {
      if (this.aeroBoostActive > 0.45) return "Aero open";
      if (this.aeroBoostAvailable && this.ers > 0.18) return "Aero ready";
    }

    if (this.draft > 0.03 && track.section.kind === "straight") {
      return this.draft > 0.12 ? "Tow active" : "Tow building";
    }

    if (track.cornerPhase === "apex") {
      return this.speed > track.targetSpeedKph + 18 ? "Too hot" : "Clip the apex";
    }

    if (track.cornerPhase === "exit") {
      return "Open hands";
    }

    if (track.section.kind === "straight") {
      return this.ers > 0.18 && this.speed > 145 ? "ERS window" : "Open throttle";
    }

    if (track.sectionProgress > 0.6) {
      return "Power on exit";
    }

    return track.section.kind === "esses" ? "Balance the car" : "Hold the line";
  }

  private updateRaceDirector() {
    for (const event of this.director.update(this.z, this.totalTime)) {
      if (event.type === "checkpoint") {
        this.message = event.checkpoint.name;
        this.messageTimer = 0.55;
      }

      if (event.type === "sector") {
        const sectorTime = event.time - this.previousSectorTime;
        const sectorDelta = sectorTime - this.referenceSectorTime(event.sector);
        this.previousSectorTime = event.time;
        this.lastSector = event.sector;
        this.lastSectorTime = sectorTime;
        this.lastSectorDelta = sectorDelta;
        this.sectorPaceScore = this.scoreSectorPace(sectorDelta);
        this.sectorPaceState = this.sectorPaceLabel(this.sectorPaceScore);
        this.message = `S${event.sector} ${this.sectorPaceState} ${sectorDelta >= 0 ? "+" : ""}${sectorDelta.toFixed(2)}`;
        this.messageTimer = 1.05;
      }

      if (event.type === "lap") {
        this.splitDelta = this.bestLap === null ? null : event.time - this.bestLap;
        if (event.valid && (this.bestLap === null || event.time < this.bestLap)) {
          this.bestLap = event.time;
        }

        if (!event.valid) {
          this.message = "Lap deleted";
          this.messageTimer = 1.2;
        }

        this.lap = Math.min(event.lap + 1, LAPS);
        if (event.lap >= LAPS) {
          this.lapTime = event.time;
        } else {
          this.lapTime = 0;
          this.cleanLap = true;
          this.offTrackTime = 0;
          this.previousSectorTime = 0;
        }
      }

      if (event.type === "finish") {
        this.phase = "finished";
        this.lap = LAPS;
        this.totalTime = event.time;
        this.message = this.position <= 3 ? "Podium secured" : "Race complete";
        this.messageTimer = 8;
      }
    }
  }

  private referenceSectorTime(sector: 1 | 2 | 3) {
    const sectorEnds = getTrackSectorEnds();
    const sectorStart = sector === 1 ? 0 : sectorEnds[sector - 2];
    const sectorLength = sectorEnds[sector - 1] - sectorStart;
    const wetPenalty = this.dynamicRoadWetness() * 0.16;
    const difficultyPenalty = this.session.track.difficulty * 0.08;
    return (sectorLength / 67) * (1 + wetPenalty + difficultyPenalty);
  }

  private scoreSectorPace(delta: number) {
    const paceScore = clamp(1 - (delta + 2.5) / 9, 0, 1);
    const rhythmBonus = this.flowScore * 0.26;
    const cleanBonus = this.cleanLap ? 0.12 : -0.18;
    return clamp(paceScore * 0.62 + rhythmBonus + cleanBonus, 0, 1);
  }

  private sectorPaceLabel(score: number) {
    if (!this.cleanLap) return "Sector invalid";
    if (score > 0.82) return "Purple sector";
    if (score > 0.66) return "Green sector";
    if (score > 0.48) return "Solid sector";
    return "Sector time lost";
  }
}
