import { test, expect } from "@playwright/test";
import { WORLDS } from "../src/content.js";

test("complete reading adventure, speech fallback, persistence, and canonical ending", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test=1");
  await expect(page.getByText("Small words.")).toBeVisible();
  await page.getByRole("button", { name: "Let’s go exploring" }).click();
  await expect(page.locator("#scene canvas")).toBeVisible();
  const initialZ = await page.evaluate(
    () => window.__game.game.player.position.z,
  );
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  expect(
    await page.evaluate(() => window.__game.game.player.position.z),
  ).toBeLessThan(initialZ);
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__game.game.player.position.y))
    .toBeGreaterThan(0);
  await page.evaluate(() => window.__game.game.teleport(-3, 12));
  await expect(page.locator("#gems")).toHaveText("1");
  await page
    .getByRole("button", { name: "World map", exact: true })
    .first()
    .click();
  await expect(
    page.locator('[data-action="travel"][data-index="1"]'),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  for (const [index, w] of WORLDS.entries()) {
    if (!w.tasks.length) break;
    if (index) {
      await page
        .getByRole("button", { name: "World map", exact: true })
        .first()
        .click();
      await page
        .locator(`[data-action="travel"][data-index="${index}"]`)
        .click();
    }
    for (const task of w.tasks) {
      await page.evaluate(({ x, z }) => window.__game.game.teleport(x, z), {
        x: task.position[0],
        z: task.position[1] + 1,
      });
      await expect
        .poll(() => page.evaluate(() => window.__game.game.near?.id))
        .toBe(task.id);
      await expect(page.locator("#near-prompt")).toBeVisible();
      await page.locator("#near-prompt button").click();
      await expect(page.locator("#modal-title")).toHaveText(task.prompt);
      if (task.id === "kit-cat") {
        await page.locator('[data-answer="sun"]').click();
        await expect(page.locator("#lesson-feedback")).toContainText(
          "Good try",
        );
        expect(
          await page.evaluate(() => window.__game.progress.completed.length),
        ).toBe(0);
      }
      if (task.choices)
        await page.locator(`[data-answer="${task.answer}"]`).click();
      else {
        const parts =
          task.type === "order" ? task.answer.split(" ") : [...task.answer];
        for (const part of parts)
          await page.getByRole("button", { name: part, exact: true }).click();
      }
      await expect(page.locator("#modal-title")).toHaveText(
        "You made a little magic!",
      );
      if (task.id === "kit-cat") {
        await page.evaluate(() => {
          window.SpeechRecognition = undefined;
          window.webkitSpeechRecognition = undefined;
        });
        await page.getByRole("button", { name: "Use microphone" }).click();
        await expect(page.locator("#speech-feedback")).toContainText(
          "cannot listen",
        );
        await page.getByRole("button", { name: "I practised aloud" }).click();
        await expect(page.locator("#speech-feedback")).toContainText(
          "Beautiful effort",
        );
      }
      await page.getByRole("button", { name: "Keep exploring" }).click();
    }
  }
  await expect(page.locator("#stars")).toHaveText("12");
  await page
    .getByRole("button", { name: "World map", exact: true })
    .first()
    .click();
  await page.locator('[data-action="travel"][data-index="4"]').click();
  await page.evaluate(() => window.__game.game.teleport(0, -7));
  await expect(page.locator("#near-text")).toContainText("silver star");
  await page.locator("#near-prompt button").click();
  await expect(page.locator(".dialogue-text")).toContainText("says Kit");
  await page.getByRole("button", { name: "Give everyone a hug" }).click();
  await page.getByRole("button", { name: "Follow the silver light" }).click();
  await expect(page.locator("#modal-title")).toHaveText(
    "Goodnight, Magic Kingdom.",
  );
  expect(await page.evaluate(() => window.__game.progress.ending)).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Continue my adventure" }).click();
  await expect(page.locator("#stars")).toHaveText("12");
  await expect(page.locator("#world-name")).toHaveText("Starlight Castle");
  expect(await page.evaluate(() => window.__game.progress.spoken.length)).toBe(
    1,
  );
  await page.getByRole("button", { name: "Reading journal" }).click();
  await expect(page.locator(".word-bank button")).toHaveCount(9);
  expect(errors).toEqual([]);
});

test("two browser players can join a private room and see each other", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p1 = await a.newPage(),
    p2 = await b.newPage();
  try {
    for (const p of [p1, p2]) {
      await p.goto("/?test=1");
      await p.getByRole("button", { name: "Let’s go exploring" }).click();
      await p.getByRole("button", { name: "Play together" }).click();
    }
    await p1.getByRole("button", { name: "Create a private room" }).click();
    await expect(p1.locator(".room-invite strong")).toBeVisible();
    const code = await p1.locator(".room-invite strong").textContent();
    await p2.locator("#nickname").fill("Mum");
    await p2.locator("#room-code").fill(code);
    await p2.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(p1.locator(".room-invite p")).toHaveText(
      "2 of 6 explorers connected",
    );
    await expect(p2.locator(".room-invite p")).toHaveText(
      "2 of 6 explorers connected",
    );
    await p1.getByRole("button", { name: "Explore together" }).click();
    await p2.getByRole("button", { name: "Explore together" }).click();
    await expect
      .poll(() => p1.evaluate(() => window.__game.game.peers.size))
      .toBe(1);
    await expect
      .poll(() => p2.evaluate(() => window.__game.game.peers.size))
      .toBe(1);
    await p1.evaluate(() => window.__game.game.teleport(6, 12));
    await expect
      .poll(() =>
        p2.evaluate(() => [...window.__game.game.peers.values()][0]?.target.x),
      )
      .toBe(6);
    await p1.evaluate(() =>
      window.__game.game.renderer
        .getContext()
        .getExtension("WEBGL_lose_context")
        .loseContext(),
    );
    await expect(p1.locator('#scene canvas[data-renderer="2d"]')).toBeVisible();
    await p1.evaluate(() => window.__game.game.teleport(-6, 12));
    await expect
      .poll(() =>
        p2.evaluate(() => [...window.__game.game.peers.values()][0]?.target.x),
      )
      .toBe(-6);
  } finally {
    await a.close();
    await b.close();
  }
});

test("mobile layout and touch movement work without horizontal overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    await page.goto("/?test=1");
    await page.getByRole("button", { name: "Let’s go exploring" }).click();
    await expect(page.locator("#joystick")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    const z = await page.evaluate(() => window.__game.game.player.position.z);
    const rect = await page.locator("#joystick").boundingBox();
    await page.locator("#joystick").dispatchEvent("pointerdown", {
      pointerId: 1,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + 10,
    });
    await page.waitForTimeout(350);
    await page
      .locator("#joystick")
      .dispatchEvent("pointerup", { pointerId: 1 });
    expect(
      await page.evaluate(() => window.__game.game.player.position.z),
    ).toBeLessThan(z);
    await page
      .getByRole("button", { name: "World map", exact: true })
      .first()
      .click();
    await expect(page.locator(".world-card")).toHaveCount(5);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  } finally {
    await context.close();
  }
});
