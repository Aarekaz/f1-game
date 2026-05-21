import * as THREE from "three";

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

export function buildFormulaCarProxy(color = "#e72436") {
  const car = new THREE.Group();
  car.name = "formula-car-proxy";

  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.18 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: "#14181d", roughness: 0.56, metalness: 0.18 });
  const cockpitMaterial = new THREE.MeshStandardMaterial({ color: "#080b0f", roughness: 0.32, metalness: 0.38 });
  const tireMaterial = new THREE.MeshStandardMaterial({ color: "#050607", roughness: 0.86 });
  const wheelRimMaterial = new THREE.MeshStandardMaterial({ color: "#29313a", roughness: 0.5, metalness: 0.35 });

  car.add(makeBox("body", [1.14, 0.34, 2.78], [0, 0.34, 0], bodyMaterial));
  car.add(makeBox("sidepod-left", [0.42, 0.24, 1.24], [-0.64, 0.29, 0.12], bodyMaterial));
  car.add(makeBox("sidepod-right", [0.42, 0.24, 1.24], [0.64, 0.29, 0.12], bodyMaterial));
  car.add(makeBox("nose", [0.42, 0.2, 1.48], [0, 0.32, -1.86], bodyMaterial));
  car.add(makeBox("cockpit", [0.58, 0.34, 0.58], [0, 0.62, -0.28], cockpitMaterial));
  car.add(makeBox("halo", [0.72, 0.08, 0.42], [0, 0.88, -0.42], trimMaterial));
  car.add(makeBox("front-wing", [2.48, 0.08, 0.36], [0, 0.18, -2.72], trimMaterial));
  car.add(makeBox("front-wing-flap", [2.12, 0.08, 0.16], [0, 0.3, -2.52], trimMaterial));
  car.add(makeBox("rear-wing", [2.06, 0.38, 0.14], [0, 0.78, 1.4], trimMaterial));
  car.add(makeBox("rear-wing-support", [0.16, 0.52, 0.18], [0, 0.5, 1.32], trimMaterial));

  for (const x of [-0.88, 0.88]) {
    for (const z of [-1.46, 1.02]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.28, 24), tireMaterial);
      tire.name = z < 0 ? "front-wheel" : "rear-wheel";
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.22, z);
      tire.castShadow = true;
      tire.receiveShadow = true;
      car.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 18), wheelRimMaterial);
      rim.name = z < 0 ? "front-wheel-rim" : "rear-wheel-rim";
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(tire.position);
      rim.castShadow = true;
      car.add(rim);
    }
  }

  car.userData.disposableMaterials = [bodyMaterial, trimMaterial, cockpitMaterial, tireMaterial, wheelRimMaterial];
  return car;
}
