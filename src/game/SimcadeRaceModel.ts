import { TRACK_LOOP_LENGTH, sampleTrack, trackCurveAt } from "./trackPath";

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
  brakingZone: boolean;
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
  };
  rivals: Array<{
    id: number;
    x: number;
    z: number;
    heading: number;
    color: string;
    gap: number;
  }>;
};

type RivalState = {
  id: number;
  lane: number;
  distance: number;
  speed: number;
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
    color
  }));
}

export class SimcadeRaceModel {
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
  private grip = 1;
  private ers = 1;
  private lapTime = 0;
  private bestLap: number | null = null;
  private splitDelta: number | null = null;
  private totalTime = 0;
  private overtakeStreak = 0;
  private message = "Hold throttle to launch";
  private messageTimer = 0;
  private lastBrake = 0;
  private rivals = createRivals();

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
      this.updateLapFlow();
    }

    this.messageTimer = Math.max(0, this.messageTimer - dt);
    return this.telemetry();
  }

  telemetry(): RaceTelemetry {
    const lapDistance = this.phase === "finished" ? LAP_LENGTH : this.z % LAP_LENGTH;
    const delta = this.bestLap === null ? 0 : this.lapTime - this.bestLap;
    const track = sampleTrack(this.z);
    return {
      phase: this.phase,
      lap: this.lap,
      laps: LAPS,
      countdown: this.countdown,
      position: this.position,
      targetPosition: 3,
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
      brakingZone: track.brakingZone,
      lapProgress: clamp(lapDistance / LAP_LENGTH, 0, 1),
      raceProgress: this.phase === "finished" ? 1 : clamp((this.lap - 1 + lapDistance / LAP_LENGTH) / LAPS, 0, 1),
      objective: this.position <= 3 ? "Hold podium pace" : `Catch P${Math.max(3, this.position - 1)}`,
      message: this.messageTimer > 0 ? this.message : "",
      car: {
        x: this.x,
        z: this.z,
        heading: this.heading,
        yawRate: this.yawRate,
        slip: this.slip,
        braking: this.phase === "racing" ? this.lastBrake : 0
      },
      rivals: this.rivals.map((rival) => ({
        id: rival.id,
        x: sampleTrack(rival.distance).center + rival.lane,
        z: rival.distance,
        heading: -trackCurveAt(rival.distance) * 0.8,
        color: rival.color,
        gap: (rival.distance - this.z) / 42
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
    this.grip = 1;
    this.ers = 1;
    this.lapTime = 0;
    this.bestLap = null;
    this.splitDelta = null;
    this.totalTime = 0;
    this.overtakeStreak = 0;
    this.message = "Hold throttle to launch";
    this.messageTimer = 0;
    this.lastBrake = 0;
    this.rivals = createRivals();
  }

  private updateDriving(dt: number, actions: RaceActions) {
    const throttle = clamp(actions.throttle, 0, 1);
    const brake = clamp(actions.brake, 0, 1);
    const steer = clamp(actions.steer, -1, 1);
    this.lastBrake = brake;

    const track = sampleTrack(this.z);
    const onTrack = Math.abs(this.x - track.center) <= track.halfWidth;
    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const boost = actions.ers && throttle > 0.1 && brake < 0.1 && this.ers > 0.03 ? 1 : 0;
    const acceleration = throttle * (112 - speedRatio * 52);
    const braking = brake * 248;
    const boostPower = boost * 72;
    const drag = 0.045 * this.speed + speedRatio * speedRatio * 38;
    const offTrackDrag = onTrack ? 0 : 82;

    this.speed += (acceleration + boostPower - braking - drag - offTrackDrag) * dt;
    this.speed = clamp(this.speed, this.speed > 0 ? MIN_RACE_SPEED : 0, MAX_SPEED);
    this.ers = clamp(this.ers + brake * 0.28 * dt + 0.025 * dt - boost * 0.38 * dt, 0, 1);

    const cornerLoad = Math.abs(track.curve) * speedRatio * 3.2;
    const gripTarget = onTrack ? clamp(1 - brake * 0.08 - speedRatio * Math.abs(steer) * 0.23 - cornerLoad, 0.54, 1) : 0.42;
    this.grip = approach(this.grip, gripTarget, dt * 5.5);

    const steerAuthority = (0.78 - speedRatio * 0.44) * this.grip;
    const targetYawRate = steer * steerAuthority;
    this.yawRate = approach(this.yawRate, targetYawRate, dt * 6.5);
    this.heading += this.yawRate * dt;
    this.slip = clamp(Math.abs(this.yawRate) * speedRatio * (1.25 - this.grip), 0, 1);

    const metersPerSecond = this.speed * (1000 / 3600);
    this.z += metersPerSecond * dt * 1.55;
    this.x += Math.sin(this.heading) * metersPerSecond * dt * 0.28 + steer * speedRatio * dt * 2.3 + track.curve * metersPerSecond * dt * 0.95;
    this.x = clamp(this.x, track.center - 9, track.center + 9);
    this.lapTime += dt;
    this.totalTime += dt;
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
      return this.speed > 178 ? "Brake now" : "Set up the apex";
    }

    if (track.section.kind === "straight") {
      return this.ers > 0.18 && this.speed > 145 ? "ERS window" : "Open throttle";
    }

    if (track.sectionProgress > 0.6) {
      return "Power on exit";
    }

    return track.section.kind === "esses" ? "Balance the car" : "Hold the line";
  }

  private updateLapFlow() {
    const completedLap = Math.floor(this.z / LAP_LENGTH) + 1;
    if (completedLap > this.lap) {
      const completedLapTime = this.lapTime;
      this.splitDelta = this.bestLap === null ? null : completedLapTime - this.bestLap;
      if (this.bestLap === null || completedLapTime < this.bestLap) {
        this.bestLap = completedLapTime;
      }
      this.lap = completedLap;
      if (this.lap > LAPS) {
        this.phase = "finished";
        this.lap = LAPS;
        this.message = this.position <= 3 ? "Podium secured" : "Race complete";
        this.messageTimer = 8;
      } else {
        this.lapTime = 0;
      }
    }
  }
}
