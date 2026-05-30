import * as THREE from "three";

type MaterialSet = {
  body: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  livery: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  cockpit: THREE.MeshStandardMaterial;
  visor: THREE.MeshStandardMaterial;
  helmet: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  tireSidewall: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  brake: THREE.MeshStandardMaterial;
  brakeGlow: THREE.MeshStandardMaterial;
  wheelBlur: THREE.MeshBasicMaterial;
  sensor: THREE.MeshStandardMaterial;
  rainLight: THREE.MeshStandardMaterial;
  rainLightGlow: THREE.MeshBasicMaterial;
  ersGlow: THREE.MeshBasicMaterial;
};

function makeBox(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeEllipsoid(
  name: string,
  scale: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  widthSegments = 24,
  heightSegments = 12
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, widthSegments, heightSegments), material);
  mesh.name = name;
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCylinder(
  name: string,
  radius: number,
  depth: number,
  position: [number, number, number],
  material: THREE.Material,
  radialSegments = 24
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, radialSegments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeWedge(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  taper = 0.55
) {
  const geometry = new THREE.BoxGeometry(...size);
  const halfX = size[0] / 2;
  const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const y = positionAttribute.getY(index);
    if (y > 0) {
      positionAttribute.setX(index, positionAttribute.getX(index) * taper);
    }
  }

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.baseHalfWidth = halfX;
  return mesh;
}

function makeWing(
  name: string,
  width: number,
  depth: number,
  position: [number, number, number],
  material: THREE.Material
) {
  const group = new THREE.Group();
  group.name = name;
  group.add(makeBox(`${name}-main-plane`, [width, 0.055, depth], [0, 0, 0], material));
  const lower = makeBox(`${name}-lower-plane`, [width * 0.94, 0.04, depth * 0.36], [0, -0.11, -depth * 0.18], material);
  lower.rotation.x = 0.08;
  group.add(lower);
  const upper = makeBox(`${name}-upper-plane`, [width * 0.86, 0.045, depth * 0.42], [0, 0.14, depth * 0.08], material);
  upper.rotation.x = -0.12;
  group.add(upper);
  const slotGap = makeBox(`${name}-slot-gap-shadow`, [width * 0.82, 0.028, depth * 0.08], [0, 0.055, -depth * 0.08], material);
  slotGap.rotation.x = -0.08;
  group.add(slotGap);
  const gurney = makeBox(`${name}-gurney-lip`, [width * 0.78, 0.08, 0.04], [0, 0.22, depth * 0.31], material);
  gurney.rotation.x = -0.18;
  group.add(gurney);

  for (const side of [-1, 1]) {
    const endplate = makeBox(`${name}-endplate`, [0.08, 0.42, depth * 1.15], [side * width * 0.52, 0.11, 0], material);
    endplate.rotation.z = side * 0.06;
    group.add(endplate);
    const divePlane = makeBox(`${name}-dive-plane`, [0.045, 0.045, depth * 0.62], [side * width * 0.48, 0.25, -depth * 0.08], material);
    divePlane.rotation.z = side * 0.28;
    divePlane.rotation.x = -0.22;
    group.add(divePlane);
    const cascade = makeBox(`${name}-cascade-winglet`, [0.05, 0.035, depth * 0.5], [side * width * 0.37, 0.28, depth * 0.02], material);
    cascade.rotation.z = side * 0.24;
    cascade.rotation.x = -0.16;
    group.add(cascade);
  }

  group.position.set(...position);
  return group;
}

function makeSuspensionArm(
  name: string,
  from: THREE.Vector3,
  to: THREE.Vector3,
  material: THREE.Material
) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length, 8), material);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  return mesh;
}

