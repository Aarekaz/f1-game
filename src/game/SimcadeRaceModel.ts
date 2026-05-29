import { RaceDirector } from "./RaceDirector";
import { TRACK_LOOP_LENGTH, getTrackCheckpoints, getTrackSectorEnds, sampleTrack, setActiveTrackLayout, trackCurveAt } from "./trackPath";
import { DEFAULT_SESSION, type SessionConfig } from "../world/FictionalGpWorld";

export type RacePhase = "ready" | "countdown" | "racing" | "finished";

export type RaceActions = {
  steer: number;
  throttle: number;
  brake: number;
  ers: boolean;
  launch: boolean;
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
  roadWetness: number;
  rainIntensity: number;
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
  checkpointProgress: string;
  sectorSplits: [number | null, number | null, number | null];
  lapValid: boolean;
  lapProgress: number;
  raceProgress: number;
  objective: string;
  message: string;
  car: {
    x: number;
    y: number;
    z: number;
    bank: number;
    heading: number;
    yawRate: number;
    slip: number;
    braking: number;
    throttle: number;
    wheelspin: number;
    understeer: number;
    lockup: number;
  };
  rivals: Array<{
    id: number;
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
const MIN_RACE_SPEED = 16;
const RIVAL_COLORS = ["#24c7ff", "#f4d35e", "#f7f7f2", "#ff7a2d", "#b88cff", "#1fd17f", "#ff4f83"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function approach(current: number, target: number, amount: number) {
  return current + (target - current) * clamp(amount, 0, 1);
}

function createRivals(): RivalState[] {
  return RIVAL_COLORS.map((color, index) => ({
    id: index + 1,
    lane: ((index % 3) - 1) * 2.4,
    distance: 58 + index * 44,
    speed: 126 + index * 7,
    pace: 0.86 + index * 0.012,
    color,
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
  private flowScore = 0.62;
  private surfaceRumble = 0;
  private grip = 1;
  private ers = 1;
  private lapTime = 0;
  private bestLap: number | null = null;
  private splitDelta: number | null = null;
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
      this.updateDriving(dt, actions);
      this.updateRivals(dt);
      this.updateRaceDirector();
    }

    this.messageTimer = Math.max(0, this.messageTimer - dt);
    return this.telemetry();
  }

  telemetry(): RaceTelemetry {
    const delta = this.bestLap === null ? 0 : this.lapTime - this.bestLap;
    const track = sampleTrack(this.z);
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
      surfaceGrip: this.session.weather.gripMultiplier,
      surfaceName: this.drivingSurface(track).name,
      surfaceGripModifier: this.drivingSurface(track).grip,
      surfaceRumble: this.surfaceRumble,
      roadWetness: this.session.weather.roadWetness,
      rainIntensity: this.session.weather.rainIntensity,
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
      carX: this.x - track.center,
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
      checkpointProgress: `${Math.min(director.checkpointIndex + 1, director.checkpointCount)}/${director.checkpointCount}`,
      sectorSplits: director.sectorSplits,
      lapValid: director.lapValid,
      lapProgress: director.lapProgress,
      raceProgress: director.raceProgress,
      objective: this.position <= 3 ? "Hold podium pace" : `Catch P${Math.max(3, this.position - 1)}`,
      message: this.messageTimer > 0 ? this.message : "",
      car: {
        x: this.x,
        y: track.elevation + 0.065,
        z: this.z,
        bank: track.bank,
        heading: this.heading,
        yawRate: this.yawRate,
        slip: this.slip,
        braking: this.phase === "racing" ? this.lastBrake : 0,
        throttle: this.phase === "racing" ? this.lastThrottle : 0,
        wheelspin: this.wheelspin,
        understeer: this.understeer,
        lockup: this.lockup
      },
      rivals: this.rivals.map((rival) => {
        const rivalTrack = sampleTrack(rival.distance);
        return {
          id: rival.id,
          x: rivalTrack.center + rival.lane,
          y: rivalTrack.elevation + 0.055,
          z: rival.distance,
          bank: rivalTrack.bank,
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
    this.flowScore = 0.62;
    this.surfaceRumble = 0;
    this.grip = 1;
    this.ers = 1;
    this.lapTime = 0;
    this.bestLap = null;
    this.splitDelta = null;
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
    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const boost = actions.ers && throttle > 0.1 && brake < 0.1 && this.ers > 0.03 ? 1 : 0;
    const overspeed = clamp((this.speed - track.targetSpeedKph) / 120, 0, 1);
    const air = this.raceAirEffect(track);
    this.draft = approach(this.draft, air.draft, dt * 4.2);
    this.dirtyAir = approach(this.dirtyAir, air.dirtyAir, dt * 5.4);
    const racecraft = this.racecraftPressure();
    this.rivalProximity = approach(this.rivalProximity, racecraft.proximity, dt * 7.2);
    this.sideBySide = approach(this.sideBySide, racecraft.sideBySide, dt * 8.2);
    this.contactRisk = approach(this.contactRisk, racecraft.contactRisk, dt * 9.5);
    this.racecraftCooldown = Math.max(0, this.racecraftCooldown - dt);
    if (this.contactRisk > 0.7 && this.racecraftCooldown === 0) {
      this.message = this.contactRisk > 0.88 ? "Avoid contact" : "Wheel to wheel";
      this.messageTimer = 0.85;
      this.racecraftCooldown = 2.1;
    }

    const driverDemand = Math.max(throttle, brake, Math.abs(steer));
    const tractionStress = throttle * speedRatio * (track.section.kind === "straight" ? 0.22 : track.section.difficulty);
    const wheelspinTarget = onTrack
      ? clamp(throttle * (1 - this.grip) * (0.9 + track.section.difficulty * 0.55) + tractionStress * overspeed * 0.35 + surface.roughness * throttle * 0.18, 0, 1)
      : clamp(throttle * (0.48 + surface.roughness * 0.34) + speedRatio * 0.18, 0, 1);
    const lockupTarget = onTrack
      ? clamp(brake * speedRatio * (0.18 + overspeed * 0.9 + (1 - this.grip) * 0.75 + surface.roughness * 0.2), 0, 1)
      : clamp(brake * (0.38 + surface.roughness * 0.26) + speedRatio * 0.18, 0, 1);
    const understeerTarget = clamp(
      Math.abs(steer) * speedRatio * (track.section.difficulty * 0.24 + overspeed * 0.82 + (1 - this.grip) * 0.7),
      0,
      1
    );

    this.wheelspin = approach(this.wheelspin, wheelspinTarget, dt * 7.5);
    this.lockup = approach(this.lockup, lockupTarget, dt * 10);
    this.understeer = approach(this.understeer, understeerTarget, dt * 6);

    const acceleration = throttle * (112 - speedRatio * 52) * (1 - this.wheelspin * 0.34);
    const braking = brake * 248 * (1 - this.lockup * 0.22);
    const boostPower = boost * 72;
    const draftPower = this.draft * throttle * (16 + speedRatio * 28);
    const drag = 0.045 * this.speed + speedRatio * speedRatio * 38;
    const grade = (sampleTrack(this.z + 14).elevation - sampleTrack(this.z - 14).elevation) / 28;
    const gradeForce = -grade * (78 + speedRatio * 44);
    const instabilityDrag = (this.wheelspin * 18 + this.lockup * 24 + this.understeer * 14) * driverDemand;
    const racecraftDrag = this.contactRisk * (8 + speedRatio * 18) + this.sideBySide * Math.abs(steer) * 6;
    const offTrackDrag = surface.drag;
    this.surfaceRumble = approach(this.surfaceRumble, surface.roughness * clamp(0.25 + speedRatio, 0, 1), dt * 12);

    this.speed += (acceleration + boostPower + draftPower + gradeForce - braking - drag - instabilityDrag - racecraftDrag - offTrackDrag) * dt;
    this.speed = clamp(this.speed, this.speed > 0 ? MIN_RACE_SPEED : 0, MAX_SPEED);
    this.ers = clamp(this.ers + brake * 0.28 * dt + 0.025 * dt - boost * 0.38 * dt, 0, 1);

    const cornerLoad = Math.abs(track.curve) * speedRatio * (3.2 + track.section.difficulty * 1.2);
    const weatherGrip = this.session.weather.gripMultiplier * surface.grip;
    const wetPenalty = this.session.weather.roadWetness * (brake * 0.08 + throttle * 0.04 + Math.abs(steer) * 0.05);
    const bankingSupport = 1 + Math.min(0.1, Math.abs(track.bank) * 0.22);
    const dirtyAirPenalty = this.dirtyAir * (0.1 + speedRatio * 0.14);
    const gripTarget = onTrack
      ? clamp(
          (1 - brake * 0.08 - speedRatio * Math.abs(steer) * 0.23 - cornerLoad - overspeed * track.section.difficulty * 0.32) *
            weatherGrip *
            bankingSupport -
            wetPenalty -
            dirtyAirPenalty,
          0.34,
          1
        )
      : 0.42 * weatherGrip;
    this.grip = approach(this.grip, gripTarget, dt * 5.5);

    const steerAuthority = (0.78 - speedRatio * 0.44) * this.grip * (1 - this.understeer * 0.35);
    const targetYawRate = steer * steerAuthority;
    this.yawRate = approach(this.yawRate, targetYawRate, dt * 6.5);
    this.heading += (this.yawRate + racecraft.squeeze * this.contactRisk * 0.045) * dt;
    this.slip = clamp(
      Math.max(
        Math.abs(this.yawRate) * speedRatio * (1.25 - this.grip),
        this.wheelspin * 0.45,
        this.lockup * 0.55,
        this.understeer * 0.62
      ),
      0,
      1
    );

    const metersPerSecond = this.speed * (1000 / 3600);
    this.z += metersPerSecond * dt * 1.55;
    this.x +=
      Math.sin(this.heading) * metersPerSecond * dt * 0.28 +
      steer * (0.16 + speedRatio) * dt * 2.3 +
      track.curve * metersPerSecond * dt * 0.95 +
      racecraft.squeeze * this.contactRisk * dt * 0.7;
    this.x = clamp(this.x, track.center - 9, track.center + 9);
    this.lapTime += dt;
    this.totalTime += dt;
    this.updateFlowScore(dt, track, onTrack);
    this.updateTrackLimits(dt, onTrack);
  }

  private drivingSurface(track: ReturnType<typeof sampleTrack>) {
    const lateral = Math.abs(this.x - track.center);
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

  private drivingAssist(track: ReturnType<typeof sampleTrack>, throttle: number, brake: number, steer: number) {
    const assist = this.session.assist;
    if (assist.steeringHelp === 0 && assist.throttleHelp === 0 && assist.brakeHelp === 0) {
      this.latestAssist = { steer: 0, brake: 0, throttleTrim: 0 };
      return this.latestAssist;
    }

    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const lineError = this.x - track.center - track.racingLineOffset;
    const lineCorrection = clamp(-lineError / Math.max(3.8, track.halfWidth * 0.78), -1, 1);
    const driverOverride = clamp(Math.abs(steer) * 1.25 + brake * 0.75, 0, 1);
    const cornerNeed = track.section.kind === "straight" ? 0.12 : clamp(track.section.difficulty, 0.32, 1);
    const steeringAssist = lineCorrection * assist.steeringHelp * cornerNeed * (1 - driverOverride * 0.78);
    const paceOvershoot = clamp((this.speed - track.targetSpeedKph) / 95, 0, 1);
    const brakingWindow = track.brakingZone ? 1 : track.cornerPhase === "turn-in" ? 0.42 : 0;
    const brakeAssist = assist.brakeHelp * paceOvershoot * brakingWindow * (1 - brake) * (0.35 + throttle * 0.65);
    const throttleTrim =
      assist.throttleHelp * paceOvershoot * cornerNeed * clamp(speedRatio + 0.12, 0, 1) * (track.section.kind === "straight" ? 0.16 : 1);

    this.latestAssist = {
      steer: Math.abs(steeringAssist) < 0.01 ? 0 : steeringAssist,
      brake: brakeAssist < 0.01 ? 0 : brakeAssist,
      throttleTrim: throttleTrim < 0.01 ? 0 : throttleTrim
    };
    return this.latestAssist;
  }

  private updateFlowScore(dt: number, track: ReturnType<typeof sampleTrack>, onTrack: boolean) {
    const paceError = Math.abs(this.speed - track.targetSpeedKph);
    const paceScore = clamp(1 - paceError / (track.section.kind === "straight" ? 150 : 92), 0, 1);
    const lineError = Math.abs(this.x - track.center - track.racingLineOffset);
    const lineScore = clamp(1 - lineError / Math.max(3.8, track.halfWidth * 0.84), 0, 1);
    const carCalm = clamp(1 - this.slip * 0.76 - this.lockup * 0.72 - this.wheelspin * 0.62 - this.understeer * 0.58, 0, 1);
    const raceRoom = clamp(1 - this.contactRisk * 0.68 - this.dirtyAir * 0.18, 0, 1);
    const sectionWeight = track.section.kind === "straight" ? 0.74 : 1;
    const target = onTrack
      ? clamp((paceScore * 0.3 + lineScore * 0.3 + carCalm * 0.28 + raceRoom * 0.12) * sectionWeight + 0.08, 0, 1)
      : 0.08;
    this.flowScore = approach(this.flowScore, target, dt * (target > this.flowScore ? 0.82 : 2.9));
  }

  private updateTrackLimits(dt: number, onTrack: boolean) {
    if (onTrack) {
      this.offTrackTime = 0;
      return;
    }

    this.offTrackTime += dt;
    if (this.offTrackTime > 0.42) {
      this.cleanLap = false;
      this.trackLimitWarnings += 1;
      this.director.addPenalty(5);
      this.offTrackTime = -1.8;
      this.message = this.trackLimitWarnings >= 3 ? "+5s penalty: lap invalidated" : "+5s track limits";
      this.messageTimer = 1.3;
    }
  }

  private gear() {
    if (this.speed < 30) return 1;
    if (this.speed < 78) return 2;
    if (this.speed < 124) return 3;
    if (this.speed < 168) return 4;
    if (this.speed < 214) return 5;
    if (this.speed < 262) return 6;
    return 7;
  }

  private rpm() {
    const gear = this.gear();
    const lower = [0, 0, 30, 78, 124, 168, 214, 262][gear] ?? 0;
    const upper = [30, 78, 124, 168, 214, 262, MAX_SPEED][gear - 1] ?? MAX_SPEED;
    const gearProgress = clamp((this.speed - lower) / Math.max(1, upper - lower), 0, 1);
    return Math.round(4600 + gearProgress * 5200 + this.slip * 900);
  }

  private updateRivals(dt: number) {
    for (const rival of this.rivals) {
      const track = sampleTrack(rival.distance);
      const targetSpeed = clamp(track.targetSpeedKph * rival.pace + 18, 76, 292);
      rival.speed = approach(rival.speed, targetSpeed, dt * (rival.speed > targetSpeed ? 2.4 : 0.65));
      this.updateRivalLane(rival, track, dt);
      rival.distance += rival.speed * (1000 / 3600) * dt * 1.48;
      if (rival.distance < this.z - 60 && this.position > 1) {
        this.position -= 1;
        this.overtakeStreak += 1;
        rival.distance = this.z + 420;
        rival.lane = (((rival.id + this.position) % 3) - 1) * 2.4;
        rival.desiredLane = rival.lane;
        rival.defending = false;
        this.message = `Passed for P${this.position}`;
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
      const contactPressure = clamp(1 - Math.abs(gap) / 8, 0, 1) * clamp(1 - lateralGap / 3.1, 0, 1);

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

  private airState() {
    if (this.dirtyAir > 0.16) return "Dirty air";
    if (this.draft > 0.03) return "Slipstream";
    return "Clean air";
  }

  private racecraftState() {
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
        this.message = `Sector ${event.sector} ${event.time.toFixed(2)}`;
        this.messageTimer = 0.9;
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
}
