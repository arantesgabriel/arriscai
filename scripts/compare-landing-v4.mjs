import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const root = "docs/v4-oficial/landing-comparison";
await mkdir(root, { recursive: true });
await mkdir(".tmp/v4-official/landing-png", { recursive: true });
const browser = await chromium.launch();
const results = [];
const pages = new Map();
for (const name of ["before", "after"]) {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    javaScriptEnabled: false,
  });
  await context.route(
    /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
    (route) => route.abort(),
  );
  pages.set(name, await context.newPage());
}
for (const [width, height] of [
  [320, 720],
  [390, 844],
  [768, 1024],
  [1360, 768],
  [1440, 900],
  [1920, 1080],
]) {
  const buffers = [];
  const measurements = [];
  for (const [name, port] of [
    ["before", 3017],
    ["after", 3018],
  ]) {
    const page = pages.get(name);
    await page.setViewportSize({ width, height });
    console.log("COMPARE SSR (JavaScript disabled)", name, width);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
    await page.waitForFunction(() =>
      getComputedStyle(
        document.querySelector(".landing-v4"),
      ).fontFamily.includes("Nunito"),
    );
    await page.evaluate(() => document.fonts.ready);
    measurements.push(
      await page
        .locator(".landing-v4")
        .evaluate((el) => ({
          height: el.getBoundingClientRect().height,
          title: getComputedStyle(el.querySelector("h1")).fontFamily,
          body: getComputedStyle(el).fontFamily,
          scrollWidth: document.documentElement.scrollWidth,
        })),
    );
    const png = await page.screenshot({ fullPage: true });
    buffers.push(png);
    await writeFile(`.tmp/v4-official/landing-png/${name}-${width}.png`, png);
    await page.screenshot({
      path: `${root}/${name}-${width}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 80,
    });
  }
  results.push({
    width,
    height,
    mode: "SSR, JavaScript disabled, reduced motion",
    identicalPng: buffers[0].equals(buffers[1]),
    before: measurements[0],
    after: measurements[1],
  });
}
await writeFile(`${root}/resultados.json`, JSON.stringify(results, null, 2));
console.log(results);
await browser.close();
