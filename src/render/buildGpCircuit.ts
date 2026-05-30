import * as THREE from "three";
import {
  getActiveTrackLayout,
  getTrackCheckpoints,
  getTrackSectorEnds,
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
    const width = sample.brakingZone ? 0.2 : 0.14;
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
    color: "#dfe7d8",
    transparent: true,
    opacity: 0.08,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ghosted-racing-line";
  mesh.renderOrder = 2;
  return mesh;
}

function makeSurfaceRibbon(
  name: string,
  material: THREE.Material,
  centerOffset: (sample: TrackSample) => number,
  width: (sample: TrackSample) => number,
  y: number,
  startAhead = -150,
  endAhead = RENDERED_TRACK_LENGTH,
  step = 14
) {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  let row = 0;

  for (let ahead = startAhead; ahead <= endAhead; ahead += step) {
    const sample = sampleTrack(ahead);
    const center = centerOffset(sample);
    const halfWidth = width(sample) * 0.5;
    const left = trackWorldPointAt(ahead, center - halfWidth);
    const right = trackWorldPointAt(ahead, center + halfWidth);
    vertices.push(
      left.x,
      surfaceY(sample, center - halfWidth, y),
      left.z,
      right.x,
      surfaceY(sample, center + halfWidth, y),
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

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = 1;
  return mesh;
}

function makeGridSlot(distance: number, lateral: number, material: THREE.Material) {
  const slot = new THREE.Group();
  slot.name = "painted-grid-slot";
  slot.position.set(...worldPosition(distance, lateral, 0.064));
  slot.rotation.y = trackWorldHeadingAt(distance);

  const sideWidth = 0.08;
  const slotWidth = 2.15;
  const slotLength = 4.75;
  const pieces = [
    makePlane("grid-slot-side", [sideWidth, slotLength], [-slotWidth / 2, 0, 0], material),
    makePlane("grid-slot-side", [sideWidth, slotLength], [slotWidth / 2, 0, 0], material),
    makePlane("grid-slot-end", [slotWidth, sideWidth], [0, 0, -slotLength / 2], material),
    makePlane("grid-slot-end", [slotWidth, sideWidth], [0, 0, slotLength / 2], material)
  ];

  for (const piece of pieces) {
    piece.renderOrder = 2;
    slot.add(piece);
  }

  return slot;
}

function makeWetPuddle(distance: number, lateral: number, scale: [number, number], material: THREE.Material) {
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 28), material);
  puddle.name = "edge-standing-water";
  puddle.rotation.x = -Math.PI / 2;
  puddle.rotation.y = trackWorldHeadingAt(distance);
  puddle.scale.set(scale[0], scale[1], 1);
  puddle.position.set(...worldPosition(distance, lateral, 0.058));
  puddle.renderOrder = 2;
  return puddle;
}

function makeFlowCue(distance: number, material: THREE.Material) {
  const sample = sampleTrack(distance);
  const cue = makePlane(
    "painted-apex-flow-cue",
    [0.22, sample.brakingZone ? 3.1 : 2.35],
    worldPosition(distance, Math.max(-3.1, Math.min(3.1, sample.racingLineOffset)), 0.067),
    material
  );
  cue.rotation.y = trackWorldHeadingAt(distance) - sample.curve * 2.2;
  cue.renderOrder = 3;
  return cue;
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

function makeCatchFence(name: string, length: number, material: THREE.Material, postMaterial: THREE.Material) {
  const fence = new THREE.Group();
  fence.name = name;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, 1.65, 10, 1), material);
  mesh.name = `${name}-mesh`;
  mesh.position.y = 1.55;
  mesh.castShadow = true;
  fence.add(mesh);

  const postCount = Math.max(2, Math.round(length / 3));
  for (let index = 0; index < postCount; index += 1) {
    const t = postCount === 1 ? 0 : index / (postCount - 1);
    const post = makeBox(`${name}-post`, [0.08, 2.1, 0.08], [THREE.MathUtils.lerp(-length / 2, length / 2, t), 1.05, 0], postMaterial);
    post.castShadow = true;
    fence.add(post);
  }

  return fence;
}

function makeMarshalPost(name: string, material: THREE.Material, roofMaterial: THREE.Material) {
  const post = new THREE.Group();
  post.name = name;
  post.add(makeBox(`${name}-base`, [1.9, 0.16, 1.1], [0, 0.08, 0], material));
  post.add(makeBox(`${name}-booth`, [1.55, 1.05, 0.82], [0, 0.68, 0], material));
  post.add(makeBox(`${name}-roof`, [1.9, 0.18, 1.12], [0, 1.3, 0], roofMaterial));
  post.add(makeBox(`${name}-flag-panel`, [0.55, 0.5, 0.05], [0.46, 0.83, -0.44], roofMaterial));
  return post;
}

