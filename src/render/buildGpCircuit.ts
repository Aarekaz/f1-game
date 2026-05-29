import * as THREE from "three";
import {
  getActiveTrackLayout,
  sampleTrack,
  terrainHeightAt,
  trackCurveAt,
  trackElevationAt,
  trackWorldHeadingAt,
  trackWorldPointAt,
  TRACK_LOOP_LENGTH,
  type TrackSample
} from "../game/trackPath";

type DynamicPiece = {
  object: THREE.Object3D;
  ahead: number;
  lateral: number;
  curveScale: number;
  baseY?: number;
};

const RENDERED_TRACK_LENGTH = TRACK_LOOP_LENGTH;

function surfaceY(sample: TrackSample, lateral: number, offset = 0) {
  const normalized = Math.max(-1.35, Math.min(1.35, lateral / Math.max(1, sample.halfWidth)));
  return sample.elevation + sample.bank * normalized + offset;
}

function worldPosition(distance: number, lateral: number, offset = 0): [number, number, number] {
  const sample = sampleTrack(distance);
  const point = trackWorldPointAt(distance, lateral);
  return [point.x, surfaceY(sample, lateral, offset), point.z];
}

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
  endAhead = RENDERED_TRACK_LENGTH,
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
    const left = trackWorldPointAt(ahead, lateralStart);
    const right = trackWorldPointAt(ahead, lateralEnd);
    const leftY = surfaceY(sample, lateralStart, y);
    const rightY = surfaceY(sample, lateralEnd, y);
    vertices.push(left.x, leftY, left.z, right.x, rightY, right.z);
    uvs.push(0, row, 1, row);
    if (row > 0) {
      const base = row * 2;
      indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
    }
    row += 1;

    if (Math.abs(curve) > 0.035) {
      const midAhead = ahead + step * 0.5;
      const mid = sampleTrack(midAhead);
      const midLeft = trackWorldPointAt(midAhead, lateralStart);
      const midRight = trackWorldPointAt(midAhead, lateralEnd);
      vertices.push(
        midLeft.x,
        surfaceY(mid, lateralStart, y),
        midLeft.z,
        midRight.x,
        surfaceY(mid, lateralEnd, y),
        midRight.z
      );
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

  for (let ahead = -150; ahead <= RENDERED_TRACK_LENGTH; ahead += 14) {
    const sample = sampleTrack(ahead);
    const racingOffset = sample.racingLineOffset;
    const width = sample.brakingZone ? 0.34 : 0.22;
    const centerOffset = Math.max(-2.8, Math.min(2.8, racingOffset));
    const left = trackWorldPointAt(ahead, centerOffset - width);
    const right = trackWorldPointAt(ahead, centerOffset + width);
    vertices.push(
      left.x,
      surfaceY(sample, centerOffset - width, 0.041),
      left.z,
      right.x,
      surfaceY(sample, centerOffset + width, 0.041),
      right.z
    );
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

function makeTree(name: string, height: number, color: string) {
  const tree = new THREE.Group();
  tree.name = name;

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#5a3b25", roughness: 0.88 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, height * 0.36, 8), trunkMaterial);
  trunk.position.y = height * 0.18;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown = new THREE.Mesh(new THREE.ConeGeometry(height * 0.34, height * 0.86, 9), leafMaterial);
  crown.position.y = height * 0.7;
  crown.castShadow = true;
  tree.add(crown);
  tree.userData.disposableMaterials = [trunkMaterial, leafMaterial];
  return tree;
}

function makeSkidMark(distance: number, lateral: number, length: number, material: THREE.Material) {
  const mark = makePlane(
    "rubbered-braking-mark",
    [0.2, length],
    worldPosition(distance, lateral, 0.052),
    material
  );
  mark.rotation.y = trackWorldHeadingAt(distance);
  return mark;
}

function makeAsphaltMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    ctx.fillStyle = "#30363a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 900; index += 1) {
      const shade = 42 + Math.floor(random() * 36);
      ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 8}, ${0.12 + random() * 0.16})`;
      ctx.fillRect(random() * canvas.width, random() * canvas.height, 1 + random() * 2.5, 1);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.055)";
    for (let y = 24; y < canvas.height; y += 48) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 80);
  texture.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshStandardMaterial({
    color: "#30363a",
    map: texture,
    roughness: 0.86,
    metalness: 0.02
  });
}

export function buildGpCircuit() {
  const circuit = new THREE.Group();
  const layout = getActiveTrackLayout();
  circuit.name = `${layout.id}-fictional-gp-circuit`;
  const dynamicPieces: DynamicPiece[] = [];

  const asphalt = makeAsphaltMaterial();
  const grass = new THREE.MeshStandardMaterial({ color: layout.terrainColor, roughness: 0.9 });
  const runoff = new THREE.MeshStandardMaterial({ color: layout.runoffColor, roughness: 0.86 });
  const gravel = new THREE.MeshStandardMaterial({ color: "#9a8a70", roughness: 0.96 });
  const kerbRed = new THREE.MeshStandardMaterial({ color: "#d62b3a", roughness: 0.54 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: "#f5f7f4", roughness: 0.5 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: "#dce3e8", roughness: 0.62, metalness: 0.08 });
  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: "#202832", roughness: 0.48, metalness: 0.25 });
  const skidMaterial = new THREE.MeshBasicMaterial({ color: "#121514", transparent: true, opacity: 0.22, depthWrite: false });
  const chevronMaterial = makeBoardMaterial(">>", "#e20e3b", "#ffffff");
  const brakeMaterial = makeBoardMaterial("BRAKE", "#e20e3b", "#ffffff");
  const board150 = makeBoardMaterial("150");
  const board100 = makeBoardMaterial("100");
  const board50 = makeBoardMaterial("50");

  circuit.add(makeTrackStrip("terrain-following-grass", grass, -88, 88, -0.18, 0, RENDERED_TRACK_LENGTH, 26));
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

  for (let lap = 0; lap < 1; lap += 1) {
    const lapStart = lap * TRACK_LOOP_LENGTH;
    for (const section of technicalSections) {
      const marker = makePlane(
        section.name,
        [section.w, section.d],
        [section.x, 0.005, -(lapStart + section.z)],
        section.name.includes("gravel") ? gravel : runoff
      );
      dynamicPieces.push({ object: marker, ahead: lapStart + section.z, lateral: section.x, curveScale: 0.9 });
      circuit.add(marker);
    }
  }

  for (let lap = 0; lap < 1; lap += 1) {
    const lapStart = lap * TRACK_LOOP_LENGTH;
    for (const brakingStart of [230, 770, 1280]) {
      for (const lateral of [-1.7, 0.2, 1.6]) {
        circuit.add(makeSkidMark(lapStart + brakingStart - 42, lateral, 36, skidMaterial));
      }
    }
  }

  for (let index = 0; index < 120; index += 1) {
    const distance = 80 + index * 58;
    const side = index % 2 === 0 ? -1 : 1;
    const stagger = ((index * 37) % 19) - 9;
    const lateral = side * (26 + (index % 5) * 2.8) + stagger * 0.2;
    const tree = makeTree("trackside-cypress", 3.6 + (index % 4) * 0.55, index % 3 === 0 ? layout.treeColor : layout.terrainColor);
    const point = trackWorldPointAt(distance, lateral);
    tree.position.set(point.x, terrainHeightAt(distance, lateral), point.z);
    tree.rotation.y = trackWorldHeadingAt(distance) + (index % 7) * 0.4;
    circuit.add(tree);
  }

  const tracksideCount = Math.ceil((RENDERED_TRACK_LENGTH + 280) / 24);
  for (let index = 0; index < tracksideCount; index += 1) {
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

  for (let lap = 0; lap < 1; lap += 1) {
    const lapStart = lap * TRACK_LOOP_LENGTH;
    for (const ahead of [160, 520, 900, 1320]) {
      const apexMarker = makeBox("apex-reference-board", [0.12, 1.3, 2.4], [-12.2, 0.75, -(lapStart + ahead)], bridgeMaterial);
      dynamicPieces.push({ object: apexMarker, ahead: lapStart + ahead, lateral: -12.2, curveScale: 1.15 });
      circuit.add(apexMarker);
    }
  }

  for (let lap = 0; lap < 1; lap += 1) {
    const lapStart = lap * TRACK_LOOP_LENGTH;
    for (const brakingStart of [230, 770, 1280]) {
      const refs = [
        { label: "150", material: board150, offset: -150 },
        { label: "100", material: board100, offset: -100 },
        { label: "50", material: board50, offset: -50 },
        { label: "BRAKE", material: brakeMaterial, offset: -12 }
      ];
      for (const ref of refs) {
        const board = makeTracksideBoard(`braking-reference-${ref.label}`, ref.material);
        dynamicPieces.push({ object: board, ahead: lapStart + brakingStart + ref.offset, lateral: 11.6, curveScale: 1.25 });
        circuit.add(board);
      }
    }
  }

  for (let lap = 0; lap < 1; lap += 1) {
    const lapStart = lap * TRACK_LOOP_LENGTH;
    for (const apex of [322, 870, 910, 1390]) {
      for (const side of [-1, 1]) {
        const chevron = makeTracksideBoard("corner-chevron", chevronMaterial);
        chevron.scale.set(0.82, 0.82, 0.82);
        dynamicPieces.push({ object: chevron, ahead: lapStart + apex, lateral: side * 10.4, curveScale: 1.8 });
        circuit.add(chevron);
      }
    }
  }

  const startElevation = trackElevationAt(18);
  const startBridgePoint = trackWorldPointAt(38, 0);
  const timingBridge = new THREE.Group();
  timingBridge.name = "timing-bridge";
  timingBridge.position.set(startBridgePoint.x, 0, startBridgePoint.z);
  timingBridge.rotation.y = trackWorldHeadingAt(38);
  timingBridge.add(makeBox("timing-bridge-crossbar", [18.4, 0.72, 0.5], [0, startElevation + 5.2, 0], bridgeMaterial));
  timingBridge.add(makeBox("timing-bridge-left-upright", [0.5, 5.2, 0.5], [-8.9, startElevation + 2.6, 0], bridgeMaterial));
  timingBridge.add(makeBox("timing-bridge-right-upright", [0.5, 5.2, 0.5], [8.9, startElevation + 2.6, 0], bridgeMaterial));
  circuit.add(timingBridge);
  const startLinePoint = trackWorldPointAt(18, 0);
  const startLine = makeBox("start-line", [12.2, 0.025, 0.42], [startLinePoint.x, startElevation + 0.055, startLinePoint.z], kerbWhite);
  startLine.rotation.y = trackWorldHeadingAt(18);
  circuit.add(startLine);

  circuit.userData.disposableMaterials = [
    asphalt,
    grass,
    runoff,
    gravel,
    kerbRed,
    kerbWhite,
    barrierMaterial,
    bridgeMaterial,
    skidMaterial,
    chevronMaterial,
    brakeMaterial,
    board150,
    board100,
    board50
  ];
  circuit.userData.dynamicPieces = dynamicPieces;
  circuit.userData.weatherMaterials = { asphalt, runoff, racingLine: racingLine.material };
  positionTracksidePieces(circuit);
  return circuit;
}

function positionTracksidePieces(circuit: THREE.Group) {
  const dynamicPieces = circuit.userData.dynamicPieces as DynamicPiece[] | undefined;
  if (!dynamicPieces) return;

  for (const piece of dynamicPieces) {
    const curve = trackCurveAt(piece.ahead);
    const sample = sampleTrack(piece.ahead);
    const baseY = piece.baseY ?? piece.object.position.y;
    const point = trackWorldPointAt(piece.ahead, piece.lateral);
    piece.baseY = baseY;
    piece.object.position.x = point.x;
    piece.object.position.y = surfaceY(sample, piece.lateral, baseY);
    piece.object.position.z = point.z;
    piece.object.rotation.y = trackWorldHeadingAt(piece.ahead) - curve * piece.curveScale * 0.25;
  }
}
