import { test, expect } from "@playwright/test";
import { harness } from "./sql-harness";

test("participante expirado volta à entrada e precisa entrar novamente", async ({
  browser,
}) => {
  test.skip(
    process.env.ARRISCAI_LIVE_E2E === "1",
    "Relógio de banco simulado apenas no ambiente isolado",
  );
  const runtime = await harness();
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    for (const context of contexts) await runtime.attach(context);
    const [host, guest] = await Promise.all(contexts.map((c) => c.newPage()));
    await host.goto("/jogar");
    await host.getByLabel("Escolha seu apelido").fill("Host expiração");
    await host
      .getByRole("button", { name: "Criar uma sala", exact: false })
      .click();
    await expect(host.locator(".room-code strong")).toBeVisible();
    const code = await host.locator(".room-code strong").innerText();
    const room = host.url().split("/sala/")[1].split("?")[0];
    await guest.goto(`/?codigo=${code}`);
    await guest
      .getByLabel("Escolha seu apelido")
      .fill("Visitante expiração");
    await guest.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(guest.locator(".preparation-preview")).toBeVisible();
    await runtime.expireMember(room, "Visitante expiração");
    // Uma retomada dispara heartbeat e consulta, como ao retornar à aba.
    await guest.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(guest).toHaveURL(/\/jogar\?expirada=1/);
    await expect(guest.getByLabel("Código da sala")).toHaveValue(code);
    await expect(guest.locator(".notice-banner")).toContainText(
      "2 minutos sem conexão",
    );
    await expect(
      host.locator(".member-slot").filter({ hasText: "Visitante expiração" }),
    ).toHaveCount(0);
    await guest
      .getByLabel("Escolha seu apelido")
      .fill("Visitante expiração");
    await guest.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(guest).toHaveURL(new RegExp(`/sala/${room}`));
    await expect(
      host.locator(".member-slot").filter({ hasText: "Visitante expiração" }),
    ).toHaveCount(1);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await runtime.close();
  }
});
