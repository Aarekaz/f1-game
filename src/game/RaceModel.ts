export type RacePhase = "ready" | "racing" | "finished";

export type RaceInput = {
  steer: number;
  throttle: boolean;
  brake: boolean;
  boost: boolean;
  launch: boolean;
};

export type RivalCar = {
  id: number;
  lane: number;
  distance: number;
  speed: number;
  color: number;
  passed: boolean;
};

export type Telemetry = {
  phase: RacePhase;
  lap: number;
  laps: number;
  lapProgress: number;
  raceProgress: number;
  position: number;
  speedKph: number;
  ers: number;
  grip: number;
  lapTime: number;
  bestLap: number | null;
  delta: number;
  totalTime: number;
  trackOffset: number;
  curve: number;
  carX: number;
  onTrack: boolean;
  overtakeStreak: number;
  message: string;
};

const TRACK_WIDTH = 1.18;
const LAP_DISTANCE = 6200;
const MAX_SPEED = 330;
const RIVAL_COLORS = [0x28d9ff, 0xfff05a, 0xf2f2f2, 0xff7d2d, 0x42f56f, 0xb669ff, 0xff4f88];

export class RaceModel {
  phase: RacePhase = "ready";
  readonly laps = 3;
  lap = 1;
  position = 8;
  speed = 0;
  carX = 0;
  lateralVelocity = 0;
  ers = 1;
  grip = 1;
  distance = 0;
  lapDistance = 0;
  lapTime = 0;
  totalTime = 0;
  bestLap: number | null = null;
  penaltyTimer = 0;
  trackOffset = 0;
  overtakeStreak = 0;
  rivals: RivalCar[] = [];
  private spawnTimer = 0.2;
  private nextRivalId = 1;
  private eventMessage = "";
  private eventTimer = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.phase = "ready";
    this.lap = 1;
    this.position = 8;
    this.speed = 0;
    this.carX = 0;
    this.lateralVelocity = 0;
    this.ers = 1;
    this.grip = 1;
    this.distance = 0;
    this.lapDistance = 0;
    this.lapTime = 0;
    this.totalTime = 0;
    this.bestLap = null;
    this.penaltyTimer = 0;
    this.trackOffset = 0;
    this.overtakeStreak = 0;
    this.rivals = [];
    this.spawnTimer = 0.2;
    this.nextRivalId = 1;
    this.eventMessage = "";
    this.eventTimer = 0;
  }

  update(dt: number, input: RaceInput): Telemetry {
    if (this.phase === "ready" && input.launch) {
      this.phase = "racing";
      this.speed = 64;
    } else if (this.phase === "finished" && input.launch) {
      this.reset();
    }

    if (this.phase === "racing") {
      this.updateRace(dt, input);
    }

    const curve = this.getCurve(this.distance);
    const trackCenter = this.getTrackCenter(this.distance);
    const onTrack = Math.abs(this.carX - trackCenter) < TRACK_WIDTH * 0.54;
    const delta = this.bestLap === null ? 0 : this.lapTime - this.bestLap;
    const lapProgress = PhaserMathClamp(this.lapDistance / LAP_DISTANCE, 0, 1);
    const raceProgress = PhaserMathClamp((this.lap - 1 + lapProgress) / this.laps, 0, 1);

    return {
      phase: this.phase,
      lap: this.lap,
      laps: this.laps,
      lapProgress,
      raceProgress,
      position: this.position,
      speedKph: Math.max(0, Math.round(this.speed)),
      ers: this.ers,
      grip: this.grip,
      lapTime: this.lapTime,
      bestLap: this.bestLap,
      delta,
      totalTime: this.totalTime,
      trackOffset: this.trackOffset,
      curve,
      carX: this.carX,
      onTrack,
      overtakeStreak: this.overtakeStreak,
      message: this.getMessage()
    };
  }

  trackCenterAt(distanceAhead: number) {
    return this.getTrackCenter(this.distance + distanceAhead);
  }

  trackCurveAt(distanceAhead: number) {
    return this.getCurve(this.distance + distanceAhead);
  }

  private updateRace(dt: number, input: RaceInput) {
    const curve = this.getCurve(this.distance);
    const center = this.getTrackCenter(this.distance);
    const onTrack = Math.abs(this.carX - center) < TRACK_WIDTH * 0.54;
    const braking = input.brake;
    const boosting = input.boost && this.ers > 0.05 && !braking;
    const throttle = input.throttle || !braking;
    const drag = 0.06 + Math.abs(curve) * 0.048;
    const accel = throttle ? 68 : -18;
    const brakeForce = braking ? -156 : 0;
    const boostForce = boosting ? 92 : 0;
    const offTrackDrag = onTrack ? 0 : -34;
    this.eventTimer = Math.max(0, this.eventTimer - dt);

    this.speed += (accel + brakeForce + boostForce + offTrackDrag - this.speed * drag) * dt;
    this.speed = Math.max(0, Math.min(MAX_SPEED, this.speed));
    this.ers = Math.max(0, Math.min(1, this.ers + (braking ? 0.24 : 0.045) * dt - (boosting ? 0.32 : 0) * dt));
    this.grip += ((onTrack ? 1 : 0.42) - this.grip) * Math.min(1, dt * 4);

    const steerResponse = PhaserMathClamp(0.88 - this.speed / 720, 0.34, 0.86);
    this.lateralVelocity += input.steer * steerResponse * dt * 3.2;
    this.lateralVelocity *= Math.pow(0.08, dt);
    this.carX += this.lateralVelocity;
    this.carX += (center - this.carX) * dt * 1.8;
    this.carX = PhaserMathClamp(this.carX, -1.08, 1.08);

    const meters = this.speed * (1000 / 3600) * dt * 2.18;
    this.distance += meters;
    this.lapDistance += meters;
    this.trackOffset += meters;
    this.lapTime += dt;
    this.totalTime += dt;

    if (!onTrack) {
      this.penaltyTimer += dt;
    } else {
      this.penaltyTimer = Math.max(0, this.penaltyTimer - dt * 1.4);
    }

    this.updateRivals(dt);
    this.checkLap();
  }

  private updateRivals(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.rivals.length < 7) {
      const lane = [-0.28, 0, 0.28][Math.floor(Math.random() * 3)];
      this.rivals.push({
        id: this.nextRivalId++,
        lane,
        distance: 820 + Math.random() * 1800,
        speed: 215 + Math.random() * 64,
        color: RIVAL_COLORS[Math.floor(Math.random() * RIVAL_COLORS.length)],
        passed: false
      });
      this.spawnTimer = 2.4 + Math.random() * 2.2;
    }

    for (const rival of this.rivals) {
      const relative = (rival.speed - this.speed) * (1000 / 3600) * dt * 2.18;
      rival.distance += relative;

      const near = Math.abs(rival.distance) < 94;
      const sideBySide = Math.abs(this.carX - (this.trackCenterAt(rival.distance) + rival.lane)) < 0.15;
      if (near && sideBySide) {
        this.speed = Math.max(46, this.speed - 120 * dt);
        this.grip = Math.max(0.25, this.grip - 1.2 * dt);
        this.setEvent("Contact - hold the line", 0.8);
      }

      if (!rival.passed && rival.distance < -44) {
        rival.passed = true;
        this.position = Math.max(1, this.position - 1);
        this.overtakeStreak += 1;
        this.ers = Math.min(1, this.ers + 0.18);
        this.setEvent(`Overtake - P${this.position}`, 1.5);
      }
    }

    this.rivals = this.rivals.filter((rival) => rival.distance > -520 && rival.distance < 3100);
  }

  private checkLap() {
    if (this.lapDistance < LAP_DISTANCE) return;

    if (this.bestLap === null || this.lapTime < this.bestLap) {
      this.bestLap = this.lapTime;
    }

    if (this.lap >= this.laps) {
      this.phase = "finished";
      this.speed = 0;
      return;
    }

    this.lap += 1;
    this.lapDistance -= LAP_DISTANCE;
    this.lapTime = 0;
    this.setEvent(`Lap ${this.lap} - push mode`, 1.8);
  }

  private getCurve(distance: number) {
    return (
      Math.sin(distance / 480) * 0.25 +
      Math.sin(distance / 1120 + 1.8) * 0.38 +
      Math.sin(distance / 210 + 0.6) * 0.08
    );
  }

  private getTrackCenter(distance: number) {
    return (
      Math.sin(distance / 730) * 0.24 +
      Math.sin(distance / 1300 + 0.7) * 0.18 +
      Math.sin(distance / 340 + 1.4) * 0.09
    );
  }

  private getMessage() {
    if (this.phase === "ready") return "Press Space to launch";
    if (this.phase === "finished") return `Finished P${this.position} - Space to restart`;
    if (this.eventTimer > 0) return this.eventMessage;
    if (this.penaltyTimer > 1.4) return "Track limits - slow down";
    if (this.ers < 0.06) return "ERS harvesting";
    if (this.speed > 290) return "Flat out";
    return "";
  }

  private setEvent(message: string, duration: number) {
    this.eventMessage = message;
    this.eventTimer = duration;
  }
}

function PhaserMathClamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
