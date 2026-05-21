import Phaser from "phaser";
import { RaceInput, RaceModel, RivalCar, Telemetry } from "../game/RaceModel";

type HudRefs = {
  position: HTMLElement;
  lap: HTMLElement;
  best: HTMLElement;
  delta: HTMLElement;
  speed: HTMLElement;
  raceProgress: HTMLElement;
  ers: HTMLElement;
  grip: HTMLElement;
  streak: HTMLElement;
  message: HTMLElement;
};

type TrackMarker = Phaser.GameObjects.Rectangle;
type TrackProp = Phaser.GameObjects.Image;

const TRACK_PROP_KEYS = [
  "track-prop-barrier-red",
  "track-prop-barrier-white",
  "track-prop-tires-red",
  "track-prop-tires-white",
  "track-prop-cone",
  "track-prop-arrow",
  "track-prop-lights",
  "track-prop-tribune",
  "track-prop-tribune-red"
] as const;

type TrackPropKey = (typeof TRACK_PROP_KEYS)[number];

export class RaceScene extends Phaser.Scene {
  private model = new RaceModel();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private track!: Phaser.GameObjects.Graphics;
  private kerbs!: Phaser.GameObjects.Graphics;
  private speedFx!: Phaser.GameObjects.Graphics;
  private car!: Phaser.GameObjects.Container;
  private carShadow!: Phaser.GameObjects.Ellipse;
  private trackMarkers: TrackMarker[] = [];
  private trackProps: TrackProp[] = [];
  private rivalViews = new Map<number, Phaser.GameObjects.Container>();
  private hud!: HudRefs;
  private touchState = { left: false, right: false, brake: false, boost: false };
  private touchLaunch = false;
  private launchQueued = false;
  private telemetry!: Telemetry;

  constructor() {
    super("RaceScene");
  }

  preload() {
    this.load.image("track-prop-barrier-red", "/assets/kenney-racing/objects/barrier_red_race.png");
    this.load.image("track-prop-barrier-white", "/assets/kenney-racing/objects/barrier_white_race.png");
    this.load.image("track-prop-tires-red", "/assets/kenney-racing/objects/tires_red.png");
    this.load.image("track-prop-tires-white", "/assets/kenney-racing/objects/tires_white.png");
    this.load.image("track-prop-cone", "/assets/kenney-racing/objects/cone_straight.png");
    this.load.image("track-prop-arrow", "/assets/kenney-racing/objects/arrow_yellow.png");
    this.load.image("track-prop-lights", "/assets/kenney-racing/objects/lights.png");
    this.load.image("track-prop-tribune", "/assets/kenney-racing/objects/tribune_full.png");
    this.load.image("track-prop-tribune-red", "/assets/kenney-racing/objects/tribune_overhang_red.png");
  }

