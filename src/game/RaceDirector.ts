import { TRACK_LOOP_LENGTH, getTrackCheckpoints, getTrackSectorEnds } from "./trackPath";

export type Checkpoint = {
  id: string;
  name: string;
  distance: number;
  sector: 1 | 2 | 3;
};

export type RaceDirectorEvent =
  | { type: "checkpoint"; checkpoint: Checkpoint; checkpointIndex: number }
  | { type: "sector"; sector: 1 | 2 | 3; time: number }
  | { type: "lap"; lap: number; time: number; valid: boolean }
  | { type: "finish"; time: number };

export type RaceDirectorSnapshot = {
  lap: number;
  laps: number;
  nextCheckpoint: Checkpoint;
  checkpointIndex: number;
  checkpointCount: number;
  sectorSplits: [number | null, number | null, number | null];
  lapValid: boolean;
  penaltySeconds: number;
  raceProgress: number;
  lapProgress: number;
  finished: boolean;
};

export const RACE_CHECKPOINTS: Checkpoint[] = [
  { id: "basilica-entry", name: "Basilica Entry", distance: 310, sector: 1 },
  { id: "orchard-exit", name: "Orchard Exit", distance: 535, sector: 1 },
  { id: "veloce-entry", name: "Veloce Entry", distance: 760, sector: 2 },
  { id: "cava-entry", name: "Cava Entry", distance: 1030, sector: 2 },
  { id: "ridge-exit", name: "Ridge Exit", distance: 1260, sector: 2 },
  { id: "station-entry", name: "Station Entry", distance: 1580, sector: 3 },
  { id: "parabolica-entry", name: "Parabolica Entry", distance: 1820, sector: 3 }
];

const SECTOR_ENDS = [760, 1580, TRACK_LOOP_LENGTH] as const;

export class RaceDirector {
  private lap = 1;
  private nextCheckpointIndex = 0;
  private nextSectorIndex = 0;
  private previousDistance = 0;
  private currentLapStartTime = 0;
  private sectorSplits: [number | null, number | null, number | null] = [null, null, null];
  private validLap = true;
  private penaltySeconds = 0;
  private finished = false;

  constructor(
    private readonly laps: number,
    private checkpoints: readonly Checkpoint[] = getTrackCheckpoints(),
    private sectorEnds: readonly [number, number, number] = getTrackSectorEnds(),
    private loopLength = TRACK_LOOP_LENGTH
  ) {}

  configure(checkpoints = getTrackCheckpoints(), sectorEnds = getTrackSectorEnds(), loopLength = TRACK_LOOP_LENGTH) {
    this.checkpoints = checkpoints;
    this.sectorEnds = sectorEnds;
    this.loopLength = loopLength;
    this.reset();
  }

  reset() {
    this.lap = 1;
    this.nextCheckpointIndex = 0;
    this.nextSectorIndex = 0;
    this.previousDistance = 0;
    this.currentLapStartTime = 0;
    this.sectorSplits = [null, null, null];
    this.validLap = true;
    this.penaltySeconds = 0;
    this.finished = false;
  }

  invalidateLap() {
    this.validLap = false;
  }

  addPenalty(seconds: number) {
    this.penaltySeconds += seconds;
    this.invalidateLap();
  }

  update(distance: number, totalTime: number): RaceDirectorEvent[] {
    if (this.finished) return [];

    const events: RaceDirectorEvent[] = [];
    while (this.nextCheckpointIndex < this.checkpoints.length && this.crossed(this.nextCheckpointDistance(), distance)) {
      const checkpoint = this.checkpoints[this.nextCheckpointIndex];
      events.push({ type: "checkpoint", checkpoint, checkpointIndex: this.nextCheckpointIndex });
      this.nextCheckpointIndex += 1;
    }

    while (this.nextSectorIndex < this.sectorEnds.length && this.crossed(this.nextSectorDistance(), distance)) {
      const sector = (this.nextSectorIndex + 1) as 1 | 2 | 3;
      const time = totalTime - this.currentLapStartTime;
      this.sectorSplits[this.nextSectorIndex] = time;
      events.push({ type: "sector", sector, time });
      this.nextSectorIndex += 1;
    }

    while (this.crossed(this.lap * this.loopLength, distance)) {
      const time = totalTime - this.currentLapStartTime;
      const valid = this.validLap && this.nextCheckpointIndex >= this.checkpoints.length;
      events.push({ type: "lap", lap: this.lap, time, valid });
      if (this.lap >= this.laps) {
        this.finished = true;
        this.lap += 1;
        events.push({ type: "finish", time: totalTime + this.penaltySeconds });
        break;
      }

      this.lap += 1;
      this.currentLapStartTime = totalTime;
      this.nextCheckpointIndex = 0;
      this.nextSectorIndex = 0;
      this.sectorSplits = [null, null, null];
      this.validLap = true;
    }

    this.previousDistance = Math.max(this.previousDistance, distance);
    return events;
  }

  snapshot(distance: number): RaceDirectorSnapshot {
    const lapDistance = this.finished ? this.loopLength : distance % this.loopLength;
    return {
      lap: Math.min(this.lap, this.laps),
      laps: this.laps,
      nextCheckpoint: this.checkpoints[this.nextCheckpointIndex] ?? this.checkpoints[0],
      checkpointIndex: this.nextCheckpointIndex,
      checkpointCount: this.checkpoints.length,
      sectorSplits: [...this.sectorSplits],
      lapValid: this.validLap,
      penaltySeconds: this.penaltySeconds,
      raceProgress: this.finished ? 1 : Math.min(1, (this.lap - 1 + lapDistance / this.loopLength) / this.laps),
      lapProgress: Math.min(1, lapDistance / this.loopLength),
      finished: this.finished
    };
  }

  private nextCheckpointDistance() {
    return (this.lap - 1) * this.loopLength + (this.checkpoints[this.nextCheckpointIndex]?.distance ?? this.loopLength + 1);
  }

  private nextSectorDistance() {
    return (this.lap - 1) * this.loopLength + (this.sectorEnds[this.nextSectorIndex] ?? this.loopLength + 1);
  }

  private crossed(target: number, distance: number) {
    return this.previousDistance < target && distance >= target;
  }
}