function makeWheel(name: string, x: number, z: number, materials: MaterialSet) {
  const wheel = new THREE.Group();
  wheel.name = name;
  wheel.position.set(x, 0.24, z);

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.34, 32), materials.tire);
  tire.name = `${name}-tire`;
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);

  for (const side of [-1, 1]) {
    const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.015, 8, 36), materials.tireSidewall);
    sidewall.name = `${name}-sidewall-ring`;
    sidewall.position.x = side * 0.18;
    sidewall.rotation.y = Math.PI / 2;
    wheel.add(sidewall);

    for (let marker = 0; marker < 3; marker += 1) {
      const label = makeBox(
        `${name}-sidewall-letter-block`,
        [0.014, 0.032, 0.15],
        [side * 0.197, 0.12 - marker * 0.12, marker === 1 ? -0.19 : 0.19],
        materials.tireSidewall
      );
      label.rotation.x = marker * 0.55;
      wheel.add(label);
    }
  }

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 18), materials.rim);
  rim.name = `${name}-rim`;
  rim.rotation.z = Math.PI / 2;
  rim.castShadow = true;
  wheel.add(rim);

  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.37, 18), materials.brake);
  brake.name = `${name}-brake-disc`;
  brake.rotation.z = Math.PI / 2;
  wheel.add(brake);

  const wheelNut = makeCylinder(`${name}-wheel-nut`, 0.055, 0.405, [0, 0, 0], materials.accent, 12);
  wheelNut.rotation.z = Math.PI / 2;
  wheel.add(wheelNut);

  const blur = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 8, 36), materials.wheelBlur);
  blur.name = `${name}-wheel-blur`;
  blur.rotation.y = Math.PI / 2;
  blur.visible = false;
  wheel.add(blur);

  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.382, 18), materials.brakeGlow);
  glow.name = `${name}-brake-glow`;
  glow.rotation.z = Math.PI / 2;
  glow.visible = false;
  wheel.add(glow);

  for (let index = 0; index < 6; index += 1) {
    const spoke = makeBox(`${name}-spoke`, [0.035, 0.035, 0.28], [0, 0, 0], materials.rim);
    spoke.rotation.x = (index / 6) * Math.PI;
    wheel.add(spoke);
  }

  const duct = makeBox(`${name}-brake-duct`, [0.2, 0.11, 0.16], [0, 0.03, -0.24], materials.carbon);
  duct.rotation.x = -0.1;
  wheel.add(duct);

  return wheel;
}

