import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";

test("catalog timeout shows a recoverable load error instead of an empty catalog", async ({
  browser,
}) => {
  const runtime = await harness();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await runtime.attach(context);
  let fail = true;
  await context.route("**/rest/v1/rpc/question_catalog", async (route) => {
    if (!fail) return route.fallback();
    fail = false;
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: "57014",
        message: "canceling statement due to statement timeout",
      }),
    });
  });
  const page = await context.newPage();
  try {
    await page.goto("/jogar");
    await page.getByLabel("Escolha seu apelido").fill("Host");
    await page.getByRole("button", { name: /^Criar uma sala/ }).click();
    await expect(
      page.getByText("Não foi possível carregar as perguntas.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Nenhuma pergunta disponível para esta sala.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Preparar e iniciar", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".prep-stats-bar")).toHaveCount(0);
    mkdirSync(".tmp/catalog-timeout", { recursive: true });
    await page.screenshot({ path: ".tmp/catalog-timeout/error.png" });
    await page
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .click();
    await expect(page.locator(".prep-stats-bar")).toContainText(
      "504 perguntas elegíveis",
    );
    await expect(
      page.getByText("Não foi possível carregar as perguntas.", {
        exact: true,
      }),
    ).toHaveCount(0);
    await page.screenshot({ path: ".tmp/catalog-timeout/recovered.png" });
  } finally {
    await context.close();
    await runtime.close();
  }
});
