import * as THREE from "three";

type MaterialSet = {
  body: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  cockpit: THREE.MeshStandardMaterial;
  tire: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  brake: THREE.MeshStandardMaterial;
  brakeGlow: THREE.MeshStandardMaterial;
  wheelBlur: THREE.MeshBasicMaterial;
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
  const upper = makeBox(`${name}-upper-plane`, [width * 0.86, 0.045, depth * 0.42], [0, 0.14, depth * 0.08], material);
  upper.rotation.x = -0.12;
  group.add(upper);

  for (const side of [-1, 1]) {
    const endplate = makeBox(`${name}-endplate`, [0.08, 0.42, depth * 1.15], [side * width * 0.52, 0.11, 0], material);
    endplate.rotation.z = side * 0.06;
    group.add(endplate);
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

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 18), materials.rim);
  rim.name = `${name}-rim`;
  rim.rotation.z = Math.PI / 2;
  rim.castShadow = true;
  wheel.add(rim);

  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.37, 18), materials.brake);
  brake.name = `${name}-brake-disc`;
  brake.rotation.z = Math.PI / 2;
  wheel.add(brake);

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

  return wheel;
}

export function buildFormulaCarProxy(color = "#e72436") {
  const car = new THREE.Group();
  car.name = "apex-formula-car";

  const materials: MaterialSet = {
    body: new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.22 }),
    accent: new THREE.MeshStandardMaterial({ color: "#f7f7f2", roughness: 0.38, metalness: 0.12 }),
    trim: new THREE.MeshStandardMaterial({ color: "#101419", roughness: 0.46, metalness: 0.26 }),
    carbon: new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 0.7, metalness: 0.18 }),
    cockpit: new THREE.MeshStandardMaterial({ color: "#05070d", roughness: 0.26, metalness: 0.46 }),
    tire: new THREE.MeshStandardMaterial({ color: "#030405", roughness: 0.9 }),
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
    })
  };

  car.add(makeWedge("survival-cell", [1.02, 0.42, 2.08], [0, 0.38, -0.05], materials.body, 0.68));
  car.add(makeWedge("engine-cover", [0.68, 0.62, 1.24], [0, 0.58, 0.72], materials.body, 0.44));
  car.add(makeWedge("shark-fin", [0.16, 0.76, 0.98], [0, 1.0, 0.88], materials.body, 0.25));
  car.add(makeWedge("nose-cone", [0.38, 0.2, 1.76], [0, 0.3, -1.88], materials.body, 0.38));
  car.add(makeBox("nose-accent-stripe", [0.14, 0.035, 2.52], [0, 0.54, -0.92], materials.accent));
  car.add(makeBox("floor", [1.82, 0.06, 2.95], [0, 0.15, -0.1], materials.carbon));
  car.add(makeBox("diffuser", [1.32, 0.18, 0.46], [0, 0.24, 1.62], materials.carbon));

  for (const side of [-1, 1]) {
    car.add(makeWedge(`sidepod-${side < 0 ? "left" : "right"}`, [0.48, 0.34, 1.18], [side * 0.72, 0.34, 0.12], materials.body, 0.5));
    car.add(makeBox(`bargeboard-${side < 0 ? "left" : "right"}`, [0.06, 0.38, 0.64], [side * 1.0, 0.36, -0.48], materials.carbon));
    car.add(makeBox(`mirror-${side < 0 ? "left" : "right"}`, [0.18, 0.08, 0.08], [side * 0.66, 0.79, -0.55], materials.trim));
  }

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.54), materials.cockpit);
  cockpit.name = "low-cockpit-canopy";
  cockpit.scale.set(0.88, 0.5, 1.15);
  cockpit.position.set(0, 0.76, -0.28);
  cockpit.castShadow = true;
  cockpit.receiveShadow = true;
  car.add(cockpit);

  const halo = new THREE.Group();
  halo.name = "fictional-halo";
  halo.add(makeBox("halo-front-post", [0.08, 0.48, 0.08], [0, 0.18, -0.3], materials.trim));
  halo.add(makeBox("halo-left-rail", [0.08, 0.08, 0.72], [-0.28, 0.43, -0.16], materials.trim));
  halo.add(makeBox("halo-right-rail", [0.08, 0.08, 0.72], [0.28, 0.43, -0.16], materials.trim));
  halo.position.set(0, 0.73, -0.34);
  car.add(halo);

  car.add(makeWing("front-wing", 2.7, 0.46, [0, 0.16, -2.78], materials.carbon));
  car.add(makeWing("rear-wing", 2.1, 0.42, [0, 0.78, 1.62], materials.carbon));
  car.add(makeBox("rear-wing-pylon", [0.16, 0.56, 0.16], [0, 0.54, 1.36], materials.carbon));

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
