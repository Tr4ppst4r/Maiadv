import * as THREE from "three";

const materials = new Map();
export function mat(color, extra = {}) {
  if (Object.keys(extra).length)
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
    );
  return materials.get(color);
}
export function ball(parent, color, x, y, z, sx, sy = sx, sz = sx) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(parent, color, x, y, z, sx, sy, sz, radius = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cone(parent, color, x, y, z, radius, height, segments = 8) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, segments),
    mat(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function eyes(g, y, z, spread, color = "#3d6847") {
  for (const sign of [-1, 1]) {
    ball(g, "#fffef5", sign * spread, y, z, 0.105, 0.14, 0.06);
    ball(g, color, sign * spread, y, z + 0.045, 0.065, 0.095, 0.04);
    ball(g, "#fff", sign * spread - 0.018, y + 0.032, z + 0.078, 0.022);
  }
}
function heart(g, color, x, y, z, size) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  ball(h, color, -0.25 * size, 0.15 * size, 0, 0.38 * size);
  ball(h, color, 0.25 * size, 0.15 * size, 0, 0.38 * size);
  const p = cone(h, color, 0, -0.2 * size, 0, 0.47 * size, 0.65 * size);
  p.rotation.z = Math.PI;
  g.add(h);
}
function limb(g, color, x, y, z, sx, sy, sz) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  ball(pivot, color, 0, -sy * 0.65, 0, sx, sy, sz);
  g.add(pivot);
  return pivot;
}

