import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { harness } from "./sql-harness";

const out = ".tmp/player-guesses";
const sizes = [
  [320, 720],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1360, 768],
  [1440, 900],
  [1920, 1080],
];
test.use({ trace: "off", actionTimeout: 20000 });
test("player submits, organizer judges, room feedback, fit workspace and balanced round result", async ({
  browser,
}) => {
  test.setTimeout(240000);
  mkdirSync(out, { recursive: true });
  const runtime = await harness();
  const contexts = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      browser.newContext({
        viewport: { width: 1360, height: 768 },
        reducedMotion: i === 2 ? "reduce" : "no-preference",
      }),
    ),
  );
  for (const context of contexts) {
    await runtime.attach(context);
    await context.addInitScript(() => {
      const original = window.AudioContext;
      (window as unknown as { qaAudio: number }).qaAudio = 0;
      window.AudioContext = class extends original {
        constructor(options?: AudioContextOptions) {
          super(options);
          (window as unknown as { qaAudio: number }).qaAudio++;
        }
      };
    });
  }
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [host, ...rest] = pages;
  const errors: string[] = [];
  pages.forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
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
        if (!response.ok) throw Error(JSON.stringify(body));
        return body;
      },
      { name, args },
    );
  }
  let room: string;
  const state = () => rpc(host, "public_room_snapshot", { room });
  async function noScroll(page: Page) {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const main = document.querySelector("main")!;
          const app = document.querySelector(".app")!;
          return {
            main: main.scrollHeight - main.clientHeight,
            app: app.scrollHeight - app.clientHeight,
            document: document.documentElement.scrollHeight - innerHeight,
            horizontal: document.documentElement.scrollWidth - innerWidth,
          };
        }),
      )
      .toEqual({ main: 0, app: 0, document: 0, horizontal: 0 });
  }
  async function choose(position: number) {
    await host.getByRole("button", { name: "Rodada", exact: true }).click();
    const switcher = host.getByRole("button", {
      name: "Tabuleiro",
      exact: true,
    });
    if (await switcher.isVisible()) await switcher.click();
    const tile = host.getByRole("button", {
      name: `Posição ${position}`,
      exact: true,
    });
    for (let i = 0; i < 22 && !(await tile.isVisible()); i++)
      await host
        .getByRole("button", { name: "Próximas posições", exact: true })
        .click();
    await tile.click();
    await expect(
      host.getByRole("button", { name: "Confirmar revelação", exact: true }),
    ).toBeVisible();
    await noScroll(host);
    await host
      .getByRole("button", { name: "Confirmar revelação", exact: true })
      .click();
  }
  const soundCount = (p: Page) =>
    p.evaluate(() => (window as unknown as { qaAudio: number }).qaAudio);
  const report: unknown[] = [];
  try {
    await host.goto("/jogar");
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    await host.getByLabel("Escolha seu apelido").fill("QA Organizador");
    await host.getByRole("button", { name: "Ativar som", exact: true }).click();
    await host.getByRole("button", { name: /^Criar uma sala/ }).click();
    const code = await host.locator(".room-code strong").innerText();
    room = new URL(host.url()).pathname.split("/").pop()!;
    const names = ["QA Ana", "QA Bruno", "QA Carla"];
    await Promise.all(
      rest.map(async (p, i) => {
        await p.goto(`/?codigo=${code}${i >= 3 ? "&telao=1" : ""}`);
        if (i < 3) await p.getByLabel("Escolha seu apelido").fill(names[i]);
        await p.getByRole("button", { name: "Entrar", exact: true }).click();
        await expect(p).toHaveURL(/\/sala\//);
      }),
    );
    await host.getByLabel("Rodadas", { exact: true }).fill("1");
    await host.getByLabel("Tamanho da pergunta").selectOption("22");
    await host
      .getByRole("button", { name: "Preparar e iniciar", exact: true })
      .click();
    await expect(host.locator(".host-workspace")).toBeVisible();
    await rest[3]
      .getByRole("button", { name: "Ativar som", exact: true })
      .click();
    for (const [width, height] of sizes) {
      await host.setViewportSize({ width, height });
      await noScroll(host);
      // Let responsive measurement and web fonts settle before inspecting pages.
      await host.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      const seen = new Set<number>();
      await expect
        .poll(async () => host.locator(".board-fit .tile").count())
        .toBeGreaterThan(0);
      for (let p = 0; p < 22; p++) {
        for (const label of await host
          .locator(".board-fit .tile")
          .evaluateAll((tiles) =>
            tiles.map((t) => t.getAttribute("aria-label")!),
          ))
          seen.add(Number(label.match(/Posição (\d+)/)![1]));
        const next = host.getByRole("button", {
          name: "Próximas posições",
          exact: true,
        });
        if (await next.isDisabled()) break;
        await next.click();
      }
      expect(seen.size).toBe(22);
      await host.getByRole("button", { name: "Placar", exact: true }).click();
      await noScroll(host);
      await host.getByRole("button", { name: "Ajustes", exact: true }).click();
      await noScroll(host);
      await host.getByRole("button", { name: "Rodada", exact: true }).click();
      await noScroll(host);
      await host.screenshot({
        path: `${out}/host-board-${width}x${height}.png`,
      });
    }
    await host.setViewportSize({ width: 390, height: 844 });
    await host
      .getByRole("button", { name: "Resposta secreta", exact: true })
      .click();
    await expect(host.getByRole("dialog")).toBeVisible();
    await host
      .getByRole("button", { name: "Fechar consulta", exact: true })
      .click();
    await choose(22);
    const current = (await state()).game.players[(await state()).game.current]
      .nickname;
    await host
      .getByRole("button", { name: "Registrar um palpite falado", exact: true })
      .click();
    await host.setViewportSize({ width: 390, height: 500 });
    const spokenInput = host.getByLabel(`Palpite de ${current}`, {
      exact: true,
    });
    await spokenInput.fill("QA teclado simulado");
    for (const control of [
      spokenInput,
      host.getByRole("button", { name: "Comparar palpite", exact: true }),
    ]) {
      const box = await control.boundingBox();
      if (!box) throw new Error("Controle fora da tela");
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(500);
    }
    await host.getByRole("button", { name: "Voltar", exact: true }).click();
    await host.setViewportSize({ width: 390, height: 844 });
    const player = rest[names.indexOf(current)];
    const other = rest[names.indexOf(current) === 0 ? 1 : 0];
    await expect(
      player.getByLabel("Seu palpite", { exact: true }),
    ).toBeVisible();
    await expect(other.getByLabel("Seu palpite", { exact: true })).toHaveCount(
      0,
    );
    const beforeHost = await soundCount(host),
      beforeTv = await soundCount(rest[3]);
    const wrongGuess = "QA tentativa visível para todos "
      .repeat(7)
      .slice(0, 200);
    await player.getByLabel("Seu palpite", { exact: true }).fill(wrongGuess);
    await player
      .getByRole("button", { name: "Enviar palpite", exact: true })
      .click();
    for (const p of pages) {
      await expect(
        p.locator('.game-feedback[data-kind="guess"]'),
      ).toContainText("QA tentativa visível para todos");
    }
    await expect.poll(() => soundCount(host)).toBe(beforeHost + 1);
    await expect.poll(() => soundCount(rest[3])).toBe(beforeTv + 1);
    expect(await soundCount(rest[4])).toBe(0);
    await host.screenshot({ path: `${out}/guess-announcement.png` });
    await expect(
      player.getByRole("button", { name: "Enviar palpite", exact: true }),
    ).toHaveCount(0);
    expect((await state()).game.live_guess.text).toBe(wrongGuess);
    await host.setViewportSize({ width: 320, height: 720 });
    await noScroll(host);
    await expect(
      host.getByRole("navigation", { name: "Trechos do palpite" }),
    ).toBeVisible();
    await host.setViewportSize({ width: 390, height: 844 });
    await noScroll(host);
    await host
      .getByRole("button", { name: "Confirmar erro", exact: true })
      .click();
    for (const p of pages)
      await expect(
        p.locator('.game-feedback[data-kind="incorrect"]'),
      ).toContainText("Não foi dessa vez");
    await expect.poll(() => soundCount(host)).toBe(beforeHost + 2);
    await expect.poll(() => soundCount(rest[3])).toBe(beforeTv + 2);
    expect(await soundCount(rest[4])).toBe(0);
    const reduced = rest[1];
    expect(
      await reduced
        .locator(".feedback-card")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await host.screenshot({ path: `${out}/incorrect-feedback.png` });
    await expect(host.locator(".game-feedback")).toHaveCount(0, {
      timeout: 6000,
    });
    const audioAfterError = await soundCount(host);
    await host.reload();
    await expect(host.locator(".host-workspace")).toBeVisible();
    await expect(host.locator(".game-feedback")).toHaveCount(0);
    expect(await soundCount(host)).toBe(0);
    report.push({
      soundEnabledBefore: beforeHost,
      soundContextsAfterError: audioAfterError,
      mutedDisplayContexts: await soundCount(rest[4]),
      reconnectDoesNotReplay: true,
    });
    await choose(3);
    await host
      .getByRole("button", { name: "Registrar um palpite falado", exact: true })
      .click();
    await expect(
      host
        .getByRole("dialog", { name: "Registrar palpite falado" })
        .getByRole("textbox"),
    ).toHaveValue("");
    await host.getByRole("button", { name: "Voltar", exact: true }).click();
    for (const [width, height] of [
      [320, 720],
      [390, 844],
      [1360, 768],
      [1920, 1080],
    ]) {
      await host.setViewportSize({ width, height });
      await noScroll(host);
      await host.screenshot({
        path: `${out}/host-awaiting-${width}x${height}.png`,
      });
    }
    const secondState = await state();
    const second =
      rest[
        names.indexOf(
          secondState.game.players[secondState.game.current].nickname,
        )
      ];
    const answer = (await rpc(host, "host_private_round_snapshot", { room }))
      .answer;
    await second.getByLabel("Seu palpite", { exact: true }).fill(answer);
    await second
      .getByRole("button", { name: "Enviar palpite", exact: true })
      .click();
    await expect(host.locator(".judgement")).toBeVisible();
    await host
      .getByRole("button", { name: "Confirmar acerto", exact: true })
      .click();
    await expect(host.locator(".round-result-overlay")).toBeVisible();
    await expect(host.locator(".round-reward strong")).toHaveText("+21");
    for (const [width, height] of sizes) {
      await host.setViewportSize({ width, height });
      await noScroll(host);
      await host.screenshot({
        path: `${out}/host-result-${width}x${height}.png`,
      });
    }
    await expect(host.locator(".game-feedback")).toHaveCount(0, {
      timeout: 6000,
    });
    for (const [p, role] of [
      [host, "host"],
      [rest[0], "player"],
      [rest[3], "tv"],
    ] as const) {
      await p.setViewportSize({ width: 1360, height: 768 });
      await p.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      const axe = await p.evaluate(async () =>
        (
          window as unknown as {
            axe: {
              run: (context: string) => Promise<{ violations: unknown[] }>;
            };
          }
        ).axe.run(".round-result-overlay"),
      );
      report.push({ role, ...axe });
      expect(axe.violations).toEqual([]);
      await p
        .locator(".round-result-overlay")
        .screenshot({ path: `${out}/${role}-result.png` });
    }
    await host
      .getByRole("button", { name: "Avançar rodada / encerrar", exact: true })
      .click();
    await expect(host.locator(".podium")).toBeVisible();
    expect(errors).toEqual([]);
    writeFileSync(
      `${out}/report.json`,
      JSON.stringify(
        {
          environment: "local PGlite; simulated Auth/Realtime",
          errors,
          report,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await runtime.close();
  }
});
