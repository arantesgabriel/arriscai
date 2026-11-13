import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { harness } from "./sql-harness";
const sizes = [390, 768, 1440, 1920];
async function browserRPC(
  page: Page,
  name: string,
  args: Record<string, unknown>,
) {
  const live = process.env.ARRISCAI_LIVE_E2E === "1";
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
      url: live
        ? process.env.NEXT_PUBLIC_SUPABASE_URL!
        : "http://127.0.0.1:54321",
      key: live
        ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
        : "test-publishable-key",
      name,
      args,
    },
  );
}
async function capture(page: Page, name: string) {
  const directory = ".tmp/qa-evidence/screenshots";
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/${name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function joinAs(
  page: Page,
  code: string,
  nickname: string,
  expectedHeading = "Junte a turma.",
) {
  await page.goto("/?codigo=" + encodeURIComponent(code));
  await page.getByLabel("Como a turma te chama?").fill(nickname);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: expectedHeading }),
  ).toBeVisible();
}

test("three players, telão and late spectator use isolated SQL harness", async ({
  browser,
}) => {
  const live = process.env.ARRISCAI_LIVE_E2E === "1";
  if (live) {
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const stagingRef = process.env.ARRISCAI_STAGING_PROJECT_REF?.trim();
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const ref = configuredUrl ? new URL(configuredUrl).hostname.split(".")[0] : "";
    if (
      !configuredUrl?.startsWith("https://") ||
      !key ||
      !stagingRef ||
      ref !== stagingRef
    ) {
      throw new Error(
        "Hosted E2E requires the publishable key and URL for the staging project, with ARRISCAI_STAGING_PROJECT_REF matching that URL.",
      );
    }
  }
  const runtime = live ? null : await harness();
  const videoDirectory = ".tmp/qa-evidence/videos";
  mkdirSync(videoDirectory, { recursive: true });
  const video = { recordVideo: { dir: videoDirectory } };
  const contexts = await Promise.all(
    Array.from({ length: 6 }, () => browser.newContext(video)),
  );
  for (const context of contexts)
    await runtime?.attach(context);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [host, player, secondPlayer, thirdPlayer, tv, late] = pages;
  const errors: string[] = [];
  for (const page of pages)
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
    await joinAs(player, code, "Bia");
    await joinAs(secondPlayer, code, "Caio");
    await joinAs(thirdPlayer, code, "Davi");
    await tv.goto("/?codigo=" + code + "&telao=1");
    await tv.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      tv.getByRole("heading", { name: "Junte a turma." }),
    ).toBeVisible();
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 1000 });
      await capture(host, `lobby-host-${width}`);
      await player.setViewportSize({ width, height: 1000 });
      await capture(player, `lobby-player-a-${width}`);
      await secondPlayer.setViewportSize({ width, height: 1000 });
      await capture(secondPlayer, `lobby-player-b-${width}`);
      await thirdPlayer.setViewportSize({ width, height: 1000 });
      await capture(thirdPlayer, `lobby-player-c-${width}`);
      await tv.setViewportSize({ width, height: 1000 });
      await capture(tv, `lobby-tv-${width}`);
    }
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.getByLabel("Rodadas", { exact: true }).fill("3");
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
    await joinAs(late, code, "Elisa", "Sua próxima pista está aqui.");
    await expect(late.locator(".spectator-note")).toHaveText(
      "Você está assistindo. Entre no rodízio na próxima partida.",
    );
    for (const page of [player, secondPlayer, thirdPlayer, tv, late])
      await expect(page.locator(".private")).toHaveCount(0);
    await expect(tv.locator(".controls")).toHaveCount(0);
    const room = new URL(player.url()).pathname.split("/").pop()!;
    const publicState = await browserRPC(player, "public_room_snapshot", {
      room,
    });
    expect(publicState.status, JSON.stringify(publicState.body)).toBe(200);
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
    const visualRoles: Array<[Page, string]> = [
      [host, "host"],
      [player, "player-a"],
      [secondPlayer, "player-b"],
      [thirdPlayer, "player-c"],
      [tv, "tv"],
      [late, "late-spectator"],
    ];
    for (const width of sizes) {
      for (const [page, role] of visualRoles) {
        await page.setViewportSize({ width, height: 1000 });
        await capture(page, `${role}-active-${width}`);
      }
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
    await expect(secondPlayer.locator(".tile.revealed")).toHaveCount(1);
    await expect(thirdPlayer.locator(".tile.revealed")).toHaveCount(1);
    await expect(tv.locator(".tile.revealed")).toHaveCount(1);
    await player.reload();
    await expect(player.locator(".tile.revealed")).toHaveCount(1);
    const answer = await host.locator(".private>strong").innerText();
    const fullQuestion = await host.locator(".private>p").innerText();
    await host.getByLabel("Palpite de Bia").fill(answer);
    await host.getByRole("button", { name: "Comparar palpite" }).click();
    await expect(
      host.getByText("A comparação sugere acerto.", { exact: false }),
    ).toBeVisible();
    await host.getByRole("button", { name: "Confirmar acerto" }).click();
    await expect(player.locator(".scoreboard b").first()).toHaveText("22pts");
    await expect(
      player.locator(".round-result-overlay .solution-answer"),
    ).toHaveText(answer);
    await expect(
      tv.locator(".round-result-overlay .solution-answer"),
    ).toHaveText(answer);
    await expect(
      late.locator(".round-result-overlay .solution-answer"),
    ).toHaveText(answer);
    await expect(
      player.locator(".round-result-overlay .solution-question"),
    ).toHaveText(fullQuestion);
    await expect(
      player.locator(".round-result-overlay h2"),
    ).toContainText("Bia acertou e levou +22 pontos");
    await expect(host.locator(".host-sticky-dock")).toHaveCount(0);
    await expect(host.locator(".points-result span")).toHaveText(
      "pontos conquistados",
    );
    await expect(host.locator(".board .tile")).toHaveCount(22);
    for (const width of sizes) {
      for (const [page, role] of visualRoles) {
        await page.setViewportSize({ width, height: 1000 });
        const panel = page.locator(".round-result-overlay");
        await expect(panel).toBeVisible();
        await expect(panel.locator(".solution-answer")).toBeVisible();
        const box = await panel.boundingBox();
        expect(box?.height).toBeGreaterThan(180);
        await capture(page, `${role}-round-result-${width}`);
      }
    }
    await host
      .locator(".round-result-overlay")
      .getByRole("button", { name: "Avançar rodada / encerrar" })
      .click();

    // Round 2: Caio starts; three passes make the fourth reveal worth 19.
    await expect(host.locator(".board-top h2")).toContainText("Caio");
    for (let reveal = 1; reveal <= 4; reveal += 1) {
      await host
        .getByRole("button", { name: `Posição ${reveal}`, exact: true })
        .click();
      await host.getByRole("button", { name: "Confirmar revelação" }).click();
      await expect(host.locator(".tile.revealed")).toHaveCount(reveal);
      if (reveal < 4) {
        await host.getByRole("button", { name: "Jogador desistiu" }).click();
      }
    }
    const answer2 = await host.locator(".private>strong").innerText();
    await host.getByLabel("Palpite de Caio").fill(answer2);
    await host.getByRole("button", { name: "Comparar palpite" }).click();
    await host.getByRole("button", { name: "Confirmar acerto" }).click();
    await expect(host.locator(".points-result strong")).toHaveText("19");
    await expect(
      secondPlayer
        .locator(".scoreboard li")
        .filter({ hasText: "Caio" })
        .locator("b"),
    ).toHaveText("19pts");
    await host
      .locator(".round-result-overlay")
      .getByRole("button", { name: "Avançar rodada / encerrar" })
      .click();

    // Round 3: the next starter is Davi; the last word is worth one point.
    await expect(host.locator(".board-top h2")).toContainText("Davi");
    for (let reveal = 1; reveal <= 22; reveal += 1) {
      await host
        .getByRole("button", { name: `Posição ${reveal}`, exact: true })
        .click();
      await host.getByRole("button", { name: "Confirmar revelação" }).click();
      await expect(host.locator(".tile.revealed")).toHaveCount(reveal);
      if (reveal < 22)
        await host.getByRole("button", { name: "Jogador desistiu" }).click();
    }
    const answer3 = await host.locator(".private>strong").innerText();
    await host.getByLabel("Palpite de Davi").fill(answer3);
    await host.getByRole("button", { name: "Comparar palpite" }).click();
    await host.getByRole("button", { name: "Confirmar acerto" }).click();
    await expect(host.locator(".points-result strong")).toHaveText("1");
    await expect(
      thirdPlayer
        .locator(".scoreboard li")
        .filter({ hasText: "Davi" })
        .locator("b"),
    ).toHaveText("1pts");
    await host
      .locator(".round-result-overlay")
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
    await expect(host.locator(".scoreboard li")).toHaveCount(4);
    await expect(host.locator(".scoreboard b").first()).toHaveText("0pts");

    // A spectator who arrives after the next match starts becomes eligible
    // when that match is cancelled; the display remains read-only.
    const cancelContext = await browser.newContext(video);
    contexts.push(cancelContext);
    await runtime?.attach(cancelContext);
    const cancelPage = await cancelContext.newPage();
    pages.push(cancelPage);
    cancelPage.on("pageerror", (e) => errors.push(e.message));
    await joinAs(cancelPage, code, "Eva", "Sua próxima pista está aqui.");
    await expect(cancelPage.locator(".spectator-note")).toHaveText(
      "Você está assistindo. Entre no rodízio na próxima partida.",
    );

    await player.getByText("Controles da partida").click();
    player.once("dialog", (dialog) => void dialog.accept());
    await player.getByRole("button", { name: "Cancelar partida" }).click();
    await expect(
      player.getByRole("heading", { name: "Junte a turma." }),
    ).toBeVisible();
    const cancelled = await browserRPC(cancelPage, "public_room_snapshot", {
      room,
    });
    expect(cancelled.status).toBe(200);
    const member = (nickname: string) =>
      cancelled.body.members.find(
        (item: { nickname: string }) => item.nickname === nickname,
      );
    expect(member("Eva").spectator).toBe(false);
    expect(member("Elisa").spectator).toBe(false);
    expect(member("Telão").spectator).toBe(true);
    expect(member("Telão").display_only).toBe(true);

    await player.getByLabel("Rodadas", { exact: true }).fill("1");
    await player.getByLabel("Tamanho da pergunta").selectOption("9");
    await player.getByLabel("Seleção").selectOption("manual");
    await player
      .getByPlaceholder("Digite trecho da pergunta ou categoria...")
      .fill("Tour de France");
    const nineWordQuestion = player
      .locator(".question-card")
      .filter({ hasText: "Tour de France" });
    await expect(nineWordQuestion).toHaveCount(1);
    await nineWordQuestion.getByRole("checkbox").check();
    await player.getByRole("button", { name: "Iniciar nova partida" }).click();
    await expect(host.locator(".scoreboard li")).toHaveCount(5);
    await expect(host.locator(".board .tile")).toHaveCount(9);
    await expect(
      host.locator(".scoreboard li").filter({ hasText: "Elisa" }),
    ).toHaveCount(1);
    await expect(
      host.locator(".scoreboard li").filter({ hasText: "Eva" }),
    ).toHaveCount(1);
    await expect(tv.locator(".controls")).toHaveCount(0);

    // The screenshot's 9-word Tour de France question is worth 8 points
    // when the correct answer comes after two revealed words.
    await player.getByRole("button", { name: "Posição 1", exact: true }).click();
    await player.getByRole("button", { name: "Confirmar revelação" }).click();
    await player.getByRole("button", { name: "Jogador desistiu" }).click();
    await player.getByRole("button", { name: "Posição 2", exact: true }).click();
    await player.getByRole("button", { name: "Confirmar revelação" }).click();
    const answer9 = await player.locator(".private>strong").innerText();
    const turn9 = (await player.locator(".board-top h2").innerText()).replace(
      "É a vez de ",
      "",
    );
    await player.getByLabel(`Palpite de ${turn9}`).fill(answer9);
    await player.getByRole("button", { name: "Comparar palpite" }).click();
    await player.getByRole("button", { name: "Confirmar acerto" }).click();
    await expect(player.locator(".points-result strong")).toHaveText("8");
    await expect(player.locator(".round-result-overlay h2")).toContainText(
      `${turn9} acertou e levou +8 pontos`,
    );
    await expect(
      host.locator(".scoreboard li").filter({ hasText: turn9 }).locator("b"),
    ).toHaveText("8pts");
    await player.setViewportSize({ width: 390, height: 1000 });
    await capture(player, "tour-de-france-host-result-390");
    await player
      .locator(".round-result-overlay")
      .getByRole("button", { name: "Avançar rodada / encerrar" })
      .click();
    await expect(player.locator(".podium-sub")).toContainText("8 pontos");
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await Promise.all(
      pages.map((page, index) =>
        page
          .video()
          ?.saveAs(
            `${videoDirectory}/${[
              "host",
              "player-a",
              "player-b",
              "player-c",
              "telao",
              "late-spectator",
              "cancel-late-spectator",
            ][index]}.webm`,
          ),
      ),
    );
    await runtime?.close();
  }
});
