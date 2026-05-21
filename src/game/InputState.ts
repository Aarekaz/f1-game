import type { RaceActions } from "./SimcadeRaceModel";

type KeyMap = {
  left: boolean;
  right: boolean;
  throttle: boolean;
  brake: boolean;
  ers: boolean;
  launch: boolean;
  restart: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function approach(current: number, target: number, amount: number) {
  return current + (target - current) * clamp01(amount);
}

export class InputState {
  private keys: KeyMap = {
    left: false,
    right: false,
    throttle: false,
    brake: false,
    ers: false,
    launch: false,
    restart: false
  };

  private steer = 0;
  private throttle = 0;
  private brake = 0;
  private launchPulse = false;
  private restartPulse = false;

  attach(target: Window = window) {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    document.getElementById("start-race")?.addEventListener("click", this.onLaunchClick);
    document.getElementById("restart-race")?.addEventListener("click", this.onRestartClick);
  }

  detach(target: Window = window) {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    document.getElementById("start-race")?.removeEventListener("click", this.onLaunchClick);
    document.getElementById("restart-race")?.removeEventListener("click", this.onRestartClick);
    this.reset();
  }

  update(dt: number): RaceActions {
    const steerTarget = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    this.steer = approach(this.steer, steerTarget, dt * (steerTarget === 0 ? 9 : 6));
    this.throttle = approach(this.throttle, this.keys.throttle ? 1 : 0, dt * 7);
    this.brake = approach(this.brake, this.keys.brake ? 1 : 0, dt * 10);

    const actions = {
      steer: this.steer,
      throttle: this.throttle,
      brake: this.brake,
      ers: this.keys.ers,
      launch: this.launchPulse || this.keys.launch || this.keys.throttle,
      restart: this.restartPulse || this.keys.restart
    };
    this.launchPulse = false;
    this.restartPulse = false;
    return actions;
  }

  reset() {
    this.keys = {
      left: false,
      right: false,
      throttle: false,
      brake: false,
      ers: false,
      launch: false,
      restart: false
    };
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.launchPulse = false;
    this.restartPulse = false;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.setKey(event.code, true)) {
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (this.setKey(event.code, false)) {
      event.preventDefault();
    }
  };

  private onLaunchClick = () => {
    this.launchPulse = true;
  };

  private onRestartClick = () => {
    this.restartPulse = true;
  };

  private setKey(code: string, active: boolean) {
    switch (code) {
      case "ArrowLeft":
      case "KeyA":
        this.keys.left = active;
        return true;
      case "ArrowRight":
      case "KeyD":
        this.keys.right = active;
        return true;
      case "ArrowUp":
      case "KeyW":
        this.keys.throttle = active;
        return true;
      case "ArrowDown":
      case "KeyS":
        this.keys.brake = active;
        return true;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.ers = active;
        return true;
      case "Enter":
      case "Space":
        this.keys.launch = active;
        return true;
      case "KeyR":
        this.keys.restart = active;
        return true;
      default:
        return false;
    }
  }
}
