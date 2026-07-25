import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

const KENNEY_OBJ_ROOT = "/assets/kenney-racing-kit/obj/";
const FORMULA_OBJ_ROOT = "/assets/apex-formula/";

type AssetName = "raceCarRed" | "grandStand" | "lightPostLarge" | "formulaCar";

const assetScales: Record<AssetName, number> = {
  raceCarRed: 3.05,
  grandStand: 3.9,
  lightPostLarge: 4.2,
  formulaCar: 1
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

  createFormulaCar(color?: string) {
    return this.createAsset("formulaCar").then((car) => {
      car.name = "apex-open-wheel-car";
      normalizeFormulaCar(car);
      normalizeFormulaMaterials(car);
      if (color) tintFormulaCar(car, color);
      car.userData.assetCar = "apex-open-wheel-cc0";
      car.userData.teamColor = color ?? null;
      car.userData.restingY = car.position.y;
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

    if (name === "formulaCar") {
      const loaded = this.loadFormulaTemplate();
      this.templates.set(name, loaded);
      return loaded;
    }

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

  private loadFormulaTemplate() {
    return new Promise<THREE.Object3D>((resolve, reject) => {
      const mtlLoader = new MTLLoader(this.manager).setPath(FORMULA_OBJ_ROOT);
      mtlLoader.load(
        "apex-formula.mtl",
        (materials) => {
          materials.preload();
          const objLoader = new OBJLoader(this.manager).setPath(FORMULA_OBJ_ROOT);
          objLoader.setMaterials(materials);
          objLoader.load(
            "apex-formula.obj",
            (object) => {
              object.scale.setScalar(assetScales.formulaCar);
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
  }
}

function normalizeFormulaCar(root: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y += 0.11 - bounds.min.y;
}

function normalizeFormulaMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const materials = sourceMaterials.map((source) => {
      const material = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: "map" in source && source.map instanceof THREE.Texture ? source.map : null,
        roughness: 0.38,
        metalness: 0.16,
        side: THREE.DoubleSide
      });
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      return material;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
}

function tintFormulaCar(root: THREE.Object3D, color: string) {
  const teamColor = new THREE.Color(color);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.color.lerp(teamColor, 0.28);
      material.needsUpdate = true;
    }
  });
}
