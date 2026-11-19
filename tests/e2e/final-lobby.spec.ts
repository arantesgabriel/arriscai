import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";

test("final ranking stays separate until the host brings everyone to the lobby", async ({
  browser,
}) => {
  const runtime = await harness();
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext()));
  for (const context of contexts) await runtime.attach(context);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, ana, bruno] = pages;
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
    await host.getByLabel("Tamanho da pergunta").selectOption("9");
    await host
      .getByRole("button", { name: "Preparar e iniciar", exact: true })
      .click();
    await host.getByRole("button", { name: "Posição 1", exact: true }).click();
    await host
      .getByRole("button", { name: "Confirmar revelação", exact: true })
      .click();
    await ana
      .getByLabel("Seu palpite", { exact: true })
      .fill(await runtime.answerForRoom(room));
    await ana
      .getByRole("button", { name: "Enviar palpite", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Confirmar acerto", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Avançar rodada / encerrar", exact: true })
      .click();
    mkdirSync(".tmp/final-lobby", { recursive: true });
    for (const page of pages) {
      await expect(page.locator(".podium")).toBeVisible();
      await expect(page.locator(".lobby-layout")).toHaveCount(0);
    }
    await expect(
      ana.getByRole("button", { name: "Voltar todos ao lobby", exact: true }),
    ).toHaveCount(0);
    for (const width of [390, 768, 1440]) {
      await host.setViewportSize({ width, height: 900 });
      await host.screenshot({ path: `.tmp/final-lobby/ranking-${width}.png` });
      expect(
        await host.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }
    await host.reload();
    await expect(host.locator(".podium")).toBeVisible();
    await expect(host.locator(".lobby-layout")).toHaveCount(0);
    await host
      .getByRole("button", { name: "Voltar todos ao lobby", exact: true })
      .click();
    for (const page of pages) {
      await expect(page.locator(".podium")).toHaveCount(0);
      await expect(page.locator(".lobby-layout")).toBeVisible();
    }
    await expect(host.locator(".history")).toContainText("Ana");
    await host.screenshot({ path: ".tmp/final-lobby/lobby.png" });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await runtime.close();
  }
});
