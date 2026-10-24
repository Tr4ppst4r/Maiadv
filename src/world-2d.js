import { WORLDS, SEED_POSITIONS } from "./content.js";
import { portrait } from "./icons.js";

// A complete canvas renderer for devices that cannot create a WebGL2 context.
// It shares the regular lesson, progression, save, and private-room callbacks.
export class World2D {
  constructor(container, callbacks, progress) {
    this.cb = callbacks;
    this.progress = progress;
    this.active = false;
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.player = { position: { x: 0, y: 0, z: 16 }, rotation: { y: Math.PI } };
    this.peers = new Map();
    this.time = 0;
    this.velocityY = 0;
    this.abort = new AbortController();
    this.canvas = document.createElement("canvas");
    this.canvas.tabIndex = 0;
    this.canvas.dataset.renderer = "2d";
    this.canvas.setAttribute(
      "aria-label",
      "Magic Kingdom in simple graphics mode. Use arrow keys to move, Space to jump, and E to read.",
    );
    this.context = this.canvas.getContext("2d");
    if (!this.context)
      throw new Error("This browser cannot create a drawing canvas.");
    container.replaceChildren(this.canvas);
    this.portraits = {};
    for (const kind of ["maisie", "lily", "kit", "luna", "axel", "clover"]) {
      const img = new Image();
      img.src =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          portrait(kind).replace(
            "<svg ",
            '<svg xmlns="http://www.w3.org/2000/svg" ',
          ),
        );
      this.portraits[kind] = img;
    }
    this.load(progress.world);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const options = { signal: this.abort.signal };
    window.addEventListener(
      "keydown",
      (e) => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (
          this.active &&
          ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            e.code,
          )
        )
          e.preventDefault();
        this.keys.add(e.code);
        if (this.active && !e.repeat && e.code === "Space") this.jump();
        if (this.active && !e.repeat && e.code === "KeyE") this.interact();
      },
      options,
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), options);
    window.addEventListener("blur", () => this.keys.clear(), options);
    document.addEventListener(
      "visibilitychange",
      () => this.keys.clear(),
      options,
    );
    this.canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active) return;
        const r = this.canvas.getBoundingClientRect();
        const x =
          (e.clientX - r.left - this.width / 2) / this.scale +
          this.player.position.x;
        const z =
          (e.clientY - r.top - this.height * 0.57) / (this.scale * 0.7) +
          this.player.position.z;
        if (Math.hypot(x, z) < 32) this.target = { x, z };
      },
      options,
    );
    this.last = performance.now();
    requestAnimationFrame((now) => this.frame(now));
  }
  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    this.width = Math.max(1, r.width);
    this.height = Math.max(1, r.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.scale = Math.max(15, Math.min(25, this.width / 38));
  }
  load(index) {
    this.index = index;
    this.entities = WORLDS[index].tasks.map((task) => ({
      id: task.id,
      type: "task",
      task,
      position: { x: task.position[0], z: task.position[1] },
      radius: 3,
    }));
    this.entities.push({
      id: "guide",
      type: "guide",
      position: { x: 3.5, z: 11 },
      radius: 3.3,
    });
    if (index === 4)
      this.entities.push({
        id: "final",
        type: "final",
        position: { x: 0, z: -8 },
        radius: 3,
      });
    this.seeds = SEED_POSITIONS.map(([x, z], i) => ({
      id: `${index}-${i}`,
      x,
      z,
    }));
    this.near = null;
    this.target = null;
    this.cb.near(null);
    this.teleport(0, 16);
  }
  refresh() {}
  setActive(active) {
    this.active = active;
    this.keys.clear();
    this.joystick = { x: 0, y: 0 };
    this.target = null;
  }
  teleport(x, z) {
    Object.assign(this.player.position, { x, y: 0, z });
    this.velocityY = 0;
    this.target = null;
  }
  jump() {
    if (this.player.position.y === 0) this.velocityY = 8.7;
  }
  interact() {
    if (this.near) this.cb.interact(this.near);
  }
  updatePeers(players) {
    this.peers = new Map(
      players.filter((p) => p.world === this.index).map((p) => [p.id, p]),
    );
  }
  point(x, z) {
    return {
      x: (x - this.player.position.x) * this.scale + this.width / 2,
      y: (z - this.player.position.z) * this.scale * 0.7 + this.height * 0.57,
    };
  }
  ellipse(x, z, rx, rz, color) {
    const p = this.point(x, z),
      c = this.context;
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(
      p.x,
      p.y,
      rx * this.scale,
      rz * this.scale * 0.7,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  star(x, y, r, color) {
    const c = this.context;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        length = i % 2 ? r * 0.47 : r;
      if (i) c.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
      else c.moveTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
    }
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }
  character(kind, x, z, name, jump = 0) {
    const c = this.context,
      p = this.point(x, z),
      size = kind === "maisie" ? 62 : 47;
    this.ellipse(x, z, 0.75, 0.4, "#345b3f26");
    const img = this.portraits[kind];
    if (img?.complete && img.naturalWidth)
      c.drawImage(
        img,
        p.x - size / 2,
        p.y - size - jump * this.scale,
        size,
        size,
      );
    if (name) {
      c.font = "600 12px 'DM Sans', sans-serif";
      c.textAlign = "center";
      c.fillStyle = "#355b46";
      c.fillText(name, p.x, p.y - size - 10 - jump * this.scale);
    }
  }
  draw() {
    const c = this.context,
      world = WORLDS[this.index];
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = world.water;
    c.fillRect(0, 0, this.width, this.height);
    this.ellipse(0, 0, 34, 34, "#8ba97c");
    this.ellipse(0, -0.5, 33.5, 33.5, world.ground);
    c.beginPath();
    [
      [0, 23],
      [-10, 9],
      [10, 0],
      [-5, -13],
      [0, -22],
    ].forEach(([x, z], i) => {
      const p = this.point(x, z);
      i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
    });
    c.lineWidth = this.scale * 2.6;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#e9dab4";
    c.stroke();
    for (let i = 0; i < 150; i++) {
      const a = i * 2.39996,
        r = 9 + ((i * 7) % 23);
      this.ellipse(
        Math.sin(a) * r,
        Math.cos(a) * r,
        0.12,
        0.12,
        ["#ffedb1", "#dfabc6", "#fff8e8"][i % 3],
      );
    }
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2,
        x = Math.sin(a) * 28,
        z = Math.cos(a) * 28,
        p = this.point(x, z);
      c.fillStyle = "#947b5d";
      c.fillRect(p.x - 5, p.y - 33, 10, 35);
      c.fillStyle =
        this.index === 1 ? ["#a99dc2", "#86ad8a"][i % 2] : "#7fa57a";
      c.beginPath();
      c.ellipse(p.x, p.y - 42, 29, 35, 0, 0, Math.PI * 2);
      c.fill();
    }
    const home = this.point(0, -23);
    c.fillStyle = "#f5e7d2";
    c.fillRect(home.x - 70, home.y - 75, 140, 75);
    for (let i = -1; i <= 1; i++) {
      c.fillStyle = "#e6dfcf";
      c.fillRect(home.x + i * 58 - 16, home.y - 100, 32, 100);
      c.fillStyle = "#afa1c6";
      c.beginPath();
      c.moveTo(home.x + i * 58 - 25, home.y - 100);
      c.lineTo(home.x + i * 58, home.y - 140);
      c.lineTo(home.x + i * 58 + 25, home.y - 100);
      c.closePath();
      c.fill();
    }
    c.fillStyle = "#af99b7";
    c.fillRect(home.x - 16, home.y - 40, 32, 40);
    for (const s of this.seeds) {
      if (this.progress.seeds.includes(s.id)) continue;
      const p = this.point(s.x, s.z);
      this.star(p.x, p.y - 10, 8, "#f6d77f");
    }
    for (const e of this.entities) {
      const p = this.point(e.position.x, e.position.z);
      if (e.type === "guide") {
        this.character(
          world.guide,
          e.position.x,
          e.position.z,
          world.guide[0].toUpperCase() + world.guide.slice(1),
        );
        continue;
      }
      this.ellipse(e.position.x, e.position.z, 1.1, 0.7, "#fff8d6aa");
      if (e.type === "final") this.star(p.x, p.y - 25, 24, "#f2f4ff");
      else {
        c.fillStyle = this.progress.completed.includes(e.id)
          ? "#7eac8b"
          : "#bd99be";
        c.fillRect(p.x - 23, p.y - 37, 46, 27);
        c.fillStyle = "#fff7e2";
        c.fillRect(p.x - 19, p.y - 39, 17, 24);
        c.fillRect(p.x + 2, p.y - 39, 17, 24);
        c.fillStyle = "#3e604d";
        c.font = "600 12px 'DM Sans', sans-serif";
        c.textAlign = "center";
        c.fillText(e.task.title, p.x, p.y - 51);
      }
    }
    for (const p of this.peers.values())
      this.character("maisie", p.x, p.z, p.name, p.y);
    this.character(
      "lily",
      this.player.position.x + 1.5,
      this.player.position.z + 1.1,
      "Lily",
    );
    this.character(
      "maisie",
      this.player.position.x,
      this.player.position.z,
      "",
      this.player.position.y,
    );
  }
  frame(now) {
    if (this.stopped) return;
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.time += dt;
    const p = this.player.position;
    if (this.active) {
      let dx =
        Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
        Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
        this.joystick.x;
      let dz =
        Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
        Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) +
        this.joystick.y;
      if (dx || dz) this.target = null;
      if (this.target) {
        dx = this.target.x - p.x;
        dz = this.target.z - p.z;
        if (Math.hypot(dx, dz) < 0.25) {
          this.target = null;
          dx = dz = 0;
        }
      }
      const length = Math.max(1, Math.hypot(dx, dz));
      dx /= length;
      dz /= length;
      const speed = this.keys.has("ShiftLeft") ? 7.8 : 5.5;
      if (Math.hypot(p.x + dx * speed * dt, p.z + dz * speed * dt) < 32.3) {
        p.x += dx * speed * dt;
        p.z += dz * speed * dt;
      }
      if (dx || dz) this.player.rotation.y = Math.atan2(dx, dz);
      this.velocityY -= 22 * dt;
      p.y = Math.max(0, p.y + this.velocityY * dt);
      if (!p.y) this.velocityY = 0;
      for (const seed of this.seeds)
        if (
          !this.progress.seeds.includes(seed.id) &&
          Math.hypot(p.x - seed.x, p.z - seed.z) < 1.1
        )
          this.cb.collect(seed.id);
      const near =
        this.entities
          .filter(
            (e) =>
              Math.hypot(p.x - e.position.x, p.z - e.position.z) < e.radius,
          )
          .sort(
            (a, b) =>
              Math.hypot(p.x - a.position.x, p.z - a.position.z) -
              Math.hypot(p.x - b.position.x, p.z - b.position.z),
          )[0] || null;
      if (near?.id !== this.near?.id) {
        this.near = near;
        this.cb.near(near);
      }
      this.cb.position(
        { ...p, rotation: this.player.rotation.y, world: this.index },
        this.time,
      );
    }
    this.draw();
  }
  destroy() {
    this.stopped = true;
    this.active = false;
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }
}
