import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

const KENNEY_OBJ_ROOT = "/assets/kenney-racing-kit/obj/";

type AssetName = "raceCarRed" | "grandStand" | "lightPostLarge";

const assetScales: Record<AssetName, number> = {
  raceCarRed: 3.05,
  grandStand: 3.9,
  lightPostLarge: 4.2
};

function cloneObjectWithMaterials(source: THREE.Object3D) {
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => material.clone());
    } else {
      object.material = object.material.clone();
    }
  });
  return clone;
}

function tintBodyMaterials(root: THREE.Object3D, color: string) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if ("color" in material && material.name.toLowerCase().includes("red")) {
        material.color = new THREE.Color(color);
      }
      if ("roughness" in material) material.roughness = 0.48;
      if ("metalness" in material) material.metalness = 0.08;
    }
  });
}

function normalizeVenueMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!("color" in material)) continue;

      const color = material.color as THREE.Color;
      const brightness = color.r + color.g + color.b;
      if ("map" in material && material.map) {
        material.map = null;
      }
      if (brightness < 1.1) {
        color.set("#5f6c69");
      }
      if ("emissive" in material) material.emissive = new THREE.Color("#111816");
      if ("emissiveIntensity" in material) material.emissiveIntensity = 0.16;
      if ("roughness" in material) material.roughness = 0.68;
      if ("metalness" in material) material.metalness = 0.06;
      material.needsUpdate = true;
    }
  });
}

function addCrowdRows(root: THREE.Object3D) {
  const colors = ["#d7eb8f", "#24c7ff", "#f3d348", "#e20e3b"];
  for (let row = 0; row < 4; row += 1) {
    const material = new THREE.MeshStandardMaterial({
      color: colors[row % colors.length],
      roughness: 0.72,
      metalness: 0.02
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.035, 0.055), material);
    mesh.name = "grandstand-crowd-band";
    mesh.position.set(-0.5, 0.32 + row * 0.12, 0.22 + row * 0.15);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

export class RacingAssetLibrary {
  private readonly manager = new THREE.LoadingManager();
  private readonly templates = new Map<AssetName, Promise<THREE.Object3D>>();

  createCar(color: string) {
    return this.createAsset("raceCarRed").then((car) => {
      car.name = "kenney-racing-car";
      tintBodyMaterials(car, color);
      car.position.y = 0.1;
      return car;
    });
  }

  createGrandstand() {
    return this.createAsset("grandStand").then((stand) => {
      stand.name = "kenney-grandstand";
      stand.rotation.y = Math.PI;
      normalizeVenueMaterials(stand);
      addCrowdRows(stand);
      return stand;
    });
  }

  createLightPost() {
    return this.createAsset("lightPostLarge").then((post) => {
      post.name = "kenney-light-post";
      return post;
    });
  }

  private createAsset(name: AssetName) {
    return this.loadTemplate(name).then((template) => cloneObjectWithMaterials(template));
  }

  private loadTemplate(name: AssetName) {
    const cached = this.templates.get(name);
    if (cached) return cached;

    const loaded = new Promise<THREE.Object3D>((resolve, reject) => {
      const mtlLoader = new MTLLoader(this.manager).setPath(KENNEY_OBJ_ROOT);
      mtlLoader.load(
        `${name}.mtl`,
        (materials) => {
          materials.preload();
          const objLoader = new OBJLoader(this.manager).setPath(KENNEY_OBJ_ROOT);
          objLoader.setMaterials(materials);
          objLoader.load(
            `${name}.obj`,
            (object) => {
              object.scale.setScalar(assetScales[name]);
              object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });
              resolve(object);
            },
            undefined,
            reject
          );
        },
        undefined,
        reject
      );
    });

    this.templates.set(name, loaded);
    return loaded;
  }
}
