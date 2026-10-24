import { test, expect } from "@playwright/test";
import { WORLDS } from "../src/content.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function disableGraphicsAndSpeech(page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (String(kind).includes("webgl")) return null;
      return original.call(this, kind, ...args);
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {
          throw new Error("Speech is unavailable");
        },
        speak() {
          throw new Error("Speech is unavailable");
        },
        getVoices() {
          return [];
        },
      },
    });
  });
}

test("all reading worlds remain playable when WebGL and speech are unavailable", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await disableGraphicsAndSpeech(page);
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Let’s go exploring" }).click();
  await expect(page.locator('#scene canvas[data-renderer="2d"]')).toBeVisible();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyW");
  expect(
    await page.evaluate(() => window.__game.game.player.position.z),
  ).toBeLessThan(16);
  for (const [index, world] of WORLDS.entries()) {
    if (index) {
      await page
        .getByRole("button", { name: "World map", exact: true })
        .first()
        .click();
      await page
        .locator(`[data-action="travel"][data-index="${index}"]`)
        .click();
    }
    for (const task of world.tasks) {
      await page.evaluate(
        ({ position }) => window.__game.game.teleport(...position),
        task,
      );
      await expect
        .poll(() => page.evaluate(() => window.__game.game.near?.id))
        .toBe(task.id);
      await page.keyboard.press("KeyE");
      await expect(page.locator("#modal-title")).toHaveText(task.prompt);
      if (task.choices)
        await page.locator(`[data-answer="${task.answer}"]`).click();
      else
        for (const part of task.type === "order"
          ? task.answer.split(" ")
          : [...task.answer])
          await page.getByRole("button", { name: part, exact: true }).click();
      await expect(page.locator("#modal-title")).toHaveText(
        "You made a little magic!",
      );
      await page.getByRole("button", { name: "Keep exploring" }).click();
    }
  }
  await expect(page.locator("#stars")).toHaveText("12");
  await page.evaluate(() => window.__game.game.teleport(0, -8));
  await expect(page.locator("#near-text")).toContainText("silver star");
  await page.keyboard.press("KeyE");
  await page.getByRole("button", { name: "Give everyone a hug" }).click();
  await page.getByRole("button", { name: "Follow the silver light" }).click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Goodnight, Magic Kingdom.",
  );
  await page.reload();
  await page.getByRole("button", { name: "Continue my adventure" }).click();
  await expect(page.locator("#stars")).toHaveText("12");
  expect(errors).toEqual([]);
});

test("lost 3D context switches to playable canvas and preserves rewards", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?test=1");
  await page.getByRole("button", { name: "Let’s go exploring" }).click();
  await page.evaluate(() => window.__game.game.teleport(-10, 9));
  await expect(page.locator("#near-prompt")).toBeVisible();
  await page.keyboard.press("KeyE");
  await page.locator('[data-answer="cat"]').click();
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.evaluate(() =>
    window.__game.game.renderer
      .getContext()
      .getExtension("WEBGL_lose_context")
      .loseContext(),
  );
  await expect(page.locator('#scene canvas[data-renderer="2d"]')).toBeVisible();
  await expect(page.locator("#stars")).toHaveText("1");
  await page.evaluate(() => window.__game.game.teleport(10, 0));
  await expect
    .poll(() => page.evaluate(() => window.__game.game.near?.id))
    .toBe("kit-sun");
  await page.keyboard.press("KeyE");
  await page.locator('[data-answer="sun"]').click();
  await expect(page.locator("#stars")).toHaveText("2");
  expect(errors).toEqual([]);
});

test("production website starts under a subdirectory on a touch device", async ({
  browser,
}) => {
  const dist = path.resolve("dist");
  const server = http.createServer(async (req, res) => {
    const relative = new URL(req.url, "http://example.test").pathname.replace(
      /^\/Maiadv\//,
      "",
    );
    const file = path.resolve(dist, relative || "index.html");
    if (!file.startsWith(dist + path.sep)) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".svg": "image/svg+xml",
      };
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await disableGraphicsAndSpeech(page);
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/Maiadv/`);
    await page.getByRole("button", { name: "Let’s go exploring" }).click();
    await expect(
      page.locator('#scene canvas[data-renderer="2d"]'),
    ).toBeVisible();
    await expect(page.locator("#joystick")).toBeVisible();
    await page
      .getByRole("button", { name: "World map", exact: true })
      .first()
      .click();
    await expect(page.locator(".world-card")).toHaveCount(5);
    expect(await page.evaluate(() => typeof window.__game)).toBe("undefined");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("blocked JavaScript displays browser launch guidance rather than a blank page", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("noscript p")).toBeVisible();
    await expect(
      page.getByText("A file preview cannot run the game.", { exact: false }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
