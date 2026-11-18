import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
if (!process.env.SUPABASE_DB_URL)
  throw new Error("Defina SUPABASE_DB_URL para o projeto autorizado.");
const privatePath = process.env.ARRISCAI_PRIVATE_SEED_SQL;
if (!privatePath || !isAbsolute(privatePath))
  throw new Error(
    "O catálogo vive no banco. Para importação administrativa, informe ARRISCAI_PRIVATE_SEED_SQL fora do repositório.",
  );
const source = realpathSync(privatePath);
const fromRoot = relative(realpathSync(process.cwd()), source);
if (
  fromRoot !== ".." &&
  !fromRoot.startsWith(`..${sep}`) &&
  !isAbsolute(fromRoot)
)
  throw new Error(
    "Não mantenha payloads privados de catálogo dentro do repositório.",
  );
const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1"], {
  input: readFileSync(source),
  env: { ...process.env, PGDATABASE: process.env.SUPABASE_DB_URL },
  stdio: ["pipe", "inherit", "inherit"],
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
