import { selectPosition, openSpokenGuess } from "./game-ui";
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { harness } from "./sql-harness";

const evidence = process.env.ARRISCAI_QA_OUTPUT ?? ".tmp/catalog-privacy/e2e";
const sizes = [
  [320, 720],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1360, 768],
  [1440, 900],
  [1920, 1080],
];
test.use({ actionTimeout: 20000, trace: "off" });

test("correções: mobile, dois telões, placares, quatro rodadas e desempates (SQL local)", async ({
  browser,
}) => {
  test.setTimeout(300000);
  mkdirSync(evidence, { recursive: true });
  const runtime = await harness();
  const contexts = await Promise.all(
    Array.from({ length: 6 }, () =>
      browser.newContext({ reducedMotion: "reduce" }),
    ),
  );
  for (const context of contexts) await runtime.attach(context);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, ...others] = pages;
  const errors: string[] = [];
  pages.forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
  const report: unknown[] = [];
  async function rpc(page: Page, name: string, args: Record<string, unknown>) {
    return page.evaluate(
      async ({ name, args }) => {
        const session = JSON.parse(
          localStorage.getItem(
            location.search.includes("telao")
              ? "arriscai-screen-auth"
              : "arriscai-auth",
          )!,
        );
        const r = await fetch("http://127.0.0.1:54321/rest/v1/rpc/" + name, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: "test-publishable-key",
            Authorization: "Bearer " + session.access_token,
          },
          body: JSON.stringify(args),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(JSON.stringify(body));
        return body;
      },
      { name, args },
    );
  }
  let room: string;
  const state = () => rpc(host, "public_room_snapshot", { room });
  async function cmd(command: string, payload: Record<string, unknown> = {}) {
    const s = await state();
    return rpc(host, "game_command", {
      room,
      match: s.game.id,
      expected_version: s.game.version,
      idempotency_key: crypto.randomUUID(),
      command,
      payload,
    });
  }
  async function start(rounds: number) {
    await rpc(host, "prepare_match", {
      room,
      planned: rounds,
      categories: [
        "Conhecimentos gerais",
        "Filmes e séries",
        "Música",
        "Esportes",
        "Geografia",
        "História",
        "Ciência e tecnologia",
        "Cultura pop",
      ],
      exact_words: 22,
      selected: [],
      selection_mode: "automatic",
    });
    await expect(host.locator(".board .tile")).toHaveCount(22);
  }
  async function finishRound(reveals: number, win: boolean, mobile = false) {
    const viewport = host.viewportSize()!;
    const mobileSize = `${viewport.width}x${viewport.height}`;
    for (let k = 0; k < reveals; k++) {
      const position = 21 - k;
      if (mobile) {
        await selectPosition(host, position + 1);
        await expect(host.locator(".controls h2")).toBeFocused();
        const button = host.getByRole("button", {
          name: "Confirmar revelação",
          exact: true,
        });
        const b = await button.boundingBox();
        expect(b!.y).toBeGreaterThanOrEqual(0);
        expect(b!.y + b!.height).toBeLessThanOrEqual(viewport.height);
        if (k === 0) {
          report.push({
            mobileSize,
            firstPosition: 22,
            confirmationInViewport: true,
            manualScrollAfterSelection: 0,
          });
          await host
            .getByRole("button", { name: "Resposta secreta", exact: true })
            .click();
          await expect(
            host.getByRole("dialog", { name: "Consulta do organizador" }),
          ).toBeVisible();
          await host
            .getByRole("button", { name: "Fechar consulta", exact: true })
            .click();
        }
        if (k === 0 || k === 21)
          await host.screenshot({
            path: `${evidence}/mobile-confirm-${position + 1}-${mobileSize}.png`,
          });
        await button.click();
      } else {
        await cmd("select", { position });
        await cmd("reveal");
      }
      if (k < reveals - 1 || !win) {
        if (mobile)
          await host
            .getByRole("button", { name: "Jogador desistiu", exact: true })
            .click();
        else await cmd("pass");
      }
    }
    if (win) {
      const secret = await rpc(host, "host_private_round_snapshot", { room });
      if (mobile) {
        const longest = Math.max(
          ...secret.question.split(/\s+/).map((word: string) => word.length),
        );
        report.push({
          mobileQuestionWords: secret.question.split(/\s+/).length,
          longestWord: longest,
        });
        await host.screenshot({
          path: `${evidence}/mobile-guess-${mobileSize}.png`,
        });
        await openSpokenGuess(host);
        await host.locator(".guess-form input").fill(secret.answer);
        await host
          .getByRole("button", { name: "Comparar palpite", exact: true })
          .click();
        await expect(host.locator(".judgement")).toBeFocused();
        await host.screenshot({
          path: `${evidence}/mobile-judgement-${mobileSize}.png`,
        });
        await host
          .getByRole("button", { name: "Confirmar acerto", exact: true })
          .click();
      } else {
        await cmd("guess", { text: secret.answer });
        const before = await state();
        const args = {
          room,
          match: before.game.id,
          expected_version: before.game.version,
          idempotency_key: crypto.randomUUID(),
          command: "judge",
          payload: { correct: true },
        };
        await Promise.all([
          rpc(host, "game_command", args),
          rpc(host, "game_command", args),
        ]);
        const after = await state();
        expect(after.game.version).toBe(before.game.version + 1);
        expect(
          after.game.players.reduce(
            (n: number, p: { score: number }) => n + p.score,
            0,
          ) -
            before.game.players.reduce(
              (n: number, p: { score: number }) => n + p.score,
              0,
            ),
        ).toBe(23 - reveals);
      }
    }
    await expect(host.locator(".round-result-overlay")).toBeVisible();
    await cmd("next");
  }
  async function audit(page: Page, role: string, phase: string) {
    if (role === "host" && phase === "active")
      await page.getByRole("button", { name: "Placar", exact: true }).click();
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const result = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: {
            run: (
              context: string,
            ) => Promise<{ violations: unknown[]; incomplete: unknown[] }>;
          };
        }
      ).axe;
      return axe.run(".scoreboard");
    });
    report.push({ role, phase, ...result });
    expect(result.violations).toEqual([]);
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await page.screenshot({
        path: `${evidence}/${role}-${phase}-${width}x${height}.png`,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (role === "host" && phase === "active")
      await page.getByRole("button", { name: "Rodada", exact: true }).click();
  }
  try {
    await host.goto("/jogar");
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    console.log("PASS local guest identity ready");
    await host.getByLabel("Escolha seu apelido").fill("Host");
    await host.getByRole("button", { name: /^Criar uma sala/ }).click();
    const code = await host.locator(".room-code strong").innerText();
    room = new URL(host.url()).pathname.split("/").pop()!;
    await Promise.all(
      others.map(async (p, i) => {
        await p.goto(`/?codigo=${code}${i >= 3 ? "&telao=1" : ""}`);
        if (i < 3)
          await p
            .getByLabel("Escolha seu apelido")
            .fill(["Ana", "Bruno", "Carla"][i]);
        await p.getByRole("button", { name: "Entrar", exact: true }).click();
        await expect(p).toHaveURL(/\/sala\//);
        await expect(
          p.getByRole("heading", { name: "Junte a galera.", exact: true }),
        ).toBeVisible();
      }),
    );
    let s = await state();
    expect(
      s.members
        .filter((m: { display_only: boolean }) => m.display_only)
        .map((m: { nickname: string }) => m.nickname)
        .sort(),
    ).toEqual(["Telão", "Telão 2"]);
    expect(
      new Set(s.members.map((m: { user_id: string }) => m.user_id)).size,
    ).toBe(6);
    await start(4);
    for (const [p, role] of [
      [host, "host"],
      [others[0], "player"],
      [others[3], "tv"],
    ] as const)
      await audit(p, role, "active");
    await host.setViewportSize({ width: 320, height: 720 });
    await finishRound(1, true);
    await finishRound(4, true);
    await finishRound(22, true, true);
    await finishRound(22, false);
    s = await state();
    expect(
      s.game.players
        .map((p: { score: number }) => p.score)
        .sort((a: number, b: number) => b - a),
    ).toEqual([22, 19, 1]);
    expect(s.history[0].total_rounds).toBe(4);
    const winner = s.game.players.find(
      (p: { score: number }) => p.score === 22,
    );
    expect(s.game.winner).toBe(winner.id);
    expect(s.history[0].winner_id).toBe(winner.id);
    for (const [p, role] of [
      [host, "host"],
      [others[0], "player"],
      [others[3], "tv"],
    ] as const) {
      await expect(p.locator(".podium")).toBeVisible();
      await audit(p, role, "podium");
    }
    await others[4].reload();
    await expect(others[4].locator(".podium")).toBeVisible();
    await contexts[1].setOffline(true);
    await contexts[1].setOffline(false);
    await others[0].reload();
    await expect(others[0].locator(".podium")).toBeVisible();
    await host.reload();
    await expect(host.locator(".podium")).toBeVisible();
    expect((await state()).game).toEqual(s.game);
    console.log(
      "PASS four rounds, mobile 320 and scoreboard axe; respecting command rate window",
    );
    await host.waitForTimeout(30500);
    await host.waitForTimeout(30500);
    await start(2);
    s = await state();
    expect(s.game.players.every((p: { score: number }) => p.score === 0)).toBe(
      true,
    );
    expect(s.game.players).toHaveLength(3);
    expect(
      s.members
        .filter((m: { display_only: boolean }) => m.display_only)
        .every(
          (m: { spectator: boolean; user_id: string }) =>
            m.spectator &&
            !s.game.players.some((p: { id: string }) => p.id === m.user_id),
        ),
    ).toBe(true);
    await finishRound(1, true);
    await finishRound(1, true);
    expect((await state()).game.round).toBe(2);
    await finishRound(22, false);
    expect((await state()).game.round).toBe(3);
    await finishRound(1, true);
    s = await state();
    expect(s.history[0].total_rounds).toBe(4);
    expect(s.game.winner).toBeTruthy();
    for (const p of others.slice(3)) {
      const t = await rpc(p, "public_room_snapshot", { room });
      expect(t.game).toEqual(s.game);
    }
    for (const nickname of ["Dora", "Eva"]) {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      contexts.push(context);
      await runtime.attach(context);
      const page = await context.newPage();
      await page.goto("/?codigo=" + code);
      await page.getByLabel("Escolha seu apelido").fill(nickname);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page).toHaveURL(/\/sala\//);
    }
    await start(1);
    expect((await state()).game.players).toHaveLength(5);
    await host.setViewportSize({ width: 390, height: 844 });
    await host.getByRole("button", { name: "Placar", exact: true }).click();
    await expect(host.locator(".scoreboard li")).toHaveCount(5);
    await host.setViewportSize({ width: 320, height: 720 });
    await expect(host.locator(".scoreboard li")).toHaveCount(4);
    const visibleNames = await host
      .locator(".scoreboard li > strong")
      .allTextContents();
    await host
      .getByRole("button", { name: "Próximos jogadores", exact: true })
      .click();
    await expect(host.locator(".scoreboard li")).toHaveCount(1);
    visibleNames.push(
      ...(await host.locator(".scoreboard li > strong").allTextContents()),
    );
    expect(visibleNames.sort()).toEqual(
      (await state()).game.players
        .map((p: { nickname: string }) => p.nickname)
        .sort(),
    );
    await host.setViewportSize({ width: 390, height: 844 });
    await host.getByRole("button", { name: "Rodada", exact: true }).click();
    await host.screenshot({
      path: evidence + "/host-five-players-390x844.png",
    });
    await finishRound(22, true, true);
    console.log(
      "PASS two extras, replayed judgments, reset, reconnect and full mobile round with five players",
    );
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}/regression.json`,
      JSON.stringify(
        {
          environment: "local PGlite, simulated Auth/Realtime transport",
          scores: [22, 19, 1],
          rounds: 4,
          tieExtraRounds: 2,
          independentContexts: 8,
          mobileRounds: ["320x720, three players", "390x844, five players"],
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
  } finally {
    writeFileSync(`${evidence}/axe.json`, JSON.stringify(report, null, 2));
    await Promise.all(contexts.map((c) => c.close()));
    await runtime.close();
  }
});
