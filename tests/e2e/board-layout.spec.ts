import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";
import { selectPosition, openSpokenGuess, readSecretAnswer } from "./game-ui";

const out = ".tmp/match-reference";
test.use({ actionTimeout: 20000, trace: "off" });
test("board height follows 9, 11 and 22 words for organizer and player", async ({
  browser,
}) => {
  test.setTimeout(180000);
  mkdirSync(out, { recursive: true });
  const runtime = await harness();
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  for (const context of contexts) await runtime.attach(context);
  const [host, player] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  const errors: string[] = [];
  for (const page of [host, player])
    page.on("pageerror", (error) => errors.push(error.message));
  async function rpc(name: string, args: Record<string, unknown>) {
    return host.evaluate(
      async ({ name, args }) => {
        const session = JSON.parse(localStorage.getItem("arriscai-auth")!);
        const response = await fetch(
          "http://127.0.0.1:54321/rest/v1/rpc/" + name,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: "test-publishable-key",
              Authorization: "Bearer " + session.access_token,
            },
            body: JSON.stringify(args),
          },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(body));
        return body;
      },
      { name, args },
    );
  }
  const heights = new Map<string, number>();
  async function checkBoard(
    page: Page,
    role: string,
    count: number,
    width: number,
  ) {
    await expect(page.locator(".match-board .tile")).toHaveCount(count);
    await page.locator("main").evaluate((el) => el.scrollTo({ top: 0 }));
    const geometry = await page.locator(".match-board").evaluate((el) => {
      const card = el.getBoundingClientRect();
      const grid = el.querySelector(".board")!.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        height: card.height,
        bottomGap: card.bottom - grid.bottom,
        padding: parseFloat(style.paddingBottom),
        overflow: el.scrollWidth - el.clientWidth,
        horizontal: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.bottomGap).toBeLessThanOrEqual(geometry.padding + 2);
    expect(geometry.overflow).toBe(0);
    expect(geometry.horizontal).toBe(0);
    heights.set(`${role}-${count}-${width}`, geometry.height);
    await page.screenshot({ path: `${out}/${role}-${count}-${width}.png` });
  }
  try {
    await host.goto("/jogar");
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    await host.getByLabel("Escolha seu apelido").fill("Gabriel");
    await host.getByRole("button", { name: /^Criar uma sala/ }).click();
    const code = await host.locator(".room-code strong").innerText();
    const room = new URL(host.url()).pathname.split("/").pop()!;
    await player.goto("/?codigo=" + code);
    await player.getByLabel("Escolha seu apelido").fill("Marina");
    await player.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(player).toHaveURL(/\/sala\//);
    for (const count of [9, 11, 22]) {
      await host.getByLabel("Rodadas", { exact: true }).fill("1");
      await host.getByLabel("Tamanho da pergunta").selectOption(String(count));
      await host
        .getByRole("button", {
          name: /^(Preparar e iniciar|Iniciar nova partida)$/,
        })
        .click();
      await expect(host.locator(".match-board .tile")).toHaveCount(count);
      for (const width of [320, 390, 768, 1360, 1920]) {
        for (const [page, role] of [
          [host, "host"],
          [player, "player"],
        ] as const) {
          await page.setViewportSize({
            width,
            height: width <= 390 ? 844 : 900,
          });
          await checkBoard(page, role, count, width);
        }
      }
      await host.setViewportSize({ width: 1360, height: 900 });
      await selectPosition(host, 3);
      await host
        .getByRole("button", { name: "Confirmar revelação", exact: true })
        .click();
      await expect(player.locator(".tile.revealed")).toHaveCount(1);
      expect(await readSecretAnswer(host)).not.toBe("");
      await openSpokenGuess(host);
      await host.screenshot({ path: `${out}/spoken-${count}-desktop.png` });
      await host.getByRole("button", { name: "Voltar", exact: true }).click();
      for (const width of [320, 1360]) {
        await host.setViewportSize({ width, height: 900 });
        await checkBoard(host, "host-revealed", count, width);
      }
      await host.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      const violations = await host.evaluate(async () =>
        (
          window as unknown as {
            axe: {
              run: (selector: string) => Promise<{ violations: unknown[] }>;
            };
          }
        ).axe.run(".host-round"),
      );
      expect(violations.violations).toEqual([]);
      const state = await rpc("public_room_snapshot", { room });
      await rpc("game_command", {
        room,
        match: state.game.id,
        expected_version: state.game.version,
        idempotency_key: crypto.randomUUID(),
        command: "cancel",
        payload: {},
      });
    }
    for (const role of ["host", "player"])
      for (const width of [320, 390, 768, 1360, 1920]) {
        expect(heights.get(`${role}-22-${width}`)!).toBeGreaterThan(
          heights.get(`${role}-11-${width}`)!,
        );
      }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await runtime.close();
  }
});
