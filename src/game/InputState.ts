import type { RaceActions } from "./SimcadeRaceModel";

export type InputActions = RaceActions & {
  cameraToggle: boolean;
  pauseToggle: boolean;
};

type KeyMap = {
  left: boolean;
  right: boolean;
  throttle: boolean;
  brake: boolean;
  ers: boolean;
  launch: boolean;
  recover: boolean;
  restart: boolean;
};

type GamepadPulseMap = {
  recover: boolean;
  camera: boolean;
  pause: boolean;
  restart: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function approach(current: number, target: number, amount: number) {
  return current + (target - current) * clamp01(amount);
}

function clampSigned(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function shapeSteerInput(value: number) {
  const clamped = clampSigned(value);
  const magnitude = Math.abs(clamped);
  return Math.sign(clamped) * Math.pow(magnitude, 1.18);
}

export class InputState {
  private keys: KeyMap = {
    left: false,
    right: false,
    throttle: false,
    brake: false,
    ers: false,
    launch: false,
    recover: false,
    restart: false
  };

  private steer = 0;
  private throttle = 0;
  private brake = 0;
  private launchPulse = false;
  private recoverPulse = false;
  private cameraPulse = false;
  private pausePulse = false;
  private restartPulse = false;
  private previousGamepadPulses: GamepadPulseMap = {
    recover: false,
    camera: false,
    pause: false,
    restart: false
  };

  attach(target: Window = window) {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    document.getElementById("start-race")?.addEventListener("click", this.onLaunchClick);
    document.getElementById("restart-race")?.addEventListener("click", this.onRestartClick);
    document.getElementById("pause-race")?.addEventListener("click", this.onPauseClick);
    document.getElementById("resume-race")?.addEventListener("click", this.onPauseClick);
  }

  detach(target: Window = window) {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    document.getElementById("start-race")?.removeEventListener("click", this.onLaunchClick);
    document.getElementById("restart-race")?.removeEventListener("click", this.onRestartClick);
    document.getElementById("pause-race")?.removeEventListener("click", this.onPauseClick);
    document.getElementById("resume-race")?.removeEventListener("click", this.onPauseClick);
    this.reset();
  }

  update(dt: number): InputActions {
    const steerTarget = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const gamepad = this.readGamepad();
    const combinedSteerTarget = shapeSteerInput(Math.abs(gamepad.steer) > Math.abs(steerTarget) ? gamepad.steer : steerTarget);
    const steeringOppositeLock = this.steer !== 0 && combinedSteerTarget !== 0 && Math.sign(this.steer) !== Math.sign(combinedSteerTarget);
    const steeringResponse = combinedSteerTarget === 0 ? 10.5 : steeringOppositeLock ? 11.5 : 6.4;
    this.steer = approach(this.steer, combinedSteerTarget, dt * steeringResponse);
    this.throttle = approach(this.throttle, Math.max(this.keys.throttle ? 1 : 0, gamepad.throttle), dt * 7);
    this.brake = approach(this.brake, Math.max(this.keys.brake ? 1 : 0, gamepad.brake), dt * 10);

    const actions = {
      steer: this.steer,
      throttle: this.throttle,
      brake: this.brake,
      ers: this.keys.ers || gamepad.ers,
      launch: this.launchPulse || this.keys.launch || this.keys.throttle || gamepad.launch,
      recover: this.recoverPulse || gamepad.recover,
      cameraToggle: this.cameraPulse || gamepad.camera,
      pauseToggle: this.pausePulse || gamepad.pause,
      restart: this.restartPulse || this.keys.restart || gamepad.restart
    };
    this.launchPulse = false;
    this.recoverPulse = false;
    this.cameraPulse = false;
    this.pausePulse = false;
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
      recover: false,
      restart: false
    };
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.launchPulse = false;
    this.recoverPulse = false;
    this.cameraPulse = false;
    this.pausePulse = false;
    this.restartPulse = false;
    this.previousGamepadPulses = {
      recover: false,
      camera: false,
      pause: false,
      restart: false
    };
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "KeyR" && !event.repeat) {
      this.recoverPulse = true;
      this.restartPulse = true;
      event.preventDefault();
      return;
    }

    if (event.code === "KeyC" && !event.repeat) {
      this.cameraPulse = true;
      event.preventDefault();
      return;
    }

    if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) {
      this.pausePulse = true;
      event.preventDefault();
      return;
    }

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

  private onPauseClick = () => {
    this.pausePulse = true;
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
      default:
        return false;
    }
  }

  private readGamepad() {
    const gamepad = navigator.getGamepads?.().find(Boolean);
    if (!gamepad) {
      this.previousGamepadPulses = {
        recover: false,
        camera: false,
        pause: false,
        restart: false
      };
      return { steer: 0, throttle: 0, brake: 0, ers: false, launch: false, recover: false, camera: false, pause: false, restart: false };
    }

    const axisSteer = Math.abs(gamepad.axes[0] ?? 0) > 0.08 ? gamepad.axes[0] ?? 0 : 0;
    const rightTrigger = gamepad.buttons[7]?.value ?? 0;
    const leftTrigger = gamepad.buttons[6]?.value ?? 0;
    const faceDown = gamepad.buttons[0]?.pressed ?? false;
    const pressed: GamepadPulseMap = {
      recover: gamepad.buttons[2]?.pressed ?? false,
      camera: gamepad.buttons[4]?.pressed ?? false,
      pause: gamepad.buttons[9]?.pressed ?? false,
      restart: gamepad.buttons[3]?.pressed ?? false
    };
    const pulses: GamepadPulseMap = {
      recover: pressed.recover && !this.previousGamepadPulses.recover,
      camera: pressed.camera && !this.previousGamepadPulses.camera,
      pause: pressed.pause && !this.previousGamepadPulses.pause,
      restart: pressed.restart && !this.previousGamepadPulses.restart
    };
    this.previousGamepadPulses = pressed;

    return {
      steer: axisSteer,
      throttle: Math.max(rightTrigger, faceDown ? 1 : 0),
      brake: leftTrigger,
      ers: gamepad.buttons[1]?.pressed ?? false,
      launch: rightTrigger > 0.1 || faceDown,
      recover: pulses.recover,
      camera: pulses.camera,
      pause: pulses.pause,
      restart: pulses.restart
    };
  }
}
