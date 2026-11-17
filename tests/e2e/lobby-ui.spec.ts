import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";
import { assertStagingFrontend } from "./staging-guard";

test("entrada alternável, convite direto e preparação pública sincronizada", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const live = process.env.ARRISCAI_LIVE_E2E === "1";
  if (live) await assertStagingFrontend();
  const runtime = live ? null : await harness();
  const contexts = await Promise.all(
    Array.from({ length: 3 }, () => browser.newContext()),
  );
  for (const context of contexts) await runtime?.attach(context);
  const [host, guest, late] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  const errors: string[] = [];
  for (const p of [host, guest, late])
    p.on("pageerror", (e) => errors.push(e.message));
  const output = live
    ? ".tmp/entry-lobby-ux/live"
    : ".tmp/entry-lobby-ux/isolated";
  mkdirSync(output, { recursive: true });
  async function capture(p: Page, name: string) {
    await p.locator("main").evaluate((el) => el.scrollTo({ top: 0, left: 0 }));
    await p.screenshot({
      path: `${output}/${name}.jpg`,
      fullPage: true,
      type: "jpeg",
      quality: 80,
    });
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const footer = await p.locator("footer").boundingBox();
    expect(footer).not.toBeNull();
    const main = await p.locator("main").boundingBox();
    expect(main!.y + main!.height).toBeLessThanOrEqual(footer!.y + 1);
    expect(footer!.y + footer!.height).toBeCloseTo(p.viewportSize()!.height, 0);
  }
  async function join(p: Page, code: string, nickname: string) {
    await p.goto(`/?codigo=${code}`);
    await expect(
      p.getByRole("button", { name: "Tenho um código" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(p.getByLabel("Código da sala")).toHaveValue(code);
    await expect(p.locator("#create-room-fields")).toHaveCount(0);
    await p.getByLabel("Como a galera te chama?").fill(nickname);
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
  }
  try {
    await host.goto("/jogar");
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    await expect(
      host.getByRole("button", { name: "Ativar som" }),
    ).toBeVisible();
    await host.getByRole("button", { name: "Ativar som" }).click();
    await expect(host.getByLabel("Volume", { exact: true })).toBeVisible();
    await host.getByRole("button", { name: "Desativar som" }).click();
    await expect(host.getByLabel("Volume", { exact: true })).toBeHidden();
    await host.getByLabel("Como a galera te chama?").fill("UX Ana");
    await expect(host.locator("#join-room-fields")).toHaveCount(0);
    await host.getByRole("button", { name: "Tenho um código" }).click();
    await expect(host.locator("#create-room-fields")).toHaveCount(0);
    await expect(host.getByLabel("Como a galera te chama?")).toHaveValue(
      "UX Ana",
    );
    await host.getByLabel("Código da sala").fill("AB12CD34");
    await host.getByLabel("Código da sala").focus();
    expect(
      await host
        .getByLabel("Código da sala")
        .evaluate((el) => getComputedStyle(el).outlineWidth),
    ).toBe("1px");
    for (const [w, h] of [
      [320, 720],
      [390, 844],
      [768, 1024],
      [1360, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await host.setViewportSize({ width: w, height: h });
      await capture(host, `entrada-codigo-${w}`);
    }
    await host.setViewportSize({ width: 320, height: 720 });
    await host.getByLabel("Como a galera te chama?").focus();
    await host.getByLabel("Como a galera te chama?").press("Tab");
    await expect(host.getByLabel("Código da sala")).toBeFocused();
    const codeBox = await host.getByLabel("Código da sala").boundingBox();
    const footerBox = await host.locator("footer").boundingBox();
    expect(codeBox!.y + codeBox!.height).toBeLessThanOrEqual(footerBox!.y);
    await host.screenshot({
      path: `${output}/entrada-codigo-320-formulario.jpg`,
      type: "jpeg",
      quality: 80,
    });
    await host.setViewportSize({ width: 1920, height: 1080 });
    await host.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(host.locator("#join-room-fields")).toHaveCount(0);
    await expect(host.getByLabel("Como a galera te chama?")).toHaveValue(
      "UX Ana",
    );
    await capture(host, "entrada-criar-1920");
    await host
      .getByRole("button", { name: "Criar uma sala", exact: false })
      .click();
    await expect(
      host.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
    const code = await host.locator(".room-code strong").innerText();
    await join(guest, code, "UX Bia");
    for (const name of ["UX Davi", "UX Eva", "UX Fábio"]) {
      const context = await browser.newContext();
      contexts.push(context);
      await runtime?.attach(context);
      await join(await context.newPage(), code, name);
    }
    await expect(host.locator(".members-heading > span")).toHaveText("5 / 14");
    await expect(host.locator('.member-slot[data-self="true"]')).toContainText(
      "UX Ana",
    );
    await expect(
      host
        .locator('.member-slot[data-self="true"]')
        .getByRole("img", { name: "Seu usuário" }),
    ).toBeVisible();
    await expect(
      host
        .locator('.member-slot[data-self="true"]')
        .getByRole("img", { name: "Organizador", exact: true }),
    ).toBeVisible();
    expect(
      await host
        .locator(".member-list")
        .evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    await host
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    const beforeCopy = await host.locator(".preparation").boundingBox();
    await host
      .getByRole("button", { name: "Copiar convite", exact: true })
      .click();
    await expect(host.locator(".notice-banner")).toContainText(
      "Link de convite copiado!",
    );
    expect(await host.locator(".preparation").boundingBox()).toEqual(
      beforeCopy,
    );
    expect(await host.evaluate(() => navigator.clipboard.readText())).toContain(
      `?codigo=${code}`,
    );
    await host
      .getByRole("button", { name: "Copiar código", exact: true })
      .click();
    await expect(host.locator(".notice-banner")).toContainText(
      `Código ${code} copiado!`,
    );
    expect(await host.evaluate(() => navigator.clipboard.readText())).toBe(
      code,
    );
    await expect(host.locator(".notice-banner")).toBeHidden({ timeout: 6000 });
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1360, 768],
      [1920, 1080],
    ]) {
      await host.setViewportSize({ width, height });
      await capture(host, `lobby-automatico-${width}`);
      if (width >= 1360) {
        await host
          .getByRole("button", { name: "Trocar organizador", exact: true })
          .click();
        await expect(host.getByRole("dialog")).toBeVisible();
        await expect(
          host.getByRole("combobox", { name: "Escolher organizador" }),
        ).toBeHidden();
        await host.screenshot({
          path: `${output}/organizador-roleta-${width}.jpg`,
          type: "jpeg",
          quality: 80,
        });
        expect(
          await host
            .locator("main")
            .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        ).toBe(true);
        await host
          .getByRole("button", { name: "Selecionar manualmente", exact: true })
          .click();
        await expect(host.locator(".wheel-stage")).toBeHidden();
        await expect(
          host.getByRole("combobox", { name: "Escolher organizador" }),
        ).toBeVisible();
        await host
          .getByRole("button", { name: "Sortear na roleta", exact: true })
          .click();
        await expect(host.locator(".wheel-stage")).toBeVisible();
        await host
          .getByRole("button", { name: "Fechar troca de organizador" })
          .click();
        expect(
          await host
            .locator("main")
            .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        ).toBe(true);
      }
    }
    await expect(host.locator(".wheel-stage")).toBeHidden();
    await expect(guest.locator(".wheel-stage")).toBeHidden();
    await host.getByLabel("Rodadas", { exact: true }).fill("5");
    await host.getByLabel("Tamanho da pergunta").selectOption("22");
    const category = host.locator(".cat-card").first();
    const categoryName = (
      await category.locator(".cat-info strong").innerText()
    ).trim();
    await category.getByRole("checkbox").uncheck();
    const publicCard = guest.locator(".preparation-preview");
    await expect(publicCard.getByLabel("Rodadas", { exact: true })).toHaveValue(
      "5",
    );
    await expect(publicCard.getByLabel("Tamanho da pergunta")).toHaveValue(
      "22",
    );
    await expect(
      publicCard
        .locator(".cat-card")
        .filter({ hasText: categoryName })
        .getByRole("checkbox"),
    ).not.toBeChecked();
    await host.getByLabel("Seleção", { exact: false }).selectOption("manual");
    const question = host.locator(".question-card").first();
    const privateQuestion = await question
      .locator("strong")
      .first()
      .innerText();
    await question.getByRole("checkbox").check();
    await expect(
      publicCard.getByText("1 pergunta selecionada", { exact: true }),
    ).toBeVisible();
    expect(await publicCard.innerText()).not.toContain(privateQuestion);
    for (const control of await publicCard.locator("input,select,button").all())
      await expect(control).toBeDisabled();
    await expect(
      publicCard.locator(".question-card, .question-private-preview"),
    ).toHaveCount(0);
    await join(late, code, "UX Caio");
    await expect(
      late
        .locator(".preparation-preview")
        .getByLabel("Rodadas", { exact: true }),
    ).toHaveValue("5");
    await expect(
      late.getByText("1 pergunta selecionada", { exact: true }),
    ).toBeVisible();
    for (const [w, h] of [
      [320, 720],
      [390, 844],
      [768, 1024],
      [1360, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await host.setViewportSize({ width: w, height: h });
      await capture(host, `lobby-host-${w}`);
      await guest.setViewportSize({ width: w, height: h });
      await capture(guest, `lobby-player-${w}`);
    }
    await host
      .getByRole("button", { name: "Trocar organizador", exact: true })
      .click();
    await expect(
      host.getByRole("button", { name: "Sortear organizador" }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Selecionar manualmente", exact: true })
      .click();
    await expect(
      host.getByRole("button", { name: "Confirmar novo organizador" }),
    ).toBeDisabled();
    await host
      .getByRole("combobox", { name: "Escolher organizador" })
      .selectOption({ label: "UX Bia" });
    await expect(
      host.getByRole("button", { name: "Confirmar novo organizador" }),
    ).toBeEnabled();
    await expect(
      host
        .locator(".member-slot")
        .filter({ hasText: "UX Ana" })
        .getByRole("img", { name: "Organizador", exact: true }),
    ).toBeVisible();
    await host
      .getByRole("button", { name: "Confirmar novo organizador" })
      .click();
    await expect(
      guest.locator('.preparation[data-editable="true"]'),
    ).toBeVisible();
    await expect(
      host
        .locator(".preparation-preview")
        .getByLabel("Rodadas", { exact: true }),
    ).toHaveValue("3");
    await guest
      .getByRole("button", { name: "Trocar organizador", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "Sortear organizador", exact: true })
      .click();
    await expect(host.locator(".wheel-countdown strong")).toHaveText("3");
    await expect(host.locator(".wheel-disc")).toBeHidden();
    await expect(host.locator(".wheel-pointer")).toBeHidden();
    await expect(guest.locator(".wheel-countdown strong")).toHaveText("3");
    await expect(late.locator(".wheel-countdown strong")).toHaveText("3");
    await host.screenshot({
      path: ".tmp/entry-lobby-ux/isolated/roleta-contagem.jpg",
    });
    await expect(host.locator(".wheel-countdown strong")).toHaveText("2");
    await expect(host.locator(".wheel-countdown strong")).toHaveText("1");
    await expect(host.locator(".wheel-disc.spinning")).toBeVisible();
    await expect(host.locator(".wheel-announcement")).toContainText(
      "foi sorteado(a)",
    );
    const sessionPages = contexts.flatMap((context) => context.pages());
    await Promise.all(
      sessionPages.map(async (page) => {
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(page.locator(".notice-banner")).toContainText(
          "foi sorteado(a)",
        );
        const isWinner = await page
          .locator('.member-slot[data-self="true"]')
          .getByRole("img", { name: "Organizador", exact: true })
          .count();
        if (isWinner)
          await expect(page.locator(".notice-banner")).toHaveText(
            /Você foi sorteado/,
          );
        else
          await expect(page.locator(".notice-banner")).not.toContainText(
            "Você foi sorteado",
          );
      }),
    );
    await host.screenshot({
      path: ".tmp/entry-lobby-ux/isolated/roleta-resultado.jpg",
    });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await runtime?.close();
  }
});
