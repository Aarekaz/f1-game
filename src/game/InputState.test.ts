import { afterEach, describe, expect, it, vi } from "vitest";
import { InputState, shapeSteerInput } from "./InputState";

type StubButton = {
  pressed: boolean;
  value: number;
};

function makeButtons() {
  return Array.from({ length: 10 }, () => ({ pressed: false, value: 0 }));
}

function stubGamepad(buttons: StubButton[], axes = [0]) {
  vi.stubGlobal("navigator", {
    getGamepads: () => [{ axes, buttons }]
  });
}

describe("InputState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shapes steering for finer center control while preserving full lock", () => {
    expect(shapeSteerInput(0)).toBe(0);
    expect(shapeSteerInput(1)).toBe(1);
    expect(shapeSteerInput(-1)).toBe(-1);
    expect(shapeSteerInput(0.25)).toBeLessThan(0.25);
    expect(shapeSteerInput(-0.5)).toBeGreaterThan(-0.5);
  });

  it("keeps analog gamepad throttle, brake, and ERS as held controls", () => {
    const buttons = makeButtons();
    buttons[1].pressed = true;
    buttons[6].value = 0.45;
    buttons[7].value = 0.8;
    stubGamepad(buttons, [0.5]);

    const input = new InputState();
    const first = input.update(1 / 30);
    const second = input.update(1 / 30);

    expect(first.steer).toBeGreaterThan(0);
    expect(first.throttle).toBeGreaterThan(0);
    expect(first.brake).toBeGreaterThan(0);
    expect(first.ers).toBe(true);
    expect(second.throttle).toBeGreaterThan(first.throttle);
    expect(second.brake).toBeGreaterThan(first.brake);
    expect(second.ers).toBe(true);
  });

  it("turns gamepad camera, pause, recover, and restart buttons into pulses", () => {
    const buttons = makeButtons();
    buttons[2].pressed = true;
    buttons[3].pressed = true;
    buttons[4].pressed = true;
    buttons[9].pressed = true;
    stubGamepad(buttons);

    const input = new InputState();
    const pressed = input.update(1 / 60);
    const held = input.update(1 / 60);

    expect(pressed.recover).toBe(true);
    expect(pressed.restart).toBe(true);
    expect(pressed.cameraToggle).toBe(true);
    expect(pressed.pauseToggle).toBe(true);
    expect(held.recover).toBe(false);
    expect(held.restart).toBe(false);
    expect(held.cameraToggle).toBe(false);
    expect(held.pauseToggle).toBe(false);

    buttons[2].pressed = false;
    buttons[3].pressed = false;
    buttons[4].pressed = false;
    buttons[9].pressed = false;
    input.update(1 / 60);

    buttons[4].pressed = true;
    const pressedAgain = input.update(1 / 60);
    expect(pressedAgain.cameraToggle).toBe(true);
  });

  it("recovers opposite lock faster than normal steering build-up", () => {
    const buttons = makeButtons();
    stubGamepad(buttons, [1]);

    const input = new InputState();
    const right = input.update(1 / 20);
    input.update(1 / 20);
    stubGamepad(buttons, [-1]);
    const left = input.update(1 / 20);

    expect(right.steer).toBeGreaterThan(0.25);
    expect(left.steer).toBeLessThan(0);
  });
});