export function buildFormulaCarProxy(color = "#e72436") {
  const car = new THREE.Group();
  car.name = "apex-formula-car";

  const materials: MaterialSet = {
    body: new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.22 }),
    accent: new THREE.MeshStandardMaterial({ color: "#f7f7f2", roughness: 0.38, metalness: 0.12 }),
    livery: new THREE.MeshStandardMaterial({ color: "#101419", roughness: 0.28, metalness: 0.22 }),
    trim: new THREE.MeshStandardMaterial({ color: "#101419", roughness: 0.46, metalness: 0.26 }),
    carbon: new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 0.7, metalness: 0.18 }),
    cockpit: new THREE.MeshStandardMaterial({ color: "#05070d", roughness: 0.26, metalness: 0.46 }),
    visor: new THREE.MeshStandardMaterial({ color: "#0f2631", roughness: 0.16, metalness: 0.66 }),
    helmet: new THREE.MeshStandardMaterial({ color: "#f7f7f2", roughness: 0.32, metalness: 0.1 }),
    tire: new THREE.MeshStandardMaterial({ color: "#030405", roughness: 0.9 }),
    tireSidewall: new THREE.MeshStandardMaterial({ color: "#d7eb8f", roughness: 0.72, metalness: 0.05 }),
    rim: new THREE.MeshStandardMaterial({ color: "#303944", roughness: 0.45, metalness: 0.45 }),
    brake: new THREE.MeshStandardMaterial({ color: "#9b322d", roughness: 0.44, metalness: 0.28 }),
    brakeGlow: new THREE.MeshStandardMaterial({
      color: "#ff6b35",
      emissive: "#ff2a12",
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.66,
      roughness: 0.28,
      metalness: 0.18
    }),
    wheelBlur: new THREE.MeshBasicMaterial({
      color: "#d9e1df",
      transparent: true,
      opacity: 0,
      depthWrite: false
    }),
    sensor: new THREE.MeshStandardMaterial({ color: "#28c7ff", emissive: "#0b4760", emissiveIntensity: 0.55, roughness: 0.34, metalness: 0.18 }),
    rainLight: new THREE.MeshStandardMaterial({
      color: "#ff2648",
      emissive: "#ff1436",
      emissiveIntensity: 1.8,
      roughness: 0.18,
      metalness: 0.08
    }),
    rainLightGlow: new THREE.MeshBasicMaterial({
      color: "#ff1238",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    ersGlow: new THREE.MeshBasicMaterial({
      color: "#69f7ff",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  };

  car.add(makeWedge("survival-cell", [1.02, 0.42, 2.08], [0, 0.38, -0.05], materials.body, 0.68));
  car.add(makeEllipsoid("sculpted-monocoque-shoulder", [0.56, 0.18, 0.98], [0, 0.58, -0.14], materials.body));
  car.add(makeEllipsoid("upper-chassis-coke-bottle", [0.42, 0.13, 0.68], [0, 0.51, 0.48], materials.body, 22, 10));
  car.add(makeWedge("engine-cover", [0.68, 0.62, 1.24], [0, 0.58, 0.72], materials.body, 0.44));
  car.add(makeEllipsoid("airbox-intake", [0.22, 0.18, 0.2], [0, 0.98, 0.2], materials.trim, 18, 8));
  car.add(makeWedge("shark-fin", [0.16, 0.76, 0.98], [0, 1.0, 0.88], materials.body, 0.25));
  car.add(makeWedge("nose-cone", [0.38, 0.2, 1.76], [0, 0.3, -1.88], materials.body, 0.38));
  car.add(makeWedge("needle-nose-tip", [0.24, 0.13, 0.78], [0, 0.25, -2.54], materials.body, 0.24));
  car.add(makeBox("nose-accent-stripe", [0.14, 0.035, 2.52], [0, 0.54, -0.92], materials.accent));
  car.add(makeBox("nose-number-panel", [0.34, 0.032, 0.42], [0, 0.49, -1.65], materials.livery));
  car.add(makeBox("livery-spine-stripe", [0.22, 0.04, 1.9], [0, 0.77, 0.36], materials.livery));
  car.add(makeBox("floor", [1.98, 0.06, 3.18], [0, 0.15, -0.08], materials.carbon));
  car.add(makeBox("floor-edge-left", [0.05, 0.08, 2.38], [-1.02, 0.21, -0.05], materials.carbon));
  car.add(makeBox("floor-edge-right", [0.05, 0.08, 2.38], [1.02, 0.21, -0.05], materials.carbon));
  car.add(makeBox("diffuser", [1.32, 0.18, 0.46], [0, 0.24, 1.62], materials.carbon));
  for (const side of [-1, 0, 1]) {
    const strake = makeBox(`diffuser-strake-${side + 1}`, [0.045, 0.22, 0.66], [side * 0.36, 0.29, 1.68], materials.carbon);
    strake.rotation.x = 0.16;
    car.add(strake);
  }

  for (const side of [-1, 1]) {
    car.add(makeWedge(`sidepod-${side < 0 ? "left" : "right"}`, [0.48, 0.34, 1.18], [side * 0.72, 0.34, 0.12], materials.body, 0.5));
    car.add(makeBox(`sidepod-inlet-${side < 0 ? "left" : "right"}`, [0.08, 0.22, 0.36], [side * 0.49, 0.46, -0.32], materials.trim));
    car.add(makeWedge(`sidepod-undercut-${side < 0 ? "left" : "right"}`, [0.22, 0.2, 0.84], [side * 0.62, 0.25, 0.28], materials.carbon, 0.38));
    car.add(makeBox(`sidepod-livery-slash-${side < 0 ? "left" : "right"}`, [0.05, 0.19, 0.82], [side * 0.96, 0.45, 0.1], materials.accent));
    car.add(makeBox(`bargeboard-${side < 0 ? "left" : "right"}`, [0.06, 0.38, 0.64], [side * 1.0, 0.36, -0.48], materials.carbon));
    car.add(makeBox(`turning-vane-${side < 0 ? "left" : "right"}`, [0.045, 0.34, 0.52], [side * 0.84, 0.34, -0.82], materials.carbon));
    car.add(makeBox(`mirror-${side < 0 ? "left" : "right"}`, [0.18, 0.08, 0.08], [side * 0.66, 0.79, -0.55], materials.trim));
    car.add(makeBox(`floor-vortex-rail-${side < 0 ? "left" : "right"}`, [0.045, 0.12, 1.42], [side * 1.16, 0.22, 0.2], materials.carbon));
    for (let gill = 0; gill < 3; gill += 1) {
      const coolingGill = makeBox(
        `cooling-gill-${side < 0 ? "left" : "right"}-${gill + 1}`,
        [0.045, 0.028, 0.28],
        [side * 0.79, 0.64 - gill * 0.04, 0.38 + gill * 0.16],
        materials.trim
      );
      coolingGill.rotation.z = side * 0.18;
      coolingGill.rotation.x = -0.14;
      car.add(coolingGill);
    }
  }

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.54), materials.cockpit);
  cockpit.name = "low-cockpit-canopy";
  cockpit.scale.set(0.88, 0.5, 1.15);
  cockpit.position.set(0, 0.76, -0.28);
  cockpit.castShadow = true;
  cockpit.receiveShadow = true;
  car.add(cockpit);

  const helmet = makeEllipsoid("driver-helmet", [0.16, 0.17, 0.15], [0, 0.82, -0.28], materials.helmet, 18, 10);
  car.add(helmet);
  const visor = makeBox("driver-visor", [0.2, 0.045, 0.07], [0, 0.84, -0.43], materials.visor);
  visor.rotation.x = -0.12;
  car.add(visor);

  const halo = new THREE.Group();
  halo.name = "fictional-halo";
  halo.add(makeBox("halo-front-post", [0.08, 0.48, 0.08], [0, 0.18, -0.3], materials.trim));
  halo.add(makeBox("halo-left-rail", [0.08, 0.08, 0.72], [-0.28, 0.43, -0.16], materials.trim));
  halo.add(makeBox("halo-right-rail", [0.08, 0.08, 0.72], [0.28, 0.43, -0.16], materials.trim));
  halo.add(makeBox("halo-center-crown", [0.44, 0.06, 0.08], [0, 0.46, -0.48], materials.trim));
  halo.position.set(0, 0.73, -0.34);
  car.add(halo);
  car.add(makeBox("race-control-t-camera", [0.16, 0.12, 0.12], [0, 1.2, -0.06], materials.sensor));

  car.add(makeWing("front-wing", 2.7, 0.46, [0, 0.16, -2.78], materials.carbon));
  car.add(makeWing("rear-wing", 2.1, 0.42, [0, 0.78, 1.62], materials.carbon));
  car.add(makeBox("beam-wing", [1.72, 0.055, 0.22], [0, 0.44, 1.72], materials.carbon));
  car.add(makeBox("rear-wing-pylon", [0.16, 0.56, 0.16], [0, 0.54, 1.36], materials.carbon));
  car.add(makeBox("rear-crash-structure", [0.36, 0.2, 0.52], [0, 0.35, 1.94], materials.carbon));
  car.add(makeBox("rear-rain-light", [0.16, 0.08, 0.045], [0, 0.48, 2.21], materials.rainLight));
  const rainLightGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.38), materials.rainLightGlow);
  rainLightGlow.name = "rear-rain-light-glow";
  rainLightGlow.position.set(0, 0.48, 2.245);
  rainLightGlow.visible = false;
  rainLightGlow.renderOrder = 6;
  car.add(rainLightGlow);
  const ersDeployGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.3), materials.ersGlow);
  ersDeployGlow.name = "ers-deploy-glow";
  ersDeployGlow.position.set(0, 0.28, 2.1);
  ersDeployGlow.visible = false;
  ersDeployGlow.renderOrder = 5;
  car.add(ersDeployGlow);
  for (const side of [-1, 1]) {
    const ersFlow = makeBox(`ers-flow-${side < 0 ? "left" : "right"}`, [0.045, 0.035, 0.92], [side * 0.86, 0.24, 0.66], materials.ersGlow);
    ersFlow.visible = false;
    car.add(ersFlow);
  }

  for (const x of [-0.96, 0.96]) {
    car.add(makeWheel(x < 0 ? "front-left-wheel" : "front-right-wheel", x, -1.5, materials));
    car.add(makeWheel(x < 0 ? "rear-left-wheel" : "rear-right-wheel", x, 1.02, materials));
  }

  for (const side of [-1, 1]) {
    car.add(makeSuspensionArm("front-upper-wishbone", new THREE.Vector3(side * 0.36, 0.43, -1.28), new THREE.Vector3(side * 0.92, 0.42, -1.5), materials.carbon));
    car.add(makeSuspensionArm("front-lower-wishbone", new THREE.Vector3(side * 0.32, 0.23, -1.18), new THREE.Vector3(side * 0.92, 0.28, -1.5), materials.carbon));
    car.add(makeSuspensionArm("rear-upper-wishbone", new THREE.Vector3(side * 0.42, 0.43, 0.86), new THREE.Vector3(side * 0.92, 0.42, 1.02), materials.carbon));
    car.add(makeSuspensionArm("rear-lower-wishbone", new THREE.Vector3(side * 0.42, 0.23, 0.74), new THREE.Vector3(side * 0.92, 0.28, 1.02), materials.carbon));
  }

  car.scale.setScalar(1.14);
  car.userData.disposableMaterials = Object.values(materials);
  return car;
}
