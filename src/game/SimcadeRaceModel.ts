import { RaceDirector } from "./RaceDirector";
import { TRACK_LOOP_LENGTH, sampleTrack, trackCurveAt } from "./trackPath";
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
  roadWetness: number;
  rainIntensity: number;
  skyColor: string;
  fogColor: string;
  grassColor: string;
  lightIntensity: number;
  speedKph: number;
  gear: number;
  rpm: number;
  ers: number;
  grip: number;
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
    z: number;
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
    z: number;
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
    distance: 90 + index * 48,
    speed: 142 + index * 8,
    pace: 0.9 + index * 0.012,
    color
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
  private rivals = createRivals();
  private director = new RaceDirector(LAPS);

  constructor(session: SessionConfig = DEFAULT_SESSION) {
    this.session = session;
  }

  configure(session: SessionConfig) {
    this.session = session;
    if (this.phase === "ready") {
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
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) {
        this.phase = "racing";
        this.speed = 64;
        this.message = "Lights out";
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
      roadWetness: this.session.weather.roadWetness,
      rainIntensity: this.session.weather.rainIntensity,
      skyColor: this.session.weather.skyColor,
      fogColor: this.session.weather.fogColor,
      grassColor: this.session.weather.grassColor,
      lightIntensity: this.session.weather.lightIntensity,
      speedKph: Math.round(this.speed),
      gear: this.gear(),
      rpm: this.rpm(),
      ers: this.ers,
      grip: this.grip,
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
        z: this.z,
        heading: this.heading,
        yawRate: this.yawRate,
        slip: this.slip,
        braking: this.phase === "racing" ? this.lastBrake : 0,
        throttle: this.phase === "racing" ? this.lastThrottle : 0,
        wheelspin: this.wheelspin,
        understeer: this.understeer,
        lockup: this.lockup
      },
      rivals: this.rivals.map((rival) => ({
        id: rival.id,
        x: sampleTrack(rival.distance).center + rival.lane,
        z: rival.distance,
        heading: -trackCurveAt(rival.distance) * 0.8,
        color: rival.color,
        gap: (rival.distance - this.z) / 42,
        speedKph: Math.round(rival.speed)
      }))
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
    this.rivals = createRivals();
    this.director.reset();
  }

  private updateDriving(dt: number, actions: RaceActions) {
    const throttle = clamp(actions.throttle, 0, 1);
    const brake = clamp(actions.brake, 0, 1);
    const steer = clamp(actions.steer, -1, 1);
    this.lastBrake = brake;
    this.lastThrottle = throttle;

    const track = sampleTrack(this.z);
    const onTrack = Math.abs(this.x - track.center) <= track.halfWidth;
    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const boost = actions.ers && throttle > 0.1 && brake < 0.1 && this.ers > 0.03 ? 1 : 0;
    const overspeed = clamp((this.speed - track.targetSpeedKph) / 120, 0, 1);
    const driverDemand = Math.max(throttle, brake, Math.abs(steer));
    const tractionStress = throttle * speedRatio * (track.section.kind === "straight" ? 0.22 : track.section.difficulty);
    const wheelspinTarget = onTrack
      ? clamp(throttle * (1 - this.grip) * (0.9 + track.section.difficulty * 0.55) + tractionStress * overspeed * 0.35, 0, 1)
      : clamp(throttle * 0.6 + speedRatio * 0.18, 0, 1);
    const lockupTarget = onTrack
      ? clamp(brake * speedRatio * (0.18 + overspeed * 0.9 + (1 - this.grip) * 0.75), 0, 1)
      : clamp(brake * 0.45 + speedRatio * 0.18, 0, 1);
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
    const drag = 0.045 * this.speed + speedRatio * speedRatio * 38;
    const instabilityDrag = (this.wheelspin * 18 + this.lockup * 24 + this.understeer * 14) * driverDemand;
    const offTrackDrag = onTrack ? 0 : 82;

    this.speed += (acceleration + boostPower - braking - drag - instabilityDrag - offTrackDrag) * dt;
    this.speed = clamp(this.speed, this.speed > 0 ? MIN_RACE_SPEED : 0, MAX_SPEED);
    this.ers = clamp(this.ers + brake * 0.28 * dt + 0.025 * dt - boost * 0.38 * dt, 0, 1);

    const cornerLoad = Math.abs(track.curve) * speedRatio * (3.2 + track.section.difficulty * 1.2);
    const weatherGrip = this.session.weather.gripMultiplier;
    const wetPenalty = this.session.weather.roadWetness * (brake * 0.08 + throttle * 0.04 + Math.abs(steer) * 0.05);
    const gripTarget = onTrack
      ? clamp((1 - brake * 0.08 - speedRatio * Math.abs(steer) * 0.23 - cornerLoad - overspeed * track.section.difficulty * 0.32) * weatherGrip - wetPenalty, 0.34, 1)
      : 0.42 * weatherGrip;
    this.grip = approach(this.grip, gripTarget, dt * 5.5);

    const steerAuthority = (0.78 - speedRatio * 0.44) * this.grip * (1 - this.understeer * 0.35);
    const targetYawRate = steer * steerAuthority;
    this.yawRate = approach(this.yawRate, targetYawRate, dt * 6.5);
    this.heading += this.yawRate * dt;
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
    this.x += Math.sin(this.heading) * metersPerSecond * dt * 0.28 + steer * speedRatio * dt * 2.3 + track.curve * metersPerSecond * dt * 0.95;
    this.x = clamp(this.x, track.center - 9, track.center + 9);
    this.lapTime += dt;
    this.totalTime += dt;
    this.updateTrackLimits(dt, onTrack);
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
      rival.distance += rival.speed * (1000 / 3600) * dt * 1.48;
      if (rival.distance < this.z - 60 && this.position > 1) {
        this.position -= 1;
        this.overtakeStreak += 1;
        rival.distance = this.z + 420;
        rival.lane = (((rival.id + this.position) % 3) - 1) * 2.4;
        this.message = `Passed for P${this.position}`;
        this.messageTimer = 1.2;
      }
    }
  }

  private trackCue(track: ReturnType<typeof sampleTrack>) {
    if (track.brakingZone) {
      return this.speed > track.targetSpeedKph + 28 ? "Brake now" : "Trail to apex";
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
