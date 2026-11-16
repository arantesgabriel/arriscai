// Phase 0 only: UI-driven production inspection. No mocks, RPC calls or app changes.
import { chromium, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 25000 });
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
const root = "docs/v4-oficial";
const origin = "http://127.0.0.1:3018";
const expectedRef = "ksouiyjszsfrqrurpepq";
const html = await (await fetch(origin + "/jogar")).text();
const paths = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
const bundles = await Promise.all(
  paths.map((p) => fetch(new URL(p, origin)).then((r) => r.text())),
);
const refs = [
  ...new Set(
    bundles.flatMap((b) =>
      [
        ...b.matchAll(
          /createClient\)[\s\S]{0,10}https:\/\/([a-z0-9]+)\.supabase\.co/g,
        ),
      ].map((m) => m[1]),
    ),
  ),
];
if (refs.length !== 1 || refs[0] !== expectedRef)
  throw new Error("Staging bundle guard failed: " + JSON.stringify(refs));
await mkdir(`${root}/capturas`, { recursive: true });
const browser = await chromium.launch();
const sizes = [
  [320, 720],
  [390, 844],
  [768, 1024],
  [1360, 768],
  [1440, 900],
  [1920, 1080],
];
const contexts = [];
const sessions = new Map();
await mkdir(".tmp/v4-oficial/sessions", { recursive: true });
const report = {
  date: new Date().toISOString(),
  origin,
  backend: expectedRef,
  screenshots: [],
  checks: [],
  errors: [],
  consoleErrors: [],
};
async function session(name) {
  const statePath = `.tmp/v4-oficial/sessions/${name}.json`;
  const saved = await access(statePath).then(
    () => true,
    () => false,
  );
  const context = await browser.newContext({
    ...(saved ? { storageState: statePath } : {}),
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: ".tmp/v4-oficial/videos",
      size: { width: 1440, height: 900 },
    },
  });
  sessions.set(context, statePath);
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push({ name, message: e.message }));
  page.on("requestfailed", (r) =>
    console.log(
      "REQUEST FAILED",
      name,
      new URL(r.url()).pathname,
      r.failure()?.errorText,
    ),
  );
  page.on("response", (r) => {
    if (
      r.url().includes("supabase.co") &&
      new URL(r.url()).pathname.startsWith("/auth/")
    )
      console.log("AUTH", name, r.status(), new URL(r.url()).pathname);
  });
  page.on("console", (e) => {
    if (e.type() === "error")
      report.consoleErrors.push({ name, message: e.text() });
  });
  page.setDefaultTimeout(25000);
  return page;
}
async function shot(page, name, fullPage = true) {
  if (await page.locator(".app[data-ready=true]").count())
    await page.context().storageState({ path: sessions.get(page.context()) });
  await page.screenshot({
    path: `${root}/capturas/${name}.jpg`,
    fullPage,
    type: "jpeg",
    quality: 75,
  });
  report.screenshots.push(name);
  report.checks.push({
    name,
    ...(await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      font: getComputedStyle(document.querySelector(".app") || document.body)
        .fontFamily,
    }))),
  });
  console.log("CAPTURE", name);
}
async function matrix(page, name) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await shot(page, `${name}-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function join(page, code, name, screen = false) {
  await page.goto(`${origin}/?codigo=${code}${screen ? "&telao=1" : ""}`);
  if (!screen) await page.getByLabel("Como a galera te chama?").fill(name);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Junte a galera." }),
  ).toBeVisible();
}
try {
  const host = await session("host"),
    p1 = await session("p1"),
    p2 = await session("p2"),
    p3 = await session("p3"),
    tv = await session("tv");
  const players = [host, p1, p2, p3];
  if (process.argv.includes("--resume-final")) {
    const previous = JSON.parse(
      await readFile(`${root}/resultados.json`, "utf8"),
    );
    Object.assign(report, previous, {
      resumedAt: new Date().toISOString(),
      previousAssertionFailure: previous.failure,
    });
    delete report.failure;
    for (const [i, p] of [host, p1, p2, p3, tv].entries()) {
      await p.goto(previous.roomUrl + (i === 4 ? "?telao=1" : ""));
      await expect(p.locator(".board .tile").first()).toBeVisible();
    }
    report.newMatchWordCount = await p1.locator(".board .tile").count();
    await shot(host, "nova-partida-host");
    await host.emulateMedia({ reducedMotion: "reduce" });
    await host.getByRole("button", { name: "Posição 1", exact: true }).focus();
    await host.keyboard.press("Space");
    await expect(
      host.getByRole("button", { name: "Confirmar revelação" }),
    ).toBeVisible();
    await shot(host, "teclado-selecao-reduced-motion");
    await host.getByRole("button", { name: "Cancelar seleção" }).click();
    await host.setViewportSize({ width: 720, height: 450 });
    await shot(host, "reflow-equivalente-200");
    report.completed = true;
  } else {
    await host.goto(report.origin);
    await expect(host.locator(".landing-v4")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await matrix(host, "landing");
    report.landingFonts = await host
      .locator("h1")
      .evaluate((el) => ({
        title: getComputedStyle(el).fontFamily,
        body: getComputedStyle(el.closest(".landing-v4")).fontFamily,
      }));
    await host.bringToFront();
    await host.goto(`${report.origin}/jogar`);
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    await matrix(host, "entrada");
    await host.getByRole("button", { name: "Entrar na conta" }).click();
    await shot(host, "conta-desktop");
    await host.getByRole("button", { name: "Esqueci minha senha" }).click();
    await shot(host, "recuperacao-desktop");
    await host.getByRole("button", { name: "Fechar", exact: true }).click();
    await host.getByLabel("Como a galera te chama?").fill("QA V4 Host");
    await host.getByRole("button", { name: "Criar uma sala" }).click();
    await expect(
      host.getByRole("heading", { name: "Junte a galera." }),
    ).toBeVisible();
    const code = await host.locator(".room-code strong").innerText();
    report.roomCode = code;
    report.roomUrl = host.url();
    console.log("ROOM", code);
    await join(p1, code, "QA V4 Bia");
    await join(p2, code, "QA V4 Caio");
    await join(p3, code, "QA V4 Davi");
    await join(tv, code, "", true);
    await expect(host.locator(".members li")).toHaveCount(5);
    await matrix(host, "lobby-host");
    await shot(p1, "lobby-jogador");
    await tv.setViewportSize({ width: 1920, height: 1080 });
    await shot(tv, "lobby-telao");
    await host.getByLabel("Seleção").selectOption("manual");
    await shot(host, "biblioteca-desktop");
    await host
      .getByPlaceholder("Digite trecho da pergunta ou categoria...")
      .fill("Tour de France");
    await shot(host, "biblioteca-busca");
    await host
      .getByPlaceholder("Digite trecho da pergunta ou categoria...")
      .fill("");
    await host.getByLabel("Seleção").selectOption("automatic");
    await host.getByRole("button", { name: "Sortear organizador" }).click();
    await shot(p1, "roleta-em-curso");
    await expect(p1.locator(".wheel-announcement")).toContainText(
      "foi sorteado",
      { timeout: 20000 },
    );
    await shot(p1, "roleta-resultado");
    let operator;
    for (const p of players)
      if (
        await p
          .getByRole("button", { name: "Sortear organizador", exact: true })
          .count()
      )
        operator = p;
    await operator
      .getByRole("combobox", { name: "Escolher organizador" })
      .selectOption({ label: "QA V4 Host" });
    await expect(
      host.getByRole("button", { name: "Preparar e iniciar" }),
    ).toBeVisible();
    await host.getByLabel("Rodadas", { exact: true }).fill("2");
    await host.getByLabel("Tamanho da pergunta").selectOption("22");
    await host.getByRole("button", { name: "Preparar e iniciar" }).click();
    await expect(host.locator(".board .tile")).toHaveCount(22);
    await matrix(host, "rodada-host");
    await matrix(p1, "rodada-jogador");
    await shot(tv, "rodada-telao");
    for (const p of [p1, p2, p3, tv]) {
      expect(await p.locator(".private").count()).toBe(0);
      expect(await p.locator(".controls").count()).toBe(0);
    }
    report.checks.push({ name: "public-private-separation", passed: true });
    await host.getByRole("button", { name: "Posição 6", exact: true }).click();
    await expect(
      p1.getByText("Posição 6 selecionada. Aguardando confirmação."),
    ).toBeVisible();
    await shot(host, "selecao-host");
    await shot(tv, "selecao-telao");
    await host.getByRole("button", { name: "Confirmar revelação" }).click();
    for (const p of [p1, p2, p3, tv])
      await expect(p.locator(".tile.revealed")).toHaveCount(1);
    await shot(host, "palpite-host");
    await shot(tv, "revelacao-telao");
    await host.setViewportSize({ width: 390, height: 844 });
    await host.getByLabel(/Palpite de/).fill("palpite incorreto de auditoria");
    await shot(host, "palpite-mobile");
    await host.setViewportSize({ width: 320, height: 720 });
    await shot(host, "palpite-320");
    await host.setViewportSize({ width: 390, height: 500 });
    await host.getByLabel(/Palpite de/).focus();
    await shot(host, "palpite-viewport-reduzida");
    await host.setViewportSize({ width: 390, height: 844 });
    await host.getByRole("button", { name: "Comparar palpite" }).click();
    await expect(
      host.getByRole("button", { name: "Confirmar erro" }),
    ).toBeVisible();
    await shot(host, "julgamento-mobile");
    await host.getByRole("button", { name: "Confirmar erro" }).click();
    await expect(
      host.getByRole("button", { name: "Posição 7", exact: true }),
    ).toBeEnabled();
    await shot(host, "erro-mobile");
    await host.locator(".management summary").click();
    await host.getByRole("button", { name: "Pausar", exact: true }).click();
    await expect(p1.locator(".pause-banner")).toBeVisible();
    await shot(host, "pausa-host-mobile");
    await shot(tv, "pausa-telao");
    await host.getByRole("button", { name: "Retomar partida" }).click();
    await p1.context().setOffline(true);
    await shot(p1, "offline-jogador");
    await p1.context().setOffline(false);
    await expect(p1.getByText("Ao vivo", { exact: true })).toBeVisible();
    await expect(p1.locator(".tile.revealed")).toHaveCount(1);
    await shot(p1, "reconectado-jogador");
    await host.setViewportSize({ width: 1440, height: 900 });
    await host.getByRole("button", { name: "Posição 7", exact: true }).click();
    await host.getByRole("button", { name: "Confirmar revelação" }).click();
    const answer = await host.locator(".private>strong").innerText();
    await host.getByLabel(/Palpite de/).fill(answer);
    await host.getByRole("button", { name: "Comparar palpite" }).click();
    await shot(host, "julgamento-acerto");
    await host.getByRole("button", { name: "Confirmar acerto" }).click();
    for (const p of [p1, p2, p3, tv])
      await expect(
        p.locator(".round-result-overlay .solution-answer"),
      ).toHaveText(answer);
    await matrix(host, "resultado-host");
    await shot(p1, "resultado-jogador");
    await shot(tv, "resultado-telao");
    await host
      .locator(".round-result-overlay")
      .getByRole("button", { name: "Avançar rodada / encerrar" })
      .click();
    for (let n = 1; n <= 22; n++) {
      await host
        .getByRole("button", { name: `Posição ${n}`, exact: true })
        .click();
      await host.getByRole("button", { name: "Confirmar revelação" }).click();
      await host.getByRole("button", { name: "Jogador desistiu" }).click();
    }
    await expect(host.locator(".round-result-overlay h2")).toHaveText(
      "Ninguém pontuou nesta rodada!",
    );
    await shot(host, "sem-acerto-host");
    await shot(tv, "sem-acerto-telao");
    await host
      .locator(".round-result-overlay")
      .getByRole("button", { name: "Avançar rodada / encerrar" })
      .click();
    await expect(host.locator(".podium")).toBeVisible();
    await matrix(host, "podio-host");
    await shot(tv, "podio-telao");
    await shot(host, "historico-desktop");
    await host.getByLabel("Rodadas", { exact: true }).fill("1");
    await host.getByRole("button", { name: "Iniciar nova partida" }).click();
    await expect(p1.locator(".board .tile").first()).toBeVisible();
    report.newMatchWordCount = await p1.locator(".board .tile").count();
    await shot(host, "nova-partida-host");
    await host.emulateMedia({ reducedMotion: "reduce" });
    await host.getByRole("button", { name: "Posição 1", exact: true }).focus();
    await host.keyboard.press("Space");
    await expect(
      host.getByRole("button", { name: "Confirmar revelação" }),
    ).toBeVisible();
    await shot(host, "teclado-selecao-reduced-motion");
    await host.getByRole("button", { name: "Cancelar seleção" }).click();
    await host.setViewportSize({ width: 720, height: 450 });
    await shot(host, "reflow-equivalente-200");
    report.completed = true;
  }
} catch (e) {
  process.exitCode = 1;
  report.failure = e.stack;
  console.error(e);
  try {
    for (let i = 0; i < contexts.length; i++) {
      const p = contexts[i].pages()[0];
      await shot(p, `failure-${i}`);
      console.log(i, (await p.locator("body").innerText()).slice(0, 2500));
    }
  } catch {}
} finally {
  await writeFile(`${root}/resultados.json`, JSON.stringify(report, null, 2));
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
}
