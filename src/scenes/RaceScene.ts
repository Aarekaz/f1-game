import Phaser from "phaser";
import { RaceInput, RaceModel, RivalCar, Telemetry } from "../game/RaceModel";

type HudRefs = {
  position: HTMLElement;
  lap: HTMLElement;
  best: HTMLElement;
  delta: HTMLElement;
  speed: HTMLElement;
  ers: HTMLElement;
  grip: HTMLElement;
  message: HTMLElement;
};

export class RaceScene extends Phaser.Scene {
  private model = new RaceModel();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private track!: Phaser.GameObjects.Graphics;
  private kerbs!: Phaser.GameObjects.Graphics;
  private car!: Phaser.GameObjects.Container;
  private carShadow!: Phaser.GameObjects.Ellipse;
  private rivalViews = new Map<number, Phaser.GameObjects.Container>();
  private hud!: HudRefs;
  private touchState = { left: false, right: false, brake: false, boost: false };
  private touchLaunch = false;
  private telemetry!: Telemetry;

  constructor() {
    super("RaceScene");
  }

  create() {
    this.track = this.add.graphics();
    this.kerbs = this.add.graphics();
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

    const launch = this.keys.space.isDown || this.touchLaunch;
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
      const star = this.add.rectangle(0, 0, 2, 2, 0xfff3bd, 0.28);
      star.setData("distance", Math.random());
      star.setData("side", Math.random() > 0.5 ? -1 : 1);
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
    const shadow = this.add.ellipse(4, 14, 48, 84, 0x000000, isPlayer ? 0 : 0.24);
    const rearWing = this.add.rectangle(0, 44, 64, 12, color);
    const body = this.add.image(0, 0, "car-body").setTint(color);
    const nose = this.add.triangle(0, -42, -14, 18, 14, 18, 0, -34, color);
    const cockpit = this.add.ellipse(0, -6, 20, 30, 0x101416, 1);
    const halo = this.add.rectangle(0, -16, 30, 4, 0xf2f2f2, 0.86);
    const frontWing = this.add.rectangle(0, -52, 74, 11, color);
    const tireColor = 0x050505;
    const tires = [
      this.add.ellipse(-31, -32, 16, 31, tireColor),
      this.add.ellipse(31, -32, 16, 31, tireColor),
      this.add.ellipse(-33, 32, 18, 34, tireColor),
      this.add.ellipse(33, 32, 18, 34, tireColor)
    ];
    container.add([shadow, ...tires, rearWing, body, nose, cockpit, halo, frontWing]);
    return container;
  }

  private createTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(22, 4, 40, 88, 18);
    graphics.fillTriangle(22, 28, 42, -8, 62, 28);
    graphics.generateTexture("car-body", 84, 100);
    graphics.destroy();
  }

  private updateHud() {
    const t = this.telemetry;
    this.hud.position.textContent = String(t.position).padStart(2, "0");
    this.hud.lap.textContent = `${t.lap}/${t.laps}`;
    this.hud.best.textContent = formatTime(t.bestLap);
    this.hud.delta.textContent = t.bestLap === null ? "+0.00" : `${t.delta >= 0 ? "+" : ""}${t.delta.toFixed(2)}`;
    this.hud.speed.textContent = String(t.speedKph);
    this.hud.ers.style.setProperty("--value", `${Math.round(t.ers * 100)}%`);
    this.hud.grip.style.setProperty("--value", `${Math.round(t.grip * 100)}%`);

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
      ers: requireElement("ers"),
      grip: requireElement("grip"),
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
