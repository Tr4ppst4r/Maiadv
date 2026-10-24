import { ALL_TASKS, WORLDS } from "./content.js";
const validTasks = new Set(ALL_TASKS.map((t) => t.id));
export function freshProgress() {
  return {
    completed: [],
    seeds: [],
    spoken: [],
    world: 0,
    ending: false,
    sound: true,
    narration: true,
    reducedMotion: false,
    graphics: "auto",
  };
}
export function sanitizeProgress(value) {
  const p = freshProgress();
  if (!value || typeof value !== "object") return p;
  p.completed = [
    ...new Set(
      Array.isArray(value.completed)
        ? value.completed.filter((id) => validTasks.has(id))
        : [],
    ),
  ];
  p.spoken = [
    ...new Set(
      Array.isArray(value.spoken)
        ? value.spoken.filter(
            (id) => validTasks.has(id) && p.completed.includes(id),
          )
        : [],
    ),
  ];
  p.seeds = [
    ...new Set(
      Array.isArray(value.seeds)
        ? value.seeds.filter(
            (id) => typeof id === "string" && /^[0-4]-[0-9]$/.test(id),
          )
        : [],
    ),
  ];
  p.world =
    Number.isInteger(value.world) &&
    value.world >= 0 &&
    value.world < WORLDS.length &&
    WORLDS[value.world].requirement <= p.completed.length
      ? value.world
      : 0;
  p.ending = value.ending === true && p.completed.length === ALL_TASKS.length;
  if (value.graphics === "simple") p.graphics = "simple";
  for (const k of ["sound", "narration", "reducedMotion"])
    if (typeof value[k] === "boolean") p[k] = value[k];
  return p;
}
export function completeTask(progress, id) {
  if (!validTasks.has(id) || progress.completed.includes(id)) return false;
  const world = WORLDS.find((w) => w.tasks.some((t) => t.id === id));
  if (progress.completed.length < world.requirement) return false;
  progress.completed.push(id);
  return true;
}
export function worldOpen(progress, index) {
  return Boolean(
    WORLDS[index] && progress.completed.length >= WORLDS[index].requirement,
  );
}
export function loadProgress(storage, key) {
  try {
    return sanitizeProgress(JSON.parse(storage.getItem(key)));
  } catch {
    return freshProgress();
  }
}