function makePitWallModule(name: string, material: THREE.Material, accentMaterial: THREE.Material, glassMaterial: THREE.Material) {
  const module = new THREE.Group();
  module.name = name;
  module.add(makeBox(`${name}-wall`, [0.4, 0.92, 5.6], [0, 0.46, 0], material));
  module.add(makeBox(`${name}-timing-screens`, [0.16, 0.58, 2.6], [-0.22, 1.18, -0.4], glassMaterial));
  module.add(makeBox(`${name}-accent-rail`, [0.08, 0.12, 5.7], [-0.26, 0.98, 0], accentMaterial));
  return module;
}

function makeCheckpointGate(name: string, label: string, panelMaterial: THREE.Material, frameMaterial: THREE.Material, accentMaterial: THREE.Material) {
  const gate = new THREE.Group();
  gate.name = name;

  gate.add(makeBox(`${name}-left-upright`, [0.18, 4.5, 0.18], [-7.35, 2.25, 0], frameMaterial));
  gate.add(makeBox(`${name}-right-upright`, [0.18, 4.5, 0.18], [7.35, 2.25, 0], frameMaterial));
  gate.add(makeBox(`${name}-crossbar`, [15.1, 0.28, 0.22], [0, 4.42, 0], frameMaterial));
  gate.add(makeBox(`${name}-timing-loop`, [12.9, 0.026, 0.42], [0, 0.052, 0], accentMaterial));

  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.82), panelMaterial);
  panel.name = `${name}-panel-${label.toLowerCase()}`;
  panel.position.set(0, 4.78, -0.13);
  gate.add(panel);

  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.16), accentMaterial);
    lamp.name = `${name}-sector-lamp`;
    lamp.position.set(side * 2.08, 4.78, -0.18);
    gate.add(lamp);
  }

  return gate;
}

function makeFictionalPaddock(name: string, material: THREE.Material, accentMaterial: THREE.Material, glassMaterial: THREE.Material) {
  const paddock = new THREE.Group();
  paddock.name = name;
  paddock.add(makeBox(`${name}-garage-block`, [14.2, 3.2, 7.8], [0, 1.6, 0], material));
  paddock.add(makeBox(`${name}-upper-suite`, [12.4, 1.45, 5.4], [0, 4.0, -0.55], glassMaterial));
  paddock.add(makeBox(`${name}-roof-blade`, [15.4, 0.24, 8.6], [0, 4.86, 0], accentMaterial));
  for (let bay = 0; bay < 5; bay += 1) {
    paddock.add(makeBox(`${name}-garage-door`, [2.1, 1.65, 0.08], [-5.0 + bay * 2.5, 1.1, -3.96], glassMaterial));
  }
  return paddock;
}

