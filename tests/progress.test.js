import test from "node:test";
import assert from "node:assert/strict";
import {
  freshProgress,
  sanitizeProgress,
  completeTask,
  worldOpen,
  loadProgress,
} from "../src/progress.js";
import { ALL_TASKS, WORLDS } from "../src/content.js";

test("reading stars unlock the full journey in order, once per task", () => {
  const p = freshProgress();
  assert.equal(worldOpen(p, 1), false);
  assert.equal(completeTask(p, "luna-log"), false);
  for (const [index, w] of WORLDS.entries()) {
    assert.equal(worldOpen(p, index), true);
    for (const task of w.tasks) {
      assert.equal(completeTask(p, task.id), true);
      assert.equal(completeTask(p, task.id), false);
    }
  }
  assert.equal(p.completed.length, 12);
  assert.equal(worldOpen(p, 5), false);
});
test("saved progress rejects corrupted state and unknown rewards", () => {
  const p = sanitizeProgress({
    completed: ["kit-cat", "kit-cat", "imaginary"],
    seeds: ["0-1", "0-1", "99-4", "0-100"],
    spoken: ["kit-cat", "luna-log"],
    world: 4,
    ending: true,
  });
  assert.deepEqual(p.completed, ["kit-cat"]);
  assert.deepEqual(p.seeds, ["0-1"]);
  assert.deepEqual(p.spoken, ["kit-cat"]);
  assert.equal(p.world, 0);
  assert.equal(p.ending, false);
  assert.deepEqual(
    loadProgress(
      {
        getItem() {
          throw new Error("disabled");
        },
      },
      "x",
    ),
    freshProgress(),
  );
  assert.deepEqual(
    loadProgress(
      {
        getItem() {
          return "{broken";
        },
      },
      "x",
    ),
    freshProgress(),
  );
});
test("all reading activities have achievable, consistent answers", () => {
  assert.equal(new Set(ALL_TASKS.map((t) => t.id)).size, 12);
  for (const t of ALL_TASKS) {
    if (t.choices) assert.ok(t.choices.includes(t.answer), t.id);
    if (t.letters)
      assert.equal(
        [...t.letters].sort().join(""),
        [...t.answer].sort().join(""),
      );
    if (t.words)
      assert.deepEqual([...t.words].sort(), t.answer.split(" ").sort());
    assert.equal(t.chunks.join(""), t.word);
  }
});
