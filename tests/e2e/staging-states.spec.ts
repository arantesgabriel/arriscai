import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { assertStagingFrontend } from "./staging-guard";

test("staging: identidade, roleta, reconexão e apelido duplicado", async ({
  browser,
}) => {
  test.skip(
    process.env.ARRISCAI_LIVE_E2E !== "1",
    "Requer Supabase dev hospedado.",
  );
  test.setTimeout(180000);
  await assertStagingFrontend();

  const contexts = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      browser.newContext(i === 4 ? { reducedMotion: "reduce" } : {}),
    ),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [host, first, second, third, tv, duplicate] = pages;
  const errors: string[] = [];
  for (const page of pages)
    page.on("pageerror", (error) => errors.push(error.message));
  const shotDir = ".tmp/qa-evidence/states";
  mkdirSync(shotDir, { recursive: true });

  async function join(
    page: Page,
    code: string,
    nickname: string,
    screen = false,
  ) {
    await page.goto(`/?codigo=${code}${screen ? "&telao=1" : ""}`);
    if (!screen)
      await page.getByLabel("Como a galera te chama?").fill(nickname);
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
  }
  async function currentHost() {
    const candidates = [host, first, second, third, duplicate];
    await expect
      .poll(async () => {
        const count = await Promise.all(
          candidates.map((p) =>
            p
              .getByRole("button", {
                name: "Sortear organizador",
                includeHidden: true,
              })
              .count(),
          ),
        );
        return count.reduce((sum, n) => sum + n, 0);
      })
      .toBe(1);
    for (const candidate of candidates)
      if (
        await candidate
          .getByRole("button", {
            name: "Sortear organizador",
            includeHidden: true,
          })
          .count()
      ) {
        if (
          (await candidate
            .locator(".organizer-options")
            .getAttribute("open")) === null
        )
          await candidate.locator(".organizer-options > summary").click();
        return candidate;
      }
    throw new Error("Organizador não encontrado");
  }

  try {
    await host.goto("/jogar");
    await expect(host.locator(".app")).toHaveAttribute("data-ready", "true");
    await host.getByLabel("Como a galera te chama?").fill("QA-Organizador-R");
    await host.getByRole("button", { name: "Criar uma sala" }).click();
    await expect(
      host.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
    const code = await host.locator(".room-code strong").innerText();

    let signups = 0;
    await contexts[1].route("**/auth/v1/signup", async (route) => {
      signups += 1;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await first.goto(`/?codigo=${code}`);
    await first.getByLabel("Como a galera te chama?").fill("QA-Jogador-1");
    await expect(
      first.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeDisabled();
    await expect(
      first.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeEnabled();
    await first.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      first.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
    expect(signups).toBe(1);
    const firstUid = await first.evaluate(
      () =>
        JSON.parse(localStorage.getItem("arriscai-auth")!).user.id as string,
    );
    const membershipUid = await host.evaluate(
      async ({ code, url, key }) => {
        const room = location.pathname.split("/").pop();
        const session = JSON.parse(localStorage.getItem("arriscai-auth")!);
        const response = await fetch(
          `${url}/rest/v1/rpc/public_room_snapshot`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ room }),
          },
        );
        if (!response.ok)
          throw new Error(`Snapshot ${response.status} da sala ${code}`);
        const snapshot = await response.json();
        return snapshot.members.find(
          (member: { nickname: string }) => member.nickname === "QA-Jogador-1",
        )?.user_id;
      },
      {
        code,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      },
    );
    expect(membershipUid).toBe(firstUid);
    await first.reload();
    await expect(
      first.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
    expect(
      await first.evaluate(
        () => JSON.parse(localStorage.getItem("arriscai-auth")!).user.id,
      ),
    ).toBe(firstUid);

    await join(second, code, "QA-Jogador-2");
    await join(third, code, "QA-Jogador-3");
    await join(tv, code, "Telão", true);
    await duplicate.goto(`/?codigo=${code}`);
    await duplicate.getByLabel("Como a galera te chama?").fill("QA-Jogador-1");
    await expect(
      duplicate.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeEnabled();
    await duplicate
      .getByRole("button", { name: "Entrar", exact: true })
      .click();
    await expect(duplicate.locator(".error[role=alert]")).toContainText(
      "Esse apelido já está em uso nesta sala. Escolha outro.",
    );
    await expect(duplicate.getByLabel("Como a galera te chama?")).toBeFocused();
    await duplicate.getByLabel("Como a galera te chama?").fill("QA-Jogador-4");
    await expect(host.locator(".members li")).toHaveCount(5);

    const members = await host.locator(".members li").allInnerTexts();
    expect(members.some((member) => member.includes("QA-Jogador-1"))).toBe(
      true,
    );
    const firstSpinHost = await currentHost();
    await firstSpinHost
      .getByRole("button", { name: "Sortear organizador" })
      .click();
    await expect(first.locator(".wheel-disc.spinning")).toBeVisible();
    await duplicate
      .getByRole("button", { name: "Entrar", exact: true })
      .click();
    await expect(
      duplicate.getByRole("heading", { name: "Junte a galera.", exact: true }),
    ).toBeVisible();
    await expect(host.locator(".members li")).toHaveCount(6);
    await expect(tv.locator(".wheel-announcement")).toContainText(
      "foi sorteado(a)",
    );
    await expect(tv.locator(".wheel-announcement")).toBeVisible();
    await firstSpinHost.getByRole("button", { name: "Som desligado" }).click();
    await firstSpinHost.getByLabel("Volume").press("ArrowRight");
    for (const page of [host, first, second, third, tv, duplicate]) {
      await expect(page.locator(".wheel-disc.spinning")).toHaveCount(0);
      await expect(page.locator(".wheel-announcement")).toContainText(
        "foi sorteado(a)",
      );
    }
    await tv.setViewportSize({ width: 1920, height: 900 });
    await tv.screenshot({ path: `${shotDir}/roulette-first-tv-1920x900.png` });

    const secondSpinHost = await currentHost();
    await secondSpinHost
      .getByRole("button", { name: "Sortear organizador" })
      .click();
    await expect(secondSpinHost.locator(".wheel-disc.spinning")).toBeVisible();
    await secondSpinHost
      .getByRole("button", { name: /Som (ligado|desligado)/ })
      .click();
    await expect(secondSpinHost.locator(".wheel-disc.spinning")).toHaveCount(0);
    await expect(secondSpinHost.locator(".wheel-announcement")).toContainText(
      "foi sorteado(a)",
    );

    await contexts[2].setOffline(true);
    await expect(second.getByText(/Reconectando/)).toBeVisible({
      timeout: 25000,
    });
    await contexts[2].setOffline(false);
    await expect(second.getByText("Ao vivo", { exact: true })).toBeVisible({
      timeout: 25000,
    });
    const activeHost = await currentHost();
    await activeHost
      .getByRole("combobox", { name: "Escolher organizador" })
      .selectOption({
        label: activeHost === first ? "QA-Jogador-3" : "QA-Jogador-1",
      });
    await expect(second.locator(".wheel-announcement")).toContainText(
      "assumiu a organização",
    );
    await second.screenshot({ path: `${shotDir}/reconnected-player.png` });
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