function makeVenueHero(layoutId: string, material: THREE.Material, accentMaterial: THREE.Material, glassMaterial: THREE.Material) {
  const hero = new THREE.Group();
  hero.name = `${layoutId}-venue-hero`;

  if (layoutId === "mirage") {
    hero.add(makeBox("mirage-marina-club", [10.8, 2.6, 5.2], [0, 1.3, 0], material));
    hero.add(makeBox("mirage-glass-deck", [9.2, 1.1, 4.2], [0, 3.1, -0.2], glassMaterial));
    for (let mast = 0; mast < 7; mast += 1) {
      const pole = makeBox("mirage-yacht-mast", [0.07, 5.4 + (mast % 3) * 0.6, 0.07], [-4.8 + mast * 1.6, 3.1, 3.1], accentMaterial);
      pole.rotation.z = (mast % 2 === 0 ? -1 : 1) * 0.05;
      hero.add(pole);
    }
    return hero;
  }

  if (layoutId === "northstar") {
    hero.add(makeBox("northstar-lodge", [9.8, 2.8, 5.4], [0, 1.4, 0], material));
    const roof = makeBox("northstar-lodge-roof", [11.2, 0.38, 6.2], [0, 3.1, 0], accentMaterial);
    roof.rotation.z = 0.08;
    hero.add(roof);
    for (let beam = 0; beam < 5; beam += 1) {
      hero.add(makeBox("northstar-timber-beam", [0.16, 2.1, 0.16], [-4 + beam * 2, 1.26, -2.82], accentMaterial));
    }
    return hero;
  }

  hero.add(makeBox("aurelia-stone-pavilion", [9.6, 2.8, 5.2], [0, 1.4, 0], material));
  hero.add(makeBox("aurelia-terrace-glass", [8.2, 1.0, 4.2], [0, 3.15, -0.2], glassMaterial));
  for (let arch = 0; arch < 4; arch += 1) {
    hero.add(makeBox("aurelia-arch-column", [0.22, 2.1, 0.22], [-3.6 + arch * 2.4, 1.05, -2.72], accentMaterial));
  }
  return hero;
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
    ctx.fillStyle = "#41494a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 900; index += 1) {
      const shade = 58 + Math.floor(random() * 44);
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
    color: "#d6dedc",
    map: texture,
    emissive: "#222b2c",
    emissiveIntensity: 0.12,
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
  const grass = new THREE.MeshBasicMaterial({
    color: layout.id === "northstar" ? "#5f7466" : layout.terrainColor,
    side: THREE.DoubleSide
  });
  const runoff = new THREE.MeshBasicMaterial({ color: layout.runoffColor, side: THREE.DoubleSide });
  const gravel = new THREE.MeshStandardMaterial({ color: "#9a8a70", roughness: 0.96 });
  const kerbRed = new THREE.MeshStandardMaterial({ color: "#d62b3a", roughness: 0.54 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: "#f5f7f4", roughness: 0.5 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: "#dce3e8", roughness: 0.62, metalness: 0.08 });
  const bridgeMaterial = new THREE.MeshStandardMaterial({ color: "#303c40", roughness: 0.52, metalness: 0.18 });
  const fenceMaterial = new THREE.MeshBasicMaterial({ color: "#dce7e4", transparent: true, opacity: 0.26, side: THREE.DoubleSide });
  const paddockMaterial = new THREE.MeshStandardMaterial({ color: "#68736f", roughness: 0.6, metalness: 0.08 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: "#9bb3b6", roughness: 0.2, metalness: 0.18, transparent: true, opacity: 0.72 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: layout.id === "mirage" ? "#20b7ff" : layout.id === "northstar" ? "#f3d348" : "#e20e3b", roughness: 0.42, metalness: 0.2 });
  const skidMaterial = new THREE.MeshBasicMaterial({ color: "#121514", transparent: true, opacity: 0.22, depthWrite: false });
  const grooveMaterial = new THREE.MeshBasicMaterial({ color: "#101413", transparent: true, opacity: 0.2, depthWrite: false });
  const wetSheenMaterial = new THREE.MeshBasicMaterial({ color: "#c9dde1", transparent: true, opacity: 0, depthWrite: false });
  const puddleMaterial = new THREE.MeshBasicMaterial({ color: "#b9d3d9", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const gridPaintMaterial = new THREE.MeshBasicMaterial({ color: "#f4f7ef", transparent: true, opacity: 0.74, depthWrite: false });
  const edgePaintMaterial = new THREE.MeshBasicMaterial({ color: "#f4f7ef", transparent: true, opacity: 0.58, depthWrite: false });
  const flowPaintMaterial = new THREE.MeshBasicMaterial({ color: "#d8ef8f", transparent: true, opacity: 0.36, depthWrite: false });
  const chevronMaterial = makeBoardMaterial(">>", "#e20e3b", "#ffffff");
  const brakeMaterial = makeBoardMaterial("BRAKE", "#e20e3b", "#ffffff");
  const board150 = makeBoardMaterial("150");
  const board100 = makeBoardMaterial("100");
  const board50 = makeBoardMaterial("50");
  const checkpointMaterials = [
    makeBoardMaterial("G1", "#171f24", "#d7eb8f"),
    makeBoardMaterial("G2", "#171f24", "#d7eb8f"),
    makeBoardMaterial("G3", "#171f24", "#d7eb8f"),
    makeBoardMaterial("G4", "#171f24", "#d7eb8f"),
    makeBoardMaterial("G5", "#171f24", "#d7eb8f"),
    makeBoardMaterial("G6", "#171f24", "#d7eb8f"),
    makeBoardMaterial("G7", "#171f24", "#d7eb8f")
  ];
  const sectorMaterials = [
    makeBoardMaterial("S1", "#f3d348", "#17211b"),
    makeBoardMaterial("S2", "#20b7ff", "#071115"),
    makeBoardMaterial("S3", "#e20e3b", "#ffffff")
  ];

  const leftTerrain = makeTrackStrip("left-terrain-following-grass", grass, -88, -15.8, -0.18, 0, RENDERED_TRACK_LENGTH, 26);
  const rightTerrain = makeTrackStrip("right-terrain-following-grass", grass, 15.8, 88, -0.18, 0, RENDERED_TRACK_LENGTH, 26);
  circuit.add(leftTerrain, rightTerrain);
  const roadMesh = makeTrackStrip("continuous-asphalt-ribbon", asphalt, -6.7, 6.7, 0.022);
  const leftRunoff = makeTrackStrip("left-continuous-runoff", runoff, -15.6, -6.8, 0.006);
  const rightRunoff = makeTrackStrip("right-continuous-runoff", runoff, 6.8, 15.6, 0.006);
  const racingLine = makeRacingLine();
  const racingGroove = makeSurfaceRibbon(
    "rubbered-racing-groove",
    grooveMaterial,
    (sample) => Math.max(-2.8, Math.min(2.8, sample.racingLineOffset)),
    (sample) => (sample.brakingZone ? 2.2 : 1.55),
    0.047
  );
  const wetSheen = makeSurfaceRibbon("wet-asphalt-sheen", wetSheenMaterial, () => 0, (sample) => sample.halfWidth * 1.78, 0.056, -80, RENDERED_TRACK_LENGTH, 22);
  const leftEdgeLine = makeSurfaceRibbon("painted-left-track-edge", edgePaintMaterial, (sample) => -sample.halfWidth + 0.42, () => 0.12, 0.069, -130, RENDERED_TRACK_LENGTH, 16);
  const rightEdgeLine = makeSurfaceRibbon("painted-right-track-edge", edgePaintMaterial, (sample) => sample.halfWidth - 0.42, () => 0.12, 0.069, -130, RENDERED_TRACK_LENGTH, 16);
  circuit.add(roadMesh, leftRunoff, rightRunoff, racingGroove, wetSheen, leftEdgeLine, rightEdgeLine, racingLine);

  for (let index = 0; index < 10; index += 1) {
    const distance = 34 + index * 13.2;
    const lateral = index % 2 === 0 ? -2.25 : 2.25;
    circuit.add(makeGridSlot(distance, lateral, gridPaintMaterial));
  }

  const puddlePlacements = [
    { distance: 276, lateral: 6.0, scale: [1.6, 0.42] as [number, number] },
    { distance: 526, lateral: -6.1, scale: [1.25, 0.34] as [number, number] },
    { distance: 1034, lateral: 5.9, scale: [1.45, 0.38] as [number, number] },
    { distance: 1418, lateral: -6.0, scale: [1.3, 0.36] as [number, number] },
    { distance: 1814, lateral: 6.2, scale: [1.75, 0.44] as [number, number] }
  ];
  for (const puddle of puddlePlacements) {
    circuit.add(makeWetPuddle(puddle.distance, puddle.lateral, puddle.scale, puddleMaterial));
  }

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

  let flowCueCount = 0;
  for (let ahead = 150; ahead < RENDERED_TRACK_LENGTH; ahead += 34) {
    const sample = sampleTrack(ahead);
    if (sample.section.kind === "straight") continue;
    if (sample.cornerPhase === "exit" && !sample.brakingZone) continue;
    circuit.add(makeFlowCue(ahead, flowPaintMaterial));
    flowCueCount += 1;
  }

  for (let index = 0; index < 120; index += 1) {
    const distance = 80 + index * 58;
    const side = index % 2 === 0 ? -1 : 1;
    const stagger = ((index * 37) % 19) - 9;
    const treeBaseLateral = layout.id === "northstar" ? 44 : 26;
    const treeSpacing = layout.id === "northstar" ? 3.6 : 2.8;
    const lateral = side * (treeBaseLateral + (index % 5) * treeSpacing) + stagger * 0.2;
    const treeHeight = layout.id === "northstar" ? 2.6 + (index % 4) * 0.38 : 3.6 + (index % 4) * 0.55;
    const tree = makeTree("trackside-cypress", treeHeight, index % 3 === 0 ? layout.treeColor : layout.terrainColor);
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

      if (index % 2 === 0) {
        const fence = makeCatchFence("catch-fence", 12.5, fenceMaterial, bridgeMaterial);
        dynamicPieces.push({ object: fence, ahead, lateral: side * 16.2, curveScale: 1.15 });
        circuit.add(fence);
      }
    }
  }

  for (const placement of [
    { distance: 72, lateral: -18.2 },
    { distance: 96, lateral: -18.2 },
    { distance: 120, lateral: -18.2 },
    { distance: 144, lateral: -18.2 },
    { distance: 168, lateral: -18.2 }
  ]) {
    const pitWall = makePitWallModule("fictional-pit-wall", bridgeMaterial, accentMaterial, glassMaterial);
    dynamicPieces.push({ object: pitWall, ahead: placement.distance, lateral: placement.lateral, curveScale: 0.4 });
    circuit.add(pitWall);
  }

  for (const placement of [
    { distance: 112, lateral: -74 },
    { distance: 148, lateral: -74 },
    { distance: 184, lateral: -74 }
  ]) {
    const paddock = makeFictionalPaddock("fictional-team-garages", paddockMaterial, accentMaterial, glassMaterial);
    paddock.scale.setScalar(layout.id === "northstar" ? 0.34 : 0.4);
    dynamicPieces.push({ object: paddock, ahead: placement.distance, lateral: placement.lateral, curveScale: 0.2 });
    circuit.add(paddock);
  }

  for (const placement of [
    { distance: 410, lateral: 18.4 },
    { distance: 1010, lateral: -18.6 },
    { distance: 1510, lateral: 18.8 }
  ]) {
    const marshalPost = makeMarshalPost("marshal-post", paddockMaterial, accentMaterial);
    dynamicPieces.push({ object: marshalPost, ahead: placement.distance, lateral: placement.lateral, curveScale: 1.1 });
    circuit.add(marshalPost);
  }

  const heroPlacement =
    layout.id === "mirage"
      ? { distance: 670, lateral: 34 }
      : layout.id === "northstar"
        ? { distance: 930, lateral: -34 }
        : { distance: 650, lateral: 33 };
  const venueHero = makeVenueHero(layout.id, paddockMaterial, accentMaterial, glassMaterial);
  venueHero.scale.setScalar(1.08);
  dynamicPieces.push({ object: venueHero, ahead: heroPlacement.distance, lateral: heroPlacement.lateral, curveScale: 0.35 });
  circuit.add(venueHero);

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

  let checkpointGateCount = 0;
  getTrackCheckpoints().forEach((checkpoint, index) => {
    const gate = makeCheckpointGate(
      "race-checkpoint-gate",
      `G${index + 1}`,
      checkpointMaterials[index % checkpointMaterials.length],
      bridgeMaterial,
      accentMaterial
    );
    dynamicPieces.push({ object: gate, ahead: checkpoint.distance, lateral: 0, curveScale: 0.7 });
    circuit.add(gate);
    checkpointGateCount += 1;
  });

  getTrackSectorEnds().forEach((distance, index) => {
    if (distance >= TRACK_LOOP_LENGTH) return;

    const gate = makeCheckpointGate("sector-timing-gate", `S${index + 1}`, sectorMaterials[index], bridgeMaterial, accentMaterial);
    gate.scale.set(1.04, 1.04, 1.04);
    dynamicPieces.push({ object: gate, ahead: distance, lateral: 0, curveScale: 0.7 });
    circuit.add(gate);
    checkpointGateCount += 1;
  });

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
    fenceMaterial,
    paddockMaterial,
    glassMaterial,
    accentMaterial,
    skidMaterial,
    grooveMaterial,
    wetSheenMaterial,
    puddleMaterial,
    gridPaintMaterial,
    edgePaintMaterial,
    flowPaintMaterial,
    chevronMaterial,
    brakeMaterial,
    board150,
    board100,
    board50,
    ...checkpointMaterials,
    ...sectorMaterials
  ];
  circuit.userData.dynamicPieces = dynamicPieces;
  circuit.userData.weatherMaterials = {
    asphalt,
    grass,
    runoff,
    racingLine: racingLine.material,
    fence: fenceMaterial,
    glass: glassMaterial,
    groove: grooveMaterial,
    wetSheen: wetSheenMaterial,
    puddle: puddleMaterial,
    gridPaint: gridPaintMaterial,
    edgePaint: edgePaintMaterial,
    flowPaint: flowPaintMaterial
  };
  circuit.userData.dressingStats = {
    dynamicPieces: dynamicPieces.length,
    catchFences: dynamicPieces.filter((piece) => piece.object.name === "catch-fence").length,
    pitWallModules: dynamicPieces.filter((piece) => piece.object.name === "fictional-pit-wall").length,
    marshalPosts: dynamicPieces.filter((piece) => piece.object.name === "marshal-post").length,
    checkpointGates: checkpointGateCount,
    venueHero: venueHero.name
  };
  circuit.userData.surfaceStats = {
    terrainBands: 2,
    racingGroove: racingGroove.name,
    wetSheen: wetSheen.name,
    edgeLines: [leftEdgeLine.name, rightEdgeLine.name],
    flowCues: flowCueCount,
    gridSlots: 10,
    puddles: puddlePlacements.length
  };
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
