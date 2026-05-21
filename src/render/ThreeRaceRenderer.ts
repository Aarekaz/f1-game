import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import { trackCenterAt, TRACK_LOOP_LENGTH } from "../game/trackPath";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";
import { buildGpCircuit, updateGpCircuit } from "./buildGpCircuit";

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
  private readonly horizon = this.buildHorizon();
  private readonly speedStreaks = this.buildSpeedStreaks();
  private readonly rivals = new Map<number, ReturnType<typeof buildFormulaCarProxy>>();
  private readonly handleResize = () => this.resize();

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#c7d8df");
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.className = "race-canvas";
    this.parent.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog("#c7d8df", 180, 920);

    const hemi = new THREE.HemisphereLight("#dcefff", "#14210f", 1.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffffff", 2.7);
    sun.position.set(-12, 30, -22);
    sun.castShadow = true;
    this.scene.add(sun);

    this.scene.add(this.circuit);
    this.scene.add(this.horizon);
    this.scene.add(this.speedStreaks);
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
    const visualProgress = telemetry.car.z % TRACK_LOOP_LENGTH;
    this.renderer.domElement.dataset.trackOffset = visualProgress.toFixed(2);
    updateGpCircuit(this.circuit, telemetry.car.z);
    const center = trackCenterAt(telemetry.car.z);
    const localCarX = telemetry.car.x - center;
    this.car.position.set(localCarX, 0, 0);
    this.car.rotation.y = -telemetry.car.heading - telemetry.curve * 0.5;
    this.car.rotation.z = -telemetry.car.yawRate * 0.22;

    const speedRatio = Math.min(1, telemetry.speedKph / 310);
    this.updateSpeedStreaks(speedRatio, telemetry.car.slip, telemetry.car.braking);
    this.camera.fov = 57 + speedRatio * 12;
    this.camera.position.set(
      localCarX * 0.55,
      5.3 - telemetry.car.braking * 0.52 + telemetry.car.slip * 0.3,
      10.7 + speedRatio * 2.4
    );
    this.camera.lookAt(localCarX * 0.35 - telemetry.curve * 5, 0.62, -9.5 - speedRatio * 5.4);
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

  private buildHorizon() {
    const horizon = new THREE.Group();
    horizon.name = "soft-gp-horizon";

    const skyMaterial = new THREE.MeshBasicMaterial({
      color: "#bfd4dc",
      fog: false,
      side: THREE.DoubleSide
    });
    const treelineMaterial = new THREE.MeshBasicMaterial({
      color: "#5d7b63",
      fog: false,
      side: THREE.DoubleSide
    });

    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2200, 540), skyMaterial);
    sky.position.set(0, 250, -760);
    horizon.add(sky);

    const treeline = new THREE.Mesh(new THREE.PlaneGeometry(2200, 54), treelineMaterial);
    treeline.position.set(0, 22, -755);
    horizon.add(treeline);

    return horizon;
  }

  private buildSpeedStreaks() {
    const group = new THREE.Group();
    group.name = "peripheral-speed-streaks";

    const material = new THREE.MeshBasicMaterial({
      color: "#f6fff1",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    });

    for (let index = 0; index < 18; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 8 + (index % 4) * 2.2), material);
      mesh.name = "speed-streak";
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = (index % 3 - 1) * 0.1;
      mesh.position.set(index % 2 === 0 ? -7.6 - (index % 5) * 0.9 : 7.6 + (index % 5) * 0.9, 0.09, -6 - index * 7.5);
      group.add(mesh);
    }

    group.userData.material = material;
    return group;
  }

  private updateSpeedStreaks(speedRatio: number, slip: number, braking: number) {
    const material = this.speedStreaks.userData.material as THREE.MeshBasicMaterial | undefined;
    if (material) {
      material.opacity = Math.max(0, speedRatio - 0.46) * 0.34 + slip * 0.08 + braking * 0.04;
      material.color.set(braking > 0.25 ? "#ffd7c8" : "#f6fff1");
    }

    this.speedStreaks.position.z = (performance.now() * 0.035 * (0.4 + speedRatio)) % 15;
    this.speedStreaks.position.x = this.car.position.x * 0.2;
    this.speedStreaks.scale.z = 0.8 + speedRatio * 1.35;
  }
}
