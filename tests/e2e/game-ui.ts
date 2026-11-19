import { expect, type Page } from "@playwright/test";

export async function selectPosition(page: Page, position: number) {
  const round = page.getByRole("button", { name: "Rodada", exact: true });
  if (await round.count()) await round.click();
  const board = page.getByRole("button", { name: "Tabuleiro", exact: true });
  if (await board.isVisible()) await board.click();
  const tile = page.getByRole("button", {
    name: `Posição ${position}`,
    exact: true,
  });
  for (let i = 0; i < 22 && !(await tile.isVisible()); i++) {
    const labels = await page
      .locator(".board-fit .tile")
      .evaluateAll((items) =>
        items.map((el) =>
          Number(el.getAttribute("aria-label")?.match(/Posição (\d+)/)?.[1]),
        ),
      );
    const direction =
      position < Math.min(...labels)
        ? "Posições anteriores"
        : "Próximas posições";
    await page.getByRole("button", { name: direction, exact: true }).click();
  }
  await expect(tile).toBeVisible();
  await tile.click();
}

export async function openSpokenGuess(page: Page) {
  await page
    .getByRole("button", { name: "Registrar um palpite falado", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Registrar palpite falado", exact: true }),
  ).toBeVisible();
}
