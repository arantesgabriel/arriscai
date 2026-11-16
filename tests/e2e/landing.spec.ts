import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1360, 1440, 1920]) {
  test(`landing V4: layout and interactions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator(".landing-v4")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Vire a pista.Arrisque.",
    );
    for (const [step, points] of [
      [1, 22],
      [4, 19],
      [22, 1],
    ]) {
      await page.locator(`[data-score-step="${step}"]`).click();
      await expect(page.locator(`[data-score-step="${step}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.locator(".score-chip.revealed")).toHaveCount(step);
      await expect(page.locator("[data-score-caption]")).toContainText(
        `${points} ponto`,
      );
    }
    const guess = page.getByLabel("Seu palpite", { exact: true });
    await expect(guess).toBeDisabled();
    await page
      .getByRole("button", { name: "Revelar posição 12", exact: true })
      .click();
    await expect(page.locator(".demo-tile.revealed")).toContainText(
      "principalmente",
    );
    expect(
      await page
        .locator(".demo-tile.revealed")
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("1");
    await expect(
      page.getByRole("button", { name: "Revelar posição 1", exact: true }),
    ).toBeDisabled();
    await guess.fill("Marte");
    await guess.press("Enter");
    await expect(page.locator("[data-demo]")).toHaveAttribute(
      "data-phase",
      "choose",
    );
    await expect(guess).toBeDisabled();
    await page
      .getByRole("button", { name: "Revelar posição 10", exact: true })
      .click();
    await guess.fill("Sátúrno!");
    await guess.press("Enter");
    await expect(page.locator("[data-demo]")).toHaveAttribute(
      "data-phase",
      "win",
    );
    await expect(page.locator("[data-points]")).toHaveText("+13 pontos");
    await page.getByRole("button", { name: "Recomeçar" }).click();
    for (let i = 1; i <= 14; i++) {
      await page
        .getByRole("button", { name: `Revelar posição ${i}`, exact: true })
        .click();
      await guess.fill("errado");
      await guess.press("Enter");
    }
    await expect(page.locator("[data-demo]")).toHaveAttribute(
      "data-phase",
      "loss",
    );
    await expect(page.locator("[data-points]")).toHaveText("0 pontos");
    await page.getByRole("button", { name: "Recomeçar" }).click();
    await expect(page.locator(".demo-tile.revealed")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.locator(".nav-cta").click();
    await expect(page).toHaveURL(/\/jogar$/);
    await expect(page.getByLabel("Como a galera te chama?")).toBeVisible();
  });
}

test("landing V4: metadata, keyboard, reduced motion and no JavaScript", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /^https:\/\/.*\/arriscai-og.png$/,
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    "content",
    "1200",
  );
  await page.keyboard.press("Tab");
  await expect(page.getByText("Pular para o conteúdo")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".portal")
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.01);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const plain = await context.newPage();
  await plain.goto("/");
  await expect(plain.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(plain.locator(".noscript-note")).toHaveText(
    /ative o JavaScript/,
  );
  await expect(plain.locator("#features-title")).toBeVisible();
  await expect(plain.locator(".nav-cta")).toHaveAttribute("href", "/jogar");
  await context.close();
});

test("landing V4: original animations and scroll feedback", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".landing-v4")).toHaveAttribute(
    "data-ready",
    "true",
  );
  for (const [selector, name, duration] of [
    [".portal", "portal-bob", "6s"],
    [".game-card", "card-bob", "5s"],
    [".coin", "coin-drift", "5s"],
  ]) {
    const animation = await page.locator(selector).evaluate((el) => ({
      name: getComputedStyle(el).animationName,
      duration: getComputedStyle(el).animationDuration,
    }));
    expect(animation.name).toBe(name);
    expect(animation.duration).toBe(duration);
  }
  const moves = await page.locator(".portal").evaluate((el) => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const before = getComputedStyle(el).transform;
    animation.currentTime = 1500;
    return before !== getComputedStyle(el).transform;
  });
  expect(moves).toBe(true);
  await page.locator(".hero-text-link").click();
  await expect(page.locator(".top")).toHaveClass("top scrolled");
  await expect
    .poll(() =>
      page
        .locator(".scroll-progress")
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeGreaterThan(0);
  expect(
    await page.locator(".top").evaluate((el) => getComputedStyle(el).position),
  ).toBe("fixed");
});

test("feature illustrations animate to their final state", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".landing-v4")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const bia = page
    .locator(".animated-score > div")
    .filter({ has: page.locator("strong", { hasText: "Bia" }) });
  await expect(bia.locator("b")).toHaveText("00");
  await expect(bia).toHaveAttribute("style", /80px/);
  await page.locator(".feature-score").scrollIntoViewIfNeeded();
  await expect(bia.locator("b")).toHaveText("22");
  await expect(bia).toHaveAttribute("style", /0px/);
  await expect(page.locator(".animated-score .leader")).toHaveCount(1);
  await page.locator(".feature-room").scrollIntoViewIfNeeded();
  await expect(page.locator(".feature-room")).toHaveClass(/feature-animate/);
  const delays = await page
    .locator(".avatar-row > span")
    .evaluateAll((items) =>
      items.slice(1).map((el) => getComputedStyle(el).animationDelay),
    );
  expect(delays).toEqual(["0.12s", "0.3s", "0.48s"]);
  await page.locator(".feature-tv").scrollIntoViewIfNeeded();
  await expect(page.locator(".feature-tv")).toHaveClass(/feature-animate/);
  expect(
    await page
      .locator(".tv-flip")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("reveal-tv");
});

test("mobile feature sequence waits for the previous card and visibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".landing-v4")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.locator(".feature-room").scrollIntoViewIfNeeded();
  await expect(page.locator(".feature-grid")).toHaveAttribute(
    "data-animation-stage",
    "1",
  );
  await expect(page.locator(".feature-score")).not.toHaveClass(
    /feature-animate/,
  );
  await expect(page.locator(".feature-tv")).not.toHaveClass(/feature-animate/);
  await page.locator(".feature-score").scrollIntoViewIfNeeded();
  await expect(page.locator(".feature-grid")).toHaveAttribute(
    "data-animation-stage",
    "2",
  );
  await expect(page.locator(".feature-tv")).not.toHaveClass(/feature-animate/);
  const bia = page
    .locator(".animated-score > div")
    .filter({ has: page.locator("strong", { hasText: "Bia" }) });
  await expect(bia.locator("b")).toHaveText("22");
  await page.locator(".feature-tv").scrollIntoViewIfNeeded();
  await expect(page.locator(".feature-grid")).toHaveAttribute(
    "data-animation-stage",
    "3",
  );
  await expect(page.locator(".feature-tv")).toHaveClass(/feature-animate/);
});
