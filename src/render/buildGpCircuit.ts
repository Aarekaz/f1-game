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
  mesh.receiveShadow = true;
  return mesh;
}

function makePlane(
  name: string,
  size: [number, number, number?, number?],
  position: [number, number, number],
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildGpCircuit() {
  const circuit = new THREE.Group();
  circuit.name = "fictional-european-technical-gp-circuit";

  const asphalt = new THREE.MeshStandardMaterial({ color: "#30363a", roughness: 0.72, metalness: 0.02 });
  const grass = new THREE.MeshStandardMaterial({ color: "#496f45", roughness: 0.9 });
  const runoff = new THREE.MeshStandardMaterial({ color: "#7d8e78", roughness: 0.86 });
  const gravel = new THREE.MeshStandardMaterial({ color: "#9a8a70", roughness: 0.96 });
  const kerbRed = new THREE.MeshStandardMaterial({ color: "#d62b3a", roughness: 0.54 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: "#f5f7f4", roughness: 0.5 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: "#dce3e8", roughness: 0.62, metalness: 0.08 });
  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: "#202832", roughness: 0.48, metalness: 0.25 });

  circuit.add(makePlane("grass-infield-and-surround", [92, 2360], [0, -0.02, 600], grass));
  circuit.add(makePlane("main-road", [12, 2240, 3, 64], [0, 0.01, 600], asphalt));

  for (const x of [-17, 17]) {
    circuit.add(makePlane("runoff-lane", [10, 2160], [x, 0, 620], runoff));
  }

  const technicalSections = [
    { name: "north-hairpin-runoff", x: -22, z: 280, w: 18, d: 120 },
    { name: "esses-runoff", x: 20, z: 720, w: 16, d: 180 },
    { name: "final-chicane-gravel", x: -20, z: 1220, w: 18, d: 150 }
  ];

  for (const section of technicalSections) {
    circuit.add(
      makePlane(
        section.name,
        [section.w, section.d],
        [section.x, 0.005, section.z],
        section.name.includes("gravel") ? gravel : runoff
      )
    );
  }

  for (let index = 0; index < 92; index += 1) {
    const z = -500 + index * 26;
    const bend = Math.sin((z + 180) / 170) * 1.4 + Math.sin(z / 420) * 0.9;
    for (const side of [-1, 1]) {
      const kerb = makeBox(
        "striped-kerb",
        [0.56, 0.06, 8.8],
        [bend + side * 6.26, 0.045, z],
        index % 2 === 0 ? kerbRed : kerbWhite
      );
      kerb.rotation.y = Math.sin(z / 230) * 0.05;
      circuit.add(kerb);

      const barrier = makeBox("low-techpro-barrier", [0.34, 0.82, 14], [bend + side * 10.8, 0.42, z], barrierMaterial);
      barrier.rotation.y = Math.sin(z / 230) * 0.05;
      circuit.add(barrier);
    }
  }

  for (const z of [160, 520, 900, 1320]) {
    const apexMarker = makeBox("apex-reference-board", [0.12, 1.3, 2.4], [-12.2, 0.75, z], bridgeMaterial);
    circuit.add(apexMarker);
  }

  const timingBridge = makeBox("timing-bridge-crossbar", [18.4, 0.72, 0.5], [0, 5.2, -38], bridgeMaterial);
  timingBridge.castShadow = true;
  circuit.add(timingBridge);
  circuit.add(makeBox("timing-bridge-left-upright", [0.5, 5.2, 0.5], [-8.9, 2.6, -38], bridgeMaterial));
  circuit.add(makeBox("timing-bridge-right-upright", [0.5, 5.2, 0.5], [8.9, 2.6, -38], bridgeMaterial));
  circuit.add(makeBox("start-line", [12.2, 0.025, 0.42], [0, 0.055, -18], kerbWhite));

  circuit.userData.disposableMaterials = [
    asphalt,
    grass,
    runoff,
    gravel,
    kerbRed,
    kerbWhite,
    barrierMaterial,
    bridgeMaterial
  ];
  return circuit;
}
