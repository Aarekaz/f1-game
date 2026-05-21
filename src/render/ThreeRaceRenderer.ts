import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";
import { buildGpCircuit } from "./buildGpCircuit";

function disposeObject3D(root: { traverse: (callback: (object: unknown) => void) => void }) {
  const materials = new Set<{ dispose: () => void }>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const mesh = object as {
      geometry: { dispose: () => void };
      material: { dispose: () => void } | Array<{ dispose: () => void }>;
    };
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) materials.add(item);
    } else {
      materials.add(material);
    }
  });

  for (const material of materials) {
    material.dispose();
  }
}

export class ThreeRaceRenderer {
  private readonly renderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1800);
  private readonly car = buildFormulaCarProxy();
  private readonly circuit = buildGpCircuit();
  private readonly rivals = new Map<number, ReturnType<typeof buildFormulaCarProxy>>();
  private readonly handleResize = () => this.resize();

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#091015");
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.className = "race-canvas";
    this.parent.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog("#091015", 150, 820);

    const hemi = new THREE.HemisphereLight("#dcefff", "#14210f", 1.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffffff", 2.7);
    sun.position.set(-12, 30, -22);
    sun.castShadow = true;
    this.scene.add(sun);

    this.scene.add(this.circuit);
    this.scene.add(this.car);
    this.resize();
    window.addEventListener("resize", this.handleResize);
  }

  resize() {
    const width = this.parent.clientWidth || window.innerWidth || 1;
    const height = this.parent.clientHeight || window.innerHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(telemetry: RaceTelemetry) {
    const visualProgress = telemetry.car.z % 520;
    this.circuit.position.z = visualProgress;
    this.renderer.domElement.dataset.trackOffset = visualProgress.toFixed(2);
    this.car.position.set(telemetry.car.x, 0, 0);
    this.car.rotation.y = -telemetry.car.heading;
    this.car.rotation.z = -telemetry.car.yawRate * 0.22;

    const speedRatio = Math.min(1, telemetry.speedKph / 310);
    this.camera.fov = 57 + speedRatio * 12;
    this.camera.position.set(
      telemetry.car.x * 0.55,
      5.3 - telemetry.car.braking * 0.52 + telemetry.car.slip * 0.3,
      10.7 + speedRatio * 2.4
    );
    this.camera.lookAt(telemetry.car.x * 0.35, 0.62, -9.5 - speedRatio * 5.4);
    this.camera.updateProjectionMatrix();

    for (const rival of telemetry.rivals) {
      const existing = this.rivals.get(rival.id);
      if (rival.z < -45 || rival.z > 280) {
        if (existing) existing.visible = false;
        continue;
      }

      const mesh = existing ?? this.addRival(rival.id, rival.color);
      mesh.visible = true;
      mesh.position.set(rival.x, 0, -rival.z);
      mesh.rotation.y = -rival.heading;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener("resize", this.handleResize);
    disposeObject3D(this.scene);
    this.rivals.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addRival(id: number, color: string) {
    const mesh = buildFormulaCarProxy(color);
    mesh.name = `rival-${id}`;
    this.rivals.set(id, mesh);
    this.scene.add(mesh);
    return mesh;
  }
}