export function makeCharacter(kind = "maisie") {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let legs = [],
    arms = [];
  if (kind === "maisie") {
    ball(body, "#e8b189", 0, 2.07, 0, 0.47, 0.52, 0.42);
    ball(body, "#754329", 0, 2.26, -0.13, 0.53, 0.5, 0.4);
    for (let i = 0; i < 10; i++) {
      const a = (i / 9) * Math.PI;
      ball(
        body,
        i % 2 ? "#864b2c" : "#6d3823",
        Math.cos(a) * 0.46,
        2.22 + Math.sin(a) * 0.22,
        -0.12,
        0.22,
        0.23,
        0.23,
      );
    }
    for (const s of [-1, 1])
      for (let i = 0; i < 4; i++)
        ball(
          body,
          i % 2 ? "#864b2c" : "#754329",
          s * (0.44 + 0.025 * Math.sin(i)),
          2.04 - i * 0.18,
          -0.06,
          0.19,
          0.22,
          0.23,
        );
    ball(body, "#864b2c", -0.15, 2.45, 0.28, 0.28, 0.17, 0.18);
    ball(body, "#754329", 0.17, 2.48, 0.23, 0.29, 0.18, 0.19);
    eyes(body, 2.12, 0.371, 0.17);
    ball(body, "#e9a08f", -0.3, 1.99, 0.34, 0.065, 0.035, 0.03);
    ball(body, "#e9a08f", 0.3, 1.99, 0.34, 0.065, 0.035, 0.03);
    ball(body, "#ce8e78", 0, 1.94, 0.401, 0.09, 0.025, 0.014);
    for (const s of [-1, 1]) {
      ball(body, "#bda072", s * 0.26, 2.015, 0.385, 0.014);
      ball(body, "#bda072", s * 0.31, 2.025, 0.36, 0.014);
    }
    ball(body, "#f3ca57", 0, 1.27, 0, 0.38, 0.51, 0.27);
    ball(body, "#3e7494", 0, 1.02, 0.01, 0.39, 0.35, 0.28);
    box(body, "#447f9e", 0, 1.35, 0.255, 0.47, 0.45, 0.07);
    for (const s of [-1, 1]) {
      box(body, "#3e7494", s * 0.24, 1.54, 0.21, 0.09, 0.39, 0.07);
      ball(body, "#f4ce6a", s * 0.24, 1.52, 0.265, 0.035);
    }
    box(body, "#6091a9", 0, 1.26, 0.306, 0.22, 0.16, 0.018);
    for (const s of [-1, 1]) {
      legs.push(limb(body, "#efbd92", s * 0.21, 0.82, 0, 0.13, 0.32, 0.14));
      ball(legs.at(-1), "#f9f3e2", 0, -0.45, 0, 0.13, 0.09, 0.15);
      ball(legs.at(-1), "#92658d", 0, -0.56, 0.055, 0.17, 0.13, 0.25);
      ball(legs.at(-1), "#f9f3e2", 0, -0.62, 0.065, 0.175, 0.045, 0.25);
      const arm = limb(body, "#e8b189", s * 0.43, 1.51, 0, 0.105, 0.31, 0.12);
      ball(arm, "#f3ca57", 0, -0.02, 0, 0.15, 0.2, 0.17);
      arms.push(arm);
    }
    ball(body, "#b980b5", 0.41, 2.48, 0.17, 0.16, 0.11, 0.1);
    ball(body, "#a76ba5", 0.55, 2.4, 0.16, 0.1, 0.16, 0.1);
  } else if (kind === "lily" || kind === "clover" || kind === "mama") {
    const color =
      kind === "lily" ? "#fcf7e8" : kind === "mama" ? "#aaa09b" : "#858388";
    ball(body, color, 0, 0.5, 0, 0.3, 0.38, 0.5);
    ball(body, color, 0, 0.88, 0.31, 0.36, 0.34, 0.31);
    cone(body, color, -0.24, 1.18, 0.31, 0.15, 0.38);
    cone(body, color, 0.24, 1.18, 0.31, 0.15, 0.38);
    cone(body, "#e3a8ac", -0.24, 1.19, 0.41, 0.085, 0.25);
    cone(body, "#e3a8ac", 0.24, 1.19, 0.41, 0.085, 0.25);
    eyes(body, 0.92, 0.583, 0.14);
    ball(body, "#ca919e", 0, 0.81, 0.62, 0.045, 0.035, 0.025);
    ball(body, "#fff8ed", 0, 0.38, 0.35, 0.2, 0.24, 0.17);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.27, 0.27])
        legs.push(limb(body, color, x, 0.38, z, 0.1, 0.2, 0.11));
    const tail = ball(body, color, 0.1, 0.7, -0.57, 0.09, 0.35, 0.1);
    tail.rotation.x = -0.5;
    if (kind === "lily") {
      ball(body, "#8c6ca7", 0, 0.66, 0.32, 0.32, 0.055, 0.27);
      heart(body, "#e6bd5e", 0, 0.58, 0.57, 0.13);
    }
    if (kind === "mama") root.scale.setScalar(1.3);
  } else if (kind === "kit") {
    ball(body, "#68a9d4", 0, 0.74, 0, 0.43, 0.6, 0.34);
    ball(body, "#fff7e5", 0, 0.7, 0.26, 0.3, 0.4, 0.13);
    ball(body, "#78b7df", 0, 1.48, 0.02, 0.47, 0.46, 0.39);
    for (const s of [-1, 1]) {
      const ear = ball(
        body,
        "#73b0dc",
        s * 0.24,
        2.13,
        -0.02,
        0.145,
        0.55,
        0.14,
      );
      ear.rotation.z = -s * 0.14;
      const inner = ball(
        body,
        "#e5a0ab",
        s * 0.24,
        2.15,
        0.102,
        0.073,
        0.39,
        0.04,
      );
      inner.rotation.z = -s * 0.14;
      legs.push(limb(body, "#68a9d4", s * 0.27, 0.36, 0.04, 0.18, 0.2, 0.27));
      arms.push(limb(body, "#68a9d4", s * 0.42, 1.05, 0, 0.13, 0.31, 0.15));
      ball(body, "#f8f5e7", s * 0.13, 1.31, 0.36, 0.17, 0.13, 0.1);
    }
    eyes(body, 1.53, 0.375, 0.17, "#355d7d");
    ball(body, "#d68f9a", 0, 1.37, 0.46, 0.06, 0.04, 0.035);
    ball(body, "#fffaed", 0, 0.58, -0.38, 0.21);
  } else if (kind === "luna") {
    ball(body, "#fffaf0", 0, 1.1, -0.15, 0.46, 0.48, 0.8);
    ball(body, "#fffaf0", 0, 1.57, 0.33, 0.32, 0.6, 0.32);
    ball(body, "#fffaf0", 0, 2.08, 0.43, 0.4, 0.48, 0.35);
    ball(body, "#f4e8e4", 0, 1.89, 0.72, 0.31, 0.22, 0.26);
    eyes(body, 2.14, 0.73, 0.17, "#39799d");
    for (const s of [-1, 1]) {
      cone(body, "#fffaf0", s * 0.24, 2.52, 0.29, 0.15, 0.42);
      for (const z of [-0.6, 0.35]) {
        legs.push(limb(body, "#fffaf0", s * 0.31, 0.86, z, 0.13, 0.4, 0.14));
        ball(legs.at(-1), "#d6b054", 0, -0.59, 0.02, 0.15, 0.11, 0.18);
      }
    }
    cone(body, "#edc367", 0, 2.66, 0.64, 0.11, 0.7);
    const rainbow = ["#e9a9c3", "#eed17c", "#a9cda1", "#88b8d4", "#b498ce"];
    for (let i = 0; i < 10; i++)
      ball(body, rainbow[i % 5], -0.18, 2.4 - i * 0.12, 0.05, 0.25, 0.23, 0.22);
    for (let i = 0; i < 8; i++)
      ball(
        body,
        rainbow[i % 5],
        Math.sin(i * 0.6) * 0.16,
        0.98 - i * 0.08,
        -0.87 - i * 0.08,
        0.19,
        0.21,
        0.2,
      );
    ball(body, "#e9bd59", 0, 1.51, 0.59, 0.29, 0.04, 0.2);
    heart(body, "#e9bd59", 0, 1.29, 0.63, 0.24);
    heart(body, "#c990c7", 0, 1.31, 0.69, 0.14);
  } else if (kind === "axel") {
    ball(body, "#f1aac1", 0, 0.64, 0, 0.38, 0.47, 0.3);
    ball(body, "#ffd2de", 0, 0.62, 0.24, 0.25, 0.34, 0.1);
    ball(body, "#f4b3c8", 0, 1.22, 0.03, 0.5, 0.38, 0.34);
    eyes(body, 1.25, 0.35, 0.2, "#3d535e");
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const fin = ball(
          body,
          "#e783aa",
          s * 0.51,
          1.07 + i * 0.17,
          -0.02,
          0.24,
          0.065,
          0.07,
        );
        fin.rotation.z = s * (i - 1) * 0.55;
        for (let j = 0; j < 3; j++)
          ball(
            body,
            "#ef94b3",
            s * (0.57 + j * 0.06),
            1.06 + i * 0.18 + j * 0.04,
            -0.02,
            0.045,
            0.09,
            0.055,
          );
      }
      legs.push(limb(body, "#e69bb9", s * 0.26, 0.3, 0.05, 0.16, 0.13, 0.2));
      arms.push(limb(body, "#efa5bd", s * 0.38, 0.8, 0.02, 0.12, 0.24, 0.13));
    }
    ball(body, "#e99cb9", 0, 0.42, -0.41, 0.15, 0.16, 0.41);
    for (const s of [-1, 1]) {
      const bow = cone(body, "#6595bf", s * 0.12, 0.94, 0.29, 0.13, 0.22, 3);
      bow.rotation.z = (s * Math.PI) / 2;
    }
    ball(body, "#7cafd4", 0, 0.94, 0.32, 0.07);
  }
  root.userData = { body, legs, arms, kind };
  return root;
}

export function animateCharacter(
  character,
  time,
  moving = false,
  reduced = false,
) {
  const { body, legs, arms, kind } = character.userData;
  if (!body) return;
  const stride = moving ? Math.sin(time * 11) * 0.5 : 0;
  legs.forEach((l, i) => (l.rotation.x = stride * (i % 2 ? 1 : -1)));
  arms.forEach((a, i) => (a.rotation.x = -stride * (i % 2 ? 1 : -1)));
  body.position.y = reduced
    ? 0
    : moving
      ? Math.abs(Math.sin(time * 11)) * 0.07
      : Math.sin(time * 2) * 0.025;
}
