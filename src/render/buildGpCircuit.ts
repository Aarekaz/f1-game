import * as THREE from "three";
import { sampleTrack, trackCenterAt, trackCurveAt } from "../game/trackPath";

type DynamicPiece = {
  object: THREE.Object3D;
  ahead: number;
  lateral: number;
  curveScale: number;
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

function makeTrackStrip(
  name: string,
  material: THREE.Material,
  lateralStart: number,
  lateralEnd: number,
  y: number,
  startAhead = -170,
  endAhead = 1900,
  step = 18
) {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  let row = 0;

  for (let ahead = startAhead; ahead <= endAhead; ahead += step) {
    const sample = sampleTrack(ahead);
    const curve = sample.curve;
    const leftX = sample.center + lateralStart;
    const rightX = sample.center + lateralEnd;
    const z = -ahead;
    vertices.push(leftX, y, z, rightX, y, z);
    uvs.push(0, row, 1, row);
    if (row > 0) {
      const base = row * 2;
      indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
    }
    row += 1;

    if (Math.abs(curve) > 0.035) {
      const midAhead = ahead + step * 0.5;
      const mid = sampleTrack(midAhead);
      vertices.push(mid.center + lateralStart, y, -midAhead, mid.center + lateralEnd, y, -midAhead);
      uvs.push(0, row, 1, row);
      const base = row * 2;
      indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
      row += 1;
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  return mesh;
}

function makeRacingLine() {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  let row = 0;

  for (let ahead = -150; ahead <= 1900; ahead += 14) {
    const sample = sampleTrack(ahead);
    const nextCurve = trackCurveAt(ahead + 42);
    const racingOffset = -nextCurve * 70;
    const width = sample.brakingZone ? 0.34 : 0.22;
    const center = sample.center + Math.max(-2.8, Math.min(2.8, racingOffset));
    vertices.push(center - width, 0.041, -ahead, center + width, 0.041, -ahead);
    uvs.push(0, row, 1, row);

    if (row > 0) {
      const base = row * 2;
      indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
    }

    row += 1;
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: "#d7eb8f",
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ghosted-racing-line";
  mesh.renderOrder = 2;
  return mesh;
}

function makeBoardMaterial(label: string, background = "#f4f7ef", foreground = "#17211b") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = foreground;
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    ctx.fillStyle = foreground;
    ctx.font = label.length > 3 ? "900 54px Arial" : "900 82px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
}

function makeTracksideBoard(name: string, material: THREE.Material) {
  const board = new THREE.Group();
  board.name = name;

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.34), material);
  panel.name = `${name}-face`;
  panel.position.y = 1.65;
  board.add(panel);

  const postMaterial = new THREE.MeshStandardMaterial({ color: "#202832", roughness: 0.55, metalness: 0.18 });
  const post = makeBox(`${name}-post`, [0.12, 1.45, 0.12], [0, 0.72, 0], postMaterial);
  board.add(post);
  board.userData.disposableMaterials = [material, postMaterial];
  return board;
}

export function buildGpCircuit() {
  const circuit = new THREE.Group();
  circuit.name = "fictional-european-technical-gp-circuit";
  const dynamicPieces: DynamicPiece[] = [];

  const asphalt = new THREE.MeshStandardMaterial({ color: "#30363a", roughness: 0.72, metalness: 0.02 });
  const grass = new THREE.MeshStandardMaterial({ color: "#496f45", roughness: 0.9 });
  const runoff = new THREE.MeshStandardMaterial({ color: "#7d8e78", roughness: 0.86 });
  const gravel = new THREE.MeshStandardMaterial({ color: "#9a8a70", roughness: 0.96 });
  const kerbRed = new THREE.MeshStandardMaterial({ color: "#d62b3a", roughness: 0.54 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: "#f5f7f4", roughness: 0.5 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: "#dce3e8", roughness: 0.62, metalness: 0.08 });
  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: "#202832", roughness: 0.48, metalness: 0.25 });
  const chevronMaterial = makeBoardMaterial(">>", "#e20e3b", "#ffffff");
  const brakeMaterial = makeBoardMaterial("BRAKE", "#e20e3b", "#ffffff");
  const board150 = makeBoardMaterial("150");
  const board100 = makeBoardMaterial("100");
  const board50 = makeBoardMaterial("50");

  circuit.add(makePlane("grass-infield-and-surround", [140, 2360], [0, -0.03, -560], grass));
  const roadMesh = makeTrackStrip("continuous-asphalt-ribbon", asphalt, -6.7, 6.7, 0.022);
  const leftRunoff = makeTrackStrip("left-continuous-runoff", runoff, -15.6, -6.8, 0.006);
  const rightRunoff = makeTrackStrip("right-continuous-runoff", runoff, 6.8, 15.6, 0.006);
  const racingLine = makeRacingLine();
  circuit.add(roadMesh, leftRunoff, rightRunoff, racingLine);

  const technicalSections = [
    { name: "north-hairpin-runoff", x: -22, z: 280, w: 18, d: 120 },
    { name: "esses-runoff", x: 20, z: 720, w: 16, d: 180 },
    { name: "final-chicane-gravel", x: -20, z: 1220, w: 18, d: 150 }
  ];

  for (const section of technicalSections) {
    const marker = makePlane(
      section.name,
      [section.w, section.d],
      [section.x, 0.005, -section.z],
      section.name.includes("gravel") ? gravel : runoff
    );
    dynamicPieces.push({ object: marker, ahead: section.z, lateral: section.x, curveScale: 0.9 });
    circuit.add(marker);
  }

  for (let index = 0; index < 92; index += 1) {
    const ahead = -140 + index * 24;
    for (const side of [-1, 1]) {
      const kerb = makeBox(
        "striped-kerb",
        [0.56, 0.06, 8.8],
        [side * 6.26, 0.045, -ahead],
        index % 2 === 0 ? kerbRed : kerbWhite
      );
      dynamicPieces.push({ object: kerb, ahead, lateral: side * 6.26, curveScale: 1.15 });
      circuit.add(kerb);

      const barrier = makeBox("low-techpro-barrier", [0.34, 0.82, 14], [side * 15.1, 0.42, -ahead], barrierMaterial);
      dynamicPieces.push({ object: barrier, ahead, lateral: side * 15.1, curveScale: 1.15 });
      circuit.add(barrier);
    }
  }

  for (const ahead of [160, 520, 900, 1320]) {
    const apexMarker = makeBox("apex-reference-board", [0.12, 1.3, 2.4], [-12.2, 0.75, -ahead], bridgeMaterial);
    dynamicPieces.push({ object: apexMarker, ahead, lateral: -12.2, curveScale: 1.15 });
    circuit.add(apexMarker);
  }

  for (const brakingStart of [230, 770, 1280]) {
    const refs = [
      { label: "150", material: board150, offset: -150 },
      { label: "100", material: board100, offset: -100 },
      { label: "50", material: board50, offset: -50 },
      { label: "BRAKE", material: brakeMaterial, offset: -12 }
    ];
    for (const ref of refs) {
      const board = makeTracksideBoard(`braking-reference-${ref.label}`, ref.material);
      dynamicPieces.push({ object: board, ahead: brakingStart + ref.offset, lateral: 11.6, curveScale: 1.25 });
      circuit.add(board);
    }
  }

  for (const apex of [322, 870, 910, 1390]) {
    for (const side of [-1, 1]) {
      const chevron = makeTracksideBoard("corner-chevron", chevronMaterial);
      chevron.scale.set(0.82, 0.82, 0.82);
      dynamicPieces.push({ object: chevron, ahead: apex, lateral: side * 10.4, curveScale: 1.8 });
      circuit.add(chevron);
    }
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
    bridgeMaterial,
    chevronMaterial,
    brakeMaterial,
    board150,
    board100,
    board50
  ];
  circuit.userData.staticTrackMeshes = [roadMesh, leftRunoff, rightRunoff, racingLine];
  circuit.userData.dynamicPieces = dynamicPieces;
  updateGpCircuit(circuit, 0);
  return circuit;
}

export function updateGpCircuit(circuit: THREE.Group, distance: number) {
  const dynamicPieces = circuit.userData.dynamicPieces as DynamicPiece[] | undefined;
  const currentCenter = trackCenterAt(distance);
  const staticTrackMeshes = circuit.userData.staticTrackMeshes as THREE.Object3D[] | undefined;
  if (staticTrackMeshes) {
    for (const mesh of staticTrackMeshes) {
      mesh.position.x = -currentCenter;
      mesh.position.z = distance;
    }
  }

  if (!dynamicPieces) return;

  for (const piece of dynamicPieces) {
    const pieceDistance = distance + piece.ahead;
    const localCenter = trackCenterAt(pieceDistance) - currentCenter;
    const curve = trackCurveAt(pieceDistance);
    piece.object.position.x = localCenter + piece.lateral;
    piece.object.position.z = -piece.ahead;
    piece.object.rotation.y = -curve * piece.curveScale;
  }
}
