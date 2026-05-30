import { RaceDirector } from "./RaceDirector";
import { TRACK_LOOP_LENGTH, getTrackCheckpoints, getTrackSectorEnds, sampleTrack, setActiveTrackLayout, terrainHeightAt, trackCurveAt } from "./trackPath";
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
  roadAdhesion: number;
  lateralScrub: number;
  slipAngle: number;
  velocityYaw: number;
  forwardBite: number;
  longitudinalGrip: number;
  tireContactGrip: number;
  tireRunoffShare: number;
  tireForceLoad: number;
  tireSaturation: number;
  roadAlignment: number;
  roadCamber: number;
  roadGrade: number;
  roadLoad: number;
  roadCompression: number;
  suspensionLoad: number;
  suspensionTravel: number;
  roadWetness: number;
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
  powerState: string;
  tireTemp: number;
  tireWear: number;
  tireState: string;
  fuelLoad: number;
  fuelMassKg: number;
  fuelState: string;
  brakeTemp: number;
  brakeFade: number;
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

function surfaceHeightAt(distance: number, lateral: number, track: ReturnType<typeof sampleTrack>, offset = 0) {
  const normalized = clamp(lateral / Math.max(1, track.halfWidth), -1.35, 1.35);
  const bankedRoad = track.elevation + track.bank * normalized;
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
    distance: 84 + (fieldSize - index - 1) * 62,
    speed: 166 - index * 5,
    pace: 0.98 - index * 0.017,
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
  private grip = 1;
  private roadAdhesion = 1;
  private lateralScrub = 0;
  private slipAngle = 0;
  private velocityYaw = 0;
  private forwardBite = 1;
  private longitudinalGrip = 1;
  private tireContactGrip = 1;
  private tireRunoffShare = 0;
  private tireForceLoad = 0;
  private tireSaturation = 0;
  private roadAlignment = 1;
  private roadGrade = 0;
  private roadLoad = 1;
  private roadCompression = 0;
  private suspensionLoad = 1;
  private suspensionTravel = 0;
  private chassisPitch = 0;
  private chassisRoll = 0;
  private ers = 1;
  private aeroBoostAvailable = false;
  private aeroBoostActive = 0;
  private aeroDragReduction = 0;
  private currentGear = 1;
  private shiftCut = 0;
  private tractionBite = 0;
  private tireTemp = 0.52;
  private tireWear = 0;
  private fuelLoad = 1;
  private brakeTemp = 0.34;
  private brakeFade = 0;
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
      roadAdhesion: this.roadAdhesion,
      lateralScrub: this.lateralScrub,
      slipAngle: this.slipAngle,
      velocityYaw: this.velocityYaw,
      forwardBite: this.forwardBite,
      longitudinalGrip: this.longitudinalGrip,
      tireContactGrip: this.tireContactGrip,
      tireRunoffShare: this.tireRunoffShare,
      tireForceLoad: this.tireForceLoad,
      tireSaturation: this.tireSaturation,
      roadAlignment: this.roadAlignment,
      roadCamber: surfaceBankAt(carLateral, track),
      roadGrade: this.roadGrade,
      roadLoad: this.roadLoad,
      roadCompression: this.roadCompression,
      suspensionLoad: this.suspensionLoad,
      suspensionTravel: this.suspensionTravel,
      roadWetness: this.dynamicRoadWetness(),
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
      powerState: this.powerState(),
      tireTemp: this.tireTemp,
      tireWear: this.tireWear,
      tireState: this.tireState(),
      fuelLoad: this.fuelLoad,
      fuelMassKg: this.fuelMassKg(),
      fuelState: this.fuelState(),
      brakeTemp: this.brakeTemp,
      brakeFade: this.brakeFade,
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
    this.grip = 1;
    this.ers = 1;
    this.aeroBoostAvailable = false;
    this.aeroBoostActive = 0;
    this.aeroDragReduction = 0;
    this.currentGear = 1;
    this.shiftCut = 0;
    this.tractionBite = 0;
    this.tireTemp = 0.52;
    this.tireWear = 0;
    this.fuelLoad = 1;
    this.brakeTemp = 0.34;
    this.brakeFade = 0;
    this.trackRubber = 0;
    this.dryingLine = 0;
    this.dirtyTirePickup = 0;
    this.roadAdhesion = 1;
    this.lateralScrub = 0;
    this.slipAngle = 0;
    this.velocityYaw = 0;
    this.forwardBite = 1;
    this.longitudinalGrip = 1;
    this.tireContactGrip = 1;
    this.tireRunoffShare = 0;
    this.tireForceLoad = 0;
    this.tireSaturation = 0;
    this.roadAlignment = 1;
    this.roadGrade = 0;
    this.roadLoad = 1;
    this.roadCompression = 0;
    this.suspensionLoad = 1;
    this.suspensionTravel = 0;
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
    const quality = clamp(1 - underCharge * 0.86 - overCharge * (0.42 + this.session.weather.roadWetness * 0.5), 0.12, 1);
    const wetSpin = overCharge * (0.18 + this.session.weather.roadWetness * 0.82);

    this.launchQuality = quality;
    this.wheelspin = Math.max(this.wheelspin, wetSpin);
    this.slip = Math.max(this.slip, wetSpin * 0.58);
    this.grip = clamp(this.grip - wetSpin * 0.18, 0.52, 1);
    this.speed = 42 + quality * 54 - wetSpin * 16;
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
    const rawThrottle = clamp(actions.throttle, 0, 1);
    const rawBrake = clamp(actions.brake, 0, 1);
    const rawSteer = clamp(actions.steer, -1, 1);
    const track = sampleTrack(this.z);
    const assist = this.drivingAssist(track, rawThrottle, rawBrake, rawSteer);
    const throttle = clamp(rawThrottle * (1 - assist.throttleTrim), 0, 1);
    const brake = clamp(Math.max(rawBrake, assist.brake), 0, 1);
    const steer = clamp(rawSteer + assist.steer, -1, 1);
    this.lastBrake = brake;
    this.lastThrottle = throttle;

    const surface = this.drivingSurface(track);
    const onTrack = surface.trackLegal;
    const carLateral = this.x - track.center;
    const offTrackDistance = Math.max(0, Math.abs(carLateral) - track.halfWidth);
    const offTrackSide = Math.sign(carLateral) || 1;
    const roadRecoveryNeed = clamp((offTrackDistance - 0.12) / 2.7, 0, 1);
    const tireContact = this.tireContactPatch(carLateral);
    this.tireContactGrip = approach(this.tireContactGrip, tireContact.grip, dt * (tireContact.grip < this.tireContactGrip ? 12 : 6));
    this.tireRunoffShare = approach(this.tireRunoffShare, tireContact.runoffShare, dt * 12);
    const roadCamber = surfaceBankAt(carLateral, track);
    this.positionGainLockout = Math.max(0, this.positionGainLockout - dt);
    this.raceControlCooldown = Math.max(0, this.raceControlCooldown - dt);
    if (!onTrack) {
      this.positionGainLockout = Math.max(this.positionGainLockout, 3.4);
    }
    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const edgeTarget = clamp(this.trackEdgeLoad(track, surface, speedRatio) * 0.55 + tireContact.edgeLoad * 0.65, 0, 1);
    this.surfaceEdgeLoad = approach(this.surfaceEdgeLoad, edgeTarget, dt * (edgeTarget > this.surfaceEdgeLoad ? 18 : 7));
    const contactRoughness = Math.max(surface.roughness, tireContact.roughness);
    this.updateTrackEvolution(dt, speedRatio, onTrack, contactRoughness);
    const roadWetness = this.dynamicRoadWetness();
    const gripContext = this.trackGripContext(track);
    this.updateDirtyTirePickup(dt, gripContext, speedRatio, onTrack, contactRoughness, roadWetness);
    const boost = actions.ers && throttle > 0.1 && brake < 0.1 && this.ers > 0.03 ? 1 : 0;
    this.updateFuelLoad(dt, throttle, boost, speedRatio);
    this.updatePowertrainState(dt, throttle, brake, roadWetness, onTrack, contactRoughness);
    const fuelWeightPenalty = this.fuelLoad * 0.075;
    const overspeed = clamp((this.speed - track.targetSpeedKph) / 120, 0, 1);
    const grade = (sampleTrack(this.z + 14).elevation - sampleTrack(this.z - 14).elevation) / 28;
    const rearGrade = (sampleTrack(this.z - 8).elevation - sampleTrack(this.z - 38).elevation) / 30;
    const frontGrade = (sampleTrack(this.z + 38).elevation - sampleTrack(this.z + 8).elevation) / 30;
    const profileBend = clamp((frontGrade - rearGrade) * 12, -0.34, 0.34);
    const profileLoadTarget = clamp(1 + profileBend * speedRatio * speedRatio - this.surfaceEdgeLoad * 0.035, 0.72, 1.28);
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

    const driverDemand = Math.max(throttle, brake, Math.abs(steer));
    const tractionStress = throttle * speedRatio * (track.section.kind === "straight" ? 0.22 : track.section.difficulty);
    const cornerDemand = track.section.kind === "straight" ? 0.18 : track.section.difficulty;
    const longitudinalForceDemand = throttle * (0.18 + speedRatio * 0.22 + boost * 0.08) + brake * (0.36 + speedRatio * 0.52);
    const steeringLoadDemand =
      Math.pow(Math.abs(rawSteer), 1.25) *
      speedRatio *
      speedRatio *
      (0.92 + speedRatio * 1.35) *
      (onTrack ? 1 : 0.52 + this.tireContactGrip * 0.42);
    const lateralForceDemand =
      Math.abs(steer) * speedRatio * (0.26 + cornerDemand * 0.52) +
      steeringLoadDemand +
      Math.abs(track.curve) * speedRatio * (3 + cornerDemand * 1.05) +
      Math.abs(this.lateralVelocity) * 0.018;
    const forceCapacity = clamp(
      this.tireContactGrip *
        (0.54 + this.grip * 0.46) *
        clamp(0.84 + this.roadLoad * 0.16, 0.84, 1.08) *
        (1 - roadWetness * 0.1) *
        (1 - this.surfaceEdgeLoad * 0.12) *
        (1 - this.tireRunoffShare * 0.18) *
        (1 - this.downforceLoss * 0.45),
      0.24,
      1.08
    );
    const forceLoadTarget = clamp(Math.hypot(longitudinalForceDemand, lateralForceDemand) / Math.max(0.24, forceCapacity), 0, 1.8);
    this.tireForceLoad = approach(this.tireForceLoad, forceLoadTarget, dt * (forceLoadTarget > this.tireForceLoad ? 12 : 7));
    const saturationTarget = clamp((forceLoadTarget - 0.74) / 0.72, 0, 1);
    this.tireSaturation = approach(this.tireSaturation, saturationTarget, dt * (saturationTarget > this.tireSaturation ? 14 : 6));
    const wheelspinTarget = onTrack
      ? clamp(
          throttle * (1 - this.grip) * (0.9 + track.section.difficulty * 0.55) +
            tractionStress * overspeed * 0.35 +
            contactRoughness * throttle * 0.18 +
            (1 - this.tireContactGrip) * throttle * 0.22 +
            this.surfaceEdgeLoad * throttle * 0.12 +
            this.tireSaturation * throttle * 0.34 +
            (gripContext.marbles + this.dirtyTirePickup) * throttle * 0.18,
          0,
          1
        )
      : clamp(throttle * (0.48 + contactRoughness * 0.34) + speedRatio * 0.18 + this.tireRunoffShare * 0.12 + this.tireSaturation * throttle * 0.22, 0, 1);
    const lockupTarget = onTrack
      ? clamp(
          brake *
            speedRatio *
            (0.18 + overspeed * 0.9 + (1 - this.grip) * 0.75 + contactRoughness * 0.2 + (1 - this.tireContactGrip) * 0.26 + this.tireSaturation * 0.42 + this.dirtyTirePickup * 0.18),
          0,
          1
        )
      : clamp(brake * (0.38 + contactRoughness * 0.26) + speedRatio * 0.18 + this.tireRunoffShare * 0.12 + this.tireSaturation * brake * 0.24, 0, 1);
    const understeerTarget = clamp(
      Math.abs(steer) * speedRatio * (track.section.difficulty * 0.24 + overspeed * 0.82 + (1 - this.grip) * 0.7 + this.tireSaturation * 0.52 + this.dirtyTirePickup * 0.2),
      0,
      1
    );

    this.wheelspin = approach(this.wheelspin, wheelspinTarget, dt * 7.5);
    this.lockup = approach(this.lockup, lockupTarget, dt * 10);
    this.understeer = approach(this.understeer, understeerTarget, dt * 6);
    this.updateTireState(dt, speedRatio, throttle, brake, Math.abs(steer), contactRoughness, onTrack);
    this.updateBrakeState(dt, brake, speedRatio, roadWetness);

    const torqueCurve = this.engineTorqueCurve();
    const shiftInterruption = 1 - this.shiftCut * 0.54;
    const steeringPowerTrim = clamp(steeringLoadDemand * 0.34, 0, 0.46);
    const standingStartTraction = clamp(0.34 + speedRatio * 2.4 + this.longitudinalGrip * 0.18 - roadWetness * 0.16, 0.32, 1);
    const tractionDelivery =
      (1 - this.tractionBite * 0.2) *
      clamp(0.62 + this.longitudinalGrip * 0.43 - this.tireSaturation * 0.08, 0.52, 1.06) *
      (1 - steeringPowerTrim) *
      standingStartTraction;
    const acceleration =
      throttle * (122 - speedRatio * 52) * torqueCurve * shiftInterruption * tractionDelivery * (1 - this.wheelspin * 0.24) * (1 - fuelWeightPenalty);
    const brakeWarmth = clamp(0.78 + this.brakeTemp * 0.34 - this.brakeFade * 0.2, 0.72, 1.05);
    const brakingGrip = clamp(0.58 + this.longitudinalGrip * 0.5 - this.surfaceEdgeLoad * 0.08 - this.tireSaturation * 0.12, 0.38, 1.06);
    const braking = brake * 248 * brakingGrip * (1 - this.lockup * 0.22) * (1 - fuelWeightPenalty * 0.45) * brakeWarmth;
    const boostPower = boost * 86;
    const aeroPower = this.aeroBoostActive * throttle * (10 + speedRatio * 22);
    const draftPower = this.draft * throttle * (16 + speedRatio * 28);
    const drag = 0.045 * this.speed + speedRatio * speedRatio * 38;
    const gradeForce = -grade * (78 + speedRatio * 44);
    const instabilityDrag = (this.wheelspin * 18 + this.lockup * 24 + this.understeer * 14 + this.surfaceEdgeLoad * 6 + this.tireSaturation * 10) * driverDemand;
    const racecraftDrag = this.contactRisk * (8 + speedRatio * 18) + this.sideBySide * Math.abs(steer) * 6 + this.frontWingDamage * (5 + speedRatio * 18);
    const settledRecoveryInput = throttle * (1 - clamp(Math.abs(rawSteer) * 1.6, 0, 1));
    const lowSpeedRecoveryWindow = clamp((92 - this.speed) / 92, 0.35, 1);
    const looseSurfaceRecoveryRelief = onTrack
      ? 0
      : clamp((72 - this.speed) / 72, 0, 1) * settledRecoveryInput * (surface.name === "Gravel" ? 0.32 : 0.58);
    const looseSurfaceRecoveryDrive = onTrack
      ? 0
      : settledRecoveryInput * (surface.name === "Gravel" ? 78 : 110) * (0.42 + roadRecoveryNeed * 0.58) * lowSpeedRecoveryWindow;
    const offTrackDrag = Math.max(surface.drag, tireContact.drag) * (onTrack ? 1 : (1.18 + roadWetness * 0.34) * (1 - looseSurfaceRecoveryRelief));
    this.surfaceRumble = approach(this.surfaceRumble, clamp(contactRoughness * clamp(0.25 + speedRatio, 0, 1) + this.surfaceEdgeLoad * 0.42, 0, 1), dt * 12);

    this.speed += (acceleration + boostPower + aeroPower + draftPower + looseSurfaceRecoveryDrive + gradeForce - braking - Math.max(0, drag - this.aeroDragReduction) - instabilityDrag - racecraftDrag - offTrackDrag) * dt;
    this.speed = clamp(this.speed, 0, MAX_SPEED);
    this.ers = clamp(this.ers + brake * 0.28 * dt + 0.025 * dt - boost * 0.38 * dt - this.aeroBoostActive * 0.07 * dt, 0, 1);

    const cornerLoad = Math.abs(track.curve) * speedRatio * (3.2 + track.section.difficulty * 1.2);
    const camberLoad = Math.abs(roadCamber) * (0.16 + speedRatio * 0.2);
    const suspensionOscillation = Math.sin(this.z * 0.095 + this.lateralVelocity * 0.12) * contactRoughness * speedRatio * 0.14;
    const loadTarget = clamp(
      1 +
        speedRatio * speedRatio * 0.2 +
        brake * (0.16 + speedRatio * 0.08) -
        throttle * 0.035 +
        camberLoad +
        Math.max(0, this.roadCompression) * (0.5 + speedRatio * 0.45) -
        Math.max(0, -this.roadCompression) * (0.44 + speedRatio * 0.32) +
        cornerLoad * 0.08 +
        contactRoughness * 0.1 +
        this.surfaceEdgeLoad * 0.16 +
        suspensionOscillation -
        roadWetness * 0.035,
      0.62,
      1.42
    );
    this.suspensionLoad = approach(this.suspensionLoad, loadTarget, dt * (contactRoughness > 0.2 ? 11 : 7));
    this.suspensionTravel = approach(
      this.suspensionTravel,
      clamp(
        (this.suspensionLoad - 1) * 0.44 +
          contactRoughness * speedRatio * 0.12 +
          this.surfaceEdgeLoad * 0.08 +
          Math.max(0, this.roadCompression) * 0.1 -
          Math.max(0, -this.roadCompression) * 0.08 +
          brake * 0.035 -
          throttle * 0.02,
        -0.24,
        0.36
      ),
      dt * 9
    );
    const weatherGrip = this.evolvedWeatherGrip() * this.tireContactGrip;
    const tireTempPenalty = this.tireTemp < 0.38 ? (0.38 - this.tireTemp) * 0.5 : this.tireTemp > 0.86 ? (this.tireTemp - 0.86) * 0.85 : 0;
    const tireGripFactor = clamp(
      1 - tireTempPenalty - this.tireWear * 0.18 + gripContext.rubberedLineGrip - gripContext.marbles * 0.07 - this.dirtyTirePickup * 0.14,
      0.7,
      1.08
    );
    const damageGripFactor = clamp(1 - this.frontWingDamage * (0.12 + speedRatio * 0.18), 0.74, 1);
    const fuelGripFactor = clamp(1 - this.fuelLoad * 0.025, 0.96, 1);
    const loadGripFactor = clamp(
      0.88 +
        this.suspensionLoad * 0.14 -
        Math.abs(this.suspensionLoad - 1) * 0.1 -
        contactRoughness * 0.05 -
        Math.max(0, 1 - this.roadLoad) * 0.24 +
        Math.max(0, this.roadLoad - 1) * 0.08,
      0.7,
      1.08
    );
    const wetPenalty = roadWetness * (brake * 0.08 + throttle * 0.04 + Math.abs(steer) * 0.05);
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
            bankingSupport -
            wetPenalty -
            dirtyAirPenalty,
          0.34,
          1
        )
      : 0.42 * weatherGrip;
    this.grip = approach(this.grip, gripTarget, dt * 5.5);
    const contactDemand = clamp(
      throttle * 0.08 + brake * 0.24 + boost * 0.08 + Math.abs(rawSteer) * speedRatio * 0.34 + this.wheelspin * 0.18 + this.lockup * 0.18 + this.surfaceEdgeLoad * 0.2 + this.tireSaturation * 0.2,
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
      (1 - this.understeer * 0.35) *
      (1 - this.tireSaturation * 0.24) *
      (1 - this.downforceLoss * 0.5) *
      (1 - this.fuelLoad * 0.035) *
      (1 - this.dirtyTirePickup * 0.08);
    const rollingSteerFactor = clamp((this.speed - 4) / 32, 0, 1);
    const targetYawRate = steer * steerAuthority * rollingSteerFactor;
    this.yawRate = approach(this.yawRate, targetYawRate, dt * 6.5);
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
        Math.abs(this.slipAngle) * 0.78
      ),
      0,
      1
    );

    const metersPerSecond = this.speed * (1000 / 3600);
    const curveFollow = track.curve * metersPerSecond * 0.9;
    const roadRelativeVelocityYaw = Math.atan2(this.lateralVelocity - curveFollow, Math.max(6, metersPerSecond));
    this.velocityYaw = approach(this.velocityYaw, roadRelativeVelocityYaw, dt * 10);
    const slipAngleTarget = clamp(this.heading - this.velocityYaw, -0.72, 0.72);
    this.slipAngle = approach(this.slipAngle, slipAngleTarget, dt * (Math.abs(slipAngleTarget) > Math.abs(this.slipAngle) ? 12 : 7));
    const slipAngleLoad = clamp((Math.abs(this.slipAngle) - 0.085) / 0.395, 0, 1);
    this.slip = Math.max(this.slip, slipAngleLoad * 0.5);

    const steeringSlipLimit = clamp(this.grip - this.understeer * 0.24 - this.lockup * 0.12 - this.tireSaturation * 0.2 - slipAngleLoad * 0.16, 0.2, 1);
    const steeringLoad = 1 - clamp(speedRatio * 0.38 + this.wheelspin * 0.12, 0, 0.52);
    const lineError = this.x - track.center - track.racingLineOffset * (onTrack ? 0.42 : 0.16);
    const rollingRoadForce = clamp(Math.max((this.speed - 2) / 24, throttle * (1 - brake) * 0.65), 0, 1);
    const roadCentering =
      -lineError * this.roadAdhesion * (onTrack ? 0.22 + speedRatio * 0.48 : 0.08 + speedRatio * 0.16) * (1 - Math.abs(rawSteer)) * rollingRoadForce;
    const roadRecoveryPull = -offTrackSide * roadRecoveryNeed * (0.78 + speedRatio * 1.84) * (1 - Math.abs(rawSteer) * 0.32) * rollingRoadForce;
    const camberForce = -roadCamber * (0.32 + speedRatio * 0.92) * (onTrack ? 1 : 1.16) * (1 - Math.abs(rawSteer) * 0.5) * rollingRoadForce;
    const splitGripPull = tireContact.sideBias * speedRatio * (0.42 + contactRoughness * 0.6) * (1 - Math.abs(rawSteer) * 0.35) * rollingRoadForce;
    const steeringSaturationPush = Math.sign(rawSteer) * clamp((Math.abs(rawSteer) - 0.82) / 0.18, 0, 1) * speedRatio * (4.2 + speedRatio * 4.8) * rollingSteerFactor;
    const lateralIntent =
      Math.sin(this.heading) * metersPerSecond * 0.28 +
      steer * (1.32 + speedRatio * 1.78) * steeringSlipLimit * steeringLoad * this.roadAdhesion * rollingSteerFactor +
      curveFollow +
      camberForce +
      splitGripPull +
      roadCentering +
      roadRecoveryPull +
      steeringSaturationPush +
      racecraft.squeeze * this.contactRisk * 0.72;
    const lateralAccelLimit = (7.4 + speedRatio * 10.6) * this.roadAdhesion * (onTrack ? 1 : 0.5 + this.tireContactGrip * 0.34);
    this.lateralVelocity = moveToward(this.lateralVelocity, lateralIntent, lateralAccelLimit * dt);
    const slipVelocity = Math.abs(this.lateralVelocity - curveFollow);
    const scrubDeadzone = onTrack ? 1.25 + this.roadAdhesion * 1.1 : 0.35;
    const scrubTarget = clamp(
      Math.max(0, slipVelocity - scrubDeadzone) / (8.2 + speedRatio * 21 + this.roadAdhesion * 5) +
        Math.max(0, 0.58 - this.roadAdhesion) * 0.42 +
        this.tireSaturation * 0.1 +
        slipAngleLoad * 0.12 +
        this.surfaceEdgeLoad * 0.12,
      0,
      1
    );
    this.lateralScrub = approach(this.lateralScrub, scrubTarget, dt * 9);
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
      Math.cos(this.heading) - alignmentSlip / Math.max(12, metersPerSecond * 0.9) - scrubPenalty * 0.34 - slipAngleLoad * 0.18 - (onTrack ? 0 : 0.08),
      0.32,
      1
    );
    this.roadAlignment = approach(this.roadAlignment, alignmentTarget, dt * (onTrack ? 8 : 5.5));
    const biteTarget = clamp(
      this.roadAlignment * (0.54 + this.roadAdhesion * 0.46) - scrubPenalty * 0.28 - slipAngleLoad * 0.1 - this.wheelspin * 0.1 - this.lockup * 0.08 - this.tireSaturation * 0.12,
      0.28,
      1.04
    );
    this.forwardBite = approach(this.forwardBite, biteTarget, dt * (biteTarget < this.forwardBite ? 9 : 5));
    const longitudinalGripTarget = clamp(
      this.forwardBite * (0.48 + this.roadAdhesion * 0.52) * this.tireContactGrip -
        (1 - this.tireContactGrip) * 0.18 -
        this.surfaceEdgeLoad * 0.16 -
        Math.max(0, 1 - this.roadLoad) * 0.16 +
        Math.max(0, this.roadLoad - 1) * 0.04 -
        this.tireSaturation * 0.12 -
        slipAngleLoad * 0.1 -
        this.wheelspin * 0.08 -
        this.lockup * 0.06 -
        roadWetness * (onTrack ? 0.025 : 0.075),
      onTrack ? 0.42 : 0.2,
      1.08
    );
    this.longitudinalGrip = approach(
      this.longitudinalGrip,
      longitudinalGripTarget,
      dt * (longitudinalGripTarget < this.longitudinalGrip ? 10 : 5)
    );
    const pitchTarget = clamp(-this.roadGrade * 2.6 + this.roadCompression * 0.2 + brake * 0.062 - throttle * speedRatio * 0.032 + this.suspensionTravel * 0.08, -0.15, 0.15);
    const rollTarget = clamp(
      -roadCamber * 0.36 - this.yawRate * 0.24 - Math.sign(this.lateralVelocity || rawSteer) * this.lateralScrub * 0.08 + contactRoughness * speedRatio * 0.04,
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
    this.speed = Math.min(this.speed, 118 - speedRatio * 18);
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
    this.grip = Math.max(this.grip, 0.62);
    this.surfaceRumble = 0;
    this.surfaceEdgeLoad = 0;
    this.roadAdhesion = Math.max(this.roadAdhesion, 0.72);
    this.lateralScrub = 0;
    this.slipAngle = 0;
    this.velocityYaw = 0;
    this.forwardBite = Math.max(this.forwardBite, 0.82);
    this.longitudinalGrip = Math.max(this.longitudinalGrip, 0.82);
    this.tireContactGrip = Math.max(this.tireContactGrip, 0.82);
    this.tireRunoffShare = 0;
    this.roadAlignment = Math.max(this.roadAlignment, 0.88);
    this.roadLoad = Math.max(this.roadLoad, 0.92);
    this.roadCompression = 0;
    this.suspensionLoad = Math.max(this.suspensionLoad, 0.9);
    this.suspensionTravel = 0;
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

  private tireContactPatch(carLateral: number) {
    const wheelHalfTrack = 1.08;
    const axleOffsets = [-1.55, 1.55];
    let grip = 0;
    let roughness = 0;
    let drag = 0;
    let runoffShare = 0;
    let edgeLoad = 0;
    let sideBias = 0;
    let count = 0;

    for (const axleOffset of axleOffsets) {
      const wheelTrack = sampleTrack(this.z + axleOffset);
      const axleCenterLateral = this.x - wheelTrack.center;
      for (const side of [-1, 1]) {
        const wheelLateral = axleCenterLateral + side * wheelHalfTrack;
        const wheelSurface = this.surfaceForLateral(wheelTrack, wheelLateral);
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
        count += 1;
      }
    }

    return {
      grip: grip / count,
      roughness: roughness / count,
      drag: drag / count,
      runoffShare: runoffShare / count,
      edgeLoad: clamp(edgeLoad / count + Math.abs(carLateral) / Math.max(1, sampleTrack(this.z).halfWidth + 4) * 0.04, 0, 1),
      sideBias: clamp(sideBias / count, -1, 1)
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
    const pickup =
      gripContext.marbles * speedRatio * (1 - gripContext.lineQuality * 0.72) * (0.8 + this.tireWear * 0.28) +
      (onTrack ? 0 : surfaceRoughness * speedRatio * 0.55);
    const cleanLineScrub = gripContext.lineQuality * (1 - gripContext.offLine) * speedRatio * (0.38 + roadWetness * 0.08);
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
    const heatLoad =
      speedRatio * 0.16 +
      steerDemand * speedRatio * 0.22 +
      brake * 0.24 +
      this.wheelspin * 0.34 +
      this.lockup * 0.42 +
      surfaceRoughness * 0.12;
    const cooling = this.dynamicRoadWetness() * 0.16 + (1 - throttle) * 0.035;
    const targetTemp = clamp(0.42 + heatLoad - cooling, 0.2, 1.08);
    this.tireTemp = approach(this.tireTemp, targetTemp, dt * (targetTemp > this.tireTemp ? 1.55 : 0.95));

    const wearRate =
      0.00025 +
      speedRatio * 0.00045 +
      this.wheelspin * 0.0048 +
      this.lockup * 0.0062 +
      this.understeer * 0.0022 +
      (onTrack ? 0 : 0.002 + surfaceRoughness * 0.0025);
    this.tireWear = clamp(this.tireWear + wearRate * dt, 0, 1);
  }

  private updateFuelLoad(dt: number, throttle: number, boost: number, speedRatio: number) {
    const burnRate = throttle * (0.0028 + speedRatio * 0.0052) + boost * 0.0024;
    this.fuelLoad = clamp(this.fuelLoad - burnRate * dt, 0.38, 1);
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
    const biteTarget = clamp(wetWheelLoad + lowGripLoad + contactLossLoad + edgeLoad + gearTorqueLoad + roughLoad + shiftRecoveryLoad + this.wheelspin * 0.36, 0, 1);
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
    const heat = brake * speedRatio * (0.32 + brake * 0.42 + this.lockup * 0.18);
    const cooling = (1 - brake) * (0.08 + speedRatio * 0.12) + roadWetness * 0.04;
    this.brakeTemp = clamp(this.brakeTemp + (heat - cooling) * dt * 0.34, 0.16, 1.1);
    this.brakeFade = clamp((this.brakeTemp - 0.86) / 0.2, 0, 1);
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
      const targetSpeed = clamp(track.targetSpeedKph * rival.pace + 18, 76, 292);
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
