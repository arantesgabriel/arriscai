import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";
const sizes = [390, 768, 1440, 1920];
async function browserRPC(
  page: Page,
  name: string,
  args: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ url, key, name, args }) => {
      const screen = new URLSearchParams(location.search).has("telao");
      const session = JSON.parse(
        localStorage.getItem(
          screen ? "arriscai-screen-auth" : "arriscai-auth",
        )!,
      );
      const response = await fetch(url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify(args),
      });
      return { status: response.status, body: await response.json() };
    },
    {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      key:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        "test-publishable-key",
      name,
      args,
    },
  );
}
async function capture(page: Page, name: string) {
  mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("three browser contexts drive production UI against SQL engine (test Auth and Broadcast transport)", async ({
  browser,
}) => {
  const runtime =
    process.env.ARRISCAI_LIVE_E2E === "1" ? null : await harness();
  const hostContext = await browser.newContext(),
    playerContext = await browser.newContext(),
    tvContext = await browser.newContext();
  for (const context of [hostContext, playerContext, tvContext])
    await runtime?.attach(context);
  const host = await hostContext.newPage(),
    player = await playerContext.newPage(),
    tv = await tvContext.newPage();
  const errors: string[] = [];
  for (const page of [host, player, tv])
    page.on("pageerror", (e) => errors.push(e.message));
  try {
    await host.goto("/");
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 1000 });
      await capture(host, `home-${width}`);
    }
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.getByLabel("Como a turma te chama?").fill("Ana");
    await host.getByRole("button", { name: "Criar uma sala" }).click();
    await expect(
      host.getByRole("heading", { name: "Junte a turma." }),
    ).toBeVisible();
    const code = await host.locator(".room-code strong").innerText();
    await player.goto("/?codigo=" + code);
    await player.getByLabel("Como a turma te chama?").fill("Bia");
    await player.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      player.getByRole("heading", { name: "Junte a turma." }),
    ).toBeVisible();
    await tv.goto("/?codigo=" + code + "&telao=1");
    await tv.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      tv.getByRole("heading", { name: "Junte a turma." }),
    ).toBeVisible();
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 1000 });
      await capture(host, `lobby-preparation-${width}`);
    }
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.getByLabel("Rodadas", { exact: true }).fill("1");
    await host.getByLabel("Tamanho da pergunta").selectOption("22");
    await host.getByRole("button", { name: "Preparar e iniciar" }).click();
    await expect(
      host.getByRole("heading", { name: "Você comanda o jogo." }),
    ).toBeVisible();
    await expect(
      player.getByRole("heading", { name: "Sua próxima pista está aqui." }),
    ).toBeVisible();
    await expect(
      tv.getByRole("heading", { name: "Hora de arriscar!" }),
    ).toBeVisible();
    await expect(player.locator(".private")).toHaveCount(0);
    await expect(tv.locator(".private")).toHaveCount(0);
    await expect(tv.locator(".controls")).toHaveCount(0);
    const room = new URL(player.url()).pathname.split("/").pop()!;
    const publicState = await browserRPC(player, "public_room_snapshot", {
      room,
    });
    expect(publicState.status).toBe(200);
    expect(publicState.body.game.words.every((w: unknown) => w === null)).toBe(
      true,
    );
    expect(JSON.stringify(publicState.body)).not.toMatch(
      /"(?:answer|aliases|question_id|questions)":/,
    );
    expect(
      (await browserRPC(player, "host_private_round_snapshot", { room }))
        .status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await browserRPC(tv, "game_command", {
          room,
          match: publicState.body.game.id,
          expected_version: publicState.body.game.version,
          idempotency_key: crypto.randomUUID(),
          command: "select",
          payload: { position: 0 },
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    const race = await Promise.all(
      [0, 1].map((position) =>
        browserRPC(host, "game_command", {
          room,
          match: publicState.body.game.id,
          expected_version: publicState.body.game.version,
          idempotency_key: crypto.randomUUID(),
          command: "select",
          payload: { position },
        }),
      ),
    );
    expect(race.filter((r) => r.status === 200)).toHaveLength(1);
    expect(race.filter((r) => r.status >= 400)).toHaveLength(1);
    await host.getByRole("button", { name: "Cancelar seleção" }).click();
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 1000 });
      await capture(host, `host-active-${width}`);
      await player.setViewportSize({ width, height: 1000 });
      await capture(player, `player-active-${width}`);
      await tv.setViewportSize({ width, height: 1000 });
      await capture(tv, `tv-active-${width}`);
      if (width >= 1440)
        expect(
          await tv
            .locator(".board-shell")
            .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight),
        ).toBe(true);
    }
    await host.getByRole("button", { name: "Posição 6", exact: true }).click();
    await expect(
      player.getByText("Posição 6 selecionada. Aguardando confirmação."),
    ).toBeVisible();
    await expect(player.locator(".tile.revealed")).toHaveCount(0);
    await host.getByRole("button", { name: "Confirmar revelação" }).click();
    await expect(player.locator(".tile.revealed")).toHaveCount(1);
    await expect(tv.locator(".tile.revealed")).toHaveCount(1);
    await player.reload();
    await expect(player.locator(".tile.revealed")).toHaveCount(1);
    const answer = await host.locator(".private>strong").innerText();
    await host.getByLabel("Palpite de Bia").fill(answer);
    await host.getByRole("button", { name: "Comparar palpite" }).click();
    await expect(
      host.getByText("A comparação sugere acerto.", { exact: false }),
    ).toBeVisible();
    await host.getByRole("button", { name: "Confirmar acerto" }).click();
    await expect(player.locator(".scoreboard b").first()).toHaveText("22pts");
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 1000 });
      await capture(host, `round-result-${width}`);
    }
    await host
      .getByRole("button", { name: "Avançar rodada / encerrar" })
      .click();
    await expect(player.locator(".podium > h2")).toHaveText("Bia!");
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 1000 });
      await capture(host, `match-result-${width}`);
    }
    await host
      .getByRole("combobox", { name: "Escolher organizador" })
      .selectOption({ label: "Bia" });
    await expect(
      player.getByRole("heading", { name: "Mais uma partida?" }),
    ).toBeVisible();
    await player.getByLabel("Rodadas", { exact: true }).fill("1");
    await player.getByRole("button", { name: "Iniciar nova partida" }).click();
    await expect(
      host.getByRole("heading", { name: "Sua próxima pista está aqui." }),
    ).toBeVisible();
    await expect(host.locator(".scoreboard b")).toHaveCount(1);
    await expect(host.locator(".scoreboard b").first()).toHaveText("0pts");
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await playerContext.close();
    await tvContext.close();
    await runtime?.close();
  }
});
