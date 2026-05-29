import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import { getActiveTrackLayout, sampleTrack, setActiveTrackLayout, TRACK_LOOP_LENGTH } from "../game/trackPath";
import type { SessionConfig } from "../world/FictionalGpWorld";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";
import { buildGpCircuit } from "./buildGpCircuit";
import { RacingAssetLibrary } from "./RacingAssetLibrary";

function disposeObject3D(root: { traverse: (callback: (object: unknown) => void) => void }) {
  const materials = new Set<{ dispose: () => void }>();
  const textures = new Set<{ dispose: () => void }>();

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
    const mapped = material as { map?: { dispose: () => void } | null };
    if (mapped.map) textures.add(mapped.map);
    material.dispose();
  }

  for (const texture of textures) {
    texture.dispose();
  }
}

function makeSoftMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 76, 4, 64, 72, 62);
    gradient.addColorStop(0, "rgba(235, 243, 240, 0.46)");
    gradient.addColorStop(0.42, "rgba(225, 236, 234, 0.22)");
    gradient.addColorStop(1, "rgba(225, 236, 234, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class ThreeRaceRenderer {
  private readonly renderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1800);
  private readonly assets = new RacingAssetLibrary();
  private readonly hemi = new THREE.HemisphereLight("#dcefff", "#14210f", 1.7);
  private readonly sun = new THREE.DirectionalLight("#ffffff", 2.7);
  private readonly car = buildFormulaCarProxy();
  private circuit = buildGpCircuit();
  private readonly tracksideAssets = new THREE.Group();
  private horizon = this.buildHorizon();
  private readonly speedStreaks = this.buildSpeedStreaks();
  private readonly tireSmoke = this.buildTireSmoke();
  private readonly rainStreaks = this.buildRainStreaks();
  private readonly waterSpray = this.buildWaterSpray();
  private readonly cameraPosition = new THREE.Vector3(0, 4.8, 15.4);
  private readonly cameraTarget = new THREE.Vector3(0, 0.72, -13.5);
  private readonly desiredCameraPosition = new THREE.Vector3();
  private readonly desiredCameraTarget = new THREE.Vector3();
  private readonly carScreenPosition = new THREE.Vector3();
  private readonly rivals = new Map<number, ReturnType<typeof buildFormulaCarProxy>>();
  private readonly handleResize = () => this.resize();

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#c7d8df");
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.className = "race-canvas";
    this.renderer.domElement.dataset.assetCar = "apex-procedural";
    this.parent.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog("#c7d8df", 180, 920);
    this.scene.add(this.hemi);
    this.sun.position.set(-12, 30, -22);
    this.sun.castShadow = true;
    this.scene.add(this.sun);

    this.scene.add(this.circuit);
    this.tracksideAssets.name = "loaded-trackside-assets";
    this.scene.add(this.tracksideAssets);
    this.scene.add(this.horizon);
    this.scene.add(this.speedStreaks);
    this.scene.add(this.tireSmoke);
    this.scene.add(this.rainStreaks);
    this.scene.add(this.waterSpray);
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

  configure(session: SessionConfig) {
    setActiveTrackLayout(session.track.id);
    this.scene.remove(this.circuit);
    disposeObject3D(this.circuit);
    this.circuit = buildGpCircuit();
    this.scene.add(this.circuit);
    this.scene.remove(this.horizon);
    disposeObject3D(this.horizon);
    this.horizon = this.buildHorizon();
    this.scene.add(this.horizon);
    this.positionLoadedTracksideAssets();
    this.renderer.domElement.dataset.trackLayout = session.track.id;
    this.renderer.domElement.dataset.horizonTrack = session.track.id;
  }

  update(telemetry: RaceTelemetry) {
    const visualProgress = telemetry.car.z % TRACK_LOOP_LENGTH;
    this.renderer.domElement.dataset.trackOffset = visualProgress.toFixed(2);
    this.renderer.domElement.dataset.carWorldZ = telemetry.car.z.toFixed(2);
    this.renderer.domElement.dataset.carWorldY = telemetry.car.y.toFixed(2);
    this.renderer.domElement.dataset.circuitWorldZ = this.circuit.position.z.toFixed(2);
    this.renderer.domElement.dataset.carSlip = telemetry.car.slip.toFixed(3);
    this.renderer.domElement.dataset.carWheelspin = telemetry.car.wheelspin.toFixed(3);
    this.renderer.domElement.dataset.carUndersteer = telemetry.car.understeer.toFixed(3);
    this.renderer.domElement.dataset.carLockup = telemetry.car.lockup.toFixed(3);
    this.renderer.domElement.dataset.draft = telemetry.draft.toFixed(3);
    this.renderer.domElement.dataset.dirtyAir = telemetry.dirtyAir.toFixed(3);
    this.renderer.domElement.dataset.rainIntensity = telemetry.rainIntensity.toFixed(2);
    this.renderer.domElement.dataset.roadWetness = telemetry.roadWetness.toFixed(2);
    this.renderer.domElement.dataset.launchCharge = telemetry.launchCharge.toFixed(2);
    this.renderer.domElement.dataset.launchQuality = telemetry.launchQuality.toFixed(2);
    this.renderer.domElement.dataset.weather = telemetry.weatherName;
    this.renderer.domElement.dataset.trackName = telemetry.trackName;
    this.applyAtmosphere(telemetry);
    const carX = telemetry.car.x;
    const carY = telemetry.car.y;
    const carZ = -telemetry.car.z;
    const speedRatio = Math.min(1, telemetry.speedKph / 310);
    this.car.position.set(carX, carY, carZ);
    this.car.position.y += Math.sin(performance.now() * 0.016) * speedRatio * 0.018 + telemetry.car.slip * 0.026;
    this.car.rotation.y = -telemetry.car.heading - telemetry.curve * 0.5;
    this.car.rotation.x = telemetry.car.braking * 0.035 - telemetry.car.throttle * speedRatio * 0.018;
    this.car.rotation.z = -telemetry.car.yawRate * 0.3 + telemetry.car.understeer * 0.04 - telemetry.car.lockup * 0.024 - telemetry.car.bank * 0.16;

    this.updateSpeedStreaks(carX, carY, carZ, speedRatio, telemetry.car.slip, telemetry.car.braking, telemetry.draft, telemetry.dirtyAir);
    this.updateTireSmoke(carX, carY, carZ, telemetry.car.heading, speedRatio, telemetry.car.slip, telemetry.car.wheelspin, telemetry.car.lockup);
    this.camera.fov = 44 + speedRatio * 8 + telemetry.car.braking * 2;

    const lookAhead = 8 + speedRatio * 19;
    const cameraLag = 5.8 + speedRatio * 4.4 + telemetry.car.throttle * 1.3 - telemetry.car.braking * 2.2;
    const lateralShoulder = carX * (0.48 + speedRatio * 0.16) - telemetry.car.yawRate * 2.6;
    const targetX = carX + telemetry.car.yawRate * 4.8 - telemetry.curve * 2.6;
    this.desiredCameraPosition.set(
      lateralShoulder,
      carY + 2.85 - telemetry.car.braking * 0.28 + telemetry.car.slip * 0.28 + speedRatio * 0.16,
      carZ + cameraLag
    );
    this.desiredCameraTarget.set(targetX, carY + 0.68 + telemetry.car.slip * 0.18, carZ - lookAhead);
    const positionFollow = 0.075 + speedRatio * 0.045 + telemetry.car.braking * 0.02;
    const targetFollow = 0.1 + speedRatio * 0.05;
    this.cameraPosition.lerp(this.desiredCameraPosition, positionFollow);
    this.cameraTarget.lerp(this.desiredCameraTarget, targetFollow);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateProjectionMatrix();
    this.updateRainStreaks(carX, carY, carZ, telemetry.rainIntensity, speedRatio);
    this.updateWaterSpray(carX, carY, carZ, telemetry.car.heading, telemetry.roadWetness, speedRatio, telemetry.car.slip);
    this.carScreenPosition.copy(this.car.position).project(this.camera);
    this.renderer.domElement.dataset.cameraWorldZ = this.camera.position.z.toFixed(2);
    this.renderer.domElement.dataset.carScreenX = this.carScreenPosition.x.toFixed(3);
    this.renderer.domElement.dataset.carScreenY = this.carScreenPosition.y.toFixed(3);
    this.horizon.position.z = this.camera.position.z - 15.4;

    for (const rival of telemetry.rivals) {
      const existing = this.rivals.get(rival.id);
      const gapMeters = rival.z - telemetry.car.z;
      if (gapMeters < -45 || gapMeters > 280) {
        if (existing) existing.visible = false;
        continue;
      }

      const mesh = existing ?? this.addRival(rival.id, rival.color);
      mesh.visible = true;
      mesh.position.set(rival.x, rival.y, -rival.z);
      mesh.rotation.y = -rival.heading;
      mesh.rotation.z = -rival.bank * 0.12;
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

  private async loadRaceAssets() {
    try {
      await this.addTracksideAssets();
      this.renderer.domElement.dataset.tracksideAssets = "kenney";
    } catch {
      this.renderer.domElement.dataset.tracksideAssets = "procedural-only";
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
      stand.userData.tracksidePlacement = placement;
      this.tracksideAssets.add(stand);
    });

    lights.forEach((light, index) => {
      const placement = lightPlacements[index];
      light.userData.tracksidePlacement = { ...placement, rotation: placement.lateral > 0 ? -0.4 : 0.4 };
      this.tracksideAssets.add(light);
    });

    this.positionLoadedTracksideAssets();
  }

  private positionLoadedTracksideAssets() {
    for (const object of this.tracksideAssets.children) {
      const placement = object.userData.tracksidePlacement as { distance: number; lateral: number; rotation: number } | undefined;
      if (!placement) continue;

      const track = sampleTrack(placement.distance);
      object.position.set(track.center + placement.lateral, track.elevation, -placement.distance);
      object.rotation.y = placement.rotation;
    }
  }

  private applyAtmosphere(telemetry: RaceTelemetry) {
    const horizonMaterials = this.horizon.userData.materials as
      | { sky: THREE.MeshBasicMaterial; treeline: THREE.MeshBasicMaterial }
      | undefined;
    const weatherMaterials = this.circuit.userData.weatherMaterials as
      | {
          asphalt: THREE.MeshStandardMaterial;
          runoff: THREE.MeshStandardMaterial;
          racingLine: THREE.MeshBasicMaterial;
        }
      | undefined;
    this.renderer.setClearColor(telemetry.skyColor);
    this.scene.fog = new THREE.Fog(telemetry.fogColor, 150 - telemetry.roadWetness * 35, 880 - telemetry.rainIntensity * 250);
    this.hemi.color.set(telemetry.skyColor);
    this.hemi.groundColor.set(telemetry.grassColor);
    this.hemi.intensity = 1.25 + telemetry.lightIntensity * 0.18;
    this.sun.intensity = telemetry.lightIntensity;
    horizonMaterials?.sky.color.set(telemetry.skyColor);
    horizonMaterials?.treeline.color.set(telemetry.grassColor);

    if (weatherMaterials) {
      weatherMaterials.asphalt.color.set(telemetry.roadWetness > 0.4 ? "#1f272b" : "#30363a");
      weatherMaterials.asphalt.roughness = 0.86 - telemetry.roadWetness * 0.46;
      weatherMaterials.asphalt.metalness = 0.02 + telemetry.roadWetness * 0.16;
      weatherMaterials.runoff.color.set(telemetry.roadWetness > 0.4 ? "#59645f" : getActiveTrackLayout().runoffColor);
      weatherMaterials.racingLine.opacity = 0.32 - telemetry.roadWetness * 0.11;
    }
  }

  private buildHorizon() {
    const horizon = new THREE.Group();
    const layout = getActiveTrackLayout();
    horizon.name = `${layout.id}-venue-horizon`;

    const skyMaterial = new THREE.MeshBasicMaterial({
      color: "#bfd4dc",
      fog: false,
      side: THREE.DoubleSide
    });
    const treelineMaterial = new THREE.MeshBasicMaterial({
      color: layout.treeColor,
      fog: false,
      side: THREE.DoubleSide
    });
    const reliefMaterial = new THREE.MeshBasicMaterial({
      color: layout.id === "mirage" ? "#77878d" : layout.id === "northstar" ? "#3f5a51" : "#667b58",
      fog: false,
      side: THREE.DoubleSide
    });

    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2200, 540), skyMaterial);
    sky.position.set(0, 250, -760);
    horizon.add(sky);

    const treeline = new THREE.Mesh(new THREE.PlaneGeometry(2200, 54), treelineMaterial);
    treeline.position.set(0, 22, -750);
    horizon.add(treeline);

    this.addVenueSilhouette(horizon, layout.id, reliefMaterial);
    horizon.userData.materials = { sky: skyMaterial, treeline: treelineMaterial, relief: reliefMaterial };

    return horizon;
  }

  private addVenueSilhouette(horizon: THREE.Group, layoutId: string, material: THREE.Material) {
    if (layoutId === "mirage") {
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(2200, 26), material);
      sea.name = "mirage-bay-sea-line";
      sea.position.set(0, 18, -746);
      horizon.add(sea);

      for (let index = 0; index < 18; index += 1) {
        const width = 18 + (index % 5) * 7;
        const height = 24 + ((index * 13) % 42);
        const tower = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
        tower.name = "mirage-bay-skyline";
        tower.position.set(-420 + index * 52, 28 + height * 0.5, -744);
        horizon.add(tower);
      }
      return;
    }

    const peaks = layoutId === "northstar" ? 12 : 10;
    const baseY = layoutId === "northstar" ? 18 : 16;
    const spacing = layoutId === "northstar" ? 92 : 96;
    const heightBase = layoutId === "northstar" ? 32 : 28;

    for (let index = 0; index < peaks; index += 1) {
      const width = spacing * (1.25 + (index % 3) * 0.18);
      const height = heightBase + ((index * 19) % (layoutId === "northstar" ? 28 : 22));
      const shape = new THREE.Shape();
      shape.moveTo(-width * 0.5, 0);
      shape.lineTo(-width * 0.12, height * 0.72);
      shape.lineTo(width * 0.08, height);
      shape.lineTo(width * 0.5, 0);
      shape.lineTo(-width * 0.5, 0);
      const peak = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
      peak.name = layoutId === "northstar" ? "northstar-alpine-ridge" : "aurelia-foothill-ridge";
      peak.position.set(-520 + index * spacing, baseY, -746);
      horizon.add(peak);
    }
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

  private updateSpeedStreaks(
    carX: number,
    carY: number,
    carZ: number,
    speedRatio: number,
    slip: number,
    braking: number,
    draft: number,
    dirtyAir: number
  ) {
    const material = this.speedStreaks.userData.material as THREE.MeshBasicMaterial | undefined;
    if (material) {
      material.opacity = Math.max(0, speedRatio - 0.46) * 0.34 + slip * 0.08 + braking * 0.04 + draft * 0.16 + dirtyAir * 0.08;
      material.color.set(dirtyAir > 0.2 ? "#d8e0df" : draft > 0.03 ? "#c5fff4" : braking > 0.25 ? "#ffd7c8" : "#f6fff1");
    }

    this.speedStreaks.position.z = carZ + (performance.now() * 0.035 * (0.4 + speedRatio)) % 15;
    this.speedStreaks.position.x = carX * 0.2;
    this.speedStreaks.position.y = carY;
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
    carY: number,
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
    this.tireSmoke.position.set(carX, carY, carZ);
    this.tireSmoke.rotation.y = -heading;
    const pulse = 1 + Math.sin(performance.now() * 0.018) * 0.08;
    this.tireSmoke.scale.setScalar((0.65 + speedRatio * 0.75 + smokeStrength * 0.55) * pulse);
  }

  private buildRainStreaks() {
    const group = new THREE.Group();
    group.name = "weather-rain-streaks";

    const material = new THREE.MeshBasicMaterial({
      color: "#dce7ef",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 90; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 2.8 + (index % 4) * 0.55), material);
      mesh.name = "rain-streak";
      mesh.position.set(((index * 37) % 80) - 40, 3 + ((index * 17) % 24), -18 - ((index * 23) % 86));
      mesh.rotation.z = -0.24;
      mesh.rotation.y = ((index % 5) - 2) * 0.08;
      group.add(mesh);
    }

    group.userData.material = material;
    return group;
  }

  private updateRainStreaks(carX: number, carY: number, carZ: number, rainIntensity: number, speedRatio: number) {
    const material = this.rainStreaks.userData.material as THREE.MeshBasicMaterial | undefined;
    this.rainStreaks.visible = rainIntensity > 0.02;
    if (!material) return;

    material.opacity = rainIntensity * (0.2 + speedRatio * 0.18);
    this.rainStreaks.position.set(carX * 0.18, carY + 3.2, carZ - 10 - speedRatio * 10);
    const time = performance.now() * 0.001;
    for (let index = 0; index < this.rainStreaks.children.length; index += 1) {
      const streak = this.rainStreaks.children[index];
      const phase = (time * (18 + speedRatio * 36) + index * 5.7) % 110;
      streak.position.z = -18 - phase;
      streak.position.y = 3 + ((index * 17 + phase * 0.45) % 24);
    }
  }

  private buildWaterSpray() {
    const group = new THREE.Group();
    group.name = "wet-weather-spray";
    const texture = makeSoftMistTexture();

    const material = new THREE.MeshBasicMaterial({
      color: "#dce4e2",
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });

    for (let index = 0; index < 14; index += 1) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55 + index * 0.09, 1.1 + index * 0.16), material);
      mesh.name = "water-spray-plume";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(index % 2 === 0 ? -0.85 : 0.85, 0.08, 1.2 + index * 0.48);
      group.add(mesh);
    }

    group.userData.material = material;
    group.userData.texture = texture;
    return group;
  }

  private updateWaterSpray(
    carX: number,
    carY: number,
    carZ: number,
    heading: number,
    roadWetness: number,
    speedRatio: number,
    slip: number
  ) {
    const material = this.waterSpray.userData.material as THREE.MeshBasicMaterial | undefined;
    const sprayStrength = Math.min(1, roadWetness * (speedRatio * 0.92 + slip * 0.36));
    this.waterSpray.visible = sprayStrength > 0.03;
    if (material) {
      material.opacity = sprayStrength * 0.3;
    }

    this.waterSpray.position.set(carX, carY + 0.02, carZ + 0.25);
    this.waterSpray.rotation.y = -heading;
    this.waterSpray.scale.set(0.8 + sprayStrength * 0.9, 0.8 + sprayStrength * 0.8, 0.9 + speedRatio * 1.4);
  }
}
