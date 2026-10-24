import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  makeCharacter,
  animateCharacter,
  ball,
  box,
  cone,
  mat,
} from "./characters.js";
import { WORLDS, SEED_POSITIONS } from "./content.js";

const V = THREE.Vector3;
function cylinder(g, color, x, y, z, r, h, segments = 12) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, segments),
    mat(color),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function label(text, color = "#315749") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffaf1";
  ctx.beginPath();
  ctx.roundRect(5, 5, 502, 80, 38);
  ctx.fill();
  ctx.font = "600 31px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    }),
  );
  sprite.scale.set(4, 0.75, 1);
  return sprite;
}

export class World {
  constructor(container, callbacks, progress) {
    this.cb = callbacks;
    this.eventCleanups = [];
    this.progress = progress;
    this.index = progress.world;
    this.keys = new Set();
    this.entities = [];
    this.seeds = [];
    this.blockers = [];
    this.platforms = [];
    this.peers = new Map();
    this.active = false;
    this.time = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.yaw = 0;
    this.joystick = { x: 0, y: 0 };
    this.moveTarget = null;
    this.near = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 250);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const gl = this.renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    const software =
      debug &&
      /swiftshader|llvmpipe|software/i.test(
        gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      );
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, software ? 0.7 : 1.7),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    container.append(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute(
      "aria-label",
      "3D Magic Kingdom. Use arrow keys or W A S D to walk, Space to jump, and E to read a nearby book.",
    );
    this.canvas.tabIndex = 0;
    this.scene.add(new THREE.HemisphereLight("#fff7e5", "#779d8d", 1.7));
    const sunlight = new THREE.DirectionalLight("#fff5df", 2.5);
    sunlight.position.set(-20, 38, 20);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(software ? 512 : 1024, software ? 512 : 1024);
    sunlight.shadow.camera.left = -43;
    sunlight.shadow.camera.right = 43;
    sunlight.shadow.camera.top = 43;
    sunlight.shadow.camera.bottom = -43;
    sunlight.shadow.normalBias = 0.05;
    sunlight.shadow.bias = -0.00015;
    this.scene.add(sunlight);
    this.player = makeCharacter();
    this.lily = makeCharacter("lily");
    this.scene.add(this.player, this.lily);
    this.land = new THREE.Group();
    this.scene.add(this.land);
    this.load(this.index);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.listen(window, "keydown", (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        ) &&
        this.active
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat && this.active) this.jump();
      if (e.code === "KeyE" && !e.repeat && this.active) this.interact();
    });
    this.listen(window, "keyup", (e) => this.keys.delete(e.code));
    this.listen(window, "blur", () => this.keys.clear());
    this.listen(document, "visibilitychange", () => {
      if (document.hidden) this.keys.clear();
    });
    this.listen(this.canvas, "pointerdown", (e) => {
      this.pointerStart = { x: e.clientX, y: e.clientY };
    });
    this.listen(this.canvas, "pointerup", (e) => {
      if (
        !this.active ||
        !this.pointerStart ||
        Math.hypot(
          e.clientX - this.pointerStart.x,
          e.clientY - this.pointerStart.y,
        ) > 10
      )
        return;
      const rect = this.canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera,
      );
      const p = new V();
      if (
        ray.ray.intersectPlane(new THREE.Plane(new V(0, 1, 0), 0), p) &&
        Math.hypot(p.x, p.z) < 30
      )
        this.moveTarget = p;
    });
    this.listen(this.canvas, "webglcontextlost", (event) => {
      event.preventDefault();
      this.cb.graphicsLost?.();
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }
  listen(target, event, listener) {
    target.addEventListener(event, listener);
    this.eventCleanups.push(() => target.removeEventListener(event, listener));
  }
  destroy() {
    this.stopped = true;
    this.active = false;
    this.keys.clear();
    this.resizeObserver?.disconnect();
    this.eventCleanups.forEach((remove) => remove());
    this.renderer.dispose();
    this.canvas.remove();
  }
  resize() {
    if (!this.canvas.parentElement) return;
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }
  tree(x, z, scale = 1, color = "#82ad7c", kind = "round") {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    this.land.add(g);
    cylinder(g, "#a18064", 0, 1.7, 0, 0.25, 3.4);
    if (kind === "pine") {
      for (let i = 0; i < 3; i++)
        cone(g, color, 0, 2.2 + i * 0.9, 0, 1.6 - i * 0.3, 2.5, 9);
    } else {
      ball(g, color, 0, 3.8, 0, 1.5, 1.7, 1.4);
      ball(g, color, -0.85, 3.3, 0.2, 0.95, 1.1, 1);
      ball(g, color, 0.8, 3.55, -0.1, 1, 1.2, 1);
    }
    this.blockers.push({ x, z, r: 0.5 * scale });
  }
  castle(x = 0, z = -23) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.land.add(g);
    box(g, "#e7ded0", 0, 3, 0, 9, 6, 5);
    box(g, "#eee7d9", 0, 5.1, -1, 5, 5, 4);
    const roofs = ["#a29bc6", "#bbb1ce", "#9ca6c2"];
    for (const [i, p] of [
      [-5, 0],
      [5, 0],
      [-3, -3],
      [3, -3],
      [0, -3],
    ].entries()) {
      const h = i === 4 ? 12 : i > 1 ? 9 : 7;
      cylinder(g, "#eee3d7", p[0], h / 2, p[1], i === 4 ? 1 : 1.2, h);
      cone(g, roofs[i % 3], p[0], h + 1.7, p[1], i === 4 ? 1.55 : 1.7, 3.5, 10);
      box(g, "#8d9fb0", p[0], h - 1, p[1] + 1.18, 0.5, 1.3, 0.08);
      const pole = cylinder(g, "#d0ae69", p[0], h + 4, p[1], 0.055, 1.2, 6);
      const flag = box(g, "#d7a0b8", p[0] + 0.4, h + 4.3, p[1], 0.8, 0.4, 0.04);
    }
    box(g, "#ac91a9", 0, 1.65, 2.56, 2.4, 3.3, 0.1);
    ball(g, "#ac91a9", 0, 3.2, 2.57, 1.2, 1.2, 0.06);
    box(g, "#e1c47d", 0, 1.8, 2.65, 0.09, 3.3, 0.06);
    ball(g, "#f8d98b", -0.3, 1.55, 2.7, 0.1);
    ball(g, "#f8d98b", 0.3, 1.55, 2.7, 0.1);
    this.blockers.push({ x, z, r: 5.6 });
  }
  cottage() {
    const g = new THREE.Group();
    g.position.set(0, 0, -23);
    this.land.add(g);
    box(g, "#f4dfba", 0, 1.8, 0, 6, 3.6, 4);
    const roof = cone(g, "#b8848f", 0, 4.25, 0, 4.6, 2.8, 4);
    roof.rotation.y = Math.PI / 4;
    box(g, "#9dbaa5", 0, 1.2, 2.05, 1.3, 2.4, 0.1);
    for (const s of [-1, 1]) {
      box(g, "#fff0d3", s * 1.8, 2, 2.06, 1.1, 1, 0.1);
      box(g, "#b89876", s * 1.8, 2, 2.12, 0.07, 1, 0.05);
      box(g, "#b89876", s * 1.8, 2, 2.12, 1.1, 0.07, 0.05);
    }
    const mama = makeCharacter("mama");
    mama.position.set(2, 0, -19.8);
    this.land.add(mama);
    this.blockers.push({ x: 0, z: -23, r: 3.8 });
  }
  path(points, color = "#e4cf9e", width = 1.7) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new V(p[0], 0.045, p[1])),
    );
    const positions = [],
      uvs = [],
      indices = [];
    for (let i = 0; i <= 100; i++) {
      const p = curve.getPoint(i / 100),
        t = curve.getTangent(i / 100);
      for (const s of [-1, 1]) {
        positions.push(p.x + t.z * width * s, p.y, p.z - t.x * width * s);
        uvs.push(s === 1 ? 1 : 0, i / 100);
      }
      if (i < 100) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    this.land.add(mesh);
  }
  mergeScenery() {
    this.land.updateMatrixWorld(true);
    const groups = new Map(),
      remove = [];
    this.land.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh) return;
      let geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (geo.index) {
        const flat = geo.toNonIndexed();
        geo.dispose();
        geo = flat;
      }
      const key = `${m.material.uuid}:${m.castShadow}:${m.receiveShadow}`;
      if (!groups.has(key))
        groups.set(key, {
          material: m.material,
          cast: m.castShadow,
          receive: m.receiveShadow,
          geometries: [],
        });
      groups.get(key).geometries.push(geo);
      remove.push(m);
    });
    for (const m of remove) {
      m.parent.remove(m);
      m.geometry.dispose();
    }
    for (const { material, cast, receive, geometries } of groups.values()) {
      const combined = mergeGeometries(geometries);
      const mesh = new THREE.Mesh(combined, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      this.land.add(mesh);
      geometries.forEach((g) => g.dispose());
    }
  }
  load(index) {
    this.index = index;
    const world = WORLDS[index];
    this.near = null;
    this.cb.near?.(null);
    this.blockers = [];
    this.platforms = [];
    this.entities = [];
    this.seeds = [];
    this.moveTarget = null;
    this.velocityY = 0;
    this.yaw = 0;
    // Release geometry and transient label textures when leaving a world.
    this.land.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.isSprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
    this.land.clear();
    this.scene.background = new THREE.Color(world.sky);
    this.scene.fog = new THREE.Fog(world.sky, 52, 135);
    cylinder(this.land, "#9fbb8c", 0, -1.1, 0, 34, 2, 80);
    cylinder(this.land, world.ground, 0, -0.2, 0, 33.5, 0.4, 80);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      mat(world.water, { roughness: 0.35, metalness: 0.06 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -1.45;
    sea.receiveShadow = true;
    this.land.add(sea);
    this.path(
      [
        [0, 24],
        [0, 15],
        [-6, 10],
        [-10, 8],
        [-5, 1],
        [7, 0],
        [10, -1],
        [5, -8],
        [-5, -13],
        [0, -19],
      ],
      index === 3 ? "#d9d8c6" : "#e8d7b0",
    );
    const random = seeded(321 + index * 70);
    for (let i = 0; i < 38; i++) {
      const a = (i / 38) * Math.PI * 2;
      const r = 24 + random() * 6;
      const x = Math.sin(a) * r,
        z = Math.cos(a) * r;
      if (z < -19 && Math.abs(x) < 9) continue;
      this.tree(
        x,
        z,
        0.7 + random() * 0.8,
        index === 1
          ? ["#aeb98a", "#ada4c6", "#97bcac"][i % 3]
          : index === 3
            ? ["#d0ae75", "#aaa974", "#c2bb79"][i % 3]
            : ["#8fb786", "#76a681", "#a4bf88"][i % 3],
        i % 4 === 0 ? "pine" : "round",
      );
    }
    for (const [x, z] of [
      [-17, 5],
      [16, -6],
      [-16, -12],
      [16, 16],
    ])
      this.tree(x, z, 0.85, index === 1 ? "#b5a4c7" : "#8cb686");
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 65 + random() * 25;
      const m = cone(
        this.land,
        ["#adcbbe", "#bdcfc8", "#a9c5c7"][i % 3],
        Math.sin(a) * r,
        -3,
        Math.cos(a) * r,
        12 + random() * 12,
        20 + random() * 30,
        5,
      );
      m.rotation.y = random() * 2;
    }
    // Small flowers are instanced to keep the garden light on mobile GPUs.
    const flowerColors = ["#fff0d2", "#e4a8ba", "#cfb1d4", "#f7d77f"];
    for (const col of flowerColors) {
      const inst = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.1, 5, 4),
        mat(col),
        110,
      );
      const d = new THREE.Object3D();
      for (let i = 0; i < 110; i++) {
        const a = random() * Math.PI * 2,
          r = 12 + random() * 20;
        d.position.set(Math.sin(a) * r, 0.16, Math.cos(a) * r);
        d.scale.set(1, 0.65, 1);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
      }
      this.land.add(inst);
    }
    for (let i = 0; i < 14; i++) {
      const a = random() * Math.PI * 2,
        r = 21 + random() * 11;
      ball(
        this.land,
        "#b8c1ad",
        Math.sin(a) * r,
        0.22,
        Math.cos(a) * r,
        0.5 + random() * 0.7,
        0.35,
        0.5,
      );
    }
    if (index === 3) this.cottage();
    else this.castle(0, index === 4 ? -17 : -25);
    if (index === 1) {
      for (const [i, color] of [
        "#e7a3bf",
        "#eedb8c",
        "#a8d0ac",
        "#9bc8dc",
        "#b6a5d4",
      ].entries()) {
        const rainbow = new THREE.Mesh(
          new THREE.TorusGeometry(7 - i * 0.3, 0.14, 8, 64, Math.PI),
          mat(color),
        );
        rainbow.position.set(0, 3, -20);
        this.land.add(rainbow);
      }
    }
    if (index === 2) {
      const pond = new THREE.Mesh(
        new THREE.CircleGeometry(6.3, 48),
        mat("#6dbac8", { roughness: 0.25, metalness: 0.12 }),
      );
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(15, 0.07, 12);
      this.land.add(pond);
      for (let i = 0; i < 5; i++) {
        const x = 11 + i * 2,
          z = 12 + Math.sin(i) * 2;
        cylinder(this.land, "#9ebc91", x, 0.2, z, 0.85, 0.35);
        this.platforms.push({ x, z, r: 0.85, h: 0.38 });
      }
      for (let i = 0; i < 5; i++)
        ball(this.land, "#f0b4cc", 10 + i * 1.9, 0.18, 16, 0.2, 0.13, 0.2);
    }
    // Three low stepping stones reward jumping without gating reading access.
    for (let i = 0; i < 3; i++) {
      const x = -17 + i * 2,
        z = 16 - i * 1.3,
        h = 0.4 + i * 0.45;
      cylinder(this.land, "#d8d3b4", x, h / 2, z, 1, h);
      this.platforms.push({ x, z, r: 1, h });
    }
    this.mergeScenery();
    this.guide = makeCharacter(world.guide);
    this.guide.position.set(3.5, 0, 11);
    this.guide.rotation.y = -0.35;
    this.land.add(this.guide);
    const guideLabel = label(
      world.guide[0].toUpperCase() + world.guide.slice(1) + " · say hello",
    );
    guideLabel.position.set(3.5, 3.4, 11);
    this.land.add(guideLabel);
    this.entities.push({
      id: "guide",
      type: "guide",
      position: this.guide.position,
      radius: 3.3,
    });
    for (const [i, task] of world.tasks.entries()) {
      const [x, z] = task.position;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      this.land.add(g);
      cylinder(g, "#dfd9bd", 0, 0.14, 0, 0.95, 0.28, 16);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.9, 0.06, 8, 40),
        mat("#f7d98f"),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.32;
      g.add(ring);
      const book = new THREE.Group();
      book.position.y = 1.55;
      book.rotation.y = -0.2;
      const cover = box(
        book,
        ["#cc9dbe", "#86b9bc", "#b1a1cc"][i],
        0,
        0,
        0,
        0.88,
        0.12,
        0.75,
      );
      cover.rotation.z = -0.1;
      box(book, "#fff5d9", -0.23, 0.09, 0, 0.43, 0.12, 0.65).rotation.z = 0.15;
      box(book, "#fff5d9", 0.23, 0.09, 0, 0.43, 0.12, 0.65).rotation.z = -0.15;
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.15),
        mat("#f7d887", { emissive: "#e8b858", emissiveIntensity: 0.25 }),
      );
      star.position.set(0, 0.45, 0);
      book.add(star);
      g.add(book);
      const tag = label(`${i + 1} · ${task.title}`);
      tag.position.set(0, 2.8, 0);
      g.add(tag);
      this.entities.push({
        id: task.id,
        type: "task",
        task,
        position: g.position,
        book,
        ring,
        label: tag,
        radius: 3,
      });
    }
    SEED_POSITIONS.forEach(([x, z], i) => {
      const id = `${index}-${i}`;
      if (this.progress.seeds.includes(id)) return;
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24),
        mat("#f5d78a", { emissive: "#d8a840", emissiveIntensity: 0.25 }),
      );
      m.position.set(x, 0.8, z);
      m.castShadow = true;
      this.land.add(m);
      this.seeds.push({ id, mesh: m });
    });
    if (index === 4) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        mat("#eff4ff", {
          metalness: 0.45,
          roughness: 0.25,
          emissive: "#b7c7e3",
          emissiveIntensity: 0.4,
        }),
      );
      star.position.set(0, 1.8, -8);
      this.land.add(star);
      this.entities.push({
        id: "final",
        type: "final",
        position: new V(0, 0, -8),
        book: star,
        radius: 3,
      });
      const tag = label("Kit’s silver star");
      tag.position.set(0, 3.5, -8);
      this.land.add(tag);
    }
    this.player.position.set(0, 0, 16);
    this.player.rotation.y = Math.PI;
    this.lily.position.set(1.5, 0, 17);
    this.camera.position.set(0, 16, 36);
    this.camera.lookAt(0, 0, 9);
    this.refresh();
  }
  refresh() {
    for (const e of this.entities) {
      if (e.type === "task") {
        const done = this.progress.completed.includes(e.id);
        e.book.visible = !done;
        e.ring.material = mat(done ? "#9ecab0" : "#f7d98f");
      }
    }
  }
  setActive(active) {
    this.active = active;
    this.keys.clear();
    this.joystick = { x: 0, y: 0 };
    if (!active) this.moveTarget = null;
  }
  jump() {
    if (this.grounded) {
      this.velocityY = 8.7;
      this.grounded = false;
      this.cb.jump?.();
    }
  }
  interact() {
    if (this.near) this.cb.interact(this.near);
  }
  teleport(x, z) {
    this.player.position.set(x, 0, z);
    this.moveTarget = null;
  }
  updatePeers(peers) {
    const ids = new Set();
    for (const p of peers) {
      if (p.world !== this.index) continue;
      ids.add(p.id);
      let obj = this.peers.get(p.id);
      if (!obj) {
        const mesh = makeCharacter("maisie");
        const tag = label(p.name);
        tag.position.y = 3.3;
        mesh.add(tag);
        this.scene.add(mesh);
        obj = { mesh, target: new V(), rotation: 0 };
        this.peers.set(p.id, obj);
      }
      obj.target.set(p.x, p.y, p.z);
      obj.rotation = p.rotation;
    }
    for (const [id, obj] of this.peers)
      if (!ids.has(id)) {
        this.scene.remove(obj.mesh);
        obj.mesh.traverse((m) => {
          m.geometry?.dispose();
          if (m.isSprite) {
            m.material.map?.dispose();
            m.material.dispose();
          }
        });
        this.peers.delete(id);
      }
  }
  frame(now) {
    if (this.stopped) return;
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - this.last) / 1000, 0.04);
    this.last = now;
    this.time += dt;
    const t = this.time;
    let moving = false;
    if ((!this.active || document.hidden) && now - (this.lastRender || 0) < 240)
      return;
    this.lastRender = now;
    if (this.active) {
      let dx =
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
        this.joystick.x;
      let dz =
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) +
        this.joystick.y;
      if (dx || dz) this.moveTarget = null;
      if (this.moveTarget) {
        dx = this.moveTarget.x - this.player.position.x;
        dz = this.moveTarget.z - this.player.position.z;
        if (Math.hypot(dx, dz) < 0.3) {
          this.moveTarget = null;
          dx = dz = 0;
        }
      }
      const len = Math.hypot(dx, dz);
      moving = len > 0.05;
      if (moving) {
        dx /= Math.max(1, len);
        dz /= Math.max(1, len);
        const speed = this.keys.has("ShiftLeft") ? 7.8 : 5.5;
        const next = this.player.position
          .clone()
          .add(new V(dx * speed * dt, 0, dz * speed * dt));
        if (Math.hypot(next.x, next.z) < 32.3) {
          const blocked = this.blockers.some(
            (b) => Math.hypot(next.x - b.x, next.z - b.z) < b.r + 0.3,
          );
          if (!blocked) this.player.position.copy(next);
        }
        this.player.rotation.y = Math.atan2(dx, dz);
      }
      let floor = 0;
      for (const p of this.platforms) {
        if (
          Math.hypot(
            this.player.position.x - p.x,
            this.player.position.z - p.z,
          ) <
            p.r + 0.15 &&
          this.player.position.y >= p.h - 0.2
        )
          floor = Math.max(floor, p.h);
      }
      this.velocityY -= 22 * dt;
      this.player.position.y += this.velocityY * dt;
      if (this.player.position.y <= floor) {
        this.player.position.y = floor;
        this.velocityY = 0;
        this.grounded = true;
      } else this.grounded = false;
      for (const seed of this.seeds) {
        if (
          seed.mesh.visible &&
          seed.mesh.position.distanceTo(
            this.player.position.clone().add(new V(0, 0.8, 0)),
          ) < 1.15
        ) {
          seed.mesh.visible = false;
          this.cb.collect(seed.id);
        }
      }
      let nearest = null,
        distance = Infinity;
      for (const e of this.entities) {
        const d = Math.hypot(
          e.position.x - this.player.position.x,
          e.position.z - this.player.position.z,
        );
        if (d < e.radius && d < distance) {
          nearest = e;
          distance = d;
        }
      }
      if (nearest?.id !== this.near?.id) {
        this.near = nearest;
        this.cb.near(nearest);
      }
      this.cb.position?.(
        {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          rotation: this.player.rotation.y,
          world: this.index,
        },
        t,
      );
    }
    const lilyTarget = this.player.position.clone().add(new V(1.1, 0, 1.3));
    lilyTarget.y = 0;
    const ld = lilyTarget.distanceTo(this.lily.position);
    if (ld > 0.15) {
      const dir = lilyTarget.clone().sub(this.lily.position);
      this.lily.position.addScaledVector(dir, Math.min(1, dt * 3.3));
      this.lily.rotation.y = Math.atan2(dir.x, dir.z);
    }
    animateCharacter(this.player, t, moving, this.progress.reducedMotion);
    animateCharacter(this.lily, t, ld > 0.4, this.progress.reducedMotion);
    animateCharacter(this.guide, t, false, this.progress.reducedMotion);
    for (const e of this.entities) {
      if (e.book && !this.progress.reducedMotion) {
        e.book.position.y =
          (e.type === "final" ? 1.8 : 1.55) +
          Math.sin(t * 2 + e.position.x) * 0.14;
        e.book.rotation.y = t * 0.35;
      }
    }
    for (const seed of this.seeds) {
      if (!this.progress.reducedMotion) {
        seed.mesh.rotation.y = t;
        seed.mesh.position.y =
          0.9 + Math.sin(t * 2 + seed.mesh.position.x) * 0.12;
      }
    }
    for (const peer of this.peers.values()) {
      const dist = peer.mesh.position.distanceTo(peer.target);
      peer.mesh.position.lerp(peer.target, Math.min(1, dt * 12));
      peer.mesh.rotation.y = peer.rotation;
      animateCharacter(peer.mesh, t, dist > 0.1, this.progress.reducedMotion);
    }
    const cameraTarget = this.player.position.clone().add(new V(0, 13.7, 19.5));
    this.camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4));
    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y + 0.3,
      this.player.position.z - 4.2,
    );
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      this.cb.graphicsLost?.();
    }
  }
}
