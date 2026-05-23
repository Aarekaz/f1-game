import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import { trackCenterAt, TRACK_LOOP_LENGTH } from "../game/trackPath";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";
import { buildGpCircuit } from "./buildGpCircuit";
import { RacingAssetLibrary } from "./RacingAssetLibrary";

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
  private readonly assets = new RacingAssetLibrary();
  private readonly car = buildFormulaCarProxy();
  private readonly circuit = buildGpCircuit();
  private readonly horizon = this.buildHorizon();
  private readonly speedStreaks = this.buildSpeedStreaks();
  private readonly tireSmoke = this.buildTireSmoke();
  private readonly cameraPosition = new THREE.Vector3(0, 5.3, 10.7);
  private readonly cameraTarget = new THREE.Vector3(0, 0.62, -9.5);
  private readonly desiredCameraPosition = new THREE.Vector3();
  private readonly desiredCameraTarget = new THREE.Vector3();
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
    this.scene.add(this.tireSmoke);
    this.scene.add(this.car);
    void this.loadRaceAssets();
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
    this.renderer.domElement.dataset.carWorldZ = telemetry.car.z.toFixed(2);
    this.renderer.domElement.dataset.circuitWorldZ = this.circuit.position.z.toFixed(2);
    this.renderer.domElement.dataset.carSlip = telemetry.car.slip.toFixed(3);
    this.renderer.domElement.dataset.carWheelspin = telemetry.car.wheelspin.toFixed(3);
    this.renderer.domElement.dataset.carUndersteer = telemetry.car.understeer.toFixed(3);
    this.renderer.domElement.dataset.carLockup = telemetry.car.lockup.toFixed(3);
    const carX = telemetry.car.x;
    const carZ = -telemetry.car.z;
    this.car.position.set(carX, 0, carZ);
    this.car.rotation.y = -telemetry.car.heading - telemetry.curve * 0.5;
    this.car.rotation.z = -telemetry.car.yawRate * 0.22 + telemetry.car.understeer * 0.025 - telemetry.car.lockup * 0.018;

    const speedRatio = Math.min(1, telemetry.speedKph / 310);
    this.updateSpeedStreaks(carX, carZ, speedRatio, telemetry.car.slip, telemetry.car.braking);
    this.updateTireSmoke(carX, carZ, telemetry.car.heading, speedRatio, telemetry.car.slip, telemetry.car.wheelspin, telemetry.car.lockup);
    this.camera.fov = 57 + speedRatio * 12;
    this.desiredCameraPosition.set(
      carX,
      5.3 - telemetry.car.braking * 0.52 + telemetry.car.slip * 0.3,
      carZ + 10.7 + speedRatio * 2.4
    );
    this.desiredCameraTarget.set(carX - telemetry.curve * 5, 0.62, carZ - 9.5 - speedRatio * 5.4);
    const follow = 0.08 + speedRatio * 0.06;
    this.cameraPosition.lerp(this.desiredCameraPosition, follow);
    this.cameraTarget.lerp(this.desiredCameraTarget, follow * 1.4);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
    this.horizon.position.z = this.camera.position.z - 10.7;

    for (const rival of telemetry.rivals) {
      const existing = this.rivals.get(rival.id);
      const gapMeters = rival.z - telemetry.car.z;
      if (gapMeters < -45 || gapMeters > 280) {
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
    void this.assets.createCar(color).then((asset) => this.replaceModel(mesh, asset)).catch(() => undefined);
    return mesh;
  }

  private async loadRaceAssets() {
    try {
      const [playerCar] = await Promise.all([
        this.assets.createCar("#e72436"),
        this.addTracksideAssets()
      ]);
      this.replaceModel(this.car, playerCar);
      this.renderer.domElement.dataset.assetCar = "kenney";
    } catch {
      this.renderer.domElement.dataset.assetCar = "proxy";
    }
  }

  private async addTracksideAssets() {
    const stands = await Promise.all([this.assets.createGrandstand(), this.assets.createGrandstand(), this.assets.createGrandstand()]);
    const lights = await Promise.all([this.assets.createLightPost(), this.assets.createLightPost(), this.assets.createLightPost(), this.assets.createLightPost()]);
    const standPlacements = [
      { distance: 120, lateral: -24, rotation: Math.PI * 0.52 },
      { distance: 620, lateral: 23, rotation: -Math.PI * 0.48 },
      { distance: 1540, lateral: -22, rotation: Math.PI * 0.52 }
    ];
    const lightPlacements = [
      { distance: 210, lateral: 18 },
      { distance: 760, lateral: -18 },
      { distance: 1160, lateral: 18 },
      { distance: 1470, lateral: -18 }
    ];

    stands.forEach((stand, index) => {
      const placement = standPlacements[index];
      stand.position.set(trackCenterAt(placement.distance) + placement.lateral, 0, -placement.distance);
      stand.rotation.y = placement.rotation;
      this.scene.add(stand);
    });

    lights.forEach((light, index) => {
      const placement = lightPlacements[index];
      light.position.set(trackCenterAt(placement.distance) + placement.lateral, 0, -placement.distance);
      light.rotation.y = placement.lateral > 0 ? -0.4 : 0.4;
      this.scene.add(light);
    });
  }

  private replaceModel(target: THREE.Group, asset: THREE.Object3D) {
    disposeObject3D(target);
    target.clear();
    target.add(asset);
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

  private updateSpeedStreaks(carX: number, carZ: number, speedRatio: number, slip: number, braking: number) {
    const material = this.speedStreaks.userData.material as THREE.MeshBasicMaterial | undefined;
    if (material) {
      material.opacity = Math.max(0, speedRatio - 0.46) * 0.34 + slip * 0.08 + braking * 0.04;
      material.color.set(braking > 0.25 ? "#ffd7c8" : "#f6fff1");
    }

    this.speedStreaks.position.z = carZ + (performance.now() * 0.035 * (0.4 + speedRatio)) % 15;
    this.speedStreaks.position.x = carX * 0.2;
    this.speedStreaks.scale.z = 0.8 + speedRatio * 1.35;
  }

  private buildTireSmoke() {
    const group = new THREE.Group();
    group.name = "tire-smoke-feedback";

    const material = new THREE.MeshBasicMaterial({
      color: "#f4f0e8",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 8; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42 + index * 0.05, 0.72 + index * 0.08), material);
      mesh.name = "tire-smoke-puff";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(index % 2 === 0 ? -0.9 : 0.9, 0.08, 1.4 + index * 0.52);
      group.add(mesh);
    }

    group.userData.material = material;
    return group;
  }

  private updateTireSmoke(
    carX: number,
    carZ: number,
    heading: number,
    speedRatio: number,
    slip: number,
    wheelspin: number,
    lockup: number
  ) {
    const material = this.tireSmoke.userData.material as THREE.MeshBasicMaterial | undefined;
    const smokeStrength = Math.min(1, slip * 1.2 + wheelspin * 0.65 + lockup * 0.75);
    if (material) {
      material.opacity = smokeStrength * 0.22;
      material.color.set(lockup > wheelspin ? "#fff4e2" : "#eaf0e7");
    }

    this.tireSmoke.visible = smokeStrength > 0.025;
    this.tireSmoke.position.set(carX, 0, carZ);
    this.tireSmoke.rotation.y = -heading;
    const pulse = 1 + Math.sin(performance.now() * 0.018) * 0.08;
    this.tireSmoke.scale.setScalar((0.65 + speedRatio * 0.75 + smokeStrength * 0.55) * pulse);
  }
}
