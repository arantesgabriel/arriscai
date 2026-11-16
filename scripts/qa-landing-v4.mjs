// Renders the supplied, inert reference on a test-only URL. No production route.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
// Release image handles promptly when regenerating screenshots on Windows.
sharp.cache(false);

const base = process.env.ARRISCAI_QA_URL ?? "http://127.0.0.1:3000";
const referencePath =
  process.argv[2] ??
  "C:/Users/Gabriel/Downloads/FireShot/arriscai_v4_codex_leve/index.html";
const original = await fs.readFile(referencePath, "utf8");
const directory = process.env.ARRISCAI_QA_OUTPUT ?? "docs/landing-v4/captures";
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  // Use the very same self-hosted font binaries in both documents. The supplied
  // report used fallbacks; comparing different font metrics would hide errors.
  const fonts = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector("h1")).fontFamily,
    body: getComputedStyle(document.querySelector(".hero p")).fontFamily,
    faces: [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules]
            .filter((rule) => rule.type === CSSRule.FONT_FACE_RULE)
            .map((rule) => rule.cssText);
        } catch {
          return [];
        }
      })
      .join("\n"),
  }));
  await page.route(`${base}/__v4-reference`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: original.replace(
        /<link[^>]*fonts\.(?:googleapis|gstatic)[^>]*>/g,
        "",
      ),
    }),
  );
  const selectors = [
    ".hero",
    ".hero h1",
    ".scene",
    ".score-interlude",
    ".score-interaction",
    ".how",
    ".demo",
    ".demo-frame",
    ".features",
    ".cta",
    ".footer",
  ];
  for (const width of [320, 390, 768, 1360, 1440, 1920]) {
    const height =
      width < 768 ? 844 : width === 768 ? 1024 : width === 1920 ? 1080 : 900;
    await page.setViewportSize({ width, height });
    const shots = {};
    for (const variant of ["next", "reference"]) {
      await page.goto(variant === "next" ? base : `${base}/__v4-reference`);
      try {
        await page.locator(".hero").waitFor();
      } catch (error) {
        console.error({
          variant,
          width,
          url: page.url(),
          title: await page.title(),
          content: (await page.locator("body").innerText()).slice(0, 1000),
        });
        throw error;
      }
      if (variant === "reference")
        await page.addStyleTag({
          content: `${fonts.faces}\n:root{--font-title:${fonts.title};--font-body:${fonts.body}}`,
        });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${directory}/${variant}-${width}.png`,
        fullPage: true,
      });
      shots[variant] = await page.evaluate(
        (selectors) => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          boxes: Object.fromEntries(
            selectors.map((selector) => {
              const b = document
                .querySelector(selector)
                .getBoundingClientRect();
              return [
                selector,
                [b.x, b.y, b.width, b.height].map(
                  (n) => Math.round(n * 100) / 100,
                ),
              ];
            }),
          ),
        }),
        selectors,
      );
    }
    const a = await sharp(`${directory}/reference-${width}.png`).metadata();
    const b = await sharp(`${directory}/next-${width}.png`).metadata();
    const canvasHeight = Math.max(a.height, b.height);
    let changedPixelsPercent = null;
    if (a.height === b.height) {
      const left = await sharp(`${directory}/reference-${width}.png`)
        .removeAlpha()
        .raw()
        .toBuffer();
      const right = await sharp(`${directory}/next-${width}.png`)
        .removeAlpha()
        .raw()
        .toBuffer();
      let changed = 0;
      for (let i = 0; i < left.length; i += 3)
        if (
          Math.max(
            ...[0, 1, 2].map((c) => Math.abs(left[i + c] - right[i + c])),
          ) > 24
        )
          changed++;
      changedPixelsPercent = +((changed / (left.length / 3)) * 100).toFixed(4);
    }
    await sharp({
      create: {
        width: width * 2,
        height: canvasHeight,
        channels: 3,
        background: "#11162c",
      },
    })
      .composite([
        { input: `${directory}/reference-${width}.png`, left: 0, top: 0 },
        { input: `${directory}/next-${width}.png`, left: width, top: 0 },
      ])
      .png()
      .toFile(`${directory}/comparison-${width}.png`);
    const differences = selectors.map((selector) => ({
      selector,
      delta: shots.next.boxes[selector].map(
        (v, i) => +(v - shots.reference.boxes[selector][i]).toFixed(2),
      ),
    }));
    results.push({
      width,
      height,
      ...shots,
      differences,
      changedPixelsPercent,
    });
    console.log(
      width,
      JSON.stringify(
        differences.filter((d) => d.delta.some((n) => Math.abs(n) > 1)),
      ),
    );
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const variant of ["reference", "next"]) {
      await page.goto(variant === "next" ? base : `${base}/__v4-reference`);
      if (variant === "reference")
        await page.addStyleTag({
          content: `${fonts.faces}\n:root{--font-title:${fonts.title};--font-body:${fonts.body}}`,
        });
      else await page.locator('.landing-v4[data-ready="true"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-score-step="22"]').click();
      await page
        .locator(".score-interaction")
        .screenshot({ path: `${directory}/${variant}-score22-${width}.png` });
      const frame = page.locator("[data-demo]");
      const guess = page.getByLabel("Seu palpite", { exact: true });
      await page
        .getByRole("button", { name: "Revelar posição 12", exact: true })
        .click();
      await guess.fill("Marte");
      await guess.press("Enter");
      await frame.screenshot({
        path: `${directory}/${variant}-wrong-${width}.png`,
      });
      await page
        .getByRole("button", { name: "Revelar posição 10", exact: true })
        .click();
      await guess.fill("Sátúrno!");
      await guess.press("Enter");
      await frame.screenshot({
        path: `${directory}/${variant}-win-${width}.png`,
      });
      await page.locator("[data-reset]").click();
      for (let i = 1; i <= 14; i++) {
        await page
          .getByRole("button", { name: `Revelar posição ${i}`, exact: true })
          .click();
        await guess.fill("errado");
        await guess.press("Enter");
      }
      await frame.screenshot({
        path: `${directory}/${variant}-loss-${width}.png`,
      });
    }
    for (const state of ["score22", "wrong", "win", "loss"]) {
      const left = `${directory}/reference-${state}-${width}.png`,
        right = `${directory}/next-${state}-${width}.png`;
      const a = await sharp(left).metadata(),
        b = await sharp(right).metadata();
      await sharp({
        create: {
          width: a.width + b.width,
          height: Math.max(a.height, b.height),
          channels: 3,
          background: "#11162c",
        },
      })
        .composite([
          { input: left, left: 0, top: 0 },
          { input: right, left: a.width, top: 0 },
        ])
        .png()
        .toFile(`${directory}/comparison-${state}-${width}.png`);
    }
  }
  await fs.writeFile(
    `${directory}/comparison-metrics.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
