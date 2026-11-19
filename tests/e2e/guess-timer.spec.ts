import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";

test("quiet minute becomes explicit at ten seconds and automatically passes the turn", async ({
  browser,
}) => {
  const runtime = await harness();
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  for (const context of contexts) await runtime.attach(context);
  const [host, ana, bruno] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  try {
    await host.goto("/jogar");
    await host.getByLabel("Escolha seu apelido").fill("Host");
    await host.getByRole("button", { name: /^Criar uma sala/ }).click();
    const code = await host.locator(".room-code strong").innerText();
    const room = new URL(host.url()).pathname.split("/").pop()!;
    for (const [page, name] of [
      [ana, "Ana"],
      [bruno, "Bruno"],
    ] as const) {
      await page.goto(`/?codigo=${code}`);
      await page.getByLabel("Escolha seu apelido").fill(name);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page).toHaveURL(/\/sala\//);
    }
    await host.getByLabel("Rodadas", { exact: true }).fill("1");
    await host.getByLabel("Tamanho da pergunta").selectOption("22");
    await host
      .getByRole("button", { name: "Preparar e iniciar", exact: true })
      .click();
    await host.getByRole("button", { name: "Posição 1", exact: true }).click();
    await host
      .getByRole("button", { name: "Confirmar revelação", exact: true })
      .click();
    await expect(ana.getByLabel("Seu palpite", { exact: true })).toBeVisible();
    await expect(ana.locator(".match-board .guess-timer")).toHaveAttribute(
      "data-urgent",
      "false",
    );
    mkdirSync(".tmp/guess-timer", { recursive: true });
    for (const width of [390, 768, 1440]) {
      await ana.setViewportSize({ width, height: 900 });
      await ana.screenshot({ path: `.tmp/guess-timer/quiet-${width}.png` });
      expect(
        await ana.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
    await runtime.setGuessSeconds(room, 10);
    await Promise.all([host.reload(), ana.reload()]);
    await expect(ana.locator(".match-board .guess-timer")).toHaveAttribute(
      "data-urgent",
      "true",
    );
    await expect(host.locator(".match-board .guess-timer")).toContainText(
      "Envie seu palpite!",
    );
    await ana.screenshot({ path: ".tmp/guess-timer/urgent-desktop.png" });
    await ana.setViewportSize({ width: 390, height: 844 });
    await ana.screenshot({ path: ".tmp/guess-timer/urgent-mobile.png" });
    await expect(ana.locator(".player-guess .guess-timer")).toContainText(
      /\d+s/,
    );
    await expect(ana.locator(".player-guess .guess-timer")).toBeVisible();
    await ana.locator(".player-guess").scrollIntoViewIfNeeded();
    await ana.screenshot({ path: ".tmp/guess-timer/urgent-input-mobile.png" });
    await expect(host.locator(".match-board h2")).toHaveText(
      "É a vez de Bruno",
      { timeout: 15000 },
    );
    await expect(ana.getByLabel("Seu palpite", { exact: true })).toHaveCount(0);
    await expect(host.locator(".board-hint")).toContainText(
      "O tempo de Ana acabou",
    );
    await expect(host.locator(".match-board .guess-timer")).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await runtime.close();
  }
});