  create() {
    this.track = this.add.graphics();
    this.kerbs = this.add.graphics();
    this.speedFx = this.add.graphics();
    this.createTextures();
    this.createTrackDetails();
    this.carShadow = this.add.ellipse(0, 0, 58, 92, 0x000000, 0.34);
    this.car = this.createCar(0xe20e3b, true);
    this.hud = this.getHudRefs();
    this.bindInput();
    this.scale.on("resize", () => this.resize());
    this.resize();
  }

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.04);
    const input = this.readInput();
    this.telemetry = this.model.update(dt, input);
    this.drawTrack();
    this.updateTrackDetails();
    this.drawSpeedFx();
    this.updatePlayerCar();
    this.updateRivals();
    this.updateHud();
  }

  private bindInput() {
    this.keys = this.input.keyboard!.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.keyboard!.on("keydown-SPACE", () => {
      this.launchQueued = true;
    });

    document.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
      const control = button.dataset.control as keyof typeof this.touchState;
      const set = (value: boolean) => {
        this.touchState[control] = value;
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.touchLaunch = true;
        set(true);
      });
      button.addEventListener("pointerup", () => set(false));
      button.addEventListener("pointerleave", () => set(false));
      button.addEventListener("pointercancel", () => set(false));
    });
  }

  private readInput(): RaceInput {
    const left = this.keys.left.isDown || this.keys.a.isDown || this.touchState.left;
    const right = this.keys.right.isDown || this.keys.d.isDown || this.touchState.right;

    const launch = this.launchQueued || this.touchLaunch;
    this.launchQueued = false;
    this.touchLaunch = false;

    return {
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      throttle: this.keys.up.isDown || this.keys.w.isDown,
      brake: this.keys.down.isDown || this.keys.s.isDown || this.touchState.brake,
      boost: this.keys.shift.isDown || this.touchState.boost,
      launch
    };
  }

  private drawTrack() {
    const { width, height } = this.scale;
    const horizon = -40;
    const bottom = height + 80;
    const centerX = width * 0.5;
    const trackBase = Math.min(width * 0.82, 620);
    const trackTop = Math.max(170, width * 0.22);
    const leftPoints: Phaser.Math.Vector2[] = [];
    const rightPoints: Phaser.Math.Vector2[] = [];
    const centerPoints: Phaser.Math.Vector2[] = [];
    const slices = 34;

    for (let i = 0; i <= slices; i += 1) {
      const t = i / slices;
      const y = Phaser.Math.Linear(bottom, horizon, t);
      const distanceAhead = t * 1550;
      const perspective = 1 - t * 0.58;
      const roadWidth = Phaser.Math.Linear(trackBase, trackTop, t);
      const center = centerX + this.model.trackCenterAt(distanceAhead) * roadWidth * 0.42;
      centerPoints.push(new Phaser.Math.Vector2(center, y));
      leftPoints.push(new Phaser.Math.Vector2(center - roadWidth * 0.5 * perspective, y));
      rightPoints.push(new Phaser.Math.Vector2(center + roadWidth * 0.5 * perspective, y));
    }

    const road = [...leftPoints, ...rightPoints.reverse()];
    this.track.clear();
    this.track.fillStyle(0x18201a, 1);
    this.track.fillRect(0, 0, width, height);
    this.drawGrass(width, height);
    this.track.fillStyle(0x252a2b, 1);
    this.track.fillPoints(road, true);

    this.kerbs.clear();
    this.kerbs.lineStyle(16, 0xf6f0e9, 1);
    this.kerbs.beginPath();
    leftPoints.forEach((point, index) => (index === 0 ? this.kerbs.moveTo(point.x, point.y) : this.kerbs.lineTo(point.x, point.y)));
    this.kerbs.strokePath();
    this.kerbs.lineStyle(16, 0xe20e3b, 0.9);
    drawDashedPolyline(this.kerbs, leftPoints, 22, 18);

    this.kerbs.lineStyle(16, 0xf6f0e9, 1);
    this.kerbs.beginPath();
    rightPoints.reverse().forEach((point, index) => (index === 0 ? this.kerbs.moveTo(point.x, point.y) : this.kerbs.lineTo(point.x, point.y)));
    this.kerbs.strokePath();
    this.kerbs.lineStyle(16, 0xe20e3b, 0.9);
    drawDashedPolyline(this.kerbs, rightPoints, 22, 18);

    this.track.lineStyle(2, 0xffffff, 0.22);
    [-0.18, 0.18].forEach((lane) => {
      this.track.beginPath();
      centerPoints.forEach((point, index) => {
        const t = index / slices;
        const roadWidth = Phaser.Math.Linear(trackBase, trackTop, t);
        const laneX = point.x + roadWidth * lane * (1 - t * 0.58);
        index === 0 ? this.track.moveTo(laneX, point.y) : this.track.lineTo(laneX, point.y);
      });
      this.track.strokePath();
    });
  }

  private drawGrass(width: number, height: number) {
    const stripeH = 64;
    const offset = (this.telemetry.trackOffset * 0.35) % (stripeH * 2);
    for (let y = -stripeH * 2; y < height + stripeH; y += stripeH) {
      const alt = Math.floor((y + offset) / stripeH) % 2 === 0;
      this.track.fillStyle(alt ? 0x18281a : 0x102011, 1);
      this.track.fillRect(0, y + offset, width, stripeH);
    }
  }

  private createTrackDetails() {
    for (let i = 0; i < 28; i += 1) {
      const marker = this.add.rectangle(0, 0, 6, 18, i % 4 === 0 ? 0xf7f7f2 : 0xe20e3b, 0.7);
      marker.setData("distance", 180 + i * 132);
      marker.setData("side", i % 2 === 0 ? -1 : 1);
      marker.setDepth(2);
      this.trackMarkers.push(marker);
    }

    for (let i = 0; i < 22; i += 1) {
      const key = TRACK_PROP_KEYS[i % TRACK_PROP_KEYS.length];
      const prop = this.add.image(0, 0, key);
      prop.setData("distance", 260 + i * 172);
      prop.setData("side", i % 2 === 0 ? -1 : 1);
      prop.setData("key", key);
      prop.setDepth(3);
      prop.setOrigin(0.5, 0.72);
      this.trackProps.push(prop);
    }
  }

  private updateTrackDetails() {
    const { width, height } = this.scale;
    const trackBase = Math.min(width * 0.82, 620);
    const trackTop = Math.max(170, width * 0.22);

    for (const marker of this.trackMarkers) {
      const wrapped = ((marker.getData("distance") - (this.telemetry.trackOffset % 3696)) + 3696) % 3696;
      const t = Phaser.Math.Clamp(1 - wrapped / 1900, 0, 1);
      const y = Phaser.Math.Linear(-40, height + 60, t);
      const roadWidth = Phaser.Math.Linear(trackTop, trackBase, t);
      const center = width * 0.5 + this.model.trackCenterAt(wrapped) * roadWidth * 0.42;
      const side = marker.getData("side") as number;
      const x = center + side * roadWidth * 0.62;
      const scale = Phaser.Math.Linear(0.28, 1.25, t);

      marker.setPosition(x, y);
      marker.setScale(scale, scale);
      marker.setRotation(Phaser.Math.DegToRad(side * -8));
      marker.setAlpha(Phaser.Math.Clamp(t * 1.2, 0, 0.78));
      marker.setVisible(wrapped < 1900);
    }

    for (const prop of this.trackProps) {
      const wrapped = ((prop.getData("distance") - (this.telemetry.trackOffset % 3784)) + 3784) % 3784;
      const t = Phaser.Math.Clamp(1 - wrapped / 2100, 0, 1);
      const y = Phaser.Math.Linear(-60, height + 90, t);
      const roadWidth = Phaser.Math.Linear(trackTop, trackBase, t);
      const center = width * 0.5 + this.model.trackCenterAt(wrapped) * roadWidth * 0.42;
      const side = prop.getData("side") as number;
      const key = prop.getData("key") as TrackPropKey;
      const outsideOffset = key.includes("tribune") ? 0.88 : 0.68;
      const x = center + side * roadWidth * outsideOffset;
      const baseScale = key.includes("tribune") ? 0.45 : key === "track-prop-lights" ? 0.38 : 0.34;
      const scale = Phaser.Math.Linear(baseScale * 0.38, baseScale * 1.25, t);

      prop.setPosition(x, y);
      prop.setScale(scale);
      prop.setAngle(side < 0 ? 10 : -10);
      prop.setAlpha(Phaser.Math.Clamp(t * 1.35, 0, 0.95));
      prop.setDepth(Math.floor(y) - 1);
      prop.setVisible(wrapped < 2100);
    }
  }

  private drawSpeedFx() {
    const { width, height } = this.scale;
    const intensity = Phaser.Math.Clamp((this.telemetry.speedKph - 120) / 210, 0, 1);
    this.speedFx.clear();
    if (intensity <= 0) return;

    this.speedFx.lineStyle(2, 0xffffff, 0.1 + intensity * 0.22);
    const lineCount = Math.round(8 + intensity * 16);
    const spread = Math.min(width * 0.82, 620) * 0.52;
    const centerX = width * 0.5 + this.telemetry.carX * spread * 0.18;

    for (let i = 0; i < lineCount; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const lane = ((i * 37) % 100) / 100;
      const x = centerX + side * Phaser.Math.Linear(spread * 0.18, spread, lane);
      const y = height * Phaser.Math.Linear(0.18, 0.92, ((i * 53 + this.telemetry.trackOffset) % 100) / 100);
      const len = Phaser.Math.Linear(32, 112, intensity);
      this.speedFx.beginPath();
      this.speedFx.moveTo(x, y);
      this.speedFx.lineTo(x + side * 10, y + len);
      this.speedFx.strokePath();
    }
  }

  private updatePlayerCar() {
    const { width, height } = this.scale;
    const roadWidth = Math.min(width * 0.82, 620);
    const playerY = height * 0.77;
    const x = width * 0.5 + this.telemetry.carX * roadWidth * 0.42;
    const lean = Phaser.Math.Clamp(this.model.lateralVelocity * 24, -11, 11);
    this.car.setPosition(x, playerY);
    this.car.setRotation(Phaser.Math.DegToRad(lean));
    this.car.setScale(Phaser.Math.Clamp(width / 840, 0.72, 1.05));
    this.carShadow.setPosition(x + 4, playerY + 12);
    this.carShadow.setScale(this.car.scaleX);
  }

  private updateRivals() {
    const alive = new Set<number>();
    for (const rival of this.model.rivals) {
      alive.add(rival.id);
      let view = this.rivalViews.get(rival.id);
      if (!view) {
        view = this.createCar(rival.color, false);
        this.rivalViews.set(rival.id, view);
      }
      this.placeRival(rival, view);
    }

    for (const [id, view] of this.rivalViews) {
      if (!alive.has(id)) {
        view.destroy(true);
        this.rivalViews.delete(id);
      }
    }
  }

  private placeRival(rival: RivalCar, view: Phaser.GameObjects.Container) {
    const { width, height } = this.scale;
    const t = Phaser.Math.Clamp(1 - rival.distance / 2600, 0, 1);
    const y = Phaser.Math.Linear(-90, height * 0.83, t);
    const roadWidth = Phaser.Math.Linear(Math.max(170, width * 0.22), Math.min(width * 0.82, 620), t);
    const x = width * 0.5 + (this.model.trackCenterAt(rival.distance) + rival.lane) * roadWidth * 0.42;
    const scale = Phaser.Math.Linear(0.34, 0.82, t);
    view.setPosition(x, y);
    view.setScale(scale);
    view.setDepth(Math.floor(y));
    view.setVisible(rival.distance > -180 && rival.distance < 2600);
  }

  private createCar(color: number, isPlayer: boolean) {
    const container = this.add.container(0, 0);
    container.setDepth(isPlayer ? 10000 : 10);
    const shadow = this.add.ellipse(5, 18, 64, 116, 0x000000, isPlayer ? 0 : 0.26);
    const floor = this.add.image(0, 3, "car-floor").setTint(0x151819);
    const plank = this.add.rectangle(0, 20, 7, 68, 0xf1d35b, 0.72);
    const rearWing = this.add.rectangle(0, 54, 74, 14, color);
    const rearWingTrim = this.add.rectangle(0, 47, 58, 4, 0xffffff, 0.82);
    const body = this.add.image(0, 0, "car-body").setTint(color);
    const sidepodLeft = this.add.rectangle(-20, 13, 17, 46, color, 0.95);
    const sidepodRight = this.add.rectangle(20, 13, 17, 46, color, 0.95);
    const noseStripe = this.add.rectangle(0, -33, 8, 56, 0xffffff, 0.9);
    const frontWing = this.add.rectangle(0, -63, 84, 12, color);
    const frontWingTrim = this.add.rectangle(0, -57, 64, 4, 0xffffff, 0.82);
    const nose = this.add.triangle(0, -44, -14, 12, 14, 12, 0, -58, color);
    const cockpit = this.add.ellipse(0, -9, 22, 34, 0x0a0d0f, 1);
    const visor = this.add.ellipse(0, -14, 13, 17, 0xf4f7ff, 0.9);
    const halo = this.add.rectangle(0, -25, 36, 5, 0xf2f2f2, 0.88);
    const cameraPod = this.add.rectangle(0, -45, 10, 7, 0x111416, 1);
    const tireColor = 0x050505;
    const tires = [
      ...this.createTire(-37, -37, 18, 36, tireColor, color),
      ...this.createTire(37, -37, 18, 36, tireColor, color),
      ...this.createTire(-39, 34, 21, 41, tireColor, color),
      ...this.createTire(39, 34, 21, 41, tireColor, color)
    ];
    const suspension = [
      this.createSuspension(-27, -40, -10, -20),
      this.createSuspension(27, -40, 10, -20),
      this.createSuspension(-29, 34, -12, 18),
      this.createSuspension(29, 34, 12, 18)
    ];
    container.add([
      shadow,
      floor,
      plank,
      ...suspension,
      ...tires,
      rearWing,
      rearWingTrim,
      body,
      sidepodLeft,
      sidepodRight,
      noseStripe,
      nose,
      cockpit,
      visor,
      halo,
      cameraPod,
      frontWing,
      frontWingTrim
    ]);
    return container;
  }

  private createTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(30, 22, 44, 86, 18);
    graphics.fillRoundedRect(21, 55, 62, 42, 18);
    graphics.fillTriangle(30, 48, 52, 2, 74, 48);
    graphics.generateTexture("car-body", 104, 128);
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(31, 14, 42, 102, 10);
    graphics.fillTriangle(31, 35, 52, 0, 73, 35);
    graphics.fillTriangle(31, 94, 52, 128, 73, 94);
    graphics.generateTexture("car-floor", 104, 132);
    graphics.destroy();
  }

  private createTire(x: number, y: number, width: number, height: number, tireColor: number, accent: number) {
    const tire = this.add.ellipse(x, y, width, height, tireColor);
    const sidewall = this.add.ellipse(x, y, width * 0.58, height * 0.72, 0x171717);
    const stripe = this.add.ellipse(x, y, width * 0.34, height * 0.48, accent, 0.7);
    const rim = this.add.ellipse(x, y, width * 0.18, height * 0.26, 0xdce2e5, 0.85);
    return [tire, sidewall, stripe, rim];
  }

  private createSuspension(x1: number, y1: number, x2: number, y2: number) {
    return this.add.line(0, 0, x1, y1, x2, y2, 0x32383a, 0.86).setLineWidth(3);
  }

  private updateHud() {
    const t = this.telemetry;
    this.hud.position.textContent = String(t.position).padStart(2, "0");
    this.hud.lap.textContent = `${t.lap}/${t.laps}`;
    this.hud.best.textContent = formatTime(t.bestLap);
    this.hud.delta.textContent = t.bestLap === null ? "+0.00" : `${t.delta >= 0 ? "+" : ""}${t.delta.toFixed(2)}`;
    this.hud.speed.textContent = String(t.speedKph);
    this.hud.raceProgress.style.setProperty("--value", `${Math.round(t.raceProgress * 100)}%`);
    this.hud.ers.style.setProperty("--value", `${Math.round(t.ers * 100)}%`);
    this.hud.grip.style.setProperty("--value", `${Math.round(t.grip * 100)}%`);
    this.hud.streak.textContent = t.overtakeStreak > 0 ? `${t.overtakeStreak} overtakes banked` : "Clean air";

    if (t.message) {
      this.hud.message.classList.remove("hidden");
      const strong = this.hud.message.querySelector("strong")!;
      const span = this.hud.message.querySelector("span")!;
      strong.textContent = t.phase === "finished" ? `Finished P${t.position}` : "Apex Formula";
      span.textContent = t.message;
    } else {
      this.hud.message.classList.add("hidden");
    }
  }

  private getHudRefs(): HudRefs {
    return {
      position: requireElement("position"),
      lap: requireElement("lap"),
      best: requireElement("best"),
      delta: requireElement("delta"),
      speed: requireElement("speed"),
      raceProgress: requireElement("race-progress"),
      ers: requireElement("ers"),
      grip: requireElement("grip"),
      streak: requireElement("streak"),
      message: requireElement("message")
    };
  }

  private resize() {
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height);
  }
}

function requireElement(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing HUD element #${id}`);
  return element;
}

function formatTime(seconds: number | null) {
  if (seconds === null) return "--.--";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
}

function drawDashedPolyline(
  graphics: Phaser.GameObjects.Graphics,
  points: Phaser.Math.Vector2[],
  dashLength: number,
  gapLength: number
) {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
    let cursor = 0;

    while (cursor < segmentLength) {
      const dashEnd = Math.min(cursor + dashLength, segmentLength);
      const fromX = start.x + Math.cos(angle) * cursor;
      const fromY = start.y + Math.sin(angle) * cursor;
      const toX = start.x + Math.cos(angle) * dashEnd;
      const toY = start.y + Math.sin(angle) * dashEnd;
      graphics.beginPath();
      graphics.moveTo(fromX, fromY);
      graphics.lineTo(toX, toY);
      graphics.strokePath();
      cursor += dashLength + gapLength;
    }
  }
}
