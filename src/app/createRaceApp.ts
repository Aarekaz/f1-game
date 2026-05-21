import { InputState } from "../game/InputState";
import { SimcadeRaceModel, type RaceActions } from "../game/SimcadeRaceModel";
import { ThreeRaceRenderer } from "../render/ThreeRaceRenderer";
import { HudController } from "../ui/HudController";

type ControlName = "left" | "right" | "throttle" | "brake" | "boost";

const MAX_DT = 1 / 20;

function createTouchBridge() {
  const activeControls = new Set<ControlName>();
  const cleanups: Array<() => void> = [];
  let launchPulse = false;

  document.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    if (!isControlName(control)) return;

    const activate = (event: Event) => {
      event.preventDefault();
      activeControls.add(control);
      if (control === "throttle") launchPulse = true;
    };
    const deactivate = (event: Event) => {
      event.preventDefault();
      activeControls.delete(control);
    };

    button.addEventListener("pointerdown", activate);
    button.addEventListener("pointerup", deactivate);
    button.addEventListener("pointercancel", deactivate);
    button.addEventListener("pointerleave", deactivate);

    cleanups.push(() => {
      button.removeEventListener("pointerdown", activate);
      button.removeEventListener("pointerup", deactivate);
      button.removeEventListener("pointercancel", deactivate);
      button.removeEventListener("pointerleave", deactivate);
    });
  });

  return {
    merge(actions: RaceActions): RaceActions {
      const touchSteer = (activeControls.has("right") ? 1 : 0) - (activeControls.has("left") ? 1 : 0);
      const merged = {
        ...actions,
        steer: touchSteer !== 0 ? touchSteer : actions.steer,
        throttle: activeControls.has("throttle") ? 1 : actions.throttle,
        brake: activeControls.has("brake") ? 1 : actions.brake,
        ers: actions.ers || activeControls.has("boost"),
        launch: actions.launch || launchPulse || activeControls.has("throttle")
      };
      launchPulse = false;
      return merged;
    },
    destroy() {
      for (const cleanup of cleanups) cleanup();
      cleanups.length = 0;
      activeControls.clear();
    }
  };
}

function isControlName(value: string | undefined): value is ControlName {
  return value === "left" || value === "right" || value === "throttle" || value === "brake" || value === "boost";
}

export function createRaceApp() {
  const container = document.getElementById("game");
  if (!container) throw new Error("Missing #game container");

  const input = new InputState();
  const touch = createTouchBridge();
  const model = new SimcadeRaceModel();
  const renderer = new ThreeRaceRenderer(container);
  const hud = new HudController();
  let last = performance.now();
  let frame = 0;

  input.attach();

  function tick(now: number) {
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;

    const actions = touch.merge(input.update(dt));
    const telemetry = model.update(dt, actions);
    renderer.update(telemetry);
    hud.update(telemetry);
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    renderer.resize();
  }

  window.addEventListener("resize", resize);
  resize();
  frame = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      input.detach();
      touch.destroy();
      renderer.dispose();
    }
  };
}
