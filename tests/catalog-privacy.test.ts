import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import fingerprints from "./fixtures/catalog-fingerprints.json";

it("não distribui enunciados do catálogo em arquivos públicos do projeto", () => {
  const files = [
    ...new Set(
      execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
        encoding: "utf8",
      })
        .trim()
        .split(/\r?\n/),
    ),
  ].filter((file) => existsSync(file));
  const expected = new Set(fingerprints.map((item) => item.sha256));
  const sizes = [...new Set(fingerprints.map((item) => item.words))];
  const leaks: string[] = [];
  for (const file of files) {
    if (
      !/\.(?:md|csv|txt|json|sql|[cm]?[jt]sx?|html)$/.test(file) ||
      file === "package-lock.json" ||
      file.endsWith("catalog-fingerprints.json")
    )
      continue;
    const text = readFileSync(file, "utf8")
      .normalize("NFC")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    const words = text.split(/\s+/);
    let found = false;
    for (const size of sizes) {
      for (let start = 0; start + size <= words.length; start++) {
        const digest = createHash("sha256")
          .update(words.slice(start, start + size).join(" "))
          .digest("hex");
        if (expected.has(digest)) {
          leaks.push(file);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  expect(leaks).toEqual([]);
  expect(files.filter((file) => /^data\/perguntas_/.test(file))).toEqual([]);
  expect(
    files.filter((file) => /^docs\/.*\.(?:png|jpe?g|webm|html)$/i.test(file)),
  ).toEqual([]);
  // Full-repository hashing grows with source size; keep every fingerprint check.
}, 15000);

it("recusa importar payloads privados armazenados no repositório", () => {
  const result = spawnSync(process.execPath, ["scripts/seed.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_DB_URL: "postgresql://qa.invalid/test",
      ARRISCAI_PRIVATE_SEED_SQL: resolve(
        "tests/fixtures/catalog-fingerprints.json",
      ),
    },
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Não mantenha payloads privados");
});
